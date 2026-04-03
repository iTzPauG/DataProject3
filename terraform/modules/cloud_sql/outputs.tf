output "connection_name" {
  value = google_sql_database_instance.main.connection_name
}

output "database_url_secret" {
  value = "projects/${var.project_id}/secrets/database-url/versions/latest"
}
