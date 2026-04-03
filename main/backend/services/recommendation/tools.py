"""
Place search tools — Google Places API (New) with mock fallback.
All functions double as ADK tools (docstring = tool description for the LLM).
Set GEOAPIFY_API_KEY=mock in .env to use built-in Valencia mock data during development.
"""

import logging
import math
import time

from config import GEOAPIFY_API_KEY
from .category_flow import get_flow_definition

GEOAPIFY_KEY = GEOAPIFY_API_KEY

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


def _build_query(parent_category: str, subcategory: str | None) -> str:
    """Build a smart search query based on category + subcategory."""
    # Special overrides to prevent mixing venues with stores/generic terms
    if subcategory == "padel":
        return "pista de padel"
        
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
    lat: float,
    lng: float,
    price_level: int | None,
    language: str = "es",
) -> dict:
    """Search for category-correct places near a location using Google Places API (New).

    Returns reviews inline with each result (up to 5 per place from Google).
    """
    if GEOAPIFY_KEY == "mock":
        t0 = time.perf_counter()
        result = _mock_search(subcategory or parent_category, price_level or 2)
        log.info(
            "[A] search → MOCK  %.2fs  results=%d",
            time.perf_counter() - t0,
            len(result.get("restaurants", [])),
        )
        return result

    t0 = time.perf_counter()
    restaurants: list[dict] = []
    seen_ids: set[str] = set()

    try:
        from services.google_places_service import search_places as gp_search

        query = _build_query(parent_category, subcategory)
        log.info("[A] Google query: '%s' for %s/%s", query, parent_category, subcategory)

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
    lat: float,
    lng: float,
    price_level: int | None,
    language: str = "es",
) -> list[dict]:
    """Return category-correct results for guided discovery."""
    result = await search_places(parent_category, subcategory, lat, lng, price_level, language=language)
    return result.get("restaurants", [])


async def get_place_details(place_id: str, photo_reference: str = "", language: str = "es") -> dict:
    """Fetch phone number, photo URL, and reviews for a place."""
    if GEOAPIFY_KEY == "mock":
        t0 = time.perf_counter()
        result = _mock_details(place_id)
        log.info("[C] PlaceDetails %-30s → MOCK  %.2fs", place_id[:20], time.perf_counter() - t0)
        return result

    try:
        from services.google_places_service import get_place_details as gp_details
        google_data = await gp_details(place_id, language=language)
        if google_data:
            return google_data
    except Exception:
        pass

    return {
        "phone": "",
        "photo_url": "",
        "google_reviews": [],
    }


async def fetch_all_reviews(place_id: str, name: str, lat: float, lng: float, language: str = "es") -> dict:
    """Fetch reviews for a place. If reviews were already fetched inline, this is a no-op."""
    t0 = time.perf_counter()
    details = await get_place_details(place_id, language=language)
    safe_name = str(name or "Unknown")
    log.info("[C] %-30s → Details fetched in %.2fs", safe_name[:25], time.perf_counter() - t0)

    return {
        "place_id": place_id,
        "phone": details.get("phone", ""),
        "photo_url": details.get("photo_url", ""),
        "google_reviews": details.get("google_reviews", []),
    }


# ── Mock data (Valencia, Spain) ───────────────────────────────────────────────

_PLACES = [
    {"place_id": "m1",  "name": "Pizzeria Da Luca",           "address": "C/ Russafa 12, Valencia",           "rating": 4.5, "price_level": 2, "lat": 39.4631, "lng": -0.3775, "photo_reference": "", "total_ratings": 892},
    {"place_id": "m2",  "name": "Doppio Zero",                "address": "C/ Dr. Serrano 7, Valencia",        "rating": 4.7, "price_level": 2, "lat": 39.4655, "lng": -0.3780, "photo_reference": "", "total_ratings": 1567},
    {"place_id": "m3",  "name": "L'Osteria Valencia",         "address": "Av. Regne de Valencia 8",           "rating": 4.2, "price_level": 2, "lat": 39.4680, "lng": -0.3740, "photo_reference": "", "total_ratings": 1243},
    {"place_id": "m4",  "name": "Forno di Bacco",             "address": "C/ Colón 33, Valencia",             "rating": 4.3, "price_level": 3, "lat": 39.4695, "lng": -0.3720, "photo_reference": "", "total_ratings": 421},
    {"place_id": "m5",  "name": "Pizza Garden",               "address": "Pg. Petxina 5, Valencia",           "rating": 4.0, "price_level": 1, "lat": 39.4750, "lng": -0.3760, "photo_reference": "", "total_ratings": 334},
    {"place_id": "m6",  "name": "La Pepita",                  "address": "C/ Conde Altea 33, Valencia",       "rating": 4.4, "price_level": 2, "lat": 39.4668, "lng": -0.3705, "photo_reference": "", "total_ratings": 2341},
    {"place_id": "m7",  "name": "Bodega Casa Montana",        "address": "C/ José Benlliure 69, Valencia",    "rating": 4.5, "price_level": 2, "lat": 39.4716, "lng": -0.3266, "photo_reference": "", "total_ratings": 1876},
    {"place_id": "m8",  "name": "Trattoria Al Forno",         "address": "C/ Sorní 11, Valencia",             "rating": 4.4, "price_level": 3, "lat": 39.4700, "lng": -0.3710, "photo_reference": "", "total_ratings": 289},
    {"place_id": "m9",  "name": "Bar El Cabanyal",            "address": "C/ de la Reina 15, Cabanyal",       "rating": 4.6, "price_level": 1, "lat": 39.4720, "lng": -0.3242, "photo_reference": "", "total_ratings": 1102},
    {"place_id": "m10", "name": "Restaurante Ricard Camarena","address": "C/ Doctor Sumsi 4, Valencia",       "rating": 4.8, "price_level": 3, "lat": 39.4667, "lng": -0.3695, "photo_reference": "", "total_ratings": 743},
    {"place_id": "m11", "name": "El Poblet",                  "address": "C/ Correos 8, Valencia",            "rating": 4.6, "price_level": 3, "lat": 39.4690, "lng": -0.3760, "photo_reference": "", "total_ratings": 512},
    {"place_id": "m12", "name": "Pizzeria Venezia",           "address": "C/ Pérez Galdós 30, Valencia",      "rating": 4.3, "price_level": 1, "lat": 39.4740, "lng": -0.3770, "photo_reference": "", "total_ratings": 512},
]

_PHONES = {
    "m1": "+34 963 111 222", "m2": "+34 963 222 333", "m3": "+34 963 333 444",
    "m4": "+34 963 444 555", "m5": "+34 963 555 666", "m6": "+34 963 666 777",
    "m7": "+34 963 777 888", "m8": "+34 963 888 999", "m9": "+34 963 999 000",
    "m10": "+34 963 100 200", "m11": "+34 963 200 300", "m12": "+34 963 300 400",
}

_REVIEWS = {
    "m1": {
        "google": [
            {"author": "María G.", "rating": 5, "text": "Best thin-crust pizza in Russafa! The wood oven gives it an amazing flavour."},
            {"author": "James T.", "rating": 4, "text": "Great atmosphere, lovely pasta too. Could have more generous toppings for the price."},
        ],
    },
    "m2": {
        "google": [
            {"author": "Ana V.", "rating": 5, "text": "Doppio Zero is consistently excellent. Best pizza in Valencia hands down. Try the burrata!"},
            {"author": "Pablo R.", "rating": 5, "text": "Perfect Neapolitan pizza every time. A bit crowded at weekends."},
        ],
    },
    "m6": {
        "google": [
            {"author": "Clara R.", "rating": 5, "text": "La Pepita has the best pintxos in Valencia! Lively atmosphere and the wine selection is superb."},
            {"author": "Diego M.", "rating": 4, "text": "Great for tapas with friends. Gets very crowded so arrive early."},
        ],
    },
    "m7": {
        "google": [
            {"author": "Tapas_Lover", "rating": 5, "text": "150 years of tradition. The anchovies and wine selection are unbeatable."},
            {"author": "Tourist_2024", "rating": 4, "text": "Hard to find but totally worth it. Excellent vermouth and tapas."},
        ],
    },
    "m10": {
        "google": [
            {"author": "Gastronome_EU", "rating": 5, "text": "Michelin-starred magic. Every dish is a work of art. Expensive but worth every euro."},
            {"author": "Elena M.", "rating": 5, "text": "One of the best dining experiences of my life. The tasting menu is stunning."},
        ],
    },
}


def _generic_reviews(place_id: str) -> dict:
    p = next((r for r in _PLACES if r["place_id"] == place_id), None)
    rating = p["rating"] if p else 4.0
    return {
        "google": [
            {"author": "Local Customer", "rating": round(rating), "text": "Great food and friendly staff. Would definitely recommend to friends."},
            {"author": "Visitor", "rating": round(rating) - 1, "text": "Nice place, a bit pricey for what you get but decent quality overall."},
        ],
    }


def _mock_search(_category: str, price_level: int) -> dict:
    if price_level > 0:
        results = [r for r in _PLACES if abs(r["price_level"] - price_level) <= 1]
    else:
        results = list(_PLACES)
    return {"restaurants": results[:10]}


def _mock_details(place_id: str) -> dict:
    rv = _REVIEWS.get(place_id, _generic_reviews(place_id))
    return {
        "phone": _PHONES.get(place_id, "+34 963 000 000"),
        "photo_url": "",
        "google_reviews": rv.get("google", []),
    }
