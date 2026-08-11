# Not the Compute Engine default SA, which carries project Editor.

resource "google_service_account" "vm" {
  account_id   = "${var.project_name}-vm"
  display_name = "MultiPicross application host"
  description  = "Attached to the app VM. Reads container images and secrets, nothing else."
}

resource "google_service_account" "deploy" {
  account_id   = "${var.project_name}-deploy"
  display_name = "MultiPicross GitHub Actions deploy"
  description  = "Impersonated by GitHub Actions via Workload Identity Federation to push images and trigger a deploy."
}

resource "google_artifact_registry_repository_iam_member" "vm_pull" {
  project    = google_artifact_registry_repository.images.project
  location   = google_artifact_registry_repository.images.location
  repository = google_artifact_registry_repository.images.name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.vm.email}"
}

resource "google_secret_manager_secret_iam_member" "vm_read" {
  for_each  = google_secret_manager_secret.app
  secret_id = each.value.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.vm.email}"
}

# deploy.sh snapshots the data disk before every rollout, which is the only
# rollback for a migration, then prunes to the newest ten. Narrower than
# roles/compute.storageAdmin, which would also let the host delete the disk.
resource "google_project_iam_custom_role" "vm_snapshot" {
  project     = var.project_id
  role_id     = "multipicrossVmSnapshot"
  title       = "MultiPicross VM snapshot"
  description = "Create and prune snapshots of the data disk. Cannot touch disks or images."
  permissions = [
    "compute.disks.createSnapshot",
    "compute.disks.get",
    "compute.snapshots.create",
    "compute.snapshots.delete",
    "compute.snapshots.get",
    "compute.snapshots.list",
    "compute.zones.get",
  ]
}

resource "google_project_iam_member" "vm_snapshot" {
  project = var.project_id
  role    = google_project_iam_custom_role.vm_snapshot.id
  member  = "serviceAccount:${google_service_account.vm.email}"
}

resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github"
  display_name              = "GitHub Actions"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-oidc"
  display_name                       = "GitHub OIDC"

  attribute_mapping = {
    "google.subject"             = "assertion.sub"
    "attribute.repository"       = "assertion.repository"
    "attribute.repository_owner" = "assertion.repository_owner"
    "attribute.ref"              = "assertion.ref"
    "attribute.environment"      = "assertion.environment"
  }

  # Required, or any GitHub repo could mint a token into this pool. Both
  # clauses must hold (AND, not OR), so a token is only valid for a run on
  # main under the production environment, which is already reviewer-gated.
  attribute_condition = <<-EOT
    assertion.repository == "${var.github_repo}" &&
    assertion.repository_owner == "${split("/", var.github_repo)[0]}" &&
    assertion.ref == "refs/heads/${var.github_deploy_branch}" &&
    assertion.environment == "production"
  EOT

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_member" "github_wif" {
  service_account_id = google_service_account.deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repo}"
}

resource "google_project_iam_member" "deploy_compute_viewer" {
  project = var.project_id
  role    = "roles/compute.viewer"
  member  = "serviceAccount:${google_service_account.deploy.email}"
}

# Non-sudo: startup.sh.tftpl adds a sudoers rule limiting this identity to
# running deploy.sh, not a full root shell (osAdminLogin).
resource "google_compute_instance_iam_member" "deploy_oslogin" {
  project       = var.project_id
  zone          = var.zone
  instance_name = google_compute_instance.app.name
  role          = "roles/compute.osLogin"
  member        = "serviceAccount:${google_service_account.deploy.email}"
}

resource "google_iap_tunnel_instance_iam_member" "deploy" {
  project  = var.project_id
  zone     = var.zone
  instance = google_compute_instance.app.name
  role     = "roles/iap.tunnelResourceAccessor"
  member   = "serviceAccount:${google_service_account.deploy.email}"
}

resource "google_artifact_registry_repository_iam_member" "deploy_push" {
  project    = google_artifact_registry_repository.images.project
  location   = google_artifact_registry_repository.images.location
  repository = google_artifact_registry_repository.images.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.deploy.email}"
}

# SSHing into a VM with an attached SA counts as using that SA. Without this,
# start-iap-tunnel fails with "[4033: 'not authorized']".
resource "google_service_account_iam_member" "deploy_actas_vm_sa" {
  service_account_id = google_service_account.vm.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deploy.email}"
}
