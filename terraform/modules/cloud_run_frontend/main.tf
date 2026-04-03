resource "google_cloud_run_v2_service" "frontend" {
  name     = "gado-frontend"
  location = var.region

  template {
    annotations = {
      "build-id" = var.build_id
    }

    containers {
      image = var.image

      ports {
        container_port = 80
      }

      env {
        name  = "EXPO_PUBLIC_BACKEND_URL"
        value = var.backend_url
      }
      env {
        name  = "EXPO_PUBLIC_FIREBASE_API_KEY"
        value = var.firebase_api_key
      }
      env {
        name  = "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN"
        value = var.firebase_auth_domain
      }
      env {
        name  = "EXPO_PUBLIC_FIREBASE_PROJECT_ID"
        value = var.firebase_project_id
      }
      env {
        name  = "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET"
        value = var.firebase_storage_bucket
      }
      env {
        name  = "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
        value = var.firebase_messaging_sender_id
      }
      env {
        name  = "EXPO_PUBLIC_FIREBASE_APP_ID"
        value = var.firebase_app_id
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
      max_instance_count = 5
    }
  }
}

resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.frontend.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}
