output "image" {
  value = local.image
}

output "build_id" {
  value = null_resource.docker_build_push.id
}
