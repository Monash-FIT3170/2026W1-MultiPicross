resource "google_compute_address" "app" {
  name         = "${var.project_name}-ip"
  region       = var.region
  address_type = "EXTERNAL"
  # cheaper for AU egress than Premium, must match access_config below
  network_tier = "STANDARD"
}

resource "google_compute_disk" "pgdata" {
  name = "${var.project_name}-pgdata"
  type = "pd-balanced"
  zone = var.zone
  size = var.data_disk_size

  # google_compute_disk has no deletion_protection field, this is the
  # equivalent.
  lifecycle {
    prevent_destroy = true
  }
}

resource "google_compute_instance" "app" {
  name         = "${var.project_name}-app"
  machine_type = var.machine_type
  zone         = var.zone
  tags         = ["multipicross-app"]

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-12"
      size  = var.boot_disk_size
      type  = "pd-balanced"
    }
  }

  attached_disk {
    source = google_compute_disk.pgdata.id
    # becomes /dev/disk/by-id/google-pgdata in the guest, stable across
    # reboots unlike /dev/sdX
    device_name = "pgdata"
    mode        = "READ_WRITE"
  }

  network_interface {
    network = "default"
    access_config {
      nat_ip       = google_compute_address.app.address
      network_tier = "STANDARD"
    }
  }

  service_account {
    email = google_service_account.vm.email
    # Omitting this falls back to legacy access scopes, which gate the
    # metadata token independent of IAM and 403 regardless of IAM bindings.
    scopes = ["https://www.googleapis.com/auth/cloud-platform"]
  }

  metadata = {
    enable-oslogin = "TRUE"

    startup-script = templatefile("${path.module}/startup.sh.tftpl", {
      domain_name   = var.domain_name
      acme_email    = var.acme_email
      acme_caserver = var.acme_caserver
      ar_host       = "${var.region}-docker.pkg.dev"
      project_id    = var.project_id
      region        = var.region
      zone          = var.zone
      pgdata_disk   = google_compute_disk.pgdata.name
      # OS Login POSIX username: "sa_" + unique_id, truncated to 32 chars
      deploy_sa_user    = substr("sa_${google_service_account.deploy.unique_id}", 0, 32)
      deploy_script_b64 = filebase64("${path.module}/files/deploy.sh")

      oidc_issuer       = var.oidc_issuer
      oidc_provider_id  = var.oidc_provider_id
      oidc_client_id    = var.oidc_client_id
      oidc_anchor_claim = var.oidc_anchor_claim
      oidc_scopes       = var.oidc_scopes
      oidc_client_auth  = var.oidc_client_auth
    })
  }

  shielded_instance_config {
    enable_secure_boot          = true
    enable_vtpm                 = true
    enable_integrity_monitoring = true
  }

  allow_stopping_for_update = true
  deletion_protection       = true

  depends_on = [
    google_artifact_registry_repository.images,
    google_secret_manager_secret.app,
  ]
}
