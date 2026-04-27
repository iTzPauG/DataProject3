variable "project_id" {
  default = "project1grupo7"
}

variable "region" {
  default = "europe-west1"
}

variable "firebase_api_key" {
  sensitive = true
  default   = ""
}

variable "firebase_auth_domain" {
  default = ""
}

variable "firebase_storage_bucket" {
  default = ""
}

variable "firebase_messaging_sender_id" {
  default = ""
}

variable "firebase_app_id" {
  sensitive = true
  default   = ""
}
