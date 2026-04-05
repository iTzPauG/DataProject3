"""Persistence helpers for provider-sourced places."""
from __future__ import annotations

import json
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
        "location": f"POINT({lng} {lat})",
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
               (external_id, source, category_id, subcategory, amenity, name, address,
                photo_url, rating, price_level, lat, lng, location, opening_hours, metadata, is_verified)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,ST_GeomFromText($13,4326),$14,$15,$16)
               ON CONFLICT (source, external_id) DO UPDATE SET
                 name=EXCLUDED.name, address=EXCLUDED.address, photo_url=EXCLUDED.photo_url,
                 rating=EXCLUDED.rating, price_level=EXCLUDED.price_level,
                 lat=EXCLUDED.lat, lng=EXCLUDED.lng, location=EXCLUDED.location,
                 opening_hours=EXCLUDED.opening_hours, metadata=EXCLUDED.metadata""",
            [
                (
                    r["external_id"], r["source"], r["category_id"], r["subcategory"], r["amenity"],
                    r["name"], r["address"], r["photo_url"], r["rating"], r["price_level"],
                    r["lat"], r["lng"], r["location"], r["opening_hours"],
                    json.dumps(r["metadata"]), r["is_verified"],
                )
                for r in rows
            ],
        )
    return len(rows)
