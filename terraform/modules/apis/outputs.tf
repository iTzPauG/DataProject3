output "enabled" {
  value = [for s in google_project_service.required : s.service]
}
