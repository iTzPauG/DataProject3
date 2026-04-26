terraform {
  # Volvemos a configurar el backend original que viste en la terminal
  backend "gcs" {
    bucket  = "TU_BUCKET_DE_ESTADO_GCP" # Pon el nombre de tu bucket de Google
    prefix  = "terraform/state"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = "TU_ID_DE_PROYECTO_GCP"
  region  = "europe-west1" # O la que uses
}

# AQUÍ ES DONDE LLAMAS A TUS MÓDULOS (Los que daban error)
module "apis" { source = "./modules/apis" }
module "iam" { source = "./modules/iam" }
module "registry" { source = "./modules/registry" }
module "cloud_run" { source = "./modules/cloud_run" }
module "cloud_sql" { source = "./modules/cloud_sql" }
# ... añade el resto de módulos que tienes en tu carpeta /modules