locals {
  image = "${var.region}-docker.pkg.dev/${var.project_id}/restaurant-api/frontend:latest"
}

resource "null_resource" "docker_build_push" {
  triggers = {
    src_hash = sha256(join("", [
      filesha256("${path.module}/../../../main/frontend/Dockerfile"),
      filesha256("${path.module}/../../../main/frontend/package.json"),
    ]))
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
