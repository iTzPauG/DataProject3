#!/bin/bash
# Genera terraform.tfvars desde Secret Manager
# Uso: bash scripts/get_secrets.sh
# Requiere: gcloud autenticado con acceso al proyecto

PROJECT="project1grupo7"

get_secret() {
  gcloud secrets versions access latest --secret="$1" --project="$PROJECT" 2>/dev/null
}

cat > terraform.tfvars <<EOF
firebase_api_key             = "$(get_secret firebase-api-key)"
firebase_auth_domain         = "$(get_secret firebase-auth-domain)"
firebase_storage_bucket      = "$(get_secret firebase-storage-bucket)"
firebase_messaging_sender_id = "$(get_secret firebase-messaging-sender-id)"
firebase_app_id              = "$(get_secret firebase-app-id)"
EOF

echo "✓ terraform.tfvars generado"
echo ""
echo "Secretos de la app (en Secret Manager, no en tfvars):"
echo "  google-maps-api-key, google-genai-api-key"
echo "  tripadvisor-api-key, yelp-api-key, here-api-key"
echo "  openrouter-api-key, groq-api-key, database-url"
