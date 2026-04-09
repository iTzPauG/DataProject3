# Guía de Infraestructura Multi-Entorno

## 1. Despliegue por entorno

### Requisitos previos
- Terraform instalado
- `gcloud` autenticado con tu cuenta
- Docker corriendo

### Dev-IA
```bash
cd terraform
terraform workspace select dev-ia
terraform apply
```

### Dev-Data
```bash
cd terraform
terraform workspace select dev-data
terraform apply
```

---

## 2. Qué se comparte y qué no

### ✅ Compartido entre todos los entornos
| Recurso | Motivo |
|---|---|
| Proyecto GCP (`pruebas-edem-dataproject3`) | Un solo proyecto |
| Secrets de Secret Manager (`google-maps-api-key`, `google-genai-api-key`, etc.) | Creados una vez, todos los entornos los leen |
| Artifact Registry (`restaurant-api`) | Las imágenes Docker se suben aquí y todos los entornos las usan |
| Cloud SQL (instancia) | Una sola instancia compartida |
| Firebase / Supabase | Servicios externos, no gestionados por Terraform |
| Bucket de tfstate (`pruebas-edem-dataproject3-tfstate`) | El bucket es uno, pero cada workspace tiene su propio prefix |

### ❌ Aislado por entorno
| Recurso | Dev-IA | Dev-Data |
|---|---|---|
| Cloud Run API | `restaurant-api-dev-ia` | `restaurant-api-dev-data` |
| Cloud Run Frontend | `gado-frontend-dev-ia` | `gado-frontend-dev-data` |
| Terraform state | `terraform/state/dev-ia/` | `terraform/state/dev-data/` |
| URL del servicio | Distinta por entorno | Distinta por entorno |

---

## 3. Cómo reproducir esto en un proyecto nuevo

### Paso 1 — Estructura de ficheros
```
terraform/
├── main.tf
├── variables.tf
└── modules/
    ├── cloud_run/
    ├── iam/
    └── ...
```

### Paso 2 — Backend con prefix por workspace
En `main.tf`:
```hcl
terraform {
  backend "gcs" {
    bucket = "<tu-bucket-de-tfstate>"
    prefix = "terraform/state"
    # GCS añade automáticamente /<workspace> al prefix
  }
}
```

### Paso 3 — Bloquear workspaces no permitidos
```hcl
locals {
  allowed_workspaces = ["dev-ia", "dev-data"]
  _workspace_check = contains(local.allowed_workspaces, terraform.workspace) ? true : tobool("ERROR: Workspace '${terraform.workspace}' no permitido. Usa: terraform workspace select dev-ia|dev-data")
}
```

### Paso 4 — Sufijo de workspace en todos los recursos
```hcl
resource "google_cloud_run_v2_service" "api" {
  name = "mi-servicio-${terraform.workspace}"
}
```

### Paso 5 — Leer secrets desde Secret Manager (sin tfvars)
```hcl
data "google_secret_manager_secret_version" "mi_secret" {
  secret = "nombre-del-secret"
}
# Uso: data.google_secret_manager_secret_version.mi_secret.secret_data
```

### Paso 6 — Crear los workspaces
```bash
terraform workspace new dev-ia
terraform workspace new dev-data
```

### Paso 7 — Crear SA de CI/CD en GCP
```bash
PROJECT=<tu-proyecto>

gcloud iam service-accounts create cicd-terraform \
  --project=$PROJECT \
  --display-name="CI/CD Terraform SA"

gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:cicd-terraform@${PROJECT}.iam.gserviceaccount.com" \
  --role="roles/editor" \
  --condition=None
```

### Paso 8 — Restringir acceso al state en GCS
```bash
BUCKET=<tu-bucket-de-tfstate>
PROJECT=<tu-proyecto>

# SA de CI/CD: acceso total
gcloud storage buckets add-iam-policy-binding gs://$BUCKET \
  --member="serviceAccount:cicd-terraform@${PROJECT}.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin" \
  --condition=None

# Usuarios: solo pueden escribir en prefixes dev-*
for EMAIL in user1@gmail.com user2@gmail.com; do
  gcloud storage buckets add-iam-policy-binding gs://$BUCKET \
    --member="user:$EMAIL" \
    --role="roles/storage.objectAdmin" \
    --condition="title=no-main-state,expression=resource.name.startsWith(\"projects/_/buckets/${BUCKET}/objects/terraform/state/dev\")"
done
```

### Paso 9 — IAM conditions en Cloud Run por equipo
```bash
PROJECT=<tu-proyecto>

# Equipo A: solo recursos con sufijo dev-ia
for EMAIL in user_ia_1@gmail.com user_ia_2@gmail.com; do
  gcloud projects add-iam-policy-binding $PROJECT \
    --member="user:$EMAIL" \
    --role="roles/run.developer" \
    --condition="title=solo-dev-ia,expression=resource.name.endsWith(\"dev-ia\")"
done

# Equipo B: solo recursos con sufijo dev-data
for EMAIL in user_data_1@gmail.com; do
  gcloud projects add-iam-policy-binding $PROJECT \
    --member="user:$EMAIL" \
    --role="roles/run.developer" \
    --condition="title=solo-dev-data,expression=resource.name.endsWith(\"dev-data\")"
done
```

### Paso 10 — Configurar CI/CD
El pipeline se autentica como la SA `cicd-terraform` con su key JSON o Workload Identity. Nadie más tiene esas credenciales.

Ejemplo GitHub Actions:
```yaml
- name: Auth GCP
  uses: google-github-actions/auth@v2
  with:
    credentials_json: ${{ secrets.CICD_SA_KEY }}

- name: Terraform apply
  run: |
    terraform workspace select <workspace-de-prod>
    terraform apply -auto-approve
```

### Limitaciones conocidas
- Sin organización GCP las Deny Policies no están disponibles. El aislamiento depende de los permisos IAM aplicados directamente en GCP.
- Con organización GCP se puede añadir una Deny Policy que bloquea permisos de escritura de forma irrevocable incluso para Editors.
