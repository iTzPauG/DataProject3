terraform {
  backend "gcs" {
    bucket = "project1grupo7-tfstate"
    prefix = "terraform/state"
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
    null = {
      source  = "hashicorp/null"
      version = "~> 3.0"
    }
  }
}

locals {
  allowed_workspaces = ["dev-ia", "dev-data", "main"]
}

resource "terraform_data" "workspace_guard" {
  lifecycle {
    precondition {
      condition     = contains(local.allowed_workspaces, terraform.workspace)
      error_message = "ERROR: Workspace '${terraform.workspace}' no permitido. Usa: terraform workspace select dev-ia|dev-data|main"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# ── State compartido (registry, firestore, bigquery, firebase) ────────────────
data "terraform_remote_state" "shared" {
  backend = "gcs"
  config = {
    bucket = "project1grupo7-tfstate"
    prefix = "terraform/state/shared"
  }
}

# ── Secrets de Firebase desde variables ──────────────────────────────────────
locals {
  firebase_api_key             = var.firebase_api_key
  firebase_app_id              = var.firebase_app_id
  firebase_auth_domain         = var.firebase_auth_domain
  firebase_storage_bucket      = var.firebase_storage_bucket
  firebase_messaging_sender_id = var.firebase_messaging_sender_id
}

# ── Por workspace ─────────────────────────────────────────────────────────────
module "apis" {
  source     = "./modules/apis"
  project_id = var.project_id
}

module "cloud_sql" {
  source     = "./modules/cloud_sql"
  project_id = var.project_id
  region     = var.region
  depends_on = [module.apis]
}

module "cloud_run" {
  source               = "./modules/cloud_run"
  region               = var.region
  image                = data.terraform_remote_state.shared.outputs.registry_image
  build_id             = data.terraform_remote_state.shared.outputs.registry_build_id
  cloud_sql_connection = module.cloud_sql.connection_name
  depends_on           = [module.apis, module.cloud_sql]
}

module "iam" {
  source       = "./modules/iam"
  region       = var.region
  project_id   = var.project_id
  service_name = module.cloud_run.service_name
}

module "bigquery_tables" {
  source     = "./modules/bigquery_tables"
  project_id = var.project_id
}

module "registry_frontend" {
  source                       = "./modules/registry_frontend"
  project_id                   = var.project_id
  region                       = var.region
  firebase_api_key             = var.firebase_api_key
  firebase_auth_domain         = var.firebase_auth_domain
  firebase_project_id          = var.project_id
  firebase_storage_bucket      = var.firebase_storage_bucket
  firebase_messaging_sender_id = var.firebase_messaging_sender_id
  firebase_app_id              = var.firebase_app_id
  backend_url                  = module.cloud_run.url
  depends_on                   = [module.cloud_run]
}

module "cloud_run_frontend" {
  source                       = "./modules/cloud_run_frontend"
  region                       = var.region
  image                        = module.registry_frontend.image
  build_id                     = module.registry_frontend.build_id
  project_id                   = var.project_id
  firebase_api_key             = var.firebase_api_key
  firebase_auth_domain         = var.firebase_auth_domain
  firebase_project_id          = var.project_id
  firebase_storage_bucket      = var.firebase_storage_bucket
  firebase_messaging_sender_id = var.firebase_messaging_sender_id
  firebase_app_id              = var.firebase_app_id
  backend_url                  = module.cloud_run.url
  depends_on                   = [module.apis, module.registry_frontend]
}
