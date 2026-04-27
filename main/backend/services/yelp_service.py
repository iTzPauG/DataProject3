"""Yelp Fusion wrapper for secondary review enrichment."""

from __future__ import annotations

import logging
from difflib import SequenceMatcher

import httpx

from config import YELP_API_KEY
from services.cache_service import cache_get, cache_set

log = logging.getLogger(__name__)

_BASE = "https://api.yelp.com/v3"
_http_client: httpx.AsyncClient | None = None


def _get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(timeout=10)
    return _http_client


def _review_locale(language: str) -> str:
    lang = (language or "es").strip().lower()
    if lang.startswith("en"):
        return "en_US"
    if lang.startswith("fr"):
        return "fr_FR"
    if lang.startswith("it"):
        return "it_IT"
    if lang.startswith("de"):
        return "de_DE"
    if lang.startswith("pt"):
        return "pt_PT"
    if lang.startswith("ca"):
        return "es_ES"
    return "es_ES"


def _similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, (a or "").lower().strip(), (b or "").lower().strip()).ratio()


def _score_business(business: dict, *, name: str, lat: float, lng: float, address: str) -> float:
    score = 0.0
    score += _similarity(name, business.get("name", "")) * 0.7

    biz_lat = business.get("coordinates", {}).get("latitude")
    biz_lng = business.get("coordinates", {}).get("longitude")
    if biz_lat is not None and biz_lng is not None:
        distance_penalty = min(1.0, abs(biz_lat - lat) * 50 + abs(biz_lng - lng) * 50)
        score += max(0.0, 0.2 - distance_penalty * 0.2)

    location_bits = business.get("location", {}).get("display_address") or []
    location_text = ", ".join(location_bits)
    if address and location_text:
        score += _similarity(address, location_text) * 0.1
    return score


async def _find_business_id(
    *,
    name: str,
    lat: float,
    lng: float,
    address: str = "",
    language: str = "es",
) -> str | None:
    if not YELP_API_KEY or not name:
        return None

    cache_key = f"yelp_match:{name}:{lat:.4f}:{lng:.4f}:{address}:{language}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached or None

    headers = {"Authorization": f"Bearer {YELP_API_KEY}"}
    params = {
        "term": name,
        "latitude": lat,
        "longitude": lng,
        "limit": 5,
        "sort_by": "best_match",
        "locale": _review_locale(language),
    }

    try:
        client = _get_http_client()
        resp = await client.get(f"{_BASE}/businesses/search", params=params, headers=headers)
        if resp.status_code != 200:
            log.info("Yelp business search failed for %r: %s", name, resp.status_code)
            await cache_set(cache_key, "", ttl=1800)
            return None
        businesses = resp.json().get("businesses", [])
    except Exception as exc:
        log.info("Yelp business search exception for %r: %s", name, exc)
        return None

    if not businesses:
        await cache_set(cache_key, "", ttl=1800)
        return None

    best = max(businesses, key=lambda b: _score_business(b, name=name, lat=lat, lng=lng, address=address))
    best_id = best.get("id") if _score_business(best, name=name, lat=lat, lng=lng, address=address) >= 0.55 else None
    await cache_set(cache_key, best_id or "", ttl=1800)
    return best_id


async def get_yelp_reviews(
    *,
    name: str,
    lat: float,
    lng: float,
    address: str = "",
    language: str = "es",
) -> list[dict]:
    """Return Yelp reviews for a nearby business match, if any."""
    if not YELP_API_KEY:
        return []

    business_id = await _find_business_id(name=name, lat=lat, lng=lng, address=address, language=language)
    if not business_id:
        return []

    cache_key = f"yelp_reviews:{business_id}:{language}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    headers = {"Authorization": f"Bearer {YELP_API_KEY}"}
    params = {"locale": _review_locale(language)}

    try:
        client = _get_http_client()
        resp = await client.get(f"{_BASE}/businesses/{business_id}/reviews", params=params, headers=headers)
        if resp.status_code != 200:
            log.info("Yelp reviews failed for %s: %s", business_id, resp.status_code)
            return []
        payload = resp.json()
    except Exception as exc:
        log.info("Yelp reviews exception for %s: %s", business_id, exc)
        return []

    reviews = []
    for review in payload.get("reviews", [])[:3]:
        text = str(review.get("text") or "").strip()
        if not text:
            continue
        user = review.get("user") or {}
        reviews.append(
            {
                "author": user.get("name", "Yelp user"),
                "rating": int(review.get("rating") or 0),
                "text": text,
                "relative_time": str(review.get("time_created") or ""),
                "source_language": language,
                "source": "yelp",
                "url": review.get("url", ""),
            }
        )

    await cache_set(cache_key, reviews, ttl=3600 * 6)
    return reviews
