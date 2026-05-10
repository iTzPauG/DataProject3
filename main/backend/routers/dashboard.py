"""Executive dashboard — platform metrics saved to BigQuery on every request."""
import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database import get_db
from .table_events import manager as ws_manager
from services import bigquery_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dashboard", tags=["dashboard"])


async def _fetch_all(db, sql: str, params: tuple = ()) -> list[dict]:
    cursor = await db.execute(sql, params)
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


async def _compute_metrics() -> dict:
    now = datetime.now(timezone.utc)
    today_str  = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    hour_ago   = (now - timedelta(hours=1)).isoformat()
    week_ago   = (now - timedelta(days=7)).isoformat()

    async with get_db() as db:

        async def scalar(sql: str, params: tuple = ()) -> float:
            cur = await db.execute(sql, params)
            row = await cur.fetchone()
            if row is None:
                return 0
            d = dict(row)
            return d.get(list(d.keys())[0]) or 0

        active_offers            = int(await scalar("SELECT COUNT(*) FROM table_events WHERE is_active=1"))
        total_offers_alltime     = int(await scalar("SELECT COUNT(*) FROM table_events"))
        total_offers_today       = int(await scalar("SELECT COUNT(*) FROM table_events WHERE created_at >= ?", (today_str,)))
        registered_restaurants   = int(await scalar("SELECT COUNT(DISTINCT restaurant_name) FROM table_events"))
        active_restaurants_today = int(await scalar("SELECT COUNT(DISTINCT restaurant_name) FROM table_events WHERE created_at >= ?", (today_str,)))
        active_restaurants_week  = int(await scalar("SELECT COUNT(DISTINCT restaurant_name) FROM table_events WHERE created_at >= ?", (week_ago,)))
        total_seats_available    = int(await scalar("SELECT COALESCE(SUM(seats),0) FROM table_events WHERE is_active=1"))
        avg_offer_price          = round(float(await scalar("SELECT COALESCE(AVG(price),0) FROM table_events WHERE is_active=1")), 2)
        min_price_active         = round(float(await scalar("SELECT COALESCE(MIN(price),0) FROM table_events WHERE is_active=1")), 2)
        max_price_active         = round(float(await scalar("SELECT COALESCE(MAX(price),0) FROM table_events WHERE is_active=1")), 2)
        avg_seats_per_offer      = round(float(await scalar("SELECT COALESCE(AVG(seats),0) FROM table_events WHERE is_active=1")), 1)
        cancelled_today          = int(await scalar("SELECT COUNT(*) FROM table_events WHERE is_active=0 AND created_at >= ?", (today_str,)))
        offers_last_hour         = int(await scalar("SELECT COUNT(*) FROM table_events WHERE created_at >= ?", (hour_ago,)))
        avg_duration_min         = round(float(await scalar(
            "SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (ends_at::timestamptz - created_at::timestamptz)) / 60.0), 0) FROM table_events"
        )), 1)

    cancellation_rate_today = round(
        (cancelled_today / total_offers_today * 100) if total_offers_today > 0 else 0, 1
    )
    ws_connections = len(ws_manager.active_connections)

    return {
        "snapshot_at":              now.isoformat(),
        # ── Ofertas ──────────────────────────────────────────────────────────
        "active_offers":            active_offers,
        "total_offers_today":       total_offers_today,
        "total_offers_alltime":     total_offers_alltime,
        "offers_last_hour":         offers_last_hour,
        "cancelled_today":          cancelled_today,
        "cancellation_rate_today":  cancellation_rate_today,
        # ── Restaurantes ─────────────────────────────────────────────────────
        "registered_restaurants":   registered_restaurants,
        "active_restaurants_today": active_restaurants_today,
        "active_restaurants_week":  active_restaurants_week,
        # ── Plazas y precios ─────────────────────────────────────────────────
        "total_seats_available":    total_seats_available,
        "avg_offer_price":          avg_offer_price,
        "min_price_active":         min_price_active,
        "max_price_active":         max_price_active,
        "avg_seats_per_offer":      avg_seats_per_offer,
        "avg_duration_min":         avg_duration_min,
        # ── Plataforma ───────────────────────────────────────────────────────
        "ws_connections":           ws_connections,
    }


@router.get("/metrics")
async def get_metrics():
    """Compute all platform metrics, persist to BigQuery, return to caller."""
    metrics = await _compute_metrics()
    saved = await asyncio.get_event_loop().run_in_executor(
        None, bigquery_service.insert_snapshot, metrics
    )
    return {**metrics, "saved_to_bigquery": saved}


@router.get("/history")
async def get_history():
    """Return the last 48 BigQuery snapshots (newest first)."""
    snapshots = await asyncio.get_event_loop().run_in_executor(
        None, bigquery_service.get_recent_snapshots, 48
    )
    return {"snapshots": snapshots, "count": len(snapshots)}


class DirectorLoginBody(BaseModel):
    code: str


@router.post("/director-login")
async def director_login(body: DirectorLoginBody):
    """Verifies the director access code."""
    expected = os.getenv("DIRECTOR_CODE", "gado2024")
    if body.code != expected:
        raise HTTPException(status_code=401, detail="Código incorrecto")
    return {"success": True}


@router.get("/restaurants")
async def get_restaurants_summary():
    """Per-restaurant stats for the director ranking table."""
    async with get_db() as db:
        rows = await _fetch_all(db, """
            SELECT restaurant_name,
                   COUNT(*) as total_offers,
                   SUM(CASE WHEN is_active=1 THEN 1 ELSE 0 END) as active_offers,
                   AVG(price) as avg_price,
                   COALESCE(SUM(seats), 0) as total_seats,
                   MAX(created_at) as last_activity
            FROM table_events
            GROUP BY restaurant_name
            ORDER BY total_offers DESC
        """)
    return {
        "restaurants": [
            {**r, "avg_price": round(float(r["avg_price"] or 0), 2)}
            for r in rows
        ]
    }
