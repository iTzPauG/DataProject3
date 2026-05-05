locals {
  env    = terraform.workspace
  suffix = replace(terraform.workspace, "-", "_")
}

resource "google_bigquery_table" "search_events" {
  project             = var.project_id
  dataset_id          = "gado_analytics"
  table_id            = "search_events_${local.suffix}"
  deletion_protection = false

  time_partitioning {
    type  = "DAY"
    field = "created_at"
  }

  schema = jsonencode([
    { name = "created_at",   type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "session_id",   type = "STRING",    mode = "NULLABLE" },
    { name = "user_id",      type = "STRING",    mode = "NULLABLE" },
    { name = "query",        type = "STRING",    mode = "REQUIRED" },
    { name = "category",     type = "STRING",    mode = "NULLABLE" },
    { name = "lat",          type = "FLOAT64",   mode = "NULLABLE" },
    { name = "lng",          type = "FLOAT64",   mode = "NULLABLE" },
    { name = "radius_m",     type = "INT64",     mode = "NULLABLE" },
    { name = "result_count", type = "INT64",     mode = "NULLABLE" },
    { name = "response_ms",  type = "INT64",     mode = "NULLABLE" },
    { name = "used_brain",   type = "BOOL",      mode = "NULLABLE" },
    { name = "brain_query",  type = "STRING",    mode = "NULLABLE" },
  ])
}

resource "google_bigquery_table" "recommendation_events" {
  project             = var.project_id
  dataset_id          = "gado_analytics"
  table_id            = "recommendation_events_${local.suffix}"
  deletion_protection = false

  time_partitioning {
    type  = "DAY"
    field = "created_at"
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
  dataset_id          = "gado_analytics"
  table_id            = "report_lifecycle_${local.suffix}"
  deletion_protection = false

  time_partitioning {
    type  = "DAY"
    field = "created_at"
  }

  schema = jsonencode([
    { name = "created_at",    type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "report_id",     type = "STRING",    mode = "REQUIRED" },
    { name = "event_type",    type = "STRING",    mode = "REQUIRED" },
    { name = "report_type",   type = "STRING",    mode = "NULLABLE" },
    { name = "lat",           type = "FLOAT64",   mode = "NULLABLE" },
    { name = "lng",           type = "FLOAT64",   mode = "NULLABLE" },
    { name = "confirmations", type = "INT64",     mode = "NULLABLE" },
    { name = "denials",       type = "INT64",     mode = "NULLABLE" },
    { name = "confidence",    type = "FLOAT64",   mode = "NULLABLE" },
    { name = "actor_type",    type = "STRING",    mode = "NULLABLE" },
  ])
}

resource "google_bigquery_table" "vote_events" {
  project             = var.project_id
  dataset_id          = "gado_analytics"
  table_id            = "vote_events_${local.suffix}"
  deletion_protection = false

  time_partitioning {
    type  = "DAY"
    field = "created_at"
  }

  schema = jsonencode([
    { name = "created_at", type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "item_type",  type = "STRING",    mode = "REQUIRED" },
    { name = "item_id",    type = "STRING",    mode = "REQUIRED" },
    { name = "vote",       type = "INT64",     mode = "REQUIRED" },
    { name = "actor_type", type = "STRING",    mode = "NULLABLE" },
    { name = "category",   type = "STRING",    mode = "NULLABLE" },
  ])
}

resource "google_bigquery_table" "brain_usage" {
  project             = var.project_id
  dataset_id          = "gado_analytics"
  table_id            = "brain_usage_${local.suffix}"
  deletion_protection = false

  time_partitioning {
    type  = "DAY"
    field = "created_at"
  }

  schema = jsonencode([
    { name = "created_at",    type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "provider",      type = "STRING",    mode = "REQUIRED" },
    { name = "query",         type = "STRING",    mode = "NULLABLE" },
    { name = "input_tokens",  type = "INT64",     mode = "NULLABLE" },
    { name = "output_tokens", type = "INT64",     mode = "NULLABLE" },
    { name = "latency_ms",    type = "INT64",     mode = "NULLABLE" },
    { name = "success",       type = "BOOL",      mode = "NULLABLE" },
    { name = "endpoint",      type = "STRING",    mode = "NULLABLE" },
  ])
}

resource "google_bigquery_table" "daily_kpis" {
  project             = var.project_id
  dataset_id          = "gado_snapshots"
  table_id            = "daily_kpis_${local.suffix}"
  deletion_protection = false

  time_partitioning {
    type  = "DAY"
    field = "date"
  }

  schema = jsonencode([
    { name = "date",            type = "DATE",    mode = "REQUIRED" },
    { name = "dau",             type = "INT64",   mode = "NULLABLE" },
    { name = "searches",        type = "INT64",   mode = "NULLABLE" },
    { name = "recommendations", type = "INT64",   mode = "NULLABLE" },
    { name = "reports_created", type = "INT64",   mode = "NULLABLE" },
    { name = "reports_active",  type = "INT64",   mode = "NULLABLE" },
    { name = "avg_response_ms", type = "FLOAT64", mode = "NULLABLE" },
    { name = "brain_calls",     type = "INT64",   mode = "NULLABLE" },
  ])
}

resource "google_bigquery_table" "category_popularity" {
  project             = var.project_id
  dataset_id          = "gado_snapshots"
  table_id            = "category_popularity_${local.suffix}"
  deletion_protection = false

  schema = jsonencode([
    { name = "week",            type = "DATE",    mode = "REQUIRED" },
    { name = "category",        type = "STRING",  mode = "REQUIRED" },
    { name = "searches",        type = "INT64",   mode = "NULLABLE" },
    { name = "recommendations", type = "INT64",   mode = "NULLABLE" },
    { name = "avg_results",     type = "FLOAT64", mode = "NULLABLE" },
  ])
}
