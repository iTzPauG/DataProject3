# Public invoker — API Gateway will handle auth upstream
resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  name     = var.service_name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}
