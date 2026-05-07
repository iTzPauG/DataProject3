"""Helpers for community report persistence across SQLite and Postgres schemas."""

from __future__ import annotations

from typing import Any

from database import using_postgres


def report_row_to_dict(row: Any) -> dict[str, Any]:
    data = dict(row)
    # The Cloud SQL schema may expose a PostGIS geography column that the frontend
    # does not need and that can be awkward to serialize consistently.
    data.pop("location", None)
    return data


async def _community_reports_has_location(db: Any) -> bool:
    if using_postgres():
        cursor = await db.execute(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = ?
              AND column_name = ?
            LIMIT 1
            """,
            ("community_reports", "location"),
        )
        return bool(await cursor.fetchone())

    cursor = await db.execute("PRAGMA table_info(community_reports)")
    rows = await cursor.fetchall()
    for row in rows:
        if row["name"] == "location":
            return True
    return False


async def insert_community_report(
    db: Any,
    *,
    report_id: str,
    created_by: str | None,
    anon_fingerprint: str | None,
    report_type: str,
    title: str,
    description: str | None,
    lat: float,
    lng: float,
    address_hint: str | None,
    created_at: str,
    expires_at: str,
    is_active: bool = True,
    confirmations: int = 0,
    denials: int = 0,
    confidence: float = 0.5,
) -> None:
    # Postgres needs a real boolean; SQLite accepts both. Coerce to bool either way.
    is_active = bool(is_active)
    if await _community_reports_has_location(db):
        await db.execute(
            """INSERT INTO community_reports
                   (id, created_by, anon_fingerprint, report_type, title, description,
                    location, lat, lng, address_hint, created_at, expires_at,
                    is_active, confirmations, denials, confidence)
                   VALUES (?,?,?,?,?,?,ST_SetSRID(ST_MakePoint(?, ?),4326)::geography,?,?,?,?,?,?,?,?,?)""",
            (
                report_id,
                created_by,
                anon_fingerprint,
                report_type,
                title,
                description,
                lng,
                lat,
                lat,
                lng,
                address_hint,
                created_at,
                expires_at,
                is_active,
                confirmations,
                denials,
                confidence,
            ),
        )
        return

    await db.execute(
        """INSERT INTO community_reports
               (id, created_by, anon_fingerprint, report_type, title, description,
                lat, lng, address_hint, created_at, expires_at,
                is_active, confirmations, denials, confidence)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            report_id,
            created_by,
            anon_fingerprint,
            report_type,
            title,
            description,
            lat,
            lng,
            address_hint,
            created_at,
            expires_at,
            is_active,
            confirmations,
            denials,
            confidence,
        ),
    )
