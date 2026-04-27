# Public invoker — API Gateway will handle auth upstream
resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  name     = var.service_name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Allow Cloud Run SA to read secrets from Secret Manager
resource "google_project_iam_member" "secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:cloud-run-api@${var.project_id}.iam.gserviceaccount.com"
}

# Allow Cloud Run SA to connect to Cloud SQL
resource "google_project_iam_member" "cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:cloud-run-api@${var.project_id}.iam.gserviceaccount.com"
}

# Allow Cloud Run SA to call Vertex AI / Gemini on Vertex
resource "google_project_iam_member" "vertex_ai_user" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:cloud-run-api@${var.project_id}.iam.gserviceaccount.com"
}
