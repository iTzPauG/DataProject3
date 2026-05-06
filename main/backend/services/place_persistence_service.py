"""Persistence helpers for provider-sourced places."""
from __future__ import annotations

import json
import uuid
from typing import Iterable

from database import get_db


def _canonical_place_row(item: dict, *, fallback_category: str | None = None) -> dict | None:
    external_id = item.get("id") or item.get("external_id") or item.get("osm_id")
    lat = item.get("lat")
    lng = item.get("lng")
    if not external_id or lat is None or lng is None:
        return None

    metadata = item.get("metadata") or {}
    source = item.get("source") or "provider"
    category_id = item.get("category_id") or fallback_category or "services"
    opening_hours = metadata.get("opening_hours")

    return {
        "external_id": str(external_id),
        "source": str(source),
        "category_id": str(category_id),
        "subcategory": item.get("subcategory"),
        "amenity": (
            metadata.get("types", [None])[0]
            if isinstance(metadata.get("types"), list)
            else metadata.get("amenity") or item.get("amenity")
        ),
        "name": item.get("name") or item.get("title") or "Unnamed",
        "address": item.get("address"),
        "photo_url": metadata.get("photo_url"),
        "rating": metadata.get("rating"),
        "price_level": metadata.get("price_level"),
        "lat": lat,
        "lng": lng,
        "opening_hours": opening_hours if isinstance(opening_hours, str) else None,
        "metadata": metadata,
        "is_verified": False,
    }


async def upsert_provider_places(items: Iterable[dict], *, fallback_category: str | None = None) -> int:
    rows = [r for item in items if (r := _canonical_place_row(item, fallback_category=fallback_category))]
    if not rows:
        return 0

    async with get_db() as db:
        await db.executemany(
            """INSERT INTO places
               (id, external_id, source, category_id, subcategory, amenity, name, address,
                photo_url, rating, price_level, lat, lng, opening_hours, metadata, is_verified)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
               ON CONFLICT (source, external_id) DO UPDATE SET
                 name=excluded.name, address=excluded.address, photo_url=excluded.photo_url,
                 rating=excluded.rating, price_level=excluded.price_level,
                 lat=excluded.lat, lng=excluded.lng,
                 opening_hours=excluded.opening_hours, metadata=excluded.metadata""",
            [
                (
                    str(uuid.uuid4()), r["external_id"], r["source"], r["category_id"], r["subcategory"], r["amenity"],
                    r["name"], r["address"], r["photo_url"], r["rating"], r["price_level"],
                    r["lat"], r["lng"], r["opening_hours"],
                    json.dumps(r["metadata"]), r["is_verified"],
                )
                for r in rows
            ],
        )
        await db.commit()
    return len(rows)
