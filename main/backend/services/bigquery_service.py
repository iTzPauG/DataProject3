"""BigQuery integration for platform metrics snapshots."""
import logging
import os
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

BQ_PROJECT = os.getenv("BIGQUERY_PROJECT_ID", "")
BQ_DATASET = os.getenv("BIGQUERY_DATASET_ID", "whim_metrics")
BQ_TABLE   = "platform_metrics"

_SCHEMA = [
    ("snapshot_at",              "TIMESTAMP"),
    ("active_offers",            "INTEGER"),
    ("registered_restaurants",   "INTEGER"),
    ("active_restaurants_today", "INTEGER"),
    ("total_offers_today",       "INTEGER"),
    ("total_offers_alltime",     "INTEGER"),
    ("cancelled_today",          "INTEGER"),
    ("cancellation_rate_today",  "FLOAT"),
    ("offers_last_hour",         "INTEGER"),
    ("total_seats_available",    "INTEGER"),
    ("avg_offer_price",          "FLOAT"),
    ("min_price_active",         "FLOAT"),
    ("max_price_active",         "FLOAT"),
    ("avg_seats_per_offer",      "FLOAT"),
    ("ws_connections",           "INTEGER"),
]


def _client():
    if not BQ_PROJECT:
        return None
    try:
        from google.cloud import bigquery  # noqa: F401
        return bigquery.Client(project=BQ_PROJECT)
    except ImportError:
        logger.warning("[BQ] google-cloud-bigquery not installed — BigQuery disabled")
        return None
    except Exception as e:
        logger.warning("[BQ] client init failed: %s", e)
        return None


def ensure_table() -> None:
    """Create dataset + table if they don't exist. Called once at startup."""
    client = _client()
    if not client:
        logger.info("[BQ] No project configured — BigQuery disabled")
        return
    try:
        from google.cloud import bigquery
        ds_ref = client.dataset(BQ_DATASET)
        try:
            client.get_dataset(ds_ref)
        except Exception:
            ds = bigquery.Dataset(ds_ref)
            ds.location = "EU"
            client.create_dataset(ds, exists_ok=True)
            logger.info("[BQ] Dataset %s created", BQ_DATASET)

        table_ref = ds_ref.table(BQ_TABLE)
        schema = [bigquery.SchemaField(name, bq_type) for name, bq_type in _SCHEMA]
        table = bigquery.Table(table_ref, schema=schema)
        client.create_table(table, exists_ok=True)
        logger.info("[BQ] Table %s ready", BQ_TABLE)
    except Exception as e:
        logger.warning("[BQ] setup error: %s", e)


def insert_snapshot(metrics: dict) -> bool:
    """Insert one metrics snapshot row. Returns True on success."""
    client = _client()
    if not client:
        return False
    try:
        table_id = f"{BQ_PROJECT}.{BQ_DATASET}.{BQ_TABLE}"
        row = {"snapshot_at": datetime.now(timezone.utc).isoformat()}
        for name, _ in _SCHEMA:
            if name != "snapshot_at" and name in metrics:
                row[name] = metrics[name]
        errors = client.insert_rows_json(table_id, [row])
        if errors:
            logger.warning("[BQ] insert errors: %s", errors)
            return False
        logger.info("[BQ] snapshot saved")
        return True
    except Exception as e:
        logger.warning("[BQ] insert error: %s", e)
        return False


def get_recent_snapshots(limit: int = 48) -> list[dict]:
    """Return the last `limit` snapshots ordered newest-first."""
    client = _client()
    if not client:
        return []
    try:
        query = f"""
            SELECT *
            FROM `{BQ_PROJECT}.{BQ_DATASET}.{BQ_TABLE}`
            ORDER BY snapshot_at DESC
            LIMIT {int(limit)}
        """
        rows = client.query(query).result()
        result = []
        for row in rows:
            d = dict(row)
            if hasattr(d.get("snapshot_at"), "isoformat"):
                d["snapshot_at"] = d["snapshot_at"].isoformat()
            result.append(d)
        return result
    except Exception as e:
        logger.warning("[BQ] query error: %s", e)
        return []
