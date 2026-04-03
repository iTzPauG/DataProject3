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
    null = {
      source  = "hashicorp/null"
      version = "~> 3.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

module "apis" {
  source     = "./modules/apis"
  project_id = var.project_id
}

module "registry" {
  source     = "./modules/registry"
  project_id = var.project_id
  region     = var.region
  depends_on = [module.apis]
}

module "cloud_run" {
  source     = "./modules/cloud_run"
  region     = var.region
  image      = module.registry.image
  build_id   = module.registry.build_id
  depends_on = [module.apis]
}

module "iam" {
  source       = "./modules/iam"
  region       = var.region
  service_name = module.cloud_run.service_name
}
