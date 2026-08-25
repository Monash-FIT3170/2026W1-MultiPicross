resource "google_compute_firewall" "web" {
  name    = "${var.project_name}-allow-web"
  network = "default"

  direction = "INGRESS"
  # Must stay open to the internet, Let's Encrypt validates HTTP-01 from
  # unpublished IPs.
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["multipicross-app"]

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  depends_on = [google_project_service.required]
}

resource "google_compute_firewall" "iap_ssh" {
  name    = "${var.project_name}-allow-iap-ssh"
  network = "default"

  direction = "INGRESS"
  # IAP's fixed forwarding range. Required even with a public IP since IAP
  # delivers to the internal NIC. No other path to :22.
  source_ranges = ["35.235.240.0/20"]
  target_tags   = ["multipicross-app"]

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  depends_on = [google_project_service.required]
}
