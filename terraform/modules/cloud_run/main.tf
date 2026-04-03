resource "google_service_account" "cloud_run" {
  account_id   = "cloud-run-api"
  display_name = "Cloud Run API SA"
}

resource "google_cloud_run_v2_service" "api" {
  name     = "restaurant-api"
  location = var.region

  template {
    service_account = google_service_account.cloud_run.email

    annotations = {
      "build-id" = var.build_id
    }

    containers {
      image = var.image

      ports {
        container_port = 8080
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = "database-url"
            version = "latest"
          }
        }
      }
      env {
        name  = "BRAIN_PROVIDER"
        value = "gemini"
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
    }

    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }
  }
}
