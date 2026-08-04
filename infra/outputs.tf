output "ip" {
  description = "Reserved static IP, point the domain's A records here."
  value       = google_compute_address.app.address
}

output "vm_name" {
  value = google_compute_instance.app.name
}

output "artifact_registry_host" {
  value = "${var.region}-docker.pkg.dev"
}

output "artifact_registry_repo" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.images.repository_id}"
}

output "deploy_service_account_email" {
  value = google_service_account.deploy.email
}

output "workload_identity_provider" {
  description = "Full resource name for the GCP_WORKLOAD_IDENTITY_PROVIDER repo variable."
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "secret_ids" {
  value = { for k, v in google_secret_manager_secret.app : k => v.secret_id }
}
