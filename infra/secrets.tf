# No google_secret_manager_secret_version here on purpose. Secrets are
# created empty; deploy.sh fails loudly until a version is added out of band:
#   printf '%s' "<value>" | gcloud secrets versions add multipicross-<name> --data-file=-
# Use printf, not echo, a trailing newline in POSTGRES_PASSWORD breaks auth
# silently.

locals {
  secret_names = [
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "POSTGRES_DB",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    # htpasswd credential for the /gs/monitor basicauth middleware.
    # Generate with: htpasswd -nB admin
    "GS_MONITOR_HTPASSWD",
  ]
}

resource "google_secret_manager_secret" "app" {
  for_each = toset(local.secret_names)

  secret_id = "${var.project_name}-${lower(replace(each.key, "_", "-"))}"

  replication {
    user_managed {
      replicas {
        location = var.region
      }
    }
  }
}
