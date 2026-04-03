output "cloud_run_url" {
  value = module.cloud_run.url
}

output "image" {
  value = module.registry.image
}
