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
terraform init
terraform apply
```

### Dev-Data
```bash
cd terraform
terraform workspace select dev-data
terraform init
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