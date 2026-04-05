output "image" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/restaurant-api/api:latest"
}

output "build_id" {
  value = null_resource.docker_build_push.id
}
