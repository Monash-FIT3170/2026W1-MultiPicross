# Enabling an API is itself a Service Usage call, so serviceusage and
# cloudresourcemanager have to be on before this file can run. See handover-deploy.md.
resource "google_project_service" "required" {
  for_each = toset([
    "artifactregistry.googleapis.com",
    "compute.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "iap.googleapis.com",
    "oslogin.googleapis.com",
    "secretmanager.googleapis.com",
    "sts.googleapis.com",
  ])

  project = var.project_id
  service = each.value

  # Left at its default, tofu destroy would disable these for the entire
  # project, not just for what this configuration created.
  disable_on_destroy = false
}
