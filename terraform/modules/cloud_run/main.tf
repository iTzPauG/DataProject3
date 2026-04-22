resource "google_service_account" "cloud_run" {
  account_id   = "cloud-run-api"
  display_name = "Cloud Run API SA"
}

resource "google_cloud_run_v2_service" "api" {
  name     = "restaurant-api-${terraform.workspace}"
  location = var.region

  template {
    service_account = google_service_account.cloud_run.email

    annotations = {
      "build-id"                                  = var.build_id
      "run.googleapis.com/cloudsql-instances"     = var.cloud_sql_connection
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
            secret  = "database-url-${terraform.workspace}"
            version = "latest"
          }
        }
      }
      env {
        name  = "BRAIN_PROVIDER"
        value = "gemini"
      }

      dynamic "env" {
        for_each = {
          "GOOGLE_MAPS_API_KEY"  = "google-maps-api-key"
          "GOOGLE_GENAI_API_KEY" = "google-genai-api-key"
          "GEOAPIFY_API_KEY"     = "geoapify-api-key"
          "TRIPADVISOR_API_KEY"  = "tripadvisor-api-key"
          "YELP_API_KEY"         = "yelp-api-key"
          "HERE_API_KEY"         = "here-api-key"
          "OPENROUTER_API_KEY"   = "openrouter-api-key"
          "GROQ_API_KEY"         = "groq-api-key"
        }
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value
              version = "latest"
            }
          }
        }
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
