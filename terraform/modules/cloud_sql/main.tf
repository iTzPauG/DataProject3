resource "google_sql_database_instance" "main" {
  name             = "gado-postgres-${terraform.workspace}"
  database_version = "POSTGRES_15"
  region           = var.region

  settings {
    tier              = "db-f1-micro"
    availability_type = "ZONAL"
    disk_size         = 10
    disk_autoresize   = true
    backup_configuration { enabled = true }
    ip_configuration { ipv4_enabled = true }
  }

  deletion_protection = false
}

resource "google_sql_database" "gado" {
  name     = "gado"
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "app" {
  name     = "gado_app"
  instance = google_sql_database_instance.main.name
  password = random_password.db_password.result
}

resource "random_password" "db_password" {
  length  = 32
  special = false
}

resource "google_secret_manager_secret" "database_url" {
  secret_id = "database-url-${terraform.workspace}"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "database_url" {
  secret      = google_secret_manager_secret.database_url.id
  secret_data = "postgresql://gado_app:${random_password.db_password.result}@/${google_sql_database.gado.name}?host=/cloudsql/${google_sql_database_instance.main.connection_name}"
}
