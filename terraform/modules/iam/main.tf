locals {
  cloud_run_sa_member = "serviceAccount:${var.service_account_email}"
}

# Public invoker; upstream API Gateway/auth handles access control.
resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  name     = var.service_name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Project-level secret accessor for runtime secret reads.
resource "google_project_iam_member" "secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = local.cloud_run_sa_member
}

# Explicit bindings for review providers to avoid policy drift.
resource "google_secret_manager_secret_iam_member" "review_secret_accessor" {
  for_each = toset([
    "tripadvisor-api-key",
    "yelp-api-key",
  ])

  project   = var.project_id
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = local.cloud_run_sa_member
}

# Cloud SQL client permissions for the runtime service account.
resource "google_project_iam_member" "cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = local.cloud_run_sa_member
}

# Vertex AI access — assigned manually (Terraform SA lacks resourcemanager.projectIamAdmin).
# gcloud projects add-iam-policy-binding PROJECT_ID \
#   --member="serviceAccount:cloud-run-api@PROJECT_ID.iam.gserviceaccount.com" \
#   --role="roles/aiplatform.user"
