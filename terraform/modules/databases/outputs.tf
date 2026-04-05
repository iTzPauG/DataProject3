output "firestore_database" {
  value = google_firestore_database.default.name
}

output "bigquery_analytics_dataset" {
  value = google_bigquery_dataset.analytics.dataset_id
}

output "bigquery_snapshots_dataset" {
  value = google_bigquery_dataset.snapshots.dataset_id
}

output "firebase_web_app_id" {
  value = google_firebase_web_app.gado.app_id
}
