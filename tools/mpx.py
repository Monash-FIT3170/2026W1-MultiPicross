#!/usr/bin/env python3
"""Operate a deployed MultiPicross environment.

Wraps the docker buildx, gcloud and psql invocations that a rollout needs, so
they stop being copy-pasted one-liners. Standard library only, no install step.

  ./tools/mpx.py --env qa deploy
  ./tools/mpx.py --env qa reboot --deploy
  ./tools/mpx.py --env qa secrets push --file qa-secrets.env
  ./tools/mpx.py --env qa logs --since 5m
"""

from __future__ import annotations

import argparse
import base64
import json
import shlex
import subprocess
import sys
import time
from pathlib import Path
from typing import NoReturn

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "tools" / "environments.json"
APP_DIR = "/opt/multipicross"
COMPOSE = f"{APP_DIR}/compose.gcp.yaml"
SERVICES = ("api", "gameserver", "frontend")


REQUIRED_KEYS = ("project", "zone", "region", "domain")


class Env:
    def __init__(self, name: str, section: dict) -> None:
        missing = [k for k in REQUIRED_KEYS if not section.get(k)]
        if missing:
            die(f'"{name}" in {CONFIG} is missing: {", ".join(missing)}')
        self.name = name
        self.project = section["project"]
        self.zone = section["zone"]
        self.region = section["region"]
        self.instance = section.get("instance", "multipicross-app")
        self.domain = section["domain"]
        self.ar_host = f"{self.region}-docker.pkg.dev"

    def image(self, service: str, tag: str) -> str:
        return f"{self.ar_host}/{self.project}/multipicross/{service}:{tag}"


def load_env(name: str) -> Env:
    if not CONFIG.exists():
        die(
            f"{CONFIG} not found. Copy tools/environments.example.json to it and fill in your projects."
        )
    try:
        config = json.loads(CONFIG.read_text())
    except json.JSONDecodeError as err:
        die(f"{CONFIG} is not valid JSON: {err}")
    if name not in config:
        die(f'No "{name}" in {CONFIG}. Found: {", ".join(config)}')
    return Env(name, config[name])


def die(message: str) -> NoReturn:
    print(f"error: {message}", file=sys.stderr)
    raise SystemExit(1)


def run(cmd: list[str], *, dry: bool, stdin: bytes | None = None) -> None:
    print(f"$ {shlex.join(cmd)}", file=sys.stderr)
    if dry:
        return
    result = subprocess.run(cmd, input=stdin)
    if result.returncode != 0:
        raise SystemExit(result.returncode)


def capture(cmd: list[str]) -> str:
    return subprocess.run(
        cmd, check=True, capture_output=True, text=True
    ).stdout.strip()


def git_head() -> str:
    return capture(["git", "-C", str(ROOT), "rev-parse", "HEAD"])


def ssh(env: Env, remote: str, *, dry: bool) -> None:
    run(
        [
            "gcloud",
            "compute",
            "ssh",
            env.instance,
            f"--project={env.project}",
            f"--zone={env.zone}",
            "--tunnel-through-iap",
            "--quiet",
            "--strict-host-key-checking=no",
            f"--command={remote}",
        ],
        dry=dry,
    )


def psql(env: Env, sql: str, *, dry: bool) -> None:
    inner = f'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c {shlex.quote(sql)}'
    ssh(
        env,
        f"sudo docker compose -f {COMPOSE} exec -T db sh -c {shlex.quote(inner)}",
        dry=dry,
    )


def confirm(prompt: str, expected: str) -> None:
    print(prompt)
    if input(f"Type {expected!r} to continue: ").strip() != expected:
        die("aborted")


# matches the secret_id transform in infra/secrets.tf and infra/files/deploy.sh
def secret_id(name: str) -> str:
    return "multipicross-" + name.lower().replace("_", "-")


def cmd_build(args, env: Env) -> None:
    tag = args.tag or git_head()
    services = [args.service] if args.service else list(SERVICES)
    run(
        ["gcloud", "auth", "configure-docker", env.ar_host, "--quiet"], dry=args.dry_run
    )
    for service in services:
        run(
            [
                "docker",
                "buildx",
                "build",
                # amd64 is not optional on an Apple Silicon machine: a native
                # arm64 image pushes fine and then dies with exec format error.
                "--platform",
                "linux/amd64",
                "--target",
                "prod",
                "-t",
                env.image(service, tag),
                "--push",
                str(ROOT / service),
            ],
            dry=args.dry_run,
        )
    print(f"built {', '.join(services)} at {tag}")


def cmd_deploy(args, env: Env) -> None:
    tag = args.tag or git_head()
    if not args.skip_build:
        # Always all three: deploy.sh pulls every service at one tag, so a
        # partial build leaves the others pointing at an image that isn't there.
        cmd_build(
            argparse.Namespace(**{**vars(args), "tag": tag, "service": None}), env
        )
    # Encoded here rather than by base64(1), whose line-wrapping flags differ
    # between macOS and GNU and silently produce an unusable blob.
    blob = base64.b64encode((ROOT / "compose.gcp.yaml").read_bytes()).decode()
    ssh(env, f"sudo {APP_DIR}/deploy.sh {tag} {blob}", dry=args.dry_run)


def cmd_secrets_push(args, env: Env) -> None:
    path = Path(args.file)
    if not path.exists():
        die(f"{path} not found")
    entries: list[tuple[str, bytes]] = []
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        if args.only and key not in args.only:
            continue
        # Values are sent verbatim with no trailing newline. A newline here
        # reaches the provider as part of the secret and reads as a bad credential.
        entries.append((key, value.strip().strip("\"'").encode()))
    if not entries:
        die(f"no usable KEY=VALUE lines in {path}")
    print(f"Pushing {len(entries)} secret(s) to {env.project}:")
    for key, _ in entries:
        print(f"  {key} -> {secret_id(key)}")
    if not args.yes:
        confirm("This adds a new enabled version to each.", env.name)
    for key, value in entries:
        run(
            [
                "gcloud",
                "secrets",
                "versions",
                "add",
                secret_id(key),
                "--data-file=-",
                f"--project={env.project}",
            ],
            dry=args.dry_run,
            stdin=value,
        )


def cmd_secrets_list(args, env: Env) -> None:
    run(
        [
            "gcloud",
            "secrets",
            "list",
            f"--project={env.project}",
            "--format=table(name,createTime)",
        ],
        dry=args.dry_run,
    )


def cmd_db_drop(args, env: Env) -> None:
    if not args.yes:
        confirm(
            f"This DESTROYS every table and row in {env.name} ({env.project}).",
            env.project,
        )
    ssh(env, f"sudo docker compose -f {COMPOSE} stop api", dry=args.dry_run)
    # The drizzle schema holds the applied-migration ledger. Leaving it behind
    # makes the next boot skip 0000 and rebuild only half the schema.
    psql(
        env,
        "DROP SCHEMA public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;",
        dry=args.dry_run,
    )
    ssh(env, f"sudo docker compose -f {COMPOSE} start api", dry=args.dry_run)


def cmd_db_psql(args, env: Env) -> None:
    inner = 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
    ssh(
        env,
        f"sudo docker compose -f {COMPOSE} exec db sh -c {shlex.quote(inner)}",
        dry=args.dry_run,
    )


def cmd_logs(args, env: Env) -> None:
    service = args.service or ""
    ssh(
        env,
        f"sudo docker compose -f {COMPOSE} logs --since {shlex.quote(args.since)} {service}".strip(),
        dry=args.dry_run,
    )


def cmd_status(args, env: Env) -> None:
    ssh(env, f"sudo docker compose -f {COMPOSE} ps", dry=args.dry_run)
    run(["curl", "-fsS", f"https://{env.domain}/api/health"], dry=args.dry_run)


def cmd_snapshots(args, env: Env) -> None:
    run(
        [
            "gcloud",
            "compute",
            "snapshots",
            "list",
            f"--project={env.project}",
            "--format=table(name,diskSizeGb,creationTimestamp)",
        ],
        dry=args.dry_run,
    )


def instance_status(env: Env) -> str:
    return capture(
        [
            "gcloud",
            "compute",
            "instances",
            "describe",
            env.instance,
            f"--project={env.project}",
            f"--zone={env.zone}",
            "--format=value(status)",
        ]
    )


def wait_for_status(env: Env, target: str, *, dry: bool, timeout: int = 300) -> None:
    if dry:
        print(f"(would wait for {target})", file=sys.stderr)
        return
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        current = instance_status(env)
        if current == target:
            return
        print(f"  {current}", file=sys.stderr)
        time.sleep(5)
    die(f"{env.instance} did not reach {target} within {timeout}s")


def wait_for_ssh(env: Env, *, dry: bool, timeout: int = 300) -> None:
    if dry:
        print("(would wait for ssh)", file=sys.stderr)
        return
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        probe = subprocess.run(
            [
                "gcloud",
                "compute",
                "ssh",
                env.instance,
                f"--project={env.project}",
                f"--zone={env.zone}",
                "--tunnel-through-iap",
                "--quiet",
                "--strict-host-key-checking=no",
                "--command=true",
            ],
            capture_output=True,
        )
        if probe.returncode == 0:
            return
        print("  waiting for ssh", file=sys.stderr)
        time.sleep(10)
    die(f"{env.instance} never became reachable over ssh within {timeout}s")


def cmd_reboot(args, env: Env) -> None:
    if not args.yes:
        confirm(
            f"Reboots {env.instance} in {env.name} ({env.project}). The site is down for a minute or two.",
            env.name,
        )
    # stop/start, never `instances reset`, which is a hard power cut with
    # Postgres mid-write on the data disk.
    for action, target in (("stop", "TERMINATED"), ("start", "RUNNING")):
        run(
            [
                "gcloud",
                "compute",
                "instances",
                action,
                env.instance,
                f"--project={env.project}",
                f"--zone={env.zone}",
                "--quiet",
            ],
            dry=args.dry_run,
        )
        wait_for_status(env, target, dry=args.dry_run)
    wait_for_ssh(env, dry=args.dry_run)

    # Rewritten on every boot, so it is the only proof changed tfvars reached the machine.
    ssh(env, f"cat {APP_DIR}/host.env", dry=args.dry_run)

    if args.deploy:
        cmd_deploy(args, env)
    else:
        print(
            "\nContainers restarted with the .env from the last deploy. Run `deploy` "
            "to rebuild it from the host.env above.",
            file=sys.stderr,
        )


def cmd_ssh(args, env: Env) -> None:
    if args.command:
        ssh(env, args.command, dry=args.dry_run)
        return
    run(
        [
            "gcloud",
            "compute",
            "ssh",
            env.instance,
            f"--project={env.project}",
            f"--zone={env.zone}",
            "--tunnel-through-iap",
        ],
        dry=args.dry_run,
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="mpx", description=__doc__)
    parser.add_argument("--env", required=True, help="key in environments.json")
    parser.add_argument(
        "--dry-run", action="store_true", help="print commands without running them"
    )
    sub = parser.add_subparsers(dest="command", required=True)

    build = sub.add_parser("build", help="build and push images")
    build.add_argument("--tag", help="image tag, defaults to git HEAD")
    build.add_argument("--service", choices=SERVICES)
    build.set_defaults(func=cmd_build)

    deploy = sub.add_parser("deploy", help="build, push and roll out")
    deploy.add_argument("--tag", help="image tag, defaults to git HEAD")
    deploy.add_argument(
        "--skip-build", action="store_true", help="roll out an existing tag"
    )
    deploy.set_defaults(func=cmd_deploy)

    secrets = sub.add_parser("secrets", help="manage Secret Manager values")
    secrets_sub = secrets.add_subparsers(dest="secrets_command", required=True)
    push = secrets_sub.add_parser("push", help="add a version per KEY=VALUE line")
    push.add_argument("--file", required=True, help="env-format file of secrets")
    push.add_argument("--only", nargs="*", help="push just these keys")
    push.add_argument("--yes", action="store_true")
    push.set_defaults(func=cmd_secrets_push)
    listing = secrets_sub.add_parser("list")
    listing.set_defaults(func=cmd_secrets_list)

    db = sub.add_parser("db", help="database operations")
    db_sub = db.add_subparsers(dest="db_command", required=True)
    drop = db_sub.add_parser("drop", help="destroy every table, migrations rerun")
    drop.add_argument("--yes", action="store_true")
    drop.set_defaults(func=cmd_db_drop)
    shell = db_sub.add_parser("psql", help="interactive psql shell")
    shell.set_defaults(func=cmd_db_psql)

    logs = sub.add_parser("logs")
    logs.add_argument("--since", default="10m")
    logs.add_argument("--service", choices=SERVICES + ("db", "traefik"))
    logs.set_defaults(func=cmd_logs)

    reboot = sub.add_parser(
        "reboot", help="stop and start the VM so the startup script reruns"
    )
    reboot.add_argument(
        "--deploy",
        action="store_true",
        help="redeploy afterwards, which is what applies the new host.env",
    )
    reboot.add_argument("--tag", help="image tag for --deploy, defaults to git HEAD")
    reboot.add_argument(
        "--skip-build", action="store_true", help="with --deploy, reuse existing images"
    )
    reboot.add_argument("--yes", action="store_true")
    reboot.set_defaults(func=cmd_reboot)

    sub.add_parser("status").set_defaults(func=cmd_status)
    sub.add_parser("snapshots").set_defaults(func=cmd_snapshots)
    shell_cmd = sub.add_parser("ssh", help="interactive shell, or one command")
    shell_cmd.add_argument("--command", help="run this instead of opening a shell")
    shell_cmd.set_defaults(func=cmd_ssh)
    return parser


def main() -> None:
    args = build_parser().parse_args()
    args.func(args, load_env(args.env))


if __name__ == "__main__":
    main()
