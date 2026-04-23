#!/bin/bash
# =============================================================================
# GADO — Script de migración a nuevo proyecto GCP
# Uso: bash scripts/migrate_to_new_project.sh
# Requisitos: gcloud, terraform, docker, psql, cloud-sql-proxy instalados
# =============================================================================

set -e  # Para si hay algún error

# ── CONFIGURACIÓN — CAMBIAR ESTOS VALORES ────────────────────────────────────
NEW_PROJECT_ID=""        # ej: nuevo-proyecto-gcp-123
NEW_REGION="europe-west1"
# ─────────────────────────────────────────────────────────────────────────────

if [ -z "$NEW_PROJECT_ID" ]; then
  echo "❌ ERROR: Debes editar este script y poner el NEW_PROJECT_ID"
  echo "   Abre scripts/migrate_to_new_project.sh y rellena la variable NEW_PROJECT_ID"
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║         GADO — Migración a nuevo proyecto GCP        ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "Proyecto destino: $NEW_PROJECT_ID"
echo "Región: $NEW_REGION"
echo ""

# ── PASO 1: Verificar autenticación ──────────────────────────────────────────
echo "▶ [1/9] Verificando autenticación con GCP..."
ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | head -1)
if [ -z "$ACTIVE_ACCOUNT" ]; then
  echo "   No hay cuenta activa. Iniciando login..."
  gcloud auth login
  gcloud auth application-default login
else
  echo "   ✓ Cuenta activa: $ACTIVE_ACCOUNT"
fi

# Verificar acceso al proyecto
if ! gcloud projects describe "$NEW_PROJECT_ID" &>/dev/null; then
  echo "❌ No tienes acceso al proyecto $NEW_PROJECT_ID"
  echo "   Asegúrate de que tu cuenta tiene el rol Owner o Editor"
  exit 1
fi
echo "   ✓ Acceso al proyecto verificado"

# ── PASO 2: Activar Firebase en el nuevo proyecto ────────────────────────────
echo ""
echo "▶ [2/9] Comprobando Firebase..."
echo "   ⚠️  ACCIÓN MANUAL REQUERIDA:"
echo "   1. Ve a https://console.firebase.google.com"
echo "   2. Haz clic en 'Add project' y selecciona: $NEW_PROJECT_ID"
echo "   3. Completa el proceso (no necesitas Google Analytics)"
echo "   4. Una vez creado, ve a Project Settings → General → Your apps"
echo "   5. Añade una Web app y copia el firebaseConfig"
echo ""
read -p "   ¿Has activado Firebase y tienes el firebaseConfig? (s/n): " firebase_ready
if [ "$firebase_ready" != "s" ]; then
  echo "   Por favor activa Firebase primero y vuelve a ejecutar el script"
  exit 1
fi

echo ""
echo "   Introduce los valores del firebaseConfig:"
read -p "   apiKey: " FIREBASE_API_KEY
read -p "   authDomain: " FIREBASE_AUTH_DOMAIN
read -p "   storageBucket: " FIREBASE_STORAGE_BUCKET
read -p "   messagingSenderId: " FIREBASE_MESSAGING_SENDER_ID
read -p "   appId: " FIREBASE_APP_ID

# ── PASO 3: Actualizar variables de Terraform ─────────────────────────────────
echo ""
echo "▶ [3/9] Actualizando configuración de Terraform..."

# Actualizar project_id en variables.tf
sed -i.bak "s/default = \".*\"/default = \"$NEW_PROJECT_ID\"/" terraform/variables.tf
echo "   ✓ project_id actualizado en terraform/variables.tf"

# Actualizar bucket del backend en main.tf
sed -i.bak "s/bucket = \".*-tfstate\"/bucket = \"${NEW_PROJECT_ID}-tfstate\"/" terraform/main.tf
echo "   ✓ bucket de tfstate actualizado en terraform/main.tf"

# Crear terraform.tfvars
cat > terraform/terraform.tfvars <<EOF
firebase_api_key             = "$FIREBASE_API_KEY"
firebase_auth_domain         = "$FIREBASE_AUTH_DOMAIN"
firebase_storage_bucket      = "$FIREBASE_STORAGE_BUCKET"
firebase_messaging_sender_id = "$FIREBASE_MESSAGING_SENDER_ID"
firebase_app_id              = "$FIREBASE_APP_ID"
EOF
echo "   ✓ terraform/terraform.tfvars creado"

# ── PASO 4: Crear bucket de tfstate ──────────────────────────────────────────
echo ""
echo "▶ [4/9] Creando bucket para el estado de Terraform..."
if gsutil ls "gs://${NEW_PROJECT_ID}-tfstate" &>/dev/null; then
  echo "   ✓ El bucket ya existe"
else
  cd terraform/bootstrap
  terraform init -reconfigure
  terraform apply -auto-approve -var="project_id=$NEW_PROJECT_ID" -var="region=$NEW_REGION"
  cd ../..
  echo "   ✓ Bucket creado: gs://${NEW_PROJECT_ID}-tfstate"
fi

# ── PASO 5: Inicializar Terraform con el nuevo backend ───────────────────────
echo ""
echo "▶ [5/9] Inicializando Terraform..."
cd terraform
terraform init -reconfigure
echo "   ✓ Terraform inicializado"

# ── PASO 6: Desplegar infraestructura base (sin frontend) ────────────────────
echo ""
echo "▶ [6/9] Desplegando infraestructura base (APIs, Cloud SQL, Firebase, BigQuery)..."
echo "   Esto puede tardar 10-15 minutos (Cloud SQL tarda ~10 min en crearse)"
terraform apply -auto-approve \
  -target=module.apis \
  -target=module.databases \
  -target=module.cloud_sql
echo "   ✓ Infraestructura base desplegada"

# ── PASO 7: Crear secretos en Secret Manager ─────────────────────────────────
echo ""
echo "▶ [7/9] Creando secretos en Secret Manager..."
echo "   Introduce las API keys (pulsa Enter para dejar 'mock' si no tienes la clave aún):"

create_secret() {
  local name=$1
  local value=$2
  if gcloud secrets describe "$name" --project="$NEW_PROJECT_ID" &>/dev/null; then
    echo "   ⚠️  El secreto '$name' ya existe, actualizando..."
    echo -n "$value" | gcloud secrets versions add "$name" --data-file=- --project="$NEW_PROJECT_ID"
  else
    echo -n "$value" | gcloud secrets create "$name" --data-file=- --project="$NEW_PROJECT_ID"
  fi
}

read -p "   GOOGLE_MAPS_API_KEY: " GMAPS_KEY
read -p "   GOOGLE_GENAI_API_KEY: " GENAI_KEY

create_secret "google-maps-api-key"      "${GMAPS_KEY:-mock}"
create_secret "google-genai-api-key"     "${GENAI_KEY:-mock}"
create_secret "tripadvisor-api-key"      "mock"
create_secret "yelp-api-key"             "mock"
create_secret "here-api-key"             "mock"
create_secret "openrouter-api-key"       "mock"
create_secret "groq-api-key"             "mock"

# También guardar Firebase secrets para que los compañeros puedan usar get_secrets.sh
create_secret "firebase-api-key"             "$FIREBASE_API_KEY"
create_secret "firebase-auth-domain"         "$FIREBASE_AUTH_DOMAIN"
create_secret "firebase-storage-bucket"      "$FIREBASE_STORAGE_BUCKET"
create_secret "firebase-messaging-sender-id" "$FIREBASE_MESSAGING_SENDER_ID"
create_secret "firebase-app-id"              "$FIREBASE_APP_ID"

echo "   ✓ Secretos creados"

# ── PASO 8: Desplegar todo ────────────────────────────────────────────────────
echo ""
echo "▶ [8/9] Desplegando backend y frontend..."
echo "   Esto construirá las imágenes Docker y las subirá a Artifact Registry"
echo "   Puede tardar 5-10 minutos..."
terraform apply -auto-approve
echo "   ✓ Todo desplegado"

# ── PASO 9: Aplicar schema en Cloud SQL ──────────────────────────────────────
echo ""
echo "▶ [9/9] Aplicando schema en Cloud SQL..."
echo "   Obteniendo credenciales de la base de datos..."

DB_URL=$(gcloud secrets versions access latest --secret="database-url" --project="$NEW_PROJECT_ID")
DB_PASS=$(echo "$DB_URL" | grep -oP '(?<=://gado_app:)[^@]+')

echo "   Arrancando Cloud SQL Proxy..."
pkill -f cloud-sql-proxy 2>/dev/null || true
sleep 1
cloud-sql-proxy "${NEW_PROJECT_ID}:${NEW_REGION}:gado-postgres" &
PROXY_PID=$!
sleep 5

echo "   Aplicando schema..."
PGPASSWORD="$DB_PASS" psql "host=127.0.0.1 dbname=gado user=gado_app" \
  -f ../main/supabase/migrations/005_cloud_sql_clean_schema.sql

kill $PROXY_PID 2>/dev/null || true
echo "   ✓ Schema aplicado"

# ── RESUMEN ───────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║                  ✅ MIGRACIÓN COMPLETA               ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
terraform output
echo ""
echo "URLs desplegadas:"
echo "  Backend:  $(terraform output -raw cloud_run_url 2>/dev/null)"
echo "  Frontend: $(terraform output -raw frontend_url 2>/dev/null)"
echo ""
echo "Recuerda:"
echo "  - Actualizar las API keys 'mock' en Secret Manager cuando las tengas"
echo "  - Activar Firebase Auth (Email/Password y Google) en la consola de Firebase"
echo "  - El tfstate está en: gs://${NEW_PROJECT_ID}-tfstate/terraform/state"
