terraform {
  backend "gcs" {
    bucket = "pruebas-edem-dataproject3-tfstate"
    prefix = "terraform/state/shared"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.0"
    }
  }
}

provider "google" {
  project = "pruebas-edem-dataproject3"
  region  = "europe-west1"
}

provider "google-beta" {
  project = "pruebas-edem-dataproject3"
  region  = "europe-west1"
}

# ── Artifact Registry ─────────────────────────────────────────────────────────
module "registry" {
  source     = "../modules/registry"
  project_id = "pruebas-edem-dataproject3"
  region     = "europe-west1"
}

# ── Firestore + Firebase ──────────────────────────────────────────────────────
# ── BigQuery (analytics global) ───────────────────────────────────────────────
module "databases" {
  source     = "../modules/databases"
  project_id = "pruebas-edem-dataproject3"
  region     = "europe-west1"
}

# ── Outputs para que los workspaces puedan leerlos ───────────────────────────
output "registry_image" {
  value = module.registry.image
}

output "registry_build_id" {
  value = module.registry.build_id
}
