from __future__ import annotations

import asyncio
import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Query
from fastapi.responses import StreamingResponse
from services.brain_service import ask_brain, ask_brain_stream
from database import get_supabase
from services.cache_service import cache_get, cache_set
from services.geoapify_service import search_geoapify_places
from services.google_places_service import search_places as search_google_places
from services.nominatim_service import geocode
from services.overpass_service import search_overpass
from services.place_persistence_service import upsert_provider_places

router = APIRouter(prefix="/search", tags=["search"])
logger = logging.getLogger(__name__)


async def _search_local(
    query: str,
    category: Optional[str],
    radius_m: int,
    lat: float,
    lng: float,
) -> list[dict]:
    sb = get_supabase()
    q = f"%{query}%"
    results: list[dict] = []

    if len(query) < 2:
        return results

    def fetch_places():
        places_query = (
            sb.table("places")
            .select("id,name,lat,lng,address,category_id,photo_url,price_level,rating,source,opening_hours,amenity")
            .ilike("name", q)
            .limit(30)
        )
        if category:
            places_query = places_query.eq("category_id", category)
        return places_query.execute().data or []

    def fetch_events():
        events_query = (
            sb.table("events")
            .select("id,title,lat,lng,address,category_id,photo_url,starts_at,ends_at,price_info,status")
            .ilike("title", q)
            .limit(20)
        )
        if category:
            events_query = events_query.eq("category_id", category)
        return events_query.execute().data or []

    def fetch_reports():
        if category in (None, "report"):
            reports_query = (
                sb.table("community_reports")
                .select("id,title,lat,lng,report_type,confidence,confirmations,denials,expires_at,description,photo_urls,is_active")
                .ilike("title", q)
                .limit(20)
            )
            return reports_query.execute().data or []
        return []

    try:
        places, events, reports = await asyncio.gather(
            asyncio.to_thread(fetch_places),
            asyncio.to_thread(fetch_events),
            asyncio.to_thread(fetch_reports)
        )
    except Exception:
        places, events, reports = [], [], []

    for row in places:
        results.append(
            {
                "source": "supabase",
                "item_type": "place",
                "id": row.get("id"),
                "name": row.get("name"),
                "lat": row.get("lat"),
                "lng": row.get("lng"),
                "address": row.get("address"),
                "category_id": row.get("category_id"),
                "metadata": {
                    "photo_url": row.get("photo_url"),
                    "price_level": row.get("price_level"),
                    "rating": row.get("rating"),
                    "source": row.get("source"),
                    "opening_hours": row.get("opening_hours"),
                    "amenity": row.get("amenity"),
                },
            }
        )

    now = datetime.now(timezone.utc).isoformat()
    for row in events:
        if row.get("status") and row.get("status") != "active":
            continue
        if row.get("ends_at") and row.get("ends_at") < now:
            continue
        results.append(
            {
                "source": "supabase",
                "item_type": "event",
                "id": row.get("id"),
                "name": row.get("title"),
                "lat": row.get("lat"),
                "lng": row.get("lng"),
                "address": row.get("address"),
                "category_id": row.get("category_id"),
                "metadata": {
                    "photo_url": row.get("photo_url"),
                    "starts_at": row.get("starts_at"),
                    "ends_at": row.get("ends_at"),
                    "price_info": row.get("price_info"),
                },
            }
        )

    for row in reports:
        if row.get("is_active") is False:
            continue
        if row.get("expires_at") and row.get("expires_at") < now:
            continue
        results.append(
            {
                "source": "supabase",
                "item_type": "report",
                "id": row.get("id"),
                "name": row.get("title"),
                "lat": row.get("lat"),
                "lng": row.get("lng"),
                "address": None,
                "category_id": "report",
                "metadata": {
                    "report_type": row.get("report_type"),
                    "confidence": row.get("confidence"),
                    "confirmations": row.get("confirmations"),
                    "denials": row.get("denials"),
                    "expires_at": row.get("expires_at"),
                    "description": row.get("description"),
                    "photo_urls": row.get("photo_urls"),
                },
            }
        )

    return results


@router.get("/universal")
async def universal_search(
    background_tasks: BackgroundTasks,
    q: str = Query(..., description="Texto de búsqueda"),
    lat: float = Query(...),
    lng: float = Query(...),
    radius_m: int = Query(2000, ge=100, le=20000),
    category: Optional[str] = Query(None),
    use_brain: bool = Query(True, description="Usar LLM para interpretar la búsqueda"),
):
    """
    Búsqueda universal. Combina:
    1) LLM brain para interpretar la intención
    2) Overpass API para POIs en OSM
    3) Supabase local (places/events/reports)
    """
    # Create an initial cache key with rounded lat/lng (approx ~110m precision) to improve hit rates
    # and to potentially skip the expensive brain LLM call entirely.
    orig_cache_key = hashlib.md5(
        f"v2:{q}:{lat:.3f}:{lng:.3f}:{radius_m}:{category}:{use_brain}".encode()
    ).hexdigest()
    
    cached = await cache_get(orig_cache_key)
    if cached:
        return cached

    brain_result = None
    final_query = q
    final_category = category

    if use_brain:
        try:
            brain_result = await ask_brain(q, context={"lat": lat, "lng": lng})
            final_query = brain_result.get("query", q)
            final_category = brain_result.get("category") or category
        except Exception:
            pass

    # Secondary cache check just in case brain altered the query to something we already have
    secondary_cache_key = hashlib.md5(
        f"v2:{final_query}:{lat:.3f}:{lng:.3f}:{radius_m}:{final_category}:False".encode()
    ).hexdigest()
    
    if secondary_cache_key != orig_cache_key:
        cached2 = await cache_get(secondary_cache_key)
        if cached2:
            return cached2

    t0 = datetime.now(timezone.utc)
    results_gathered = await asyncio.gather(
        search_google_places(
            query=final_query,
            lat=lat,
            lng=lng,
            radius_m=radius_m,
            category=final_category,
            strict_category=bool(final_category),
            limit=20,
        ),
        search_overpass(
            lat=lat,
            lng=lng,
            radius_m=radius_m,
            category=final_category,
            query=final_query if len(final_query) > 2 else None,
            limit=30,
        ),
        search_geoapify_places(
            lat=lat,
            lng=lng,
            radius_m=radius_m,
            query=final_query,
            category=final_category,
            limit=30,
        ),
        _search_local(final_query, final_category, radius_m, lat, lng),
        return_exceptions=True
    )

    google_results = results_gathered[0] if not isinstance(results_gathered[0], Exception) else []
    osm_results = results_gathered[1] if not isinstance(results_gathered[1], Exception) else []
    geo_results = results_gathered[2] if not isinstance(results_gathered[2], Exception) else []
    local_results = results_gathered[3] if not isinstance(results_gathered[3], Exception) else []

    all_providers = [*google_results, *geo_results, *osm_results]
    if all_providers:
        background_tasks.add_task(
            upsert_provider_places,
            all_providers,
            fallback_category=final_category,
        )

    # Google results first (have real photos + ratings), then others
    combined = [
        *google_results,
        *geo_results,
        *osm_results,
        *local_results,
    ]

    response_data = {
        "source": "mixed",
        "brain": brain_result,
        "query_used": final_query,
        "category_used": final_category,
        "results": combined,
        "count": len(combined),
    }

    # Cache both keys
    await cache_set(orig_cache_key, response_data, ttl=300)
    if secondary_cache_key != orig_cache_key:
        await cache_set(secondary_cache_key, response_data, ttl=300)

    elapsed = (datetime.now(timezone.utc) - t0).total_seconds()
    logger.info(
        "[PERF] universal_search q=%r category=%r results=%d in %.2fs",
        final_query,
        final_category,
        len(combined),
        elapsed,
    )

    return response_data


@router.get("/autocomplete")
async def autocomplete(
    q: str = Query(..., min_length=2),
    lat: float = Query(None),
    lng: float = Query(None),
):
    """Autocomplete de búsqueda vía Nominatim."""
    results = await geocode(q, lat, lng)
    return [
        {"display": r.get("display_name", ""), "lat": r["lat"], "lng": r["lon"]}
        for r in results[:5]
    ]


import json
import asyncio
from fastapi.responses import StreamingResponse

# ...

@router.get("/live")
async def live_search(
    q: str = Query(...),
    lat: float = Query(...),
    lng: float = Query(...),
    radius_m: int = Query(2000),
    category: Optional[str] = Query(None),
):
    """Streaming de resultados de búsqueda conforme llegan de cada proveedor."""
    async def stream_results():
        tasks = [
            search_google_places(q, lat, lng, radius_m, category, bool(category), 20),
            search_overpass(lat, lng, radius_m, category, q if len(q) > 2 else None, 30),
            search_geoapify_places(lat, lng, radius_m, q, category, 30),
            _search_local(q, category, radius_m, lat, lng)
        ]
        
        for task in asyncio.as_completed(tasks):
            try:
                results = await task
                if results:
                    yield json.dumps({"source": "provider", "results": results}) + "\n"
            except Exception as e:
                logger.error(f"Error en proveedor de búsqueda: {e}")

    return StreamingResponse(stream_results(), media_type="text/event-stream")

