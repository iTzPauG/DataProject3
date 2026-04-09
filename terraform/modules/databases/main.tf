# ── Firestore ────────────────────────────────────────────────────────────────

resource "google_firestore_database" "default" {
  project                 = var.project_id
  name                    = "(default)"
  location_id             = var.region
  type                    = "FIRESTORE_NATIVE"
  delete_protection_state = "DELETE_PROTECTION_ENABLED"
}

resource "google_firestore_field" "reports_ttl" {
  project    = var.project_id
  database   = google_firestore_database.default.name
  collection = "active_reports"
  field      = "expires_at"
  ttl_config {}
}

resource "google_firestore_field" "brain_jobs_ttl" {
  project    = var.project_id
  database   = google_firestore_database.default.name
  collection = "brain_jobs"
  field      = "expires_at"
  ttl_config {}
}

# ── Firebase ──────────────────────────────────────────────────────────────────

resource "google_firebase_project" "default" {
  provider = google-beta
  project  = var.project_id
}

resource "google_firebase_web_app" "gado" {
  provider     = google-beta
  project      = var.project_id
  display_name = "GADO Web"
  depends_on   = [google_firebase_project.default]
}

# ── BigQuery datasets (compartidos, las tablas van por workspace) ─────────────

resource "google_bigquery_dataset" "analytics" {
  project                    = var.project_id
  dataset_id                 = "gado_analytics"
  location                   = var.region
  delete_contents_on_destroy = false
}

resource "google_bigquery_dataset" "snapshots" {
  project                    = var.project_id
  dataset_id                 = "gado_snapshots"
  location                   = var.region
  delete_contents_on_destroy = false
}
