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

# ── GitHub Actions CI/CD permissions ─────────────────────────────────────────
resource "google_project_iam_member" "github_actions_registry" {
  project = "pruebas-edem-dataproject3"
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:github-actions@pruebas-edem-dataproject3.iam.gserviceaccount.com"
}

resource "google_project_iam_member" "github_actions_run_admin" {
  project = "pruebas-edem-dataproject3"
  role    = "roles/run.admin"
  member  = "serviceAccount:github-actions@pruebas-edem-dataproject3.iam.gserviceaccount.com"
}

resource "google_project_iam_member" "github_actions_sa_user" {
  project = "pruebas-edem-dataproject3"
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:github-actions@pruebas-edem-dataproject3.iam.gserviceaccount.com"
}

# ── Outputs para que los workspaces puedan leerlos ───────────────────────────
output "registry_image" {
  value = module.registry.image
}

output "registry_build_id" {
  value = module.registry.build_id
}
