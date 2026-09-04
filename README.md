# MultiPicross

MultiPicross is a real-time multiplayer Picross (nonogram) puzzle game developed
for FIT3170 at Monash University.

This document records the information required to assume development and operation of the project.

## Contents

1. [Architecture](#1-architecture)
2. [Requirements](#2-requirements)
3. [Development environment](#3-development-environment)
4. [Authentication](#4-authentication)
5. [Provisioning the production environment](#5-provisioning-the-production-environment)
6. [Deployment and operation](#6-deployment-and-operation)
7. [Team](#7-team)

## 1. Architecture

All services are located on a single origin. In development this origin is `multipicross.localhost` (you may need to add this to your `/etc/hosts` file to access it), and in production it is `multipicross.com`.
Traefik performs routing by path prefix.

Because the frontend and the backend services share an origin, the frontend requests are relative (e.g., `/api/...`), so no CORS configuration is required.

| Service                       | Path                | Internal port |
| ----------------------------- | ------------------- | ------------- |
| Frontend (React, Vite, Nginx) | `/` (SPA catch-all) | 80            |
| API (Hono)                    | `/api`              | 3000          |
| Game server (Colyseus)        | `/gs` (stripped)    | 2567          |

PostgreSQL is shared between the API and the game server.
Dex operates in the development environment only, where it substitutes for the production identity provider.

The system is deployed as a single Docker Compose stack. Production deployment occurs to a single GCP Compute Engine instance.

### 1.1 Repository structure

The repository holds three service directories, alongside the configuration
required to run and deploy them. Each service is containerised with Docker.

| Directory     | Contents                                                                                                                                                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api/`        | The Hono API service. `src/auth` implements the OIDC flow and session handling, `src/db` holds the Drizzle schema and client, `drizzle/` holds the generated migrations, and `imgs/` supplies the puzzle bank imported at startup |
| `gameserver/` | The Colyseus game server, which handles real-time room state                                                                                                                                                                      |
| `frontend/`   | The React/Vite client, served by Nginx in production                                                                                                                                                                              |
| `dev/`        | Configuration for services that exist only in development. At present this is the Dex identity provider at `dev/dex/config.yaml`                                                                                                  |
| `infra/`      | The OpenTofu configuration for the production environment and related resources.                                                                                                                                                  |
| `tools/`      | Operational tooling. `mpx.py` is described in Section 6.2                                                                                                                                                                         |
| `.github/`    | The continuous integration and deployment workflows                                                                                                                                                                               |

| File                    | Purpose                                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `compose.yaml`          | The base stack definition, shared by every local configuration                                                                      |
| `compose.override.yaml` | Development overrides, applied automatically by `docker compose up`. Supplies the development build targets and the published ports |
| `compose.prod.yaml`     | Selects the production build targets, for a production build performed locally                                                      |
| `compose.gcp.yaml`      | The production stack for GCP deployment to a Compute Engine instance. Defined independently of `compose.yaml`                       |
| `.env.example`          | The template for `.env`, which is excluded from source control                                                                      |
| `justfile`              | Task runner recipes, described in Section 3.3                                                                                       |

## 2. Requirements

### 2.1 Software for development

| Tool                           | Purpose                                              |
| ------------------------------ | ---------------------------------------------------- |
| Docker with Compose v2         | All services execute in containers                   |
| git                            | Source control                                       |
| `just` (optional)              | Task runner. Recipes are defined in the `justfile`   |
| Node.js 22 or later (optional) | Required only to run a service outside its container |

The following host ports must be available: 80 (Traefik), 8080 (Traefik
dashboard), 5432 (PostgreSQL), 3001 (API), and 2567 (game server).

### 2.2 Software for deployment

| Tool                  | Purpose                                                         |
| --------------------- | --------------------------------------------------------------- |
| `gcloud` CLI          | Secret Manager access, SSH over IAP, and image publication      |
| OpenTofu 1.7 or later | Infrastructure provisioning. Continuous integration uses 1.12.5 |
| Docker with `buildx`  | Cross-compilation of production images                          |
| Python 3              | Executes `tools/mpx.py`                                         |
| `openssl`             | Generation of random secrets                                    |
| `htpasswd`            | Generation of bcrypt hashes                                     |

Deployment additionally requires a Google Cloud project with billing enabled, administrative control of the domain's DNS records, and an OIDC client registered with an identity provider. Section 4 describes this dependency.

### 2.3 Hardware

The development stack comprises six containers. Ensure a requisite amount of system memory is available. No specific operating system requirement exists, however we do note that deployment images should always be cross-compiled for Linux only (do not push Mac/Windows images to Artifact Registry).

The production environment consists of one `e2-small` instance (2 vCPU, 2 GB
memory) in `australia-southeast1-a`, with a 30 GB boot disk and a separate 10 GB persistent disk for the database.
The per-container memory limits declared in `compose.gcp.yaml` are calibrated to that allocation.
Images are not built on the Compute Engine instance.
Either manually push build images to Artifact Registry, or use the provided GitHub Workflows detailed in section 5.8.

### 2.4 Installing the required software

The commands below install the tools listed in Sections 2.1 and 2.2. Only the
development tools are necessary in order to run the project locally. The
deployment tools are required only by an operator who provisions or releases to
the production environment.

**macOS.** Install Homebrew if it is not already present, then install the
packages.

```bash
# Development
brew install git just node@24
brew install --cask docker # Docker Desktop

# Deployment
brew install opentofu
brew install --cask gcloud-cli
```

Python 3, `openssl`, and `htpasswd` are supplied with macOS and require no
further action. Docker Desktop must be launched once after installation so that
the Docker daemon starts.

**Linux.** `git`, `python3`, `openssl`, and `htpasswd` should be installed from your distribution's package manager. On Debian and Ubuntu, `htpasswd` is provided by
`apache2-utils`.

Docker, the Google Cloud CLI, and OpenTofu are distributed from vendor
repositories rather than distribution ones. Consult the following documentation pages.

| Tool                                  | Instructions                                |
| ------------------------------------- | ------------------------------------------- |
| Docker Engine, Compose v2, and buildx | <https://docs.docker.com/engine/install/>   |
| Google Cloud CLI                      | <https://cloud.google.com/sdk/docs/install> |
| OpenTofu                              | <https://opentofu.org/docs/intro/install/>  |

Add the account to the `docker` group with `sudo usermod -aG docker "$USER"`,
which takes effect at the next login.

**Windows.** We recommend using WSL2 and installing the linux dependencies.

**Verification.** You can use the following commands to check each tool is installed correctly.

```bash
docker --version && docker compose version && docker buildx version
git --version
node --version                        # optional
just --version                        # optional
gcloud --version                      # deployment only
tofu --version                        # deployment only
python3 --version                     # deployment only
openssl version                       # deployment only
htpasswd -nbB check check > /dev/null && echo "htpasswd available"    # deployment only
```

## 3. Development environment

### 3.1 Installation

Clone the repository and create the environment file from the supplied template.

```bash
git clone <repository-url> && cd 2026W1-MultiPicross
cp .env.example .env
```

Four values in `.env` are marked `change-me`. Each requires a distinct random
value.

```bash
openssl rand -hex 32   # JWT_ACCESS_SECRET
openssl rand -hex 32   # JWT_REFRESH_SECRET
openssl rand -hex 32   # JWT_ROOM_SECRET
openssl rand -hex 32   # OIDC_STATE_SECRET
```

The remaining values in `.env.example` are suitable for immediate use. The
database credentials and the OIDC settings are preconfigured for the local Dex
instance. `ADMIN_USERNAME` and `ADMIN_PASSWORD` are optional. Setting both causes
a service account to be created when the API starts.

Start the application stack:

```bash
docker compose up --build    # or: `just dev`, which enables hot reload
```

The application is then available at `http://multipicross.localhost`.
Authenticate with the account `dev@multipicross.localhost` and the password
`picross-dev` (default dex credentials, see section 4.2).

### 3.2 Service endpoints

| Resource               | Address                                  |
| ---------------------- | ---------------------------------------- |
| Application            | <http://multipicross.localhost>          |
| API documentation      | <http://multipicross.localhost/api/docs> |
| API, bypassing Traefik | <http://localhost:3001>                  |
| Game server, direct    | <http://localhost:2567>                  |
| Traefik dashboard      | <http://localhost:8080>                  |
| PostgreSQL             | `localhost:5432`                         |

`compose.override.yaml` is loaded automatically by `docker compose up`. It
supplies the development build targets and the published ports listed above.

**NOTE**: Connecting to the frontend directly will break the application's functionality, since it uses relative routing to access the API.

### 3.3 Common operations

```bash
just dev              # start with hot reload
just up / just down   # start and stop the stack
just logs [service]   # retrieve logs
just ps               # list running services
just restart <svc>    # restart a single service
just db               # open a psql shell
just db-reset         # remove the database volume and rebuild
just format           # run Prettier
just lint             # run ESLint
```

Where `just` is unavailable, consult the `justfile`. Each command consists of a docker invocation which can be used as substitute.

### 3.4 Database

Migrations are applied automatically when the API container starts. The puzzle
bank is imported from `api/imgs/` during the same startup sequence. No manual
step is required under normal operation.

A new migration is generated as follows.

```bash
cd api
DATABASE_URL=postgres://picross:picross@localhost:5432/picross npm run db:generate
```

`DATABASE_URL` must be supplied explicitly. The running services
construct their own connection string from the environment variables.

`just db-reset` removes the database volume and rebuilds the containers. Migrations and the puzzle import are repeated on the subsequent start by the API service.

### 3.5 Tests

```bash
cd api && DB_HOST=localhost DB_USER=picross DB_PASSWORD=picross DB_NAME=picross npm test
cd gameserver && npm test
```

The database-dependent API tests are skipped automatically when PostgreSQL is
unreachable, so `npm test` can still be run without a running database. The game server tests require a running database.

## 4. Authentication

An external OIDC provider is required. The API conducts the authorisation flow
server-side, and no built-in password authentication is available to ordinary
users as of now (this is a requirement of our current Idp provider).

The API validates its OIDC configuration during startup and terminates if any required information is missing.

### 4.1 Configuration

| Variable              | Function                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `APP_BASE_URL`        | Public base URL of the application. The redirect URI is this value followed by `/api/auth/callback`.                     |
| `OIDC_ISSUER`         | Issuer URL. Discovery is performed against this address.                                                                 |
| `OIDC_CLIENT_ID`      | Client identifier registered with the provider.                                                                          |
| `OIDC_CLIENT_SECRET`  | Client secret.                                                                                                           |
| `OIDC_SCOPES`         | Space-separated scopes. Defaults to `openid`.                                                                            |
| `OIDC_CLIENT_AUTH`    | Token endpoint authentication method. Accepts `client_secret_basic` or `client_secret_post`.                             |
| `OIDC_ANCHOR_CLAIM`   | The claim used as the permanent account anchor. The claim must be immutable and should not be an email address.          |
| `OIDC_PROVIDER_ID`    | Namespaces stored identities by environment. Modifying this value destroys existing accounts. |
| `OIDC_STATE_SECRET`   | Signs the short-lived login transaction. Generate with `openssl rand -hex 32`.                                           |
| `OIDC_ALLOW_INSECURE` | Permits a plain HTTP issuer. Restricted to development. The API will exit if this value is set in production.            |

### 4.2 Dex in development

`dev/dex/config.yaml` configures Dex as a local substitute for the production
identity provider. Traefik serves it at `http://dex.multipicross.localhost`. The
configuration defines one client, `multipicross-dev`, and one user account. The
corresponding values are present in `.env.example`, so a newly cloned repository
can authenticate without further configuration.

Dex is configured with in-memory storage, so state does not persist across restarts, and accounts cannot be created at runtime. Additional static accounts can be added, as described below.

### 4.3 Adding a development account

1. Generate a bcrypt hash of the password and retain the portion following the
   colon.

   ```bash
   htpasswd -bnBC 10 "" your-password
   ```

2. Generate a unique identifier.

   ```bash
   uuidgen
   ```

3. Append an entry to `staticPasswords` in `dev/dex/config.yaml`.

   ```yaml
   staticPasswords:
     - email: "dev@multipicross.localhost"
       username: "dev"
       userID: "08a8684b-db88-4b73-90a9-3cd1661f5466"
       hash: "$2y$10$XDxNLWnbgA/yyeagQ0jQTuPYIpDGlmLNGaMqJoOlxItEs.w1Bg0NS"
     - email: "alice@multipicross.localhost"
       username: "alice"
       userID: "<the identifier from step 2>"
       hash: "<the hash from step 1>"
   ```

4. Restart Dex.

   ```bash
   docker compose restart dex
   ```

Both `email` and `userID` must be unique within the file. Authentication uses the
email address rather than the username. A previously unused `userID` produces a
new MultiPicross account at first sign-in, which is the recommended method of
obtaining a second account for multiplayer testing.

### 4.4 Production identity provider

Configuration of a production-ready identity provider falls outside the scope of
this document. The procedure depends on the provider selected and on that
provider's own onboarding requirements.

The following information must be obtained from the operator of the provider.

- The issuer URL, for `OIDC_ISSUER`.
- A client identifier and secret, for `OIDC_CLIENT_ID` and `OIDC_CLIENT_SECRET`.
- Confirmation that the redirect URI registered against the client is exactly
  `https://<domain>/api/auth/callback`.
- The token endpoint authentication method for which the client is configured,
  for `OIDC_CLIENT_AUTH`.
- The name of a claim that is stable and unique per person, for
  `OIDC_ANCHOR_CLAIM`.

A distinct `OIDC_PROVIDER_ID` should be determined for each environment before
the first sign-in occurs, because the value cannot subsequently be changed
without loss of accounts.

## 5. Provisioning the production environment

OpenTofu, located in `infra/`, provisions the resources that must exist before an
application deployment can occur. These comprise the virtual machine, its disks,
the firewall rules, the container registry, the empty secret entries, and the
service accounts.

OpenTofu is executed manually, and only when the
infrastructure definition changes. The GitHub Actions workflows do not execute
OpenTofu at any point.

The following steps must be performed in the order given.

### 5.1 Create the project

Create a Google Cloud project and link a billing account (we do not detail this process here, there are many resources available online). Save its project-id for the next steps.

Three APIs must be enabled manually.

```bash
gcloud services enable serviceusage.googleapis.com \
  cloudresourcemanager.googleapis.com storage.googleapis.com \
  --project=<project-id>
```

### 5.2 Authenticate

Two authentication contexts are required.

```bash
gcloud auth login
gcloud auth application-default login
```

### 5.3 Create the state bucket

Terraform requires a storage bucket to store its state, and cannot create it by itself.

```bash
gcloud storage buckets create gs://<bucket-name> --project=<project-id> --location=<region>
gcloud storage buckets update gs://<bucket-name> --versioning
```

### 5.4 Configure OpenTofu

```bash
cd infra
cp backend.hcl.example backend.hcl
cp terraform.tfvars.example terraform.tfvars
```

Enter the bucket name in `backend.hcl`, and the project identifier, contact
address, and OIDC client details in `terraform.tfvars`. Refer to `variables.tf` for a full list of variables.

Retain the staging
default for `acme_caserver` at this stage. Both files are excluded from source
control since they may contain secrets.

### 5.5 Apply the configuration

```bash
tofu init -backend-config=backend.hcl
tofu apply
```

The following resources are created.

| Resource                            | Notes                                                              |
| ----------------------------------- | ------------------------------------------------------------------ |
| 1 Compute Engine instance           | Hosts the complete compose stack                                   |
| 1 boot disk and 1 data disk         | Database data resides on a dedicated disk                          |
| 1 static external IP address        | The target of the DNS records                                      |
| 2 firewall rules                    | Ports 80 and 443 are public. Port 22 is reachable only through IAP |
| 1 Artifact Registry repository      | Stores the three service images                                    |
| 11 Secret Manager secrets           | Created without values, as described in Section 5.6                |
| 2 service accounts                  | One for the instance and one for continuous integration            |
| 1 Workload Identity Federation pool | Permits GitHub Actions to authenticate without a stored key        |
| IAM bindings                        | Least-privilege grants across the above resources                  |

### 5.6 Populate the secrets

The secrets are created without values. Deployments will fail until each required secret holds a valid version. Nine secrets are required, and two are optional.

| Secret                | Required | Description and generation method                                                          |
| --------------------- | -------- | ------------------------------------------------------------------------------------------ |
| `POSTGRES_USER`       | Yes      | Database user name. Operator-selected.                                                     |
| `POSTGRES_PASSWORD`   | Yes      | Database password. `openssl rand -hex 32`                                                  |
| `POSTGRES_DB`         | Yes      | Database name. Operator-selected.                                                          |
| `JWT_ACCESS_SECRET`   | Yes      | Signs access tokens. `openssl rand -hex 32`                                                |
| `JWT_REFRESH_SECRET`  | Yes      | Signs refresh tokens. `openssl rand -hex 32`                                               |
| `JWT_ROOM_SECRET`     | Yes      | Signs game room tokens. `openssl rand -hex 32`                                             |
| `GS_MONITOR_HTPASSWD` | Yes      | Basic authentication credential for the Colyseus monitor. `htpasswd -nB admin`             |
| `OIDC_CLIENT_SECRET`  | Yes      | Issued by the identity provider.                                                           |
| `OIDC_STATE_SECRET`   | Yes      | Signs the login transaction. `openssl rand -hex 32`                                        |
| `ADMIN_USERNAME`      | No       | Creates a service account at startup. Effective only in combination with `ADMIN_PASSWORD`. |
| `ADMIN_PASSWORD`      | No       | As above. Both versions should be destroyed once the account exists.                       |

Each secret should hold a distinct value. Repeating secrets is a security risk.

A value may be added individually through `gcloud`.

```bash
printf '%s' "<value>" | gcloud secrets versions add multipicross-jwt-access-secret --data-file=-
```

Alternatively, values may be added in bulk from a local file of `KEY=VALUE`
lines.

```bash
cp tools/environments.example.json tools/environments.json   # first occasion only, read section 6.2 before using
./tools/mpx.py --env prod secrets push --file prod-secrets.env
```

**NOTE**: Using `mpx.py` requires adding your specific Google Cloud project details to the relevant entry in `tools/environments.json`. See section 6.2.

Secret names are derived from the values in `infra/secrets.tf` (lowercase, with underscores replaced by hyphens and prefixed with `multipicross-`).

For example, `JWT_ACCESS_SECRET` becomes `multipicross-jwt-access-secret`.

The `ADMIN_USERNAME` and `ADMIN_PASSWORD` pair is currently the only way to create a service account in production.

### 5.7 Configure DNS

Retrieve the reserved address.

```bash
tofu output ip
```

Create an `A` record for the base domain (e.g. `<domain>.com`) for the ip address retrieved, as well as a `CNAME` record for host `www` pointing to `<domain>.com`.

This is required for traefik to correctly configure a LetsEncrypt certificate. Do not proceed until the DNS records propagate (verify with `dig` or `nslookup`).

### 5.8 Configure GitHub

Define the following six repository variables. None of the values are sensitive. All
values are available from `tofu output`.

| Variable          | Value                                      |
| ----------------- | ------------------------------------------ |
| `WIF_PROVIDER`    | `tofu output workload_identity_provider`   |
| `DEPLOY_SA_EMAIL` | `tofu output deploy_service_account_email` |
| `GCP_PROJECT_ID`  | The project identifier                     |
| `GCP_ZONE`        | For example, `australia-southeast1-a`      |
| `GCP_VM_NAME`     | `multipicross-app`                         |
| `APP_DOMAIN`      | For example, `multipicross.com`            |

These are required for automatic deployment using GitHub actions. Create a GitHub environment named exactly `production`.

### 5.9 Initial deployment and certificate issuance

Push to `main`, or dispatch the deployment workflow manually. The initial deployment uses the Let's Encrypt staging directory, and
browsers will therefore report an untrusted certificate. This behaviour is
expected.

Once the deployment is confirmed to operate correctly, obtain trusted
certificates.

1. Set `acme_caserver = "https://acme-v02.api.letsencrypt.org/directory"` in
   `infra/terraform.tfvars`.
2. Run `tofu apply`.
3. Restart the instance so that the revised setting reaches it, then deploy, by
   running `./tools/mpx.py --env prod reboot --deploy`. (Read section 6.2 first)
4. Delete the stale staging certificate at `/mnt/data/letsencrypt/acme.json` on
   the instance and restart Traefik. Traefik continues to serve the untrusted
   certificate until this file is removed.

For step 4, use `tools/mpx.py --env prod ssh` to connect to the instance. (read section 6.2 first)

## 6. Deployment and operation

### 6.1 The deployment pipeline

Pull requests are validated by formatting checks, linting, per-service builds,
Docker image builds, and the test suites.

On a push to `main`, the deployment workflow builds the three service images,
publishes them to Artifact Registry. The workflow then connects to the virtual machine and
executes the deployment script. That script snapshots the database disk,
retrieves the current secrets, pulls the new images, and restarts the stack. A health check is also performed afterwards.

### 6.2 The mpx utility

`tools/mpx.py` encapsulates the `gcloud`, `docker`, and `psql` invocations
required to build, release, and inspect a deployed environment. It depends only
on the Python standard library and has no installation step. It does require an
authenticated `gcloud` session, obtained as described in Section 5.2.

The utility derives the repository root from its own location, so it may be
invoked from any working directory within the repository. It reads `compose.gcp.yaml`
from that root, and it uses the current `git HEAD` as the default image tag.

**Configuration.** The utility reads `tools/environments.json`. That file records
project identifiers and is therefore excluded from source control, which means it
is absent from a fresh clone and must be created before any command will run. A
template is provided for this purpose.

```bash
cp tools/environments.example.json tools/environments.json
```

Each key at the top level of the file names an environment, and that name is the
value subsequently supplied to `--env`. The following fields are recognised.

| Field      | Required | Description                                                                      |
| ---------- | -------- | -------------------------------------------------------------------------------- |
| `project`  | Yes      | Google Cloud project identifier                                                  |
| `zone`     | Yes      | Zone of the Compute Engine instance, for example `australia-southeast1-a`        |
| `region`   | Yes      | Region of the Artifact Registry repository, for example `australia-southeast1`   |
| `domain`   | Yes      | Public domain of the environment, used by the health check performed by `status` |
| `instance` | No       | Instance name. Defaults to `multipicross-app`                                    |

A completed file defining a single production environment takes the following
form.

```json
{
  "prod": {
    "project": "multipicross-123456",
    "zone": "australia-southeast1-a",
    "region": "australia-southeast1",
    "domain": "multipicross.com",
    "instance": "multipicross-app"
  }
}
```

The Artifact Registry host is derived from `region` and is not configured
separately. Further environments are added as additional top-level keys. You can use `--env <key>` to select a different environment (e.g., `--env qa` or `--env prod`).

Where the file is absent, the utility reports the path at which it was expected
and exits. Where a named environment omits a required field, the utility reports
which fields are missing.

**Invocation.** `--env` is mandatory and must precede the subcommand. The global
`--dry-run` flag prints the commands that would be executed without executing
them, which is the recommended method of inspecting an unfamiliar operation
before performing it.

```bash
./tools/mpx.py --env prod --dry-run deploy
```

**Command reference.**

| Command        | Options                                      | Function                                                                                                                                                                                      |
| -------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `build`        | `--tag`, `--service`                         | Builds the production images for `linux/amd64` and publishes them to Artifact Registry. The tag defaults to the current `git HEAD`. In the absence of `--service`, all three images are built |
| `deploy`       | `--tag`, `--skip-build`                      | Builds and publishes the images, then executes the deployment script on the instance. `--skip-build` releases a tag that has already been published                                           |
| `secrets push` | `--file` (required), `--only`, `--yes`       | Adds a new version to each secret named by a `KEY=VALUE` line in the file. `--only` restricts the operation to the keys listed                                                                |
| `secrets list` |                                              | Lists the secrets defined in the project                                                                                                                                                      |
| `db psql`      |                                              | Opens an interactive `psql` shell against the deployed database                                                                                                                               |
| `db drop`      | `--yes`                                      | Destroys every table together with the migration ledger. Migrations are reapplied when the API restarts                                                                                       |
| `logs`         | `--since` (default `10m`), `--service`       | Retrieves container logs from the instance                                                                                                                                                    |
| `status`       |                                              | Reports container status and requests `/api/health` over the public domain                                                                                                                    |
| `snapshots`    |                                              | Lists the database disk snapshots retained in the project                                                                                                                                     |
| `reboot`       | `--deploy`, `--tag`, `--skip-build`, `--yes` | Stops and starts the instance so that the startup script runs again. `--deploy` performs a deployment afterwards, which regenerates the `host.env` file                                       |
| `ssh`          | `--command`                                  | Opens an interactive shell on the instance, or executes a single command                                                                                                                      |

`--service` accepts `api`, `gameserver`, or `frontend` for `build`, and
additionally accepts `db` and `traefik` for `logs`.

**Confirmation prompts.** Three commands are destructive or disruptive and
require a confirmation string to be entered. `--yes` suppresses the prompt and is
intended for non-interactive use.

| Command        | String required                           |
| -------------- | ----------------------------------------- |
| `secrets push` | The environment name, as given to `--env` |
| `db drop`      | The Google Cloud project identifier       |
| `reboot`       | The environment name, as given to `--env` |

**Common use cases.** A release of the current commit, followed verification of deployment.

```bash
./tools/mpx.py --env prod deploy
./tools/mpx.py --env prod status
```

A release of a previously published image, which omits the build stage.

```bash
./tools/mpx.py --env prod deploy --skip-build --tag <commit-sha>
```

Retrieval of recent API logs.

```bash
./tools/mpx.py --env prod logs --service api --since 15m
```

### 6.3 Manual instance access

Access without the wrapper is obtained as follows.

```bash
gcloud compute ssh multipicross-app --project <project> --zone <zone> --tunnel-through-iap
```

Port 22 is not exposed to the internet. All SSH traffic must be tunnelled through
Google Identity-Aware Proxy, which evaluates an IAM policy before an SSH
connection can be established.

### 6.4 Reverting a deployment

To revert application code, dispatch the deployment workflow manually with
`image_tag` set to an earlier commit SHA. The build stage is skipped, and the
existing image is redeployed. The equivalent operation from a workstation is
`./tools/mpx.py --env prod deploy --skip-build --tag <commit-sha>`.

To revert a migration, restore the database disk snapshot. No down migrations
exist, so this constitutes the only available recovery path. A snapshot is taken
immediately before each rollout, and the ten most recent snapshots are retained.

## 7. Team

| Name      | GitHub        | Email                             |
| --------- | ------------- | --------------------------------- |
| Amelia    | yurimaxxer    | ameliaswainston@gmail.com         |
| Sasith    | kubisch       | cosmos@outlook.com.au             |
| Oskar     | Oskskskar     | oskarc3n@gmail.com                |
| Carissa   | ckhong04      | carissa.a.khong@gmail.com         |
| Tom       | TomLovesAi    | thomas.dumoff@gmail.com           |
| Ethan     | ethantse26    | ethan.tse26@gmail.com             |
| Azzam     | azzammun      | azzammuntaqo2007@gmail.com        |
| Parth     | parth762      | pbhatnagar746@gmail.com           |
| Christian | chriscross664 | christian.vourgoutzis@hotmail.com |
| Nam       | TheGoldfish11 | namqtran11@gmail.com              |
| Anita     | applecee      | acha0216@student.monash.edu       |
| De-arne   | dbaker1206    | dbak0009@student.monash.edu       |
| Dakshina  | dakshina5206  | dakshina.alahakoon@gmail.com      |
| Rohan     | reeohan       | rsur0015@student.monash.edu       |
| Michael   | m_dig_63965   | mdig0003@student.monash.edu       |
