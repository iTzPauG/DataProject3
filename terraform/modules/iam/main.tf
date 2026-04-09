# Public invoker
resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  name     = var.service_name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Cloud Run SA → secrets
resource "google_project_iam_member" "secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:cloud-run-api@${var.project_id}.iam.gserviceaccount.com"
}

# Cloud Run SA → Cloud SQL
resource "google_project_iam_member" "cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:cloud-run-api@${var.project_id}.iam.gserviceaccount.com"
}
