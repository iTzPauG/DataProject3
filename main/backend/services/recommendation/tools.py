"""
Place search tools — Google Places API (New).
All functions double as ADK tools (docstring = tool description for the LLM).
"""

import asyncio
import logging
import math
import time

from .category_flow import get_flow_definition

log = logging.getLogger("pipeline")

SEARCH_RESULT_TARGET = 15


# ── Haversine distance ────────────────────────────────────────────────────────

def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Return distance in metres between two lat/lng points."""
    R = 6_371_000  # Earth radius in metres
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ── Category-aware query building ─────────────────────────────────────────────

# Maps subcategory → smarter Google search query per category
CATEGORY_QUERY_TEMPLATES: dict[str, str] = {
    # Food — search by cuisine
    "food": "{subcategory} restaurant",
    "restaurant": "{subcategory} restaurant",
    # Nightlife — search by venue type
    "nightlife": "{subcategory} nightlife",
    # Shopping — search by store type
    "shopping": "{subcategory} tienda",
# Health — search by medical type
    "health": "{subcategory}",
    # Nature — search by nature type
    "nature": "{subcategory} naturaleza",
    # Culture — search by venue type
    "culture": "{subcategory}",
    # Services — search directly
    "services": "{subcategory}",
    # Sport — search by sport/venue
    "sport": "{subcategory} deporte",
    # Education — search by type
    "education": "{subcategory}",
    # Cinema — search for movie theaters
    "cinema": "cine {subcategory}",
    # Wellness — search by type
    "wellness": "{subcategory} bienestar",
    # Coworking — search by type
    "coworking": "coworking {subcategory}",
    # Pets — search by pet service
    "pets": "{subcategory} mascotas",
    # Automotive — search by auto service
    "automotive": "{subcategory}",
}

EDUCATION_SUBCATEGORY_TERMS: dict[str, str] = {
    "public_school": "colegio publico instituto publico",
    "private_school": "colegio privado escuela privada",
    "concerted_school": "colegio concertado",
    "special_education": "centro de educacion especial apoyo educativo",
    "university": "universidad campus facultad",
    "vocational_training": "formacion profesional centro fp instituto fp",
}

EDUCATION_MOOD_TERMS: dict[str, str] = {
    "infant_primary": "infantil primaria colegio",
    "secondary_baccalaureate": "eso bachillerato instituto secundaria",
    "vocational_path": "fp grado medio grado superior formacion profesional",
    "university_path": "grado master universidad facultad",
    "special_support": "neae nee apoyo especifico inclusion pedagogia terapeutica",
    "bilingual_languages": "bilingue idiomas valenciano ingles international",
}


def _build_query(parent_category: str, subcategory: str | None, mood: str | None = None) -> str:
    """Build a smart search query based on category + subcategory."""
    # Special overrides to prevent mixing venues with stores/generic terms
    if subcategory == "padel":
        return "pista de padel"

    if parent_category == "education":
        sub = EDUCATION_SUBCATEGORY_TERMS.get(subcategory or "", (subcategory or parent_category).replace("_", " "))
        mood_terms = EDUCATION_MOOD_TERMS.get(mood or "", "")
        query = " ".join(part for part in [sub, mood_terms, "valencia"] if part).strip()
        return query or "centro educativo valencia"
        
    template = CATEGORY_QUERY_TEMPLATES.get(parent_category, "{subcategory}")
    sub = (subcategory or parent_category).replace("_", " ")
    query = template.format(subcategory=sub)
    # Avoid redundancy like "restaurant restaurant"
    words = query.split()
    seen: list[str] = []
    for w in words:
        if w.lower() not in [s.lower() for s in seen]:
            seen.append(w)
    return " ".join(seen)


async def search_places(
    parent_category: str,
    subcategory: str | None,
    mood: str | None,
    lat: float,
    lng: float,
    price_level: int | None,
    language: str = "es",
) -> dict:
    """Search for category-correct places near a location using Google Places API (New).

    Returns reviews inline with each result (up to 5 per place from Google).
    """
    t0 = time.perf_counter()
    restaurants: list[dict] = []
    seen_ids: set[str] = set()

    try:
        from services.google_places_service import search_places as gp_search

        query = _build_query(parent_category, subcategory, mood)
        log.info("[A] Google query: '%s' for %s/%s mood=%s", query, parent_category, subcategory, mood)

        flow = get_flow_definition(parent_category)
        max_radius = max(5000, int(flow.get("max_radius_m", 10000)))

        google_results = await gp_search(
            query=query,
            lat=lat,
            lng=lng,
            radius_m=max_radius,
            category=parent_category,
            subcategory=subcategory,
            strict_category=False,  # Let Google's AI decide relevance
            limit=SEARCH_RESULT_TARGET,
            language=language,
        )

        for r in google_results:
            place_id = r.get("id")
            if not place_id or place_id in seen_ids:
                continue
            seen_ids.add(place_id)

            meta = r.get("metadata", {})
            types = meta.get("types", [])

            # Pattern detector to exclude retail stores from venues/activities
            if parent_category not in ("shopping", "pets", "services"):
                is_retail = any(t == "store" or t == "shopping_mall" or t.endswith("_store") for t in types)
                if is_retail:
                    continue

            raw_pl = meta.get("price_level")
            pl_int = price_level or 2
            if raw_pl == "PRICE_LEVEL_INEXPENSIVE":
                pl_int = 1
            elif raw_pl == "PRICE_LEVEL_MODERATE":
                pl_int = 2
            elif raw_pl in ("PRICE_LEVEL_EXPENSIVE", "PRICE_LEVEL_VERY_EXPENSIVE"):
                pl_int = 3

            dist = haversine(lat, lng, r.get("lat", lat), r.get("lng", lng))
            restaurants.append(
                {
                    "place_id": place_id,
                    "name": r.get("name"),
                    "address": r.get("address"),
                    "rating": meta.get("rating", 0.0) or 4.0,
                    "price_level": pl_int,
                    "lat": r.get("lat"),
                    "lng": r.get("lng"),
                    "photo_url": meta.get("photo_url", ""),
                    "photo_name": meta.get("photo_url", ""),
                    "total_ratings": meta.get("user_rating_count", 0) or 0,
                    "distance_m": int(dist),
                    "category_id": parent_category,
                    "subcategory": subcategory or parent_category,
                    "types": meta.get("types", []),
                    # Reviews from search — up to 5 per place, no extra API call
                    "google_reviews": r.get("google_reviews", []),
                    "yelp_reviews": r.get("yelp_reviews", []),
                    "tripadvisor_reviews": r.get("tripadvisor_reviews", []),
                    # AI digest of ALL reviews — primary signal for LLM enrichment
                    "review_summary": r.get("review_summary", ""),
                }
            )

    except Exception as e:
        log.warning("[A] Google Places API error: %s", e)

    log.info(
        "[A] search_places[%s/%s] → results=%d (with reviews: %d)  %.2fs",
        parent_category,
        subcategory,
        len(restaurants),
        sum(1 for r in restaurants if r.get("google_reviews")),
        time.perf_counter() - t0,
    )
    return {"restaurants": restaurants}


async def search_generic_category_places(
    parent_category: str,
    subcategory: str | None,
    mood: str | None,
    lat: float,
    lng: float,
    price_level: int | None,
    language: str = "es",
) -> list[dict]:
    """Return category-correct results for guided discovery."""
    result = await search_places(parent_category, subcategory, mood, lat, lng, price_level, language=language)
    return result.get("restaurants", [])


async def get_place_details(place_id: str, photo_reference: str = "", language: str = "es") -> dict:
    """Fetch phone number, photo URL, and reviews for a place."""
    try:
        from services.google_places_service import get_place_details as gp_details
        google_data = await gp_details(place_id, language=language, include_yelp=False)
        if google_data:
            return google_data
    except Exception:
        pass

    return {
        "name": "",
        "address": "",
        "phone": "",
        "website": "",
        "photo_url": "",
        "rating": None,
        "user_rating_count": None,
        "google_reviews": [],
        "yelp_reviews": [],
        "tripadvisor_reviews": [],
        "review_summary": "",
    }


def _normalize_reviews(raw_reviews: object, source: str) -> list[dict]:
    if not isinstance(raw_reviews, list):
        return []

    normalized: list[dict] = []
    for review in raw_reviews:
        if not isinstance(review, dict):
            continue
        text = str(review.get("text") or "").strip()
        if not text:
            continue
        normalized.append(
            {
                "source": source,
                "author": str(review.get("author") or "Anonymous"),
                "rating": int(review.get("rating") or 0),
                "text": text,
                "relative_time": str(review.get("relative_time") or ""),
            }
        )
    return normalized


async def fetch_all_reviews(place_id: str, name: str, lat: float, lng: float, language: str = "es") -> dict:
    """Fetch Google, Yelp, and TripAdvisor reviews in parallel."""
    t0 = time.perf_counter()
    safe_name = str(name or "Unknown")

    from services.tripadvisor_service import get_tripadvisor_reviews
    from services.yelp_service import get_yelp_reviews

    details_result, yelp_result, tripadvisor_result = await asyncio.gather(
        get_place_details(place_id, language=language),
        get_yelp_reviews(name=safe_name, lat=lat, lng=lng, language=language),
        get_tripadvisor_reviews(name=safe_name, lat=lat, lng=lng, language=language),
        return_exceptions=True,
    )

    details: dict = {}
    if isinstance(details_result, Exception):
        log.warning("[C'] Google details failed for %s: %s", safe_name, details_result)
    elif isinstance(details_result, dict):
        details = details_result

    if isinstance(yelp_result, Exception):
        log.info("[C'] Yelp enrichment failed for %s: %s", safe_name, yelp_result)
        yelp_reviews: list[dict] = []
    else:
        yelp_reviews = _normalize_reviews(yelp_result, "yelp")

    if isinstance(tripadvisor_result, Exception):
        log.info("[C'] TripAdvisor enrichment failed for %s: %s", safe_name, tripadvisor_result)
        tripadvisor_reviews: list[dict] = []
    else:
        tripadvisor_reviews = _normalize_reviews(tripadvisor_result, "tripadvisor")

    google_reviews = _normalize_reviews(details.get("google_reviews", []), "google")
    if not yelp_reviews:
        yelp_reviews = _normalize_reviews(details.get("yelp_reviews", []), "yelp")
    if not tripadvisor_reviews:
        tripadvisor_reviews = _normalize_reviews(details.get("tripadvisor_reviews", []), "tripadvisor")

    total_ratings = details.get("user_rating_count")
    if total_ratings is None:
        total_ratings = details.get("total_ratings")
    safe_total_ratings = int(total_ratings or 0)
    safe_rating = float(details.get("rating") or 0.0)

    log.info(
        "[C'] %-30s -> Google:%d Yelp:%d TripAdvisor:%d in %.2fs",
        safe_name[:25],
        len(google_reviews),
        len(yelp_reviews),
        len(tripadvisor_reviews),
        time.perf_counter() - t0,
    )

    return {
        "place_id": place_id,
        "google_reviews": google_reviews,
        "yelp_reviews": yelp_reviews,
        "tripadvisor_reviews": tripadvisor_reviews,
        "review_summary": str(details.get("review_summary") or ""),
        "photo_url": str(details.get("photo_url") or ""),
        "phone": str(details.get("phone") or ""),
        "website": str(details.get("website") or ""),
        "total_ratings": safe_total_ratings,
        "rating": safe_rating,
    }
