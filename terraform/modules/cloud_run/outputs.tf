output "service_name" {
  value = google_cloud_run_v2_service.api.name
}

output "service_account_email" {
  value = google_service_account.cloud_run.email
}

output "url" {
  value = google_cloud_run_v2_service.api.uri
}
