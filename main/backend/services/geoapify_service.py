"""Geoapify Places API wrapper for universal search."""
from __future__ import annotations

import math
import os
from typing import Optional

import httpx
from config import GEOAPIFY_API_KEY


def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


_CATEGORY_MAP: dict[str, str] = {
    "food": "catering.restaurant,catering.cafe,catering.fast_food",
    "nightlife": "catering.bar,entertainment.nightclub",
    "shopping": "commercial,shop",
    "automotive": "commercial.vehicle,service.vehicle",
    "culture": "tourism,entertainment,culture",
    "nature": "natural",
    "sport": "sport",
    "services": "service",
    "education": "education",
    "health": "healthcare",
}


async def search_geoapify_places(
    *,
    lat: float,
    lng: float,
    radius_m: int,
    query: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 30,
) -> list[dict]:
    if GEOAPIFY_API_KEY == "mock":
        return []

    categories = _CATEGORY_MAP.get(category or "", None)
    if category and not categories:
        categories = "commercial,service,education,healthcare,entertainment,tourism"

    params = {
        "filter": f"circle:{lng},{lat},{radius_m}",
        "bias": f"proximity:{lng},{lat}",
        "limit": limit,
        "apiKey": GEOAPIFY_API_KEY,
    }
    if categories:
        params["categories"] = categories
    if query and len(query) > 2:
        params["name"] = query

    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get("https://api.geoapify.com/v2/places", params=params)
            if r.status_code != 200:
                return []
            data = r.json()
    except Exception:
        return []

    results: list[dict] = []
    for feat in data.get("features", []):
        p = feat.get("properties", {})
        place_id = p.get("place_id") or p.get("id")
        lat_p = p.get("lat")
        lng_p = p.get("lon")
        if lat_p is None or lng_p is None:
            continue
        distance_m = p.get("distance")
        if distance_m is None:
            distance_m = _haversine(lat, lng, lat_p, lng_p)
        results.append(
            {
                "source": "geoapify",
                "item_type": "place",
                "id": place_id,
                "name": p.get("name") or p.get("street") or "Unnamed",
                "lat": lat_p,
                "lng": lng_p,
                "address": p.get("formatted"),
                "category_id": category,
                "metadata": {
                    "distance_m": int(distance_m or 0),
                    "categories": p.get("categories", []),
                    "datasource": p.get("datasource"),
                },
            }
        )
    return results

