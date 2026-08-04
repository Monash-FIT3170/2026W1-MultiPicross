variable "project_id" {
  description = "GCP project ID (create it by hand first)."
  type        = string
}

variable "project_name" {
  description = "Short name used as a prefix for resource names."
  type        = string
  default     = "multipicross"
}

variable "region" {
  description = "Region for all regional resources."
  type        = string
  default     = "australia-southeast1"
}

variable "zone" {
  description = "Zone for the VM and its disks. Must be in `region`."
  type        = string
  default     = "australia-southeast1-a"
}

variable "machine_type" {
  description = "Compute Engine machine type for the app host."
  type        = string
  default     = "e2-small"
}

variable "boot_disk_size" {
  description = "Boot disk size in GB."
  type        = number
  default     = 30
}

variable "data_disk_size" {
  description = "Postgres data disk size in GB. Disks grow online but never shrink, start small."
  type        = number
  default     = 10
}

variable "domain_name" {
  description = "Production domain (apex). www.<domain_name> is also routed and redirected to the apex."
  type        = string
  default     = "multipicross.com"
}

variable "acme_email" {
  description = "Contact email for Let's Encrypt certificate expiry notices."
  type        = string
}

variable "acme_caserver" {
  description = <<-EOT
    Let's Encrypt ACME directory URL. Use the staging directory for initial
    setup (much looser rate limits, untrusted certs) and switch to production
    only once DNS and HTTP-01 are proven end to end. Delete
    /mnt/data/letsencrypt/acme.json on the VM when switching, or Traefik keeps
    serving the untrusted staging cert.
  EOT
  type        = string
  default     = "https://acme-staging-v02.api.letsencrypt.org/directory"
}

variable "github_repo" {
  description = "GitHub \"owner/repo\" allowed to assume the deploy service account via Workload Identity Federation."
  type        = string
  default     = "Monash-FIT3170/2026W1-MultiPicross"
}

variable "github_deploy_branch" {
  description = "Branch that, combined with the `production` GitHub environment, is allowed to deploy."
  type        = string
  default     = "main"
}
