"""Persistence helpers for provider-sourced places."""
from __future__ import annotations

from typing import Iterable

from database import get_supabase


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


def upsert_provider_places(items: Iterable[dict], *, fallback_category: str | None = None) -> int:
    rows = []
    for item in items:
        row = _canonical_place_row(item, fallback_category=fallback_category)
        if row:
            rows.append(row)

    if not rows:
        return 0

    sb = get_supabase()
    sb.table("places").upsert(rows, on_conflict="source,external_id").execute()
    return len(rows)
