"""TripAdvisor Content API wrapper for secondary review enrichment."""

from __future__ import annotations

import logging
import math
from difflib import SequenceMatcher

import httpx

from config import TRIPADVISOR_API_KEY
from services.cache_service import cache_get, cache_set

log = logging.getLogger(__name__)

_BASE = "https://api.content.tripadvisor.com/api/v1"
_http_client: httpx.AsyncClient | None = None
_MAX_MATCH_DISTANCE_M = 2000.0
_MIN_NAME_SIMILARITY = 0.62

_FOOD_CATEGORY_TERMS = (
    "restaurant",
    "food",
    "cafe",
    "bar",
    "coffee",
    "pub",
    "wine",
    "cocktail",
    "pizza",
    "burger",
    "sushi",
    "tapas",
    "brunch",
    "bakery",
    "bistro",
)

_INCOMPATIBLE_CATEGORY_TERMS = (
    "hotel",
    "attraction",
    "museum",
    "school",
    "airport",
    "hospital",
    "pharmacy",
    "shopping",
    "car",
)


def _get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(timeout=10)
    return _http_client


def _language_code(language: str) -> str:
    raw = (language or "es").strip().lower().replace("_", "-")
    if "-" in raw:
        raw = raw.split("-", 1)[0]
    return raw or "es"


def _similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, (a or "").lower().strip(), (b or "").lower().strip()).ratio()


def _to_float(value: object) -> float | None:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius = 6_371_000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlng / 2) ** 2
    return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _location_distance_m(location: dict, *, lat: float, lng: float) -> float:
    location_lat = _to_float(location.get("latitude"))
    location_lng = _to_float(location.get("longitude"))

    if location_lat is None or location_lng is None:
        geo = location.get("location") if isinstance(location.get("location"), dict) else {}
        location_lat = _to_float(geo.get("latitude")) if location_lat is None else location_lat
        location_lng = _to_float(geo.get("longitude")) if location_lng is None else location_lng

    if location_lat is not None and location_lng is not None:
        return _distance_m(lat, lng, location_lat, location_lng)

    # Location mapper responses can include distance in miles.
    raw_distance = _to_float(location.get("distance"))
    if raw_distance is not None and raw_distance >= 0:
        return raw_distance * 1609.34
    return float("inf")


def _location_categories(location: dict) -> set[str]:
    tokens: set[str] = set()

    def _push(value: object) -> None:
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized:
                tokens.add(normalized)
        elif isinstance(value, dict):
            _push(value.get("name"))
            _push(value.get("key"))
            _push(value.get("localized_name"))
        elif isinstance(value, list):
            for item in value:
                _push(item)

    _push(location.get("category"))
    _push(location.get("subcategory"))
    _push(location.get("groups"))
    return tokens


def _is_food_compatible(location: dict) -> bool:
    tokens = _location_categories(location)
    if not tokens:
        # Search request is already constrained to category=restaurants.
        return True

    for token in tokens:
        if any(bad in token for bad in _INCOMPATIBLE_CATEGORY_TERMS):
            return False

    return any(any(term in token for term in _FOOD_CATEGORY_TERMS) for token in tokens)


def _location_address_text(location: dict) -> str:
    address_obj = location.get("address_obj")
    if isinstance(address_obj, dict):
        return str(address_obj.get("address_string") or "")
    return str(location.get("address") or location.get("address_string") or "")


def _score_location(location: dict, *, name: str, lat: float, lng: float, address: str) -> float:
    score = 0.0
    score += _similarity(name, str(location.get("name") or "")) * 0.7

    distance_penalty = min(1.0, _location_distance_m(location, lat=lat, lng=lng) / 3000.0)
    score += max(0.0, 0.2 - distance_penalty * 0.2)

    location_address = _location_address_text(location)
    if address and location_address:
        score += _similarity(address, location_address) * 0.1

    if _is_food_compatible(location):
        score += 0.15
    return score


def _is_location_match(location: dict, *, name: str, lat: float, lng: float) -> bool:
    if _similarity(name, str(location.get("name") or "")) < _MIN_NAME_SIMILARITY:
        return False
    if _location_distance_m(location, lat=lat, lng=lng) > _MAX_MATCH_DISTANCE_M:
        return False
    return _is_food_compatible(location)


def _search_results(payload: dict) -> list[dict]:
    data = payload.get("data")
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]
    results = payload.get("results")
    if isinstance(results, list):
        return [item for item in results if isinstance(item, dict)]
    return []


async def _find_location_id(
    *,
    name: str,
    lat: float,
    lng: float,
    address: str = "",
    language: str = "es",
) -> tuple[str | None, int]:
    if not TRIPADVISOR_API_KEY or not name:
        return None, 0

    cache_key = f"tripadvisor_match_v2:{name}:{lat:.4f}:{lng:.4f}:{address}:{language}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached.get("id"), cached.get("count", 0)

    params: dict[str, object] = {
        "key": TRIPADVISOR_API_KEY,
        "searchQuery": name,
        "category": "restaurants",
        "latLong": f"{lat},{lng}",
        "radius": 2,
        "radiusUnit": "km",
        "language": _language_code(language),
    }
    if address:
        params["address"] = address

    try:
        client = _get_http_client()
        response = await client.get(f"{_BASE}/location/search", params=params)
        if response.status_code != 200:
            log.info("TripAdvisor search failed for %r: %s", name, response.status_code)
            await cache_set(cache_key, {"id": None, "count": 0}, ttl=1800)
            return None, 0
        payload = response.json()
    except Exception as exc:
        log.info("TripAdvisor search exception for %r: %s", name, exc)
        return None, 0

    locations = _search_results(payload)
    if not locations:
        await cache_set(cache_key, {"id": None, "count": 0}, ttl=1800)
        return None, 0

    scored = sorted(
        locations,
        key=lambda location: _score_location(location, name=name, lat=lat, lng=lng, address=address),
        reverse=True,
    )

    location_id: str | None = None
    review_count = 0
    for location in scored:
        if not _is_location_match(location, name=name, lat=lat, lng=lng):
            continue
        if _score_location(location, name=name, lat=lat, lng=lng, address=address) < 0.55:
            continue
        raw_id = location.get("location_id") or location.get("locationId")
        if raw_id is None:
            continue
        location_id = str(raw_id).strip() or None
        if location_id:
            # TripAdvisor search API doesn't always return review count directly, 
            # but we can try to extract it if available, or fetch it later.
            # For now, we'll try to get it from the search response if it exists.
            review_count = int(_to_float(location.get("num_reviews")) or 0)
            break

    await cache_set(cache_key, {"id": location_id or "", "count": review_count}, ttl=1800)
    return location_id, review_count


def _extract_tripadvisor_reviews(payload: dict, *, language: str) -> list[dict]:
    raw_reviews = payload.get("data")
    if not isinstance(raw_reviews, list):
        return []

    reviews: list[dict] = []
    for review in raw_reviews[:5]:
        if not isinstance(review, dict):
            continue
        text = str(review.get("text") or "").strip()
        if not text:
            continue

        user = review.get("user")
        if not isinstance(user, dict):
            user = {}

        reviews.append(
            {
                "author": str(user.get("username") or user.get("name") or "TripAdvisor user"),
                "rating": int(_to_float(review.get("rating")) or 0),
                "text": text,
                "relative_time": str(
                    review.get("published_date")
                    or review.get("publishedDate")
                    or review.get("travel_date")
                    or ""
                ),
                "source_language": _language_code(language),
                "source": "tripadvisor",
                "url": str(review.get("url") or ""),
            }
        )
    return reviews


async def get_tripadvisor_reviews(
    *,
    name: str,
    lat: float,
    lng: float,
    address: str = "",
    language: str = "es",
) -> dict:
    """Return TripAdvisor reviews and total count for a nearby restaurant match, if any."""
    if not TRIPADVISOR_API_KEY:
        return {"reviews": [], "total_count": 0}

    location_id, review_count = await _find_location_id(name=name, lat=lat, lng=lng, address=address, language=language)
    if not location_id:
        return {"reviews": [], "total_count": 0}

    cache_key = f"tripadvisor_reviews_v2:{location_id}:{language}"
    cached = await cache_get(cache_key)
    if cached:
        return {"reviews": cached, "total_count": review_count}

    params = {
        "key": TRIPADVISOR_API_KEY,
        "language": _language_code(language),
        "limit": 5,
    }

    try:
        client = _get_http_client()
        response = await client.get(f"{_BASE}/location/{location_id}/reviews", params=params)
        if response.status_code != 200:
            log.info("TripAdvisor reviews failed for %s: %s", location_id, response.status_code)
            return {"reviews": [], "total_count": review_count}
        payload = response.json()
    except Exception as exc:
        log.info("TripAdvisor reviews exception for %s: %s", location_id, exc)
        return {"reviews": [], "total_count": review_count}

    reviews = _extract_tripadvisor_reviews(payload, language=language)
    await cache_set(cache_key, reviews, ttl=3600 * 6)
    return {"reviews": reviews, "total_count": review_count}
