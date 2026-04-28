# ── Firestore ────────────────────────────────────────────────────────────────

resource "google_firestore_database" "default" {
  project     = var.project_id
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  delete_protection_state = "DELETE_PROTECTION_ENABLED"
}

# TTL policy: auto-expire active_reports after expires_at field
resource "google_firestore_field" "reports_ttl" {
  project    = var.project_id
  database   = google_firestore_database.default.name
  collection = "active_reports"
  field      = "expires_at"

  ttl_config {}
}

# TTL policy: auto-expire brain_jobs after 1h
resource "google_firestore_field" "brain_jobs_ttl" {
  project    = var.project_id
  database   = google_firestore_database.default.name
  collection = "brain_jobs"
  field      = "expires_at"

  ttl_config {}
}

# ── Firebase Auth ─────────────────────────────────────────────────────────────

resource "google_firebase_project" "default" {
  provider = google-beta
  project  = var.project_id
}

resource "google_firebase_web_app" "gado" {
  provider     = google-beta
  project      = var.project_id
  display_name = "WHIM Web"
  depends_on   = [google_firebase_project.default]
}

# ── BigQuery ─────────────────────────────────────────────────────────────────

resource "google_bigquery_dataset" "analytics" {
  project    = var.project_id
  dataset_id = "gado_analytics"
  location   = var.region

  delete_contents_on_destroy = false
}

resource "google_bigquery_dataset" "snapshots" {
  project    = var.project_id
  dataset_id = "gado_snapshots"
  location   = var.region

  delete_contents_on_destroy = false
}

# ── BigQuery Tables: gado_analytics ──────────────────────────────────────────

locals {
  day_partition = {
    type  = "DAY"
    field = "created_at"
  }
}

resource "google_bigquery_table" "search_events" {
  project             = var.project_id
  dataset_id          = google_bigquery_dataset.analytics.dataset_id
  table_id            = "search_events"
  deletion_protection = false

  time_partitioning {
    type  = local.day_partition.type
    field = local.day_partition.field
  }

  schema = jsonencode([
    { name = "created_at",     type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "session_id",     type = "STRING",    mode = "NULLABLE" },
    { name = "user_id",        type = "STRING",    mode = "NULLABLE" },
    { name = "query",          type = "STRING",    mode = "REQUIRED" },
    { name = "category",       type = "STRING",    mode = "NULLABLE" },
    { name = "lat",            type = "FLOAT64",   mode = "NULLABLE" },
    { name = "lng",            type = "FLOAT64",   mode = "NULLABLE" },
    { name = "radius_m",       type = "INT64",     mode = "NULLABLE" },
    { name = "result_count",   type = "INT64",     mode = "NULLABLE" },
    { name = "response_ms",    type = "INT64",     mode = "NULLABLE" },
    { name = "used_brain",     type = "BOOL",      mode = "NULLABLE" },
    { name = "brain_query",    type = "STRING",    mode = "NULLABLE" },
  ])
}

resource "google_bigquery_table" "recommendation_events" {
  project             = var.project_id
  dataset_id          = google_bigquery_dataset.analytics.dataset_id
  table_id            = "recommendation_events"
  deletion_protection = false

  time_partitioning {
    type  = local.day_partition.type
    field = local.day_partition.field
  }

  schema = jsonencode([
    { name = "created_at",      type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "user_id",         type = "STRING",    mode = "NULLABLE" },
    { name = "category",        type = "STRING",    mode = "REQUIRED" },
    { name = "mood",            type = "STRING",    mode = "NULLABLE" },
    { name = "subcategory",     type = "STRING",    mode = "NULLABLE" },
    { name = "lat",             type = "FLOAT64",   mode = "NULLABLE" },
    { name = "lng",             type = "FLOAT64",   mode = "NULLABLE" },
    { name = "places_returned", type = "INT64",     mode = "NULLABLE" },
    { name = "model_used",      type = "STRING",    mode = "NULLABLE" },
    { name = "response_ms",     type = "INT64",     mode = "NULLABLE" },
  ])
}

resource "google_bigquery_table" "report_lifecycle" {
  project             = var.project_id
  dataset_id          = google_bigquery_dataset.analytics.dataset_id
  table_id            = "report_lifecycle"
  deletion_protection = false

  time_partitioning {
    type  = local.day_partition.type
    field = local.day_partition.field
  }

  schema = jsonencode([
    { name = "created_at",     type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "report_id",      type = "STRING",    mode = "REQUIRED" },
    { name = "event_type",     type = "STRING",    mode = "REQUIRED" }, # created|confirmed|denied|expired|deleted
    { name = "report_type",    type = "STRING",    mode = "NULLABLE" },
    { name = "lat",            type = "FLOAT64",   mode = "NULLABLE" },
    { name = "lng",            type = "FLOAT64",   mode = "NULLABLE" },
    { name = "confirmations",  type = "INT64",     mode = "NULLABLE" },
    { name = "denials",        type = "INT64",     mode = "NULLABLE" },
    { name = "confidence",     type = "FLOAT64",   mode = "NULLABLE" },
    { name = "actor_type",     type = "STRING",    mode = "NULLABLE" }, # user|anon
  ])
}

resource "google_bigquery_table" "vote_events" {
  project             = var.project_id
  dataset_id          = google_bigquery_dataset.analytics.dataset_id
  table_id            = "vote_events"
  deletion_protection = false

  time_partitioning {
    type  = local.day_partition.type
    field = local.day_partition.field
  }

  schema = jsonencode([
    { name = "created_at",  type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "item_type",   type = "STRING",    mode = "REQUIRED" }, # place|event|report
    { name = "item_id",     type = "STRING",    mode = "REQUIRED" },
    { name = "vote",        type = "INT64",     mode = "REQUIRED" }, # 1|-1
    { name = "actor_type",  type = "STRING",    mode = "NULLABLE" }, # user|anon
    { name = "category",    type = "STRING",    mode = "NULLABLE" },
  ])
}

resource "google_bigquery_table" "brain_usage" {
  project             = var.project_id
  dataset_id          = google_bigquery_dataset.analytics.dataset_id
  table_id            = "brain_usage"
  deletion_protection = false

  time_partitioning {
    type  = local.day_partition.type
    field = local.day_partition.field
  }

  schema = jsonencode([
    { name = "created_at",   type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "provider",     type = "STRING",    mode = "REQUIRED" }, # gemini|groq|ollama
    { name = "query",        type = "STRING",    mode = "NULLABLE" },
    { name = "input_tokens", type = "INT64",     mode = "NULLABLE" },
    { name = "output_tokens",type = "INT64",     mode = "NULLABLE" },
    { name = "latency_ms",   type = "INT64",     mode = "NULLABLE" },
    { name = "success",      type = "BOOL",      mode = "NULLABLE" },
    { name = "endpoint",     type = "STRING",    mode = "NULLABLE" }, # search|recommend|brain
  ])
}

# ── BigQuery Tables: gado_snapshots ──────────────────────────────────────────

resource "google_bigquery_table" "daily_kpis" {
  project             = var.project_id
  dataset_id          = google_bigquery_dataset.snapshots.dataset_id
  table_id            = "daily_kpis"
  deletion_protection = false

  time_partitioning {
    type  = "DAY"
    field = "date"
  }

  schema = jsonencode([
    { name = "date",                type = "DATE",   mode = "REQUIRED" },
    { name = "dau",                 type = "INT64",  mode = "NULLABLE" },
    { name = "searches",            type = "INT64",  mode = "NULLABLE" },
    { name = "recommendations",     type = "INT64",  mode = "NULLABLE" },
    { name = "reports_created",     type = "INT64",  mode = "NULLABLE" },
    { name = "reports_active",      type = "INT64",  mode = "NULLABLE" },
    { name = "avg_response_ms",     type = "FLOAT64",mode = "NULLABLE" },
    { name = "brain_calls",         type = "INT64",  mode = "NULLABLE" },
  ])
}

resource "google_bigquery_table" "category_popularity" {
  project             = var.project_id
  dataset_id          = google_bigquery_dataset.snapshots.dataset_id
  table_id            = "category_popularity"
  deletion_protection = false

  schema = jsonencode([
    { name = "week",         type = "DATE",   mode = "REQUIRED" },
    { name = "category",     type = "STRING", mode = "REQUIRED" },
    { name = "searches",     type = "INT64",  mode = "NULLABLE" },
    { name = "recommendations", type = "INT64", mode = "NULLABLE" },
    { name = "avg_results",  type = "FLOAT64",mode = "NULLABLE" },
  ])
}
