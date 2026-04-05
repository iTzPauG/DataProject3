# Guía de Migración a Nuevo Proyecto GCP

Esta guía explica cómo desplegar GADO en un nuevo proyecto de GCP desde cero.

---

## Antes de empezar — Requisitos

Necesitas tener instalado en tu ordenador:

### Mac

| Herramienta | Cómo instalar |
|---|---|
| `gcloud` CLI | `brew install google-cloud-sdk` |
| `terraform` | `brew install terraform` |
| `docker` | Instala Docker Desktop desde docker.com |
| `psql` | `brew install postgresql` |
| `cloud-sql-proxy` | `brew install cloud-sql-proxy` |

Verifica que todo está instalado:
```bash
gcloud --version && terraform --version && docker --version && psql --version && cloud-sql-proxy --version
```

### Windows

1. **gcloud CLI**: Descarga el instalador desde [cloud.google.com/sdk/docs/install#windows](https://cloud.google.com/sdk/docs/install#windows) y ejecútalo. Al terminar abre una terminal nueva.

2. **Terraform**: Descarga el `.zip` desde [releases.hashicorp.com/terraform](https://releases.hashicorp.com/terraform/) → elige la versión más reciente → `terraform_X.X.X_windows_amd64.zip`. Extrae el `terraform.exe` y muévelo a `C:\Windows\System32\` para que esté disponible en cualquier terminal.

3. **Docker**: Descarga Docker Desktop desde [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/). Requiere Windows 10/11 con WSL2 activado.

4. **psql**: Descarga el instalador de PostgreSQL desde [postgresql.org/download/windows](https://www.postgresql.org/download/windows/). Durante la instalación, marca solo "Command Line Tools" si no quieres instalar el servidor completo.

5. **cloud-sql-proxy**: Descarga el ejecutable desde [github.com/GoogleCloudPlatform/cloud-sql-proxy/releases](https://github.com/GoogleCloudPlatform/cloud-sql-proxy/releases) → elige `cloud-sql-proxy_windows_amd64.exe`. Renómbralo a `cloud-sql-proxy.exe` y muévelo a `C:\Windows\System32\`.

Verifica que todo está instalado (en PowerShell o CMD):
```powershell
gcloud --version
terraform --version
docker --version
psql --version
cloud-sql-proxy --version
```

> ⚠️ En Windows, todos los comandos `bash` de esta guía deben ejecutarse en **PowerShell** o en **Git Bash** (incluido con Git for Windows). Se recomienda Git Bash para mayor compatibilidad.

---

## Opción A — Migración automática (recomendada)

Si tienes todo instalado, el script hace casi todo solo:

```bash
# 1. Clona el repo y entra en él
git clone <URL_DEL_REPO>
cd DataProject3

# 2.Crea un nuevo proyecto en GCP y edita el script terraform/scripts/migrate_to_new_project.sh
# Pon el ID del nuevo proyecto
# Cambia la línea: NEW_PROJECT_ID=""
# Por ejemplo:    NEW_PROJECT_ID="nuevo-proyecto-edem-2024"

# 3. Ejecuta el script
bash terraform/scripts/migrate_to_new_project.sh
```

El script te irá pidiendo las cosas que necesita (Firebase config, API keys) y hace el resto solo.

Si el script falla en algún paso, sigue la **Opción B** desde ese paso.

---

## Opción B — Migración manual paso a paso

### Paso 1 — Autenticarse con GCP

```bash
gcloud auth login
gcloud auth application-default login
```

Cuando abra el navegador, inicia sesión con la cuenta que tiene acceso al nuevo proyecto.

Verifica que puedes ver el proyecto:
```bash
gcloud projects describe TU_NUEVO_PROJECT_ID
```

Si da error, pide al administrador que te dé el rol **Owner** en el proyecto.

---

### Paso 2 — Activar Firebase (MANUAL, no se puede automatizar)

Firebase no se puede activar desde la línea de comandos. Hay que hacerlo desde la web:

1. Ve a [console.firebase.google.com](https://console.firebase.google.com)
2. Haz clic en **"Add project"**
3. En el buscador, escribe el ID del nuevo proyecto y selecciónalo
4. Haz clic en **"Continue"** (no necesitas Google Analytics)
5. Espera a que se cree (1-2 minutos)

Una vez creado, crea la Web App para obtener las claves:
1. En la consola de Firebase, haz clic en el icono `</>` (Web)
2. Ponle nombre "GADO Web" y haz clic en **"Register app"**
3. Copia el objeto `firebaseConfig` que aparece — lo necesitarás en el Paso 5

También activa los métodos de autenticación:
1. En Firebase → **Authentication** → **Sign-in method**
2. Activa **Email/Password**
3. Activa **Google**

---

### Paso 3 — Actualizar el código con el nuevo proyecto

Abre el archivo `terraform/variables.tf` y cambia el `project_id`:

```hcl
variable "project_id" {
  default = "TU_NUEVO_PROJECT_ID"   # ← cambia esto
}
```

Abre `terraform/main.tf` y cambia el bucket del estado:

```hcl
backend "gcs" {
  bucket = "<TU_NUEVO_PROJECT_ID>-tfstate"   # ← cambia esto
  prefix = "terraform/state"
}
```

---

### Paso 4 — Crear el bucket para el estado de Terraform

El estado de Terraform (que recuerda qué recursos existen) se guarda en un bucket de GCS.
Hay que crearlo antes de poder usar Terraform.

```bash
cd terraform/bootstrap
terraform init
terraform apply -auto-approve
cd ..
```

Verifica que se creó:
```bash
gsutil ls gs://TU_NUEVO_PROJECT_ID-tfstate
```

---

### Paso 5 — Crear el archivo de variables secretas

Crea el archivo `terraform/terraform.tfvars` con los valores del `firebaseConfig` que copiaste en el Paso 2:

```bash
cat > terraform/terraform.tfvars <<EOF
firebase_api_key             = ""
firebase_auth_domain         = "TU_PROYECTO.firebaseapp.com"
firebase_storage_bucket      = "TU_PROYECTO.firebasestorage.app"
firebase_messaging_sender_id = ""
firebase_app_id              = ""
EOF
```

> ⚠️ Este archivo contiene claves secretas. **Nunca lo subas a git.** Ya está en el `.gitignore`.

---

### Paso 6 — Inicializar Terraform

```bash
cd terraform
terraform init
```

Debería decir `Terraform has been successfully initialized!`

Si pregunta si quieres copiar el estado anterior, di **no** (es un proyecto nuevo).

---

### Paso 7 — Desplegar la infraestructura base

Primero desplegamos solo las bases de datos y Firebase (sin el backend ni frontend):

```bash
terraform apply -auto-approve \
  -target=module.apis \
  -target=module.databases \
  -target=module.cloud_sql
```

> ⏳ **Cloud SQL tarda ~10 minutos en crearse.** Es normal, no canceles.

Cuando termine verás algo como:
```
Apply complete! Resources: 20 added, 0 changed, 0 destroyed.
cloud_sql_connection = "TU_PROYECTO:europe-west1:gado-postgres"
```

---

### Paso 8 — Crear los secretos con las API keys

Los secretos se guardan en Secret Manager de GCP (no en el código).

```bash
# API keys reales (pide estas claves al responsable del proyecto)
echo -n "TU_GOOGLE_MAPS_KEY" | gcloud secrets create google-maps-api-key --data-file=- --project=TU_NUEVO_PROJECT_ID
echo -n "TU_GOOGLE_GENAI_KEY" | gcloud secrets create google-genai-api-key --data-file=- --project=TU_NUEVO_PROJECT_ID
echo -n "TU_GEOAPIFY_KEY" | gcloud secrets create geoapify-api-key --data-file=- --project=TU_NUEVO_PROJECT_ID

# API keys futuras (por ahora con valor "mock")
echo -n "mock" | gcloud secrets create tripadvisor-api-key --data-file=- --project=TU_NUEVO_PROJECT_ID
echo -n "mock" | gcloud secrets create yelp-api-key --data-file=- --project=TU_NUEVO_PROJECT_ID
echo -n "mock" | gcloud secrets create here-api-key --data-file=- --project=TU_NUEVO_PROJECT_ID
echo -n "mock" | gcloud secrets create openrouter-api-key --data-file=- --project=TU_NUEVO_PROJECT_ID
echo -n "mock" | gcloud secrets create groq-api-key --data-file=- --project=TU_NUEVO_PROJECT_ID

# Secretos de Firebase (para que otros compañeros puedan generar el tfvars)
echo -n "TU_FIREBASE_API_KEY" | gcloud secrets create firebase-api-key --data-file=- --project=TU_NUEVO_PROJECT_ID
echo -n "TU_FIREBASE_AUTH_DOMAIN" | gcloud secrets create firebase-auth-domain --data-file=- --project=TU_NUEVO_PROJECT_ID
echo -n "TU_FIREBASE_STORAGE_BUCKET" | gcloud secrets create firebase-storage-bucket --data-file=- --project=TU_NUEVO_PROJECT_ID
echo -n "TU_FIREBASE_MESSAGING_SENDER_ID" | gcloud secrets create firebase-messaging-sender-id --data-file=- --project=TU_NUEVO_PROJECT_ID
echo -n "TU_FIREBASE_APP_ID" | gcloud secrets create firebase-app-id --data-file=- --project=TU_NUEVO_PROJECT_ID
```

---

### Paso 9 — Desplegar todo

```bash
terraform apply -auto-approve
```

Esto construirá las imágenes Docker del backend y frontend, las subirá a GCP y desplegará los servicios Cloud Run.

> ⏳ Tarda ~5-10 minutos (construye las imágenes Docker).

Al final verás las URLs:
```
cloud_run_url = "https://restaurant-api-XXXXX-ew.a.run.app"
frontend_url  = "https://gado-frontend-XXXXX-ew.a.run.app"
```

---

### Paso 10 — Inicializar la base de datos

La base de datos Cloud SQL se crea vacía. Hay que aplicar el schema (las tablas).

```bash
# 1. Obtén la contraseña de la base de datos
DB_URL=$(gcloud secrets versions access latest --secret="database-url" --project=TU_NUEVO_PROJECT_ID)
DB_PASS=$(echo "$DB_URL" | grep -oP '(?<=://gado_app:)[^@]+')

# 2. Arranca el proxy de Cloud SQL (déjalo corriendo en esta terminal)
cloud-sql-proxy TU_NUEVO_PROJECT_ID:europe-west1:gado-postgres

# 3. En OTRA terminal, aplica el schema
PGPASSWORD="$DB_PASS" psql "host=127.0.0.1 dbname=gado user=gado_app" \
  -f main/supabase/migrations/005_cloud_sql_clean_schema.sql
```

Verifica que se crearon las tablas:
```bash
PGPASSWORD="$DB_PASS" psql "host=127.0.0.1 dbname=gado user=gado_app" \
  -c "SELECT COUNT(*) FROM categories;"
```
Debería devolver `18`.

---

## Verificación final

Comprueba que todo funciona:

```bash
# Backend
curl https://TU_BACKEND_URL/health
# Debe devolver: {"status":"ok"}

# Categorías (requiere base de datos)
curl https://TU_BACKEND_URL/categories
# Debe devolver una lista de categorías

# Frontend
# Abre en el navegador: https://TU_FRONTEND_URL
```

---

## Si algo falla

### "Permission denied" en Terraform
```bash
gcloud auth application-default login
```

### "Bucket already exists" al crear el tfstate
El bucket ya existe de antes. Puedes ignorar ese error y continuar.

### Cloud SQL tarda demasiado
Es normal. Cloud SQL puede tardar hasta 15 minutos. No canceles el `terraform apply`.

### El frontend muestra pantalla blanca
Abre las DevTools del navegador (F12 → Console) y busca errores en rojo.
Normalmente es un problema con las variables de Firebase — verifica que el `terraform.tfvars` tiene los valores correctos.

### "ImportError" en los logs del backend
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=restaurant-api" \
  --project=TU_NUEVO_PROJECT_ID --limit=20 --format="value(textPayload)"
```

---

## Para compañeros que se unan después

Una vez que el proyecto está desplegado, cualquier compañero que quiera trabajar con Terraform solo necesita:

```bash
# 1. Autenticarse
gcloud auth login
gcloud auth application-default login

# 2. Generar el tfvars desde Secret Manager
bash terraform/scripts/get_secrets.sh

# 3. Inicializar Terraform (descarga el estado remoto)
cd terraform && terraform init
```

---

## Resumen de lo que hay desplegado

| Servicio | Descripción |
|---|---|
| Cloud Run `restaurant-api` | Backend FastAPI con Gemini, Google Places, etc. |
| Cloud Run `gado-frontend` | Frontend React Native web servido por nginx |
| Cloud SQL `gado-postgres` | Base de datos PostgreSQL con PostGIS |
| Firestore `(default)` | Tiempo real: reportes activos, jobs de IA |
| BigQuery `gado_analytics` | Analítica: búsquedas, recomendaciones, uso de Gemini |
| BigQuery `gado_snapshots` | Dashboard directivo: KPIs diarios |
| Secret Manager | Todas las API keys y credenciales |
| Artifact Registry | Imágenes Docker del backend y frontend |
| Firebase Auth | Autenticación de usuarios |
