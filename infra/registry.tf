# One repo, three images: multipicross/{api,gameserver,frontend}

resource "google_artifact_registry_repository" "images" {
  location      = var.region
  repository_id = var.project_name
  format        = "DOCKER"
  description   = "MultiPicross service images"

  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }

  cleanup_policies {
    id     = "delete-untagged"
    action = "DELETE"
    condition {
      tag_state = "UNTAGGED"
      # seconds, not "7d": non-second units diff on every plan (terraform-provider-google#20796)
      older_than = "604800s"
    }
  }
}
