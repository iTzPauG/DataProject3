output "cloud_run_url" {
  value = module.cloud_run.url
}

output "frontend_url" {
  value = module.cloud_run_frontend.url
}

output "cloud_sql_connection" {
  value = module.cloud_sql.connection_name
}
