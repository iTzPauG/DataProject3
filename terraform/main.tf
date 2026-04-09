terraform {
  backend "gcs" {
    bucket = "pruebas-edem-dataproject3-tfstate"
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
  _workspace_check   = contains(local.allowed_workspaces, terraform.workspace) ? true : tobool("ERROR: Workspace '${terraform.workspace}' no permitido. Usa: terraform workspace select dev-ia|dev-data")
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
    bucket = "pruebas-edem-dataproject3-tfstate"
    prefix = "terraform/state/shared"
  }
}

# ── Secrets de Firebase desde Secret Manager ─────────────────────────────────
data "google_secret_manager_secret_version" "firebase_api_key"             { secret = "firebase-api-key" }
data "google_secret_manager_secret_version" "firebase_app_id"              { secret = "firebase-app-id" }
data "google_secret_manager_secret_version" "firebase_auth_domain"         { secret = "firebase-auth-domain" }
data "google_secret_manager_secret_version" "firebase_storage_bucket"      { secret = "firebase-storage-bucket" }
data "google_secret_manager_secret_version" "firebase_messaging_sender_id" { secret = "firebase-messaging-sender-id" }

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
  firebase_api_key             = data.google_secret_manager_secret_version.firebase_api_key.secret_data
  firebase_auth_domain         = data.google_secret_manager_secret_version.firebase_auth_domain.secret_data
  firebase_project_id          = var.project_id
  firebase_storage_bucket      = data.google_secret_manager_secret_version.firebase_storage_bucket.secret_data
  firebase_messaging_sender_id = data.google_secret_manager_secret_version.firebase_messaging_sender_id.secret_data
  firebase_app_id              = data.google_secret_manager_secret_version.firebase_app_id.secret_data
  backend_url                  = module.cloud_run.url
  depends_on                   = [module.cloud_run]
}

module "cloud_run_frontend" {
  source                       = "./modules/cloud_run_frontend"
  region                       = var.region
  image                        = module.registry_frontend.image
  build_id                     = module.registry_frontend.build_id
  project_id                   = var.project_id
  firebase_api_key             = data.google_secret_manager_secret_version.firebase_api_key.secret_data
  firebase_auth_domain         = data.google_secret_manager_secret_version.firebase_auth_domain.secret_data
  firebase_project_id          = var.project_id
  firebase_storage_bucket      = data.google_secret_manager_secret_version.firebase_storage_bucket.secret_data
  firebase_messaging_sender_id = data.google_secret_manager_secret_version.firebase_messaging_sender_id.secret_data
  firebase_app_id              = data.google_secret_manager_secret_version.firebase_app_id.secret_data
  backend_url                  = module.cloud_run.url
  depends_on                   = [module.apis, module.registry_frontend]
}
