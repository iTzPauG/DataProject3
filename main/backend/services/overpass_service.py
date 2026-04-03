"""
Overpass API — búsqueda de POIs en OpenStreetMap.
100% gratuita, sin API key.
Docs: https://overpass-api.de/
"""
from __future__ import annotations

import httpx
from typing import Optional

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

CATEGORY_TO_OSM = {
    "food": '[amenity~"restaurant|cafe|bar|fast_food|pub|food_court|ice_cream"]',
    "health": '[amenity~"pharmacy|hospital|clinic|doctors|dentist"]',
    "shopping": '[shop~"supermarket|mall|clothes|electronics|bakery|butcher|convenience"]',
    "automotive": '[amenity~"bus_station|taxi|fuel|parking|bicycle_rental|car_rental"]',
    "culture": '[amenity~"theatre|cinema|museum|arts_centre|library|nightclub"]',
    "nightlife": '[amenity~"nightclub|bar|pub|casino"]',
    "nature": '[leisure~"park|garden|nature_reserve|playground|sports_centre"]',
    "sport": '[leisure~"stadium|sports_centre|gym|swimming_pool|tennis|golf_course"]',
    "services": '[amenity~"bank|atm|post_office|police|fire_station|place_of_worship"]',
    "education": '[amenity~"school|university|college|library|kindergarten"]',
}


async def search_overpass(
    lat: float,
    lng: float,
    radius_m: int = 2000,
    category: Optional[str] = None,
    query: Optional[str] = None,
    limit: int = 50,
) -> list[dict]:
    """Search POIs in OpenStreetMap using Overpass API."""
    osm_filter = CATEGORY_TO_OSM.get(category, '[name]') if category else "[name]"

    if query:
        overpass_query = f"""
        [out:json][timeout:10];
        (
          node{osm_filter}["name"~"{query}",i](around:{radius_m},{lat},{lng});
          way{osm_filter}["name"~"{query}",i](around:{radius_m},{lat},{lng});
        );
        out center {limit};
        """
    else:
        overpass_query = f"""
        [out:json][timeout:10];
        (
          node{osm_filter}(around:{radius_m},{lat},{lng});
          way{osm_filter}(around:{radius_m},{lat},{lng});
        );
        out center {limit};
        """

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(OVERPASS_URL, data={"data": overpass_query})
        resp.raise_for_status()
        data = resp.json()

    results: list[dict] = []
    for el in data.get("elements", []):
        tags = el.get("tags", {})
        if not tags.get("name"):
            continue

        if el.get("type") == "node":
            poi_lat, poi_lng = el.get("lat"), el.get("lon")
        else:
            center = el.get("center", {})
            poi_lat, poi_lng = center.get("lat"), center.get("lon")

        if not poi_lat or not poi_lng:
            continue

        results.append(
            {
                "osm_id": str(el.get("id")),
                "osm_type": el.get("type"),
                "name": tags.get("name", "Sin nombre"),
                "lat": poi_lat,
                "lng": poi_lng,
                "address": _build_address(tags),
                "amenity": tags.get("amenity")
                or tags.get("shop")
                or tags.get("leisure"),
                "phone": tags.get("phone") or tags.get("contact:phone"),
                "website": tags.get("website") or tags.get("contact:website"),
                "opening_hours": tags.get("opening_hours"),
                "tags": tags,
                "source": "osm",
            }
        )

    return results


def _build_address(tags: dict) -> str:
    parts = [
        tags.get("addr:street", ""),
        tags.get("addr:housenumber", ""),
        tags.get("addr:city", ""),
    ]
    return ", ".join(p for p in parts if p) or tags.get("addr:full", "")
