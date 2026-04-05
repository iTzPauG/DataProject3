locals {
  image = "${var.region}-docker.pkg.dev/${var.project_id}/restaurant-api/api:latest"
}

resource "google_artifact_registry_repository" "api" {
  repository_id = "restaurant-api"
  format        = "DOCKER"
  location      = var.region
}

resource "null_resource" "docker_build_push" {
  depends_on = [google_artifact_registry_repository.api]

  triggers = {
    src_hash = sha256(join("", [
      filesha256("${path.module}/../../../main/backend/Dockerfile"),
      filesha256("${path.module}/../../../main/backend/requirements.txt"),
    ]))
  }

  provisioner "local-exec" {
    command = <<EOT
      gcloud auth configure-docker ${var.region}-docker.pkg.dev --quiet
      docker build --platform linux/amd64 --provenance=false -t ${local.image} ${path.module}/../../../main/backend
      docker push ${local.image}
    EOT
  }
}
