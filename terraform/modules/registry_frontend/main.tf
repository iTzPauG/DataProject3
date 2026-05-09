locals {
  image      = "${var.region}-docker.pkg.dev/${var.project_id}/frontend/frontend:latest"
  source_dir = "${path.module}/../../../main/frontend"
  source_files = [
    for file in tolist(fileset(local.source_dir, "**/*.{ts,tsx,js,jsx,json,Dockerfile}")) : file
    if length(regexall("(^|/)node_modules(/|$)", file)) == 0
    && length(regexall("(^|/)dist(/|$)", file)) == 0
    && length(regexall("(^|/)\\.expo(/|$)", file)) == 0
    && length(regexall("(^|/)\\.next(/|$)", file)) == 0
    && length(regexall("(^|/)coverage(/|$)", file)) == 0
    && length(regexall("(^|/)\\.git(/|$)", file)) == 0
  ]
}

resource "google_artifact_registry_repository" "frontend" {
  location      = var.region
  repository_id = "frontend"
  format        = "DOCKER"
}

resource "null_resource" "docker_build_push" {
  depends_on = [google_artifact_registry_repository.frontend]

  triggers = {
    src_hash = sha256(join("", [
      for file in local.source_files : filesha256("${local.source_dir}/${file}")
    ]))
    backend_url = var.backend_url
  }

  provisioner "local-exec" {
    command = <<EOT
      gcloud auth configure-docker ${var.region}-docker.pkg.dev --quiet
      docker build --platform linux/amd64 --provenance=false \
        --build-arg EXPO_PUBLIC_BACKEND_URL="${var.backend_url}" \
        --build-arg EXPO_PUBLIC_FIREBASE_API_KEY="${var.firebase_api_key}" \
        --build-arg EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN="${var.firebase_auth_domain}" \
        --build-arg EXPO_PUBLIC_FIREBASE_PROJECT_ID="${var.firebase_project_id}" \
        --build-arg EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET="${var.firebase_storage_bucket}" \
        --build-arg EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="${var.firebase_messaging_sender_id}" \
        --build-arg EXPO_PUBLIC_FIREBASE_APP_ID="${var.firebase_app_id}" \
        -t ${local.image} ${path.module}/../../../main/frontend
      docker push ${local.image}
    EOT
  }
}
