locals {
  image      = "${var.region}-docker.pkg.dev/${var.project_id}/restaurant-api/api:latest"
  source_dir = "${path.module}/../../../main/backend"
  source_files = [
    for file in distinct(concat(
      tolist(fileset(local.source_dir, "**")),
      tolist(fileset(local.source_dir, ".dockerignore"))
    )) : file
    if length(regexall("(^|/)__pycache__(/|$)", file)) == 0
    && length(regexall("\\.pyc$", file)) == 0
    && length(regexall("(^|/)\\.pytest_cache(/|$)", file)) == 0
    && file != ".env"
    && file != "temp_local.db"
    && file != "startup.log"
  ]
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
      for file in local.source_files : filesha256("${local.source_dir}/${file}")
    ]))
    code_hash = sha256(join("\n", [for f in sort(fileset("${path.module}/../../../main/backend", "**/*.py")) : filesha256("${path.module}/../../../main/backend/${f}")]))
  }

  provisioner "local-exec" {
    command = "gcloud auth configure-docker ${var.region}-docker.pkg.dev --quiet && docker build --platform linux/amd64 --provenance=false -t ${local.image} ${path.module}/../../../main/backend && docker push ${local.image}"
  }
}
