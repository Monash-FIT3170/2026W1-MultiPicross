#!/bin/bash
# Runs as root on the VM, invoked only via the sudoers rule in
# startup.sh.tftpl (see infra/iam.tf for why osLogin, not osAdminLogin).
#
#   $1  IMAGE_TAG    commit SHA to roll out
#   $2  COMPOSE_B64  base64 of compose.gcp.yaml at the deployed commit
#
# Non-secret config comes from host.env, written by the startup script.
# Secrets are fetched fresh from Secret Manager on every run.
set -euo pipefail

IMAGE_TAG=${1:?usage: deploy.sh <image_tag> <compose_b64>}
COMPOSE_B64=${2:?usage: deploy.sh <image_tag> <compose_b64>}

if ! printf '%s' "$IMAGE_TAG" | grep -Eq '^[A-Za-z0-9._-]{1,128}$'; then
  echo "Refusing to deploy: IMAGE_TAG is not a valid tag." >&2
  exit 1
fi

APP_DIR=/opt/multipicross
cd "$APP_DIR"

# shellcheck disable=SC1091
. ./host.env

echo "$COMPOSE_B64" | base64 -d >compose.gcp.yaml

# Migrations run in-process at API boot with no down migration, so snapshot
# first. A failed snapshot warns rather than blocking the deploy.
snapshot_name="pgdata-$(date -u +%Y%m%dt%H%M%Sz)-${IMAGE_TAG:0:7}"
gcloud compute disks snapshot "${PGDATA_DISK}" \
  --zone="$ZONE" \
  --snapshot-names="$snapshot_name" \
  --storage-location="$REGION" \
  --quiet ||
  echo "warning: pgdata snapshot failed, continuing deploy" >&2

umask 077
: >.env.new
cat host.env >>.env.new
printf 'IMAGE_TAG=%s\n' "$IMAGE_TAG" >>.env.new

for name in POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB JWT_ACCESS_SECRET JWT_REFRESH_SECRET GS_MONITOR_HTPASSWD; do
  # matches the secret_id transform in infra/secrets.tf
  secret="multipicross-$(printf '%s' "$name" | tr 'A-Z_' 'a-z-')"
  if ! value=$(gcloud secrets versions access latest --secret="$secret" --project="$PROJECT_ID" 2>/dev/null); then
    echo "Secret $secret has no version yet." >&2
    echo "  printf '%s' \"<value>\" | gcloud secrets versions add $secret --data-file=-" >&2
    exit 1
  fi
  printf '%s=%s\n' "$name" "$value" >>.env.new
done

mv .env.new .env
chmod 600 .env

docker compose -f compose.gcp.yaml pull
docker compose -f compose.gcp.yaml up -d --remove-orphans
docker image prune -f

docker compose -f compose.gcp.yaml ps
