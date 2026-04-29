"""Netflix-style 'carta' recommendations built from places + reviews + LLM analysis."""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import math
from typing import Any, Callable

from services.cache_service import cache_get, cache_set
from services.recommendation.pipeline import _llm, _parse_json, _pre_filter
from services.recommendation.tools import fetch_all_reviews, search_places

log = logging.getLogger("carta")

_METRIC_KEYS = (
    "calidad_precio",
    "servicio",
    "comida",
    "ambiente",
    "rapidez",
)
_CATEGORY_KEYS = (
    "romantico",
    "tapas",
    "comida_rapida",
    "premium",
    "familiar",
    "para_amigos",
    "turistico",
    "local_hidden_gem",
)
_CUISINES = {"italian", "japanese", "spanish", "mexican", "indian", "american", "other"}


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _as_int_0_100(value: Any, *, default: int = 50) -> int:
    try:
        parsed = int(round(float(value)))
    except (TypeError, ValueError):
        parsed = default
    return int(_clamp(parsed, 0, 100))


def _as_float_0_1(value: Any, *, default: float = 0.0) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        parsed = default
    if math.isnan(parsed):
        parsed = default
    return round(_clamp(parsed, 0.0, 1.0), 4)


def _safe_rating(place: dict) -> float:
    return round(float(place.get("rating") or 0.0), 2)


def _safe_reviews_count(place: dict) -> int:
    return int(place.get("total_ratings") or 0)


def _safe_price(place: dict) -> int:
    raw = int(place.get("price_level") or 2)
    return int(_clamp(raw, 1, 3))


def _safe_reviews_slice(place: dict, limit: int = 10) -> list[dict]:
    reviews = place.get("google_reviews", [])
    if not isinstance(reviews, list):
        return []
    safe: list[dict] = []
    for rev in reviews[:limit]:
        if not isinstance(rev, dict):
            continue
        safe.append(
            {
                "author": str(rev.get("author", "")),
                "rating": int(rev.get("rating") or 0),
                "text": str(rev.get("text") or ""),
                "relative_time": str(rev.get("relative_time") or ""),
            }
        )
    return safe


def _review_signature(place: dict) -> str:
    base_parts = [
        str(place.get("place_id") or ""),
        str(place.get("rating") or 0),
        str(place.get("total_ratings") or 0),
        str(place.get("price_level") or 0),
        str(place.get("review_summary") or ""),
    ]
    for rev in _safe_reviews_slice(place, limit=8):
        base_parts.append((rev.get("text") or "")[:120].strip().lower())
    digest = hashlib.md5("||".join(base_parts).encode("utf-8")).hexdigest()
    return digest[:16]


def _analysis_cache_key(place: dict, language: str) -> str:
    pid = str(place.get("place_id") or "")
    return f"carta:analysis:v1:{language}:{pid}:{_review_signature(place)}"


def _zone_cache_key(lat: float, lng: float, price_level: int | None, language: str) -> str:
    rounded_lat = round(lat, 3)
    rounded_lng = round(lng, 3)
    return f"carta:zone:v1:{rounded_lat:.3f}:{rounded_lng:.3f}:{price_level or 0}:{language}"


def _contains_any(text: str, keywords: tuple[str, ...]) -> bool:
    return any(word in text for word in keywords)


def _detect_cuisine(text: str) -> str:
    cuisine_keywords: list[tuple[str, tuple[str, ...]]] = [
        ("italian", ("pizza", "pasta", "trattoria", "osteria", "napolitan", "napolitana")),
        ("japanese", ("sushi", "ramen", "japanese", "japon", "izakaya", "yakitori")),
        ("spanish", ("tapas", "paella", "arroz", "iberico", "jamon", "spanish", "espanol")),
        ("mexican", ("taco", "tacos", "burrito", "quesadilla", "mexican", "mexicana")),
        ("indian", ("curry", "tandoori", "masala", "indian", "india")),
        ("american", ("burger", "hamburger", "bbq", "american", "steakhouse")),
    ]
    for cuisine, words in cuisine_keywords:
        if _contains_any(text, words):
            return cuisine
    return "other"


def _fallback_summary(language: str, best_category: str) -> str:
    messages = {
        "es": {
            "romantico": "Ideal para una cita con ambiente agradable.",
            "tapas": "Buen sitio para compartir tapas y raciones.",
            "comida_rapida": "Buena opción para comer rápido sin complicaciones.",
            "premium": "Experiencia cuidada para una ocasión especial.",
            "familiar": "Apto para planes familiares y comidas tranquilas.",
            "para_amigos": "Ambiente social perfecto para ir con amigos.",
            "turistico": "Muy popular y frecuentado por visitantes.",
            "local_hidden_gem": "Una joya local con valoraciones muy sólidas.",
        },
        "en": {
            "romantico": "Great date spot with a cozy atmosphere.",
            "tapas": "Good place to share tapas and small plates.",
            "comida_rapida": "Solid choice for a quick, casual meal.",
            "premium": "Refined experience for a special occasion.",
            "familiar": "Family-friendly and comfortable for groups.",
            "para_amigos": "Social vibe that works well with friends.",
            "turistico": "Very popular and often visited by tourists.",
            "local_hidden_gem": "A local hidden gem with strong ratings.",
        },
        "fr": {
            "romantico": "Idéal pour un rendez-vous dans une ambiance cosy.",
            "tapas": "Bon endroit pour partager des tapas.",
            "comida_rapida": "Bonne option pour manger vite et bien.",
            "premium": "Expérience soignée pour une occasion spéciale.",
            "familiar": "Adapté aux familles et aux groupes.",
            "para_amigos": "Ambiance conviviale pour venir entre amis.",
            "turistico": "Très populaire auprès des visiteurs.",
            "local_hidden_gem": "Une pépite locale avec de très bons avis.",
        },
    }
    lang = language if language in messages else "es"
    return messages[lang].get(best_category, messages[lang]["para_amigos"])


def _heuristic_analysis(place: dict, language: str) -> dict:
    name = str(place.get("name") or "")
    types = " ".join(str(t) for t in place.get("types", []) if t)
    reviews = _safe_reviews_slice(place, limit=10)
    review_text = " ".join(str(r.get("text") or "") for r in reviews).lower()
    haystack = f"{name.lower()} {types.lower()} {review_text}".strip()

    rating = _safe_rating(place)
    reviews_count = _safe_reviews_count(place)
    price = _safe_price(place)

    is_bar_like = _contains_any(haystack, ("bar", "taberna", "tapas", "raciones", "vermouth"))
    is_fast = _contains_any(
        haystack,
        ("fast", "quick", "rapido", "rápido", "takeaway", "take away", "burger", "hamburger"),
    )
    is_cozy = _contains_any(
        haystack,
        ("romantic", "romantico", "romántico", "cozy", "intimate", "acogedor", "quiet", "tranquilo"),
    )
    is_social = _contains_any(
        haystack,
        ("friends", "grupo", "group", "animado", "lively", "party", "social", "compartir"),
    )
    is_family = _contains_any(
        haystack,
        ("family", "familiar", "kids", "niños", "ninos", "children", "child"),
    )

    categories = {
        "romantico": _as_float_0_1(0.2 + 0.2 * is_cozy + 0.15 * (price >= 2) + 0.1 * (rating >= 4.4)),
        "tapas": _as_float_0_1(0.15 + 0.45 * is_bar_like + 0.15 * _contains_any(haystack, ("spanish", "espanol", "español"))),
        "comida_rapida": _as_float_0_1(0.2 + 0.35 * is_fast + 0.15 * (price <= 2)),
        "premium": _as_float_0_1(0.15 + 0.25 * (price == 3) + 0.15 * (rating >= 4.5) + 0.15 * _contains_any(haystack, ("michelin", "degustation", "fine dining", "elegant"))),
        "familiar": _as_float_0_1(0.25 + 0.25 * is_family + 0.1 * (price <= 2)),
        "para_amigos": _as_float_0_1(0.2 + 0.35 * is_social + 0.15 * is_bar_like),
        "turistico": _as_float_0_1(0.2 + 0.35 * _clamp(math.log10(reviews_count + 1) / math.log10(6000), 0.0, 1.0)),
        "local_hidden_gem": _as_float_0_1(0.15 + 0.4 * (rating >= 4.5 and reviews_count < 250) + 0.1 * (reviews_count < 120)),
    }

    metrics = {
        "comida": _as_int_0_100(rating * 20 + 5),
        "servicio": _as_int_0_100(rating * 17 + (8 if _contains_any(haystack, ("service", "servicio", "staff", "atencion", "atención")) else 0)),
        "ambiente": _as_int_0_100(35 + categories["romantico"] * 30 + categories["para_amigos"] * 20),
        "rapidez": _as_int_0_100(25 + categories["comida_rapida"] * 60),
        "calidad_precio": _as_int_0_100((rating * 18) + (22 if price == 1 else 14 if price == 2 else 8)),
    }

    cuisine = _detect_cuisine(haystack)
    best_category = max(categories.items(), key=lambda x: x[1])[0]

    return {
        "id": str(place.get("place_id") or ""),
        "metrics": metrics,
        "categories": categories,
        "cuisine": cuisine,
        "summary": _fallback_summary(language, best_category),
    }


def _normalize_analysis(item: dict, place: dict, language: str) -> dict:
    fallback = _heuristic_analysis(place, language)
    metrics_raw = item.get("metrics") if isinstance(item, dict) else {}
    cats_raw = item.get("categories") if isinstance(item, dict) else {}

    metrics = {
        k: _as_int_0_100(metrics_raw.get(k) if isinstance(metrics_raw, dict) else None, default=fallback["metrics"][k])
        for k in _METRIC_KEYS
    }
    categories = {
        k: _as_float_0_1(cats_raw.get(k) if isinstance(cats_raw, dict) else None, default=fallback["categories"][k])
        for k in _CATEGORY_KEYS
    }

    cuisine = str(item.get("cuisine") or fallback["cuisine"]).strip().lower()
    if cuisine not in _CUISINES:
        cuisine = "other"

    summary = str(item.get("summary") or "").strip() or fallback["summary"]

    return {
        "id": str(item.get("id") or fallback["id"]),
        "metrics": metrics,
        "categories": categories,
        "cuisine": cuisine,
        "summary": summary,
    }


async def _analyze_places_with_llm(places: list[dict], language: str) -> dict[str, dict]:
    if not places:
        return {}

    payload = []
    for place in places:
        payload.append(
            {
                "id": str(place.get("place_id") or ""),
                "name": str(place.get("name") or ""),
                "rating": _safe_rating(place),
                "user_ratings_total": _safe_reviews_count(place),
                "price_level": _safe_price(place),
                "types": [str(t) for t in place.get("types", []) if t],
                "address": str(place.get("address") or ""),
                "reviews": _safe_reviews_slice(place, limit=10),
            }
        )

    instruction = (
        "Eres un sistema experto en análisis de restaurantes para una app tipo Netflix. "
        "Devuelve solo JSON válido."
    )
    prompt = f"""
INPUT:
{json.dumps(payload, ensure_ascii=False)}

Para cada restaurante devuelve:
{{
  "id": "place_id",
  "metrics": {{
    "calidad_precio": number,
    "servicio": number,
    "comida": number,
    "ambiente": number,
    "rapidez": number
  }},
  "categories": {{
    "romantico": number,
    "tapas": number,
    "comida_rapida": number,
    "premium": number,
    "familiar": number,
    "para_amigos": number,
    "turistico": number,
    "local_hidden_gem": number
  }},
  "cuisine": "italian | japanese | spanish | mexican | indian | american | other",
  "summary": "frase corta útil para el usuario"
}}

Reglas:
- metricas en 0..100
- categories en 0..1
- usa sobre todo reviews reales
- sin texto fuera del JSON
- idioma del summary: {language}
"""

    raw = await _llm(name="carta_batch", instruction=instruction, prompt=prompt, json_mode=True)
    parsed = _parse_json(raw)
    if isinstance(parsed, dict):
        if isinstance(parsed.get("restaurants"), list):
            parsed = parsed["restaurants"]
        else:
            parsed = [parsed]
    if not isinstance(parsed, list):
        return {}

    place_by_id = {str(p.get("place_id") or ""): p for p in places}
    output: dict[str, dict] = {}
    for item in parsed:
        if not isinstance(item, dict):
            continue
        pid = str(item.get("id") or "")
        if not pid or pid not in place_by_id:
            continue
        output[pid] = _normalize_analysis(item, place_by_id[pid], language)
    return output


def _popular_score(restaurant: dict) -> float:
    rating_score = _clamp(float(restaurant.get("rating") or 0) / 5.0, 0.0, 1.0)
    reviews_count = int(restaurant.get("reviewsCount") or 0)
    reviews_score = _clamp(math.log10(reviews_count + 1) / math.log10(10000), 0.0, 1.0)
    distance = float(restaurant.get("distanceM") or 0)
    distance_score = _clamp(1.0 - (min(distance, 7000.0) / 7000.0), 0.0, 1.0)
    return 0.45 * rating_score + 0.35 * reviews_score + 0.20 * distance_score


def _section_score_defs() -> list[dict[str, Any]]:
    return [
        {"id": "romantico", "title": "Para una cita", "threshold": 0.45, "score": lambda r: r["categories"]["romantico"]},
        {"id": "tapas", "title": "Tapas", "threshold": 0.40, "score": lambda r: r["categories"]["tapas"]},
        {"id": "calidad_precio", "title": "Calidad-precio", "threshold": 0.55, "score": lambda r: r["metrics"]["calidad_precio"] / 100.0},
        {"id": "comida_rapida", "title": "Comida rápida", "threshold": 0.45, "score": lambda r: (0.6 * r["categories"]["comida_rapida"]) + (0.4 * (r["metrics"]["rapidez"] / 100.0))},
        {"id": "para_amigos", "title": "Para ir con amigos", "threshold": 0.45, "score": lambda r: r["categories"]["para_amigos"]},
        {"id": "familiar", "title": "Familiar", "threshold": 0.45, "score": lambda r: r["categories"]["familiar"]},
        {"id": "premium", "title": "Premium", "threshold": 0.45, "score": lambda r: r["categories"]["premium"]},
        {"id": "joyas_ocultas", "title": "Joyas ocultas", "threshold": 0.40, "score": lambda r: r["categories"]["local_hidden_gem"]},
        {"id": "populares_cerca", "title": "Populares cerca de ti", "threshold": 0.50, "score": _popular_score},
    ]


def _build_sections(restaurants: list[dict]) -> list[dict]:
    sections: list[dict] = []
    for cfg in _section_score_defs():
        score_fn: Callable[[dict], float] = cfg["score"]
        threshold = float(cfg["threshold"])

        candidates: list[tuple[float, dict]] = []
        seen_ids: set[str] = set()
        for restaurant in restaurants:
            score = _clamp(float(score_fn(restaurant)), 0.0, 1.0)
            if score < threshold:
                continue
            rid = str(restaurant.get("id") or "")
            if not rid or rid in seen_ids:
                continue
            seen_ids.add(rid)
            candidates.append((score, restaurant))

        if len(candidates) < 4:
            for score, restaurant in sorted(
                [(_clamp(float(score_fn(r)), 0.0, 1.0), r) for r in restaurants],
                key=lambda x: x[0],
                reverse=True,
            ):
                rid = str(restaurant.get("id") or "")
                if score < 0.25 or not rid or rid in seen_ids:
                    continue
                seen_ids.add(rid)
                candidates.append((score, restaurant))
                if len(candidates) >= 10:
                    break

        candidates.sort(key=lambda x: x[0], reverse=True)
        top = [restaurant for _, restaurant in candidates[:10]]
        if top:
            sections.append({"id": cfg["id"], "title": cfg["title"], "restaurants": top})
    return sections


async def _enrich_reviews_for_place(place: dict, language: str, semaphore: asyncio.Semaphore) -> dict:
    async with semaphore:
        inline_reviews = _safe_reviews_slice(place, limit=10)
        # Google Text Search already returns up to 5 reviews inline.
        # Reuse them whenever possible to control latency and API cost.
        if len(inline_reviews) >= 5:
            place["google_reviews"] = inline_reviews
            return place

        try:
            fetched = await fetch_all_reviews(
                str(place.get("place_id") or ""),
                str(place.get("name") or ""),
                float(place.get("lat") or 0.0),
                float(place.get("lng") or 0.0),
                language=language,
            )
            merged = {**place, **(fetched or {})}
            merged["google_reviews"] = _safe_reviews_slice(merged, limit=10)
            return merged
        except Exception as exc:  # noqa: BLE001
            log.warning("[CARTA] review fetch failed for %s: %s", place.get("name"), exc)
            place["google_reviews"] = _safe_reviews_slice(place, limit=10)
            return place


def _merge_and_dedupe_places(raw_places: list[dict]) -> list[dict]:
    deduped: dict[str, dict] = {}
    for place in raw_places:
        pid = str(place.get("place_id") or "")
        if not pid:
            continue
        previous = deduped.get(pid)
        if not previous:
            deduped[pid] = place
            continue
        prev_score = (previous.get("rating") or 0.0, previous.get("total_ratings") or 0)
        next_score = (place.get("rating") or 0.0, place.get("total_ratings") or 0)
        if next_score > prev_score:
            deduped[pid] = place
    return list(deduped.values())


def _build_restaurant_payload(place: dict, analysis: dict) -> dict:
    summary = str(analysis.get("summary") or "")
    reviews = _safe_reviews_slice(place, limit=10)
    return {
        "id": str(place.get("place_id") or ""),
        "name": str(place.get("name") or ""),
        "rating": _safe_rating(place),
        "reviewsCount": _safe_reviews_count(place),
        "priceLevel": _safe_price(place),
        "photoUrl": str(place.get("photo_url") or ""),
        "address": str(place.get("address") or ""),
        "lat": float(place.get("lat") or 0.0),
        "lng": float(place.get("lng") or 0.0),
        "distanceM": int(place.get("distance_m") or 0),
        "summary": summary,
        "tagline": summary,
        "why": summary,
        "cuisine": str(analysis.get("cuisine") or "other"),
        "metrics": analysis.get("metrics") or {},
        "categories": analysis.get("categories") or {},
        "reviews": reviews,
        "phone": str(place.get("phone") or ""),
        "pros": [],
        "cons": [],
        "verdict": "",
        "tags": [],
        "bestReviewQuote": "",
        "reviewQualityScore": 0.5,
    }


async def get_carta_sections(
    *,
    lat: float,
    lng: float,
    price_level: int | None = None,
    language: str = "es",
) -> dict:
    zone_key = _zone_cache_key(lat, lng, price_level, language)
    cached = await cache_get(zone_key)
    if cached:
        return cached

    try:
        search_result = await search_places(
            parent_category="food",
            subcategory="restaurant",
            lat=lat,
            lng=lng,
            price_level=price_level,
            language=language,
        )
    except Exception as exc:  # noqa: BLE001
        log.error("[CARTA] search failed: %s", exc)
        response = {"sections": [], "error": "google_places_unavailable"}
        await cache_set(zone_key, response, ttl=60)
        return response

    raw_places = search_result.get("restaurants", [])
    if not raw_places:
        response = {"sections": []}
        await cache_set(zone_key, response, ttl=60)
        return response

    places = _merge_and_dedupe_places(raw_places)
    places = _pre_filter(places, price_level, n=18)
    places = places[:18]

    semaphore = asyncio.Semaphore(6)
    places = await asyncio.gather(
        *[_enrich_reviews_for_place(place, language, semaphore) for place in places],
        return_exceptions=False,
    )

    analysis_map: dict[str, dict] = {}
    pending_places: list[dict] = []
    pending_cache_keys: dict[str, str] = {}

    for place in places:
        pid = str(place.get("place_id") or "")
        if not pid:
            continue
        cache_key = _analysis_cache_key(place, language)
        cached_analysis = await cache_get(cache_key)
        if isinstance(cached_analysis, dict):
            analysis_map[pid] = cached_analysis
        else:
            pending_places.append(place)
            pending_cache_keys[pid] = cache_key

    if pending_places:
        llm_analysis_map: dict[str, dict] = {}
        try:
            llm_analysis_map = await _analyze_places_with_llm(pending_places, language)
        except Exception as exc:  # noqa: BLE001
            log.warning("[CARTA] LLM analysis failed, using heuristics: %s", exc)
            llm_analysis_map = {}

        for place in pending_places:
            pid = str(place.get("place_id") or "")
            if not pid:
                continue
            normalized = llm_analysis_map.get(pid)
            if not isinstance(normalized, dict):
                normalized = _heuristic_analysis(place, language)
            analysis_map[pid] = normalized
            await cache_set(pending_cache_keys[pid], normalized, ttl=60 * 60 * 12)

    restaurants: list[dict] = []
    for place in places:
        pid = str(place.get("place_id") or "")
        if not pid:
            continue
        analysis = analysis_map.get(pid) or _heuristic_analysis(place, language)
        restaurants.append(_build_restaurant_payload(place, analysis))

    sections = _build_sections(restaurants)
    response = {"sections": sections}
    await cache_set(zone_key, response, ttl=300)
    return response
