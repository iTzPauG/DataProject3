"""
Recommendation pipeline v2 — speed, resilience, quality.

Optimised flow (batch mode ~3-5s, stream first result ~3s):
  A  search_places()      → Google Places API, 20 candidates + inline reviews + reviewSummary
  B  pre_filter()         → drop low-rated / wrong-price / too-far; rank by rating x log(reviews)
  C' smart_fetch()        → ONLY deep-fetch places missing reviews (skip if search gave them)
  D  resolve_mood()       → DETERMINISTIC mood → structured prefs (no LLM)
  E  parallel LLM+live    → 2 LLM batches (3+2) + live data ALL IN PARALLEL
  F  fallback             → if LLM fails, use reviewSummary directly (never empty results)
"""

import asyncio
import json
import logging
import math
import os
import re
import time
from typing import Optional
from typing import AsyncGenerator

from google.auth import default as google_auth_default
from google import genai
from google.genai import types

from .tools import fetch_all_reviews, haversine, search_places
from .category_flow import get_flow_definition
from services.live_data_service import get_live_data
from services.cache_service import cache_get, cache_set
from services.google_places_service import get_place_details as get_google_place_details

MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

log = logging.getLogger("pipeline")
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
)
for _noisy in ("httpcore", "httpx", "urllib3", "google.auth"):
    logging.getLogger(_noisy).setLevel(logging.WARNING)

MAX_DISTANCE_KM = 8.0
PREFILTER_CANDIDATES = 15
TOP_RESULTS = 10
MIN_RESULTS = 5
STREAM_BATCH_SIZE = 3
LLM_BATCH_SPLIT = 3  # split top 5 into batches of 3+2 for parallel LLM

# ── Shared Gemini client ─────────────────────────────────────────────────────
_genai_client: genai.Client | None = None
_vertex_project_id: str | None = None


def _resolve_vertex_project() -> str:
    global _vertex_project_id
    if _vertex_project_id:
        return _vertex_project_id
    project = os.getenv("GOOGLE_CLOUD_PROJECT", "").strip()
    if project:
        _vertex_project_id = project
        return _vertex_project_id
    try:
        _, detected_project = google_auth_default()
    except Exception as exc:
        log.warning("[LLM] Could not resolve Google Cloud project from ADC: %s", exc)
        detected_project = None
    _vertex_project_id = (detected_project or "").strip()
    return _vertex_project_id


def _get_client() -> genai.Client:
    global _genai_client
    if _genai_client is None:
        project = _resolve_vertex_project()
        if not project:
            raise RuntimeError("Vertex AI requires GOOGLE_CLOUD_PROJECT or ADC project discovery.")
        location = os.getenv("GOOGLE_CLOUD_LOCATION", "global").strip() or "global"
        _genai_client = genai.Client(
            vertexai=True,
            project=project,
            location=location,
            http_options=types.HttpOptions(apiVersion="v1"),
        )
    return _genai_client


_llm_timings: list[dict] = []


async def _llm_gemini(name: str, instruction: str, prompt: str, *, json_mode: bool = True) -> str:
    """Direct google-genai call with optional JSON-forced output."""
    log.info("[LLM:%s] → %d chars de prompt", name, len(prompt))
    t0 = time.perf_counter()

    config_kwargs: dict = {
        "system_instruction": instruction,
        "temperature": 0.2,
    }
    if json_mode:
        config_kwargs["response_mime_type"] = "application/json"

    response = await _get_client().aio.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(**config_kwargs),
    )
    final = response.text or ""
    elapsed = time.perf_counter() - t0

    usage = response.usage_metadata
    prompt_tok   = getattr(usage, "prompt_token_count",     "?")
    response_tok = getattr(usage, "candidates_token_count", "?")
    total_tok    = getattr(usage, "total_token_count",      "?")

    log.info(
        "[LLM:%s] ← %.2fs | tokens in=%s out=%s total=%s | respuesta %d chars",
        name, elapsed, prompt_tok, response_tok, total_tok, len(final),
    )
    _llm_timings.append({
        "name": name, "elapsed": elapsed,
        "tokens_in": prompt_tok, "tokens_out": response_tok, "tokens_total": total_tok,
    })
    return final


async def _llm(name: str, instruction: str, prompt: str, *, json_mode: bool = True) -> str:
    """LLM call with automatic fallback — Gemini first, empty string on failure."""
    try:
        return await _llm_gemini(name, instruction, prompt, json_mode=json_mode)
    except Exception as e:
        log.warning("[LLM:%s] Gemini failed: %s — triggering fallback enrichment", name, e)
        return ""


def _parse_json(text: str):
    """Pull a JSON array or object out of an LLM response."""
    # If response_mime_type=json was used, text is already clean JSON
    text = text.strip()
    if text and text[0] in ("[", "{"):
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
    m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if m:
        return json.loads(m.group(1))
    for open_c, close_c in [("[", "]"), ("{", "}")]:
        s, e = text.find(open_c), text.rfind(close_c)
        if s != -1 and e > s:
            return json.loads(text[s : e + 1])
    return json.loads(text)


# ── Category label helper ────────────────────────────────────────────────────

def _category_label(parent_category: str) -> str:
    """Human-readable label for the category, used in LLM prompts."""
    flow = get_flow_definition(parent_category)
    return flow.get("label", parent_category.replace("_", " ").title())


def _category_noun(parent_category: str) -> str:
    """What we call individual results: 'restaurante', 'bar', 'parque', etc."""
    NOUNS = {
        "food": "lugar", "restaurant": "restaurante",
        "nightlife": "local", "shopping": "tienda",
        "health": "centro de salud",
        "nature": "espacio natural", "culture": "espacio cultural",
        "services": "servicio", "sport": "instalacion deportiva",
        "education": "centro educativo", "cinema": "cine",
        "wellness": "centro de bienestar", "coworking": "espacio de coworking",
        "pets": "servicio de mascotas", "automotive": "servicio de automocion",
    }
    return NOUNS.get(parent_category, "lugar")


def _infer_city(address: str | None) -> str | None:
    """Best-effort city extraction for downstream live-data links."""
    if not address:
        return None
    parts = [part.strip() for part in address.split(",") if part.strip()]
    for part in reversed(parts):
        if any(ch.isalpha() for ch in part):
            return part
    return None


# ── Step B — pre_filter (Python) ─────────────────────────────────────────────

def _pre_filter(candidates: list[dict], price_level: int | None, n: int = PREFILTER_CANDIDATES) -> list[dict]:
    """Drop low-rated places, rank by Google's own signal + price match."""
    if not candidates:
        return []

    dropped = []
    kept = []
    far_candidates = []
    for r in candidates:
        rating = r.get("rating", 0) or 0
        price_diff = 0
        if price_level is not None and r.get("price_level") is not None:
            price_diff = abs(r.get("price_level", price_level) - price_level)
        distance_km = r.get("distance_m", 0) / 1000.0

        if rating > 0 and rating < 3.0:
            dropped.append(f"{r.get('name', 'Unknown')} (rating {rating} < 3.0)")
        elif distance_km > MAX_DISTANCE_KM:
            far_candidates.append(r)
        else:
            kept.append(r)

    # Fallbacks if we dropped too many
    if not kept and far_candidates:
        kept = far_candidates
    elif not kept and dropped:
        kept = candidates

    def _sort_key(r: dict):
        p_diff = 0
        if price_level is not None and r.get("price_level") is not None:
            p_diff = abs(r.get("price_level", price_level) - price_level)
            
        return (
            -p_diff, # Prioritize exact price matches
            (r.get("rating") or 0.0) * math.log10((r.get("total_ratings") or 0) + 1),
            -(r.get("distance_m") or 0),
        )

    if dropped:
        log.debug("[B] dropped %d candidates: %s", len(dropped), " | ".join(dropped))

    kept.sort(key=_sort_key, reverse=True)
    result = kept[:n]
    log.info(
        "[B] pre_filter: %d → %d candidates",
        len(candidates), len(result)
    )
    return result


# ── Step D — resolve_mood (DETERMINISTIC — no LLM) ──────────────────────────

_MOOD_MAP: dict[str, dict] = {
    "quick":        {"prefer_quiet": False, "prefer_fast": True,  "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["quick", "casual", "efficient"]},
    "casual":       {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["casual", "relaxed", "informal"]},
    "date":         {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": True,  "prefer_outdoor": False, "vibe_keywords": ["romantic", "intimate", "cozy"]},
    "family":       {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": True,  "vibe_keywords": ["family-friendly", "spacious", "welcoming"]},
    "celebration":  {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": True,  "prefer_outdoor": False, "vibe_keywords": ["festive", "impressive", "elegant"]},
    "sharing":      {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["lively", "sharing", "social"]},
    "gourmet":      {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": True,  "prefer_outdoor": False, "vibe_keywords": ["gourmet", "fine-dining", "elegant"]},
    "tapas":        {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["lively", "bustling", "traditional"]},
    "chill":        {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["chill", "relaxed", "quiet"]},
    "party":        {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["energetic", "loud", "dancing"]},
    "friends":      {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["social", "lively", "fun"]},
    "music":        {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["live-music", "atmosphere", "energetic"]},
    "relax":        {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": True,  "vibe_keywords": ["peaceful", "scenic", "relaxing"]},
    "active":       {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": True,  "vibe_keywords": ["adventurous", "active", "outdoor"]},
    "photo_spot":   {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": True,  "vibe_keywords": ["scenic", "photogenic", "panoramic"]},
    "learn":        {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["educational", "immersive", "quiet"]},
    "interactive":  {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["interactive", "fun", "immersive"]},
    "classic":      {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": True,  "prefer_outdoor": False, "vibe_keywords": ["historical", "classic", "impressive"]},
    "entertainment": {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["entertaining", "fun", "casual"]},
    "window":       {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": True,  "vibe_keywords": ["browsing", "relaxed", "leisurely"]},
    "treat_myself": {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["premium", "treat", "luxury"]},
    "sale":         {"prefer_quiet": False, "prefer_fast": True,  "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["bargain", "deals", "sale"]},
    "luxury":       {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": True,  "prefer_outdoor": False, "vibe_keywords": ["luxury", "premium", "exclusive"]},
    "urgent":       {"prefer_quiet": False, "prefer_fast": True,  "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["fast", "trusted", "nearby"]},
    "checkup":      {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": True,  "prefer_outdoor": False, "vibe_keywords": ["professional", "trusted", "modern"]},
    "specialist":   {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": True,  "prefer_outdoor": False, "vibe_keywords": ["specialist", "expert", "professional"]},
    "intense":      {"prefer_quiet": False, "prefer_fast": True,  "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["intense", "competitive", "professional"]},
    "fun":          {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["fun", "social", "casual"]},
    "competitive":  {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["competitive", "intense", "skilled"]},
    "beginner":     {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["beginner-friendly", "relaxed", "welcoming"]},
    "action":       {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["action", "exciting", "thrilling"]},
    "comedy":       {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["comedy", "fun", "lighthearted"]},
    "drama":        {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["dramatic", "intense", "emotional"]},
    "indie":        {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["indie", "alternative", "artistic"]},
    "blockbuster":  {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["blockbuster", "epic", "spectacular"]},
    "kids":         {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["kids", "family", "animated"]},
    "premium":      {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": True,  "prefer_outdoor": False, "vibe_keywords": ["premium", "comfortable", "luxury"]},
    "fast":         {"prefer_quiet": False, "prefer_fast": True,  "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["quick", "efficient", "direct"]},
    "cheap":        {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["affordable", "value", "budget"]},
    "eco":          {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": True,  "vibe_keywords": ["eco-friendly", "green", "sustainable"]},
    "comfort":      {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["comfortable", "convenient", "relaxed"]},
    "quiet":        {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["quiet", "focused", "peaceful"]},
    "social":       {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["social", "collaborative", "networking"]},
    "focused":      {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["focused", "productive", "quiet"]},
    "group":        {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["group", "social", "spacious"]},
    "nearby":       {"prefer_quiet": False, "prefer_fast": True,  "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["nearby", "convenient", "accessible"]},
    "trusted":      {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["trusted", "reliable", "professional"]},
    "emergency":    {"prefer_quiet": False, "prefer_fast": True,  "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["emergency", "urgent", "fast"]},
    "friendly":     {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["friendly", "welcoming", "caring"]},
    "open_now":     {"prefer_quiet": False, "prefer_fast": True,  "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["open-now", "accessible", "fast"]},
    "affordable":   {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["affordable", "cheap", "value"]},
    "flexible_hours": {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["flexible", "accessible", "convenient"]},
    "stress_relief": {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["relaxing", "calming", "therapeutic"]},
    "picnic":       {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": True,  "vibe_keywords": ["picnic", "outdoor", "park"]},
    "breakdown":    {"prefer_quiet": False, "prefer_fast": True,  "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["emergency", "repair", "urgent"]},
    # Cinema occasion moods
    "date_night":   {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": True,  "prefer_outdoor": False, "vibe_keywords": ["romantic", "intimate", "cozy"]},
    "solo":         {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["solo", "relaxed", "independent"]},
    # Services
    "express":      {"prefer_quiet": False, "prefer_fast": True,  "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["express", "quick", "efficient"]},
    # Wellness
    "disconnect":   {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["disconnect", "peaceful", "escape"]},
    "couples":      {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": True,  "prefer_outdoor": False, "vibe_keywords": ["couples", "romantic", "exclusive"]},
    "detox":        {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["detox", "purifying", "healthy"]},
    # Coworking
    "focus":        {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["focused", "quiet", "productive"]},
    "networking":   {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["networking", "social", "professional"]},
    # Pets
    "routine_care": {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": True,  "prefer_outdoor": False, "vibe_keywords": ["routine", "professional", "trusted"]},
    "new_pet":      {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["new", "welcoming", "guidance"]},
    "training":     {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": True,  "vibe_keywords": ["training", "discipline", "active"]},
    # Automotive
    "maintenance":  {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": True,  "prefer_outdoor": False, "vibe_keywords": ["maintenance", "professional", "trusted"]},
    "quick_stop":   {"prefer_quiet": False, "prefer_fast": True,  "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["quick", "efficient", "convenient"]},
    "roadtrip":     {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": True,  "vibe_keywords": ["roadtrip", "adventure", "prepared"]},
    # Sport
    "outdoor":      {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": True,  "vibe_keywords": ["outdoor", "fresh-air", "nature"]},
    "classes":      {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["classes", "structured", "guided"]},
    "competition":  {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["competitive", "intense", "tournament"]},
}

_NEUTRAL_MOOD = {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": []}


def _resolve_mood(mood: str) -> dict:
    """Instant mood resolution — no LLM needed."""
    result = _MOOD_MAP.get(mood, _NEUTRAL_MOOD)
    log.info("[D] resolve_mood('%s') → %s", mood, result)
    return result


# ── Step E — analyze reviews (SINGLE LLM call) ────────────────────────────

def _review_confidence(r: dict) -> float:
    total = r.get("total_ratings", 0) or 0
    rating_confidence = min(1.0, math.log10(total + 1) / math.log10(20000))
    text_count = len(_all_reviews(r))
    text_bonus = min(0.15, text_count * 0.03)
    return min(1.0, rating_confidence + text_bonus)


def _clean_review_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def _review_snippet(text: str, limit: int = 140) -> str:
    cleaned = _clean_review_text(text)
    if len(cleaned) <= limit:
        return cleaned
    truncated = cleaned[:limit].rsplit(" ", 1)[0].strip()
    return (truncated or cleaned[:limit]).rstrip(" ,.;:") + "..."


def _all_reviews(r: dict) -> list[dict]:
    reviews: list[dict] = []
    for key in ("google_reviews", "yelp_reviews"):
        source_reviews = r.get(key) or []
        if not isinstance(source_reviews, list):
            continue
        for review in source_reviews:
            if isinstance(review, dict) and _clean_review_text(str(review.get("text") or "")):
                reviews.append(review)
    return reviews


def _review_mentions_issue(text: str) -> bool:
    lowered = _clean_review_text(text).lower()
    issue_terms = (
        "pero",
        "aunque",
        "espera",
        "cola",
        "lento",
        "lenta",
        "ruido",
        "ruidoso",
        "caro",
        "cara",
        "frio",
        "fría",
        "mal",
        "fatal",
        "peor",
        "sucio",
        "sucia",
        "pequeño",
        "pequeno",
        "apretado",
        "agobio",
        "segunda opinión",
        "segunda opinion",
        "dolor",
        "problema",
        "queja",
    )
    return any(term in lowered for term in issue_terms)


_POSITIVE_THEMES: tuple[tuple[str, tuple[str, ...], str], ...] = (
    ("staff", ("trato", "amable", "atencion", "atención", "personal", "encantador", "cercano", "majo"), "El trato sale repetidamente como cercano y agradable."),
    ("professional", ("profesional", "profesionales", "explican", "confianza", "serio", "seriedad"), "Las reseñas transmiten profesionalidad y bastante confianza."),
    ("quality", ("rico", "buen", "buena", "increible", "increíble", "calidad", "resultado", "perfecto", "maravilla"), "La calidad final convence y la experiencia deja buen sabor de boca."),
    ("space", ("bonito", "precioso", "hermoso", "verde", "amplio", "grande", "arquitectura"), "El sitio destaca por el entorno y por lo agradable que resulta estar allí."),
    ("value", ("precio", "barato", "merece", "gratis", "económico", "economico"), "La relación entre lo que ofrece y lo que cuesta sale bien parada."),
    ("fast", ("rapido", "rápido", "agil", "ágil", "puntual", "sin espera"), "La experiencia parece ágil y sin demasiada fricción."),
)

_NEGATIVE_THEMES: tuple[tuple[str, tuple[str, ...], str], ...] = (
    ("wait", ("espera", "cola", "tardar", "lento", "lenta", "demora", "retraso"), "La pega más repetida es la espera o la lentitud."),
    ("noise", ("ruido", "ruidoso", "ruidosa", "bullicio", "agobio"), "Puede hacerse ruidoso o agobiante en momentos de mucha afluencia."),
    ("price", ("caro", "cara", "carisimo", "carísima", "sobreprecio", "overpriced"), "Varias reseñas dejan la sensación de precio alto para lo que ofrece."),
    ("cleanliness", ("sucio", "sucia", "suciedad", "baño", "bano", "olor"), "Hay señales de limpieza o mantenimiento que no terminan de convencer."),
    ("trust", ("segunda opinión", "segunda opinion", "diagnostico", "diagnóstico", "cobrarte", "timar", "innecesaria"), "Aparecen dudas serias sobre el criterio o la confianza que transmite."),
    ("result", ("dolor", "mal", "fatal", "peor", "problema", "decepcion", "decepción"), "El resultado final no siempre está a la altura de lo prometido."),
    ("crowding", ("lleno", "petado", "apretado", "mesas juntas", "masificado"), "Cuando se llena, la comodidad baja bastante."),
)

_PRACTICAL_CAUTIONS: tuple[tuple[str, tuple[str, ...], str], ...] = (
    ("walk", ("largo", "larga", "enorme", "grande", "punta a punta", "recorrer", "caminar"), "Es de esos sitios para ir con tiempo; si vas con prisa, se te puede quedar corto."),
    ("booking", ("reserva", "reservar", "book", "busy", "siempre lleno"), "Pinta a sitio de ir con margen o con reserva si no quieres jugártela."),
    ("timing", ("fin de semana", "finde", "hora punta", "mucha gente", "afluencia"), "En hora punta puede perder parte de la gracia, así que conviene elegir bien cuándo ir."),
)


def _theme_hits(text: str, themes: tuple[tuple[str, tuple[str, ...], str], ...]) -> set[str]:
    lowered = _clean_review_text(text).lower()
    hits: set[str] = set()
    for theme_id, keywords, _label in themes:
        if any(keyword in lowered for keyword in keywords):
            hits.add(theme_id)
    return hits


def _top_theme_labels(
    reviews: list[dict],
    themes: tuple[tuple[str, tuple[str, ...], str], ...],
    *,
    limit: int,
    min_hits: int = 1,
) -> list[str]:
    counts: dict[str, int] = {}
    labels: dict[str, str] = {}
    for review in reviews:
        text = str(review.get("text") or "")
        for theme_id in _theme_hits(text, themes):
            counts[theme_id] = counts.get(theme_id, 0) + 1
    for theme_id, _keywords, label in themes:
        labels[theme_id] = label
    ranked = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    results: list[str] = []
    for theme_id, count in ranked:
        if count < min_hits:
            continue
        results.append(labels[theme_id])
        if len(results) == limit:
            break
    return results


def _generic_positive_summary(reviews: list[dict]) -> str:
    if not reviews:
        return "Lo que mejor aguanta es la valoración general, pero con poca reseña útil para concretar mucho más."
    avg = sum(int(review.get("rating") or 0) for review in reviews) / max(len(reviews), 1)
    if avg >= 4.5:
        return "La gente sale bastante convencida y el tono general de las reseñas es claramente bueno."
    return "El tono general tira a positivo y no parece un sitio que decepcione de entrada."


def _generic_negative_summary(total_reviews: int) -> str:
    if total_reviews < 3:
        return "Hay poca reseña útil para sacar una pega firme sin inventar."
    return "No aparece una crítica repetida de verdad; hay buena nota, pero la muestra no da para vender perfección."


def _practical_caution_from_reviews(reviews: list[dict]) -> str:
    labels = _top_theme_labels(reviews, _PRACTICAL_CAUTIONS, limit=1, min_hits=1)
    if labels:
        return labels[0]
    return ""


def _fallback_review_signals(r: dict) -> tuple[list[str], list[str], str, str, str]:
    reviews = _all_reviews(r)
    positives = [rev for rev in reviews if int(rev.get("rating") or 0) >= 4]
    negatives = [rev for rev in reviews if int(rev.get("rating") or 0) <= 2]
    mixed = [rev for rev in reviews if rev not in negatives and _review_mentions_issue(str(rev.get("text") or ""))]

    pros = _top_theme_labels(positives, _POSITIVE_THEMES, limit=2, min_hits=1)
    if not pros and positives:
        pros = [_generic_positive_summary(positives)]

    strong_cons = _top_theme_labels(negatives + mixed, _NEGATIVE_THEMES, limit=2, min_hits=1)
    practical_caution = _practical_caution_from_reviews(reviews)
    cons = strong_cons[:]
    if not cons:
        if practical_caution:
            cons = [practical_caution]
        else:
            cons = [_generic_negative_summary(len(reviews))]

    best_quote = ""
    if positives:
        best_quote = _review_snippet(str(max(positives, key=lambda rev: len(_clean_review_text(str(rev.get("text") or "")))).get("text") or ""), 180)
    elif reviews:
        best_quote = _review_snippet(str(reviews[0].get("text") or ""), 180)

    total = int(r.get("total_ratings") or 0)
    rating = float(r.get("rating") or 0.0)
    summary = _clean_review_text(str(r.get("review_summary") or ""))

    if total < 20:
        if pros and strong_cons:
            verdict = "Hay señales interesantes, pero la muestra es corta: aquí conviene leer tanto lo bueno como las pegas antes de fiarse."
        elif pros:
            verdict = "Apunta bien, pero con tan pocas reseñas no sería serio venderlo como apuesta segura."
        elif strong_cons:
            verdict = "Con tan poca muestra ya aparecen alertas; no basta para condenarlo del todo, pero sí para ir con cuidado."
        else:
            verdict = "Sin suficiente información textual para opinar con honestidad."
    elif pros and strong_cons:
        verdict = (
            f"Tiene buena nota ({rating:.1f}/5), pero las reseñas dejan claro que aquí hay cosas que gustan mucho y otras que generan dudas reales."
        )
    elif pros:
        verdict = "El consenso sale bien parado, aunque conviene leerlo sin adornos: gusta por razones concretas, no porque sí."
    elif strong_cons:
        verdict = "Las críticas pesan más que la nota media; aquí hay señales claras para entrar con cuidado."
    elif summary:
        verdict = summary
    elif total >= 50:
        verdict = f"Tiene volumen y buena nota ({total} reseñas, {rating:.1f}/5), pero falta texto útil para sacar un take más afilado sin inventar."
    else:
        verdict = "Sin suficiente información textual para opinar con honestidad."

    why_parts = []
    if pros:
        why_parts.append(pros[0])
    if strong_cons:
        why_parts.append(cons[0])
    why = " ".join(why_parts).strip()

    return pros[:2], cons[:2], verdict, why, best_quote


def _enrich_fallback(r: dict, signals: dict[str, dict] | None = None) -> dict:
    """Build a result when LLM is unavailable — uses reviewSummary as verdict."""
    pid = r["place_id"]
    sig = (signals or {}).get(pid, {})
    total = r.get("total_ratings") or 0
    summary = r.get("review_summary", "")
    rating = float(r.get("rating") or 0.0)
    fallback_pros, fallback_cons, fallback_verdict, fallback_why, fallback_quote = _fallback_review_signals(r)

    verdict = fallback_verdict

    return {
        "id": pid,
        "name": r.get("name"),
        "priceLevel": int(r.get("price_level") or 2),
        "rating": rating,
        "reviewsCount": int(total),
        "address": r.get("address", "") or "",
        "phone": r.get("phone", "") or "",
        "photoUrl": r.get("photo_url", "") or "",
        "tagline": r.get("name", "") or "",
        "why": fallback_why or (summary[:120] if summary else ""),
        "pros": sig.get("green_flags", [])[:2] or fallback_pros or (
            [f"Valoracion de {rating:.1f} estrellas."] if rating >= 4.0 else ["Sin suficientes datos."]
        ),
        "cons": sig.get("red_flags", [])[:2] or fallback_cons or (
            ["Pocas resenas disponibles."] if total < 50 else ["Sin quejas destacadas en las reseñas disponibles."]
        ),
        "verdict": verdict,
        "tags": sig.get("atmosphere_tags", [])[:4],
        "reviews": _all_reviews(r)[:15],
        "review_count": int(total),
        "lat": float(r.get("lat") or 0.0),
        "lng": float(r.get("lng") or 0.0),
        "bestReviewQuote": r.get("best_review_quote") or fallback_quote,
        "reviewQualityScore": float(r.get("review_quality_score") or _review_confidence(r)),
        "distanceM": int(r.get("distance_m") or 0),
    }


# ── AI context builder (Step 6 — data quality) ─────────────────────────────

def _build_ai_context(r: dict) -> dict:
    """Build context for LLM with data quality indicator."""
    total = r.get("total_ratings", 0) or 0
    return {
        "id": r["place_id"],
        "name": r["name"],
        "reviews": _all_reviews(r)[:10],
        "review_summary_support": r.get("review_summary", ""),
        "rating": r.get("rating", 0),
        "total_ratings": total,
        "data_quality": "high" if total > 100 else "medium" if total > 20 else "low",
        "address": r.get("address", ""),
    }


# ── LLM batch helper ───────────────────────────────────────────────────────

_LANG_MAP = {"es": "Spanish", "en": "English", "fr": "French"}


def _build_llm_prompts(places: list[dict], mood: str, language: str, parent_category: str) -> tuple[str, str]:
    """Build instruction + prompt for a batch of places."""
    label = _category_label(parent_category)
    target_lang = _LANG_MAP.get(language, "Spanish")
    ai_payload = [_build_ai_context(r) for r in places]

    instruction = f"""You are WHIM, a brutally honest guide for {label} in Valencia, Spain.
TASK: For each place, read the real individual reviews first and produce a compact, honest take.

SOURCE PRIORITY:
1. Use 'reviews' as the PRIMARY source of truth.
2. Use 'review_summary_support' only to confirm broad consensus or when the individual review text is too thin.

RULES:
- Synthesize repeated patterns; do not copy long quotes into verdict, pros, or cons.
- Be direct, sober, and useful. No marketing tone, no filler, no generic praise.
- Include negatives when they appear in the reviews. Do not smooth them out.
- If there is no clear negative pattern, use a practical caution only if the reviews support it. Otherwise say there is not enough negative signal.
- For places with data_quality='low', be explicit about limited evidence and do not invent qualities.
- Return up to 2 pros and up to 2 cons, each as short natural-language summaries.
- All text in {target_lang}.
- Output MUST be valid JSON only."""

    prompt = f"""Language: {target_lang}. Vibe requested: {mood}.
For each place return exactly this JSON structure:
[
  {{
    "id": "place_id",
    "translated_reviews": [
      {{"author": "Name", "text": "review translated to {target_lang}", "rating": 5, "relative_time": "1 month ago"}}
    ],
    "tagline": "5-8 word summary",
    "why": "Short rationale grounded in review evidence",
    "pros": ["Short summary of a repeated positive pattern", "Optional second positive pattern"],
    "cons": ["Short summary of a repeated negative pattern or practical caution", "Optional second warning"],
    "verdict": "One short, direct, evidence-based conclusion",
    "tags": ["tag1", "tag2", "tag3"],
    "best_quote": "optional short quote from a review",
    "quality_score": 0.8
  }}
]

PLACES:
{json.dumps(ai_payload, ensure_ascii=False)}"""

    return instruction, prompt


async def _llm_batch(places: list[dict], mood: str, language: str, parent_category: str) -> dict[str, dict]:
    """Run LLM enrichment for a batch of places. Returns {place_id: ai_data}."""
    if not places:
        return {}
    instruction, prompt = _build_llm_prompts(places, mood, language, parent_category)
    raw_ai = await _llm(name=f"batch_{len(places)}", instruction=instruction, prompt=prompt)
    if not raw_ai:
        return {}
    try:
        ai_results = _parse_json(raw_ai)
        if isinstance(ai_results, dict):
            ai_results = [ai_results]
        elif not isinstance(ai_results, list):
            return {}
        return {item["id"]: item for item in ai_results if isinstance(item, dict) and "id" in item}
    except Exception as e:
        log.warning("[LLM] Failed to parse batch response: %s", e)
        return {}


# ── Result builder ──────────────────────────────────────────────────────────

def _build_result(r: dict, ai_data: dict, live_data: dict) -> dict:
    """Build a final result dict from a candidate + AI data + live data."""
    fallback_pros, fallback_cons, fallback_verdict, fallback_why, fallback_quote = _fallback_review_signals(r)
    translated = ai_data.get("translated_reviews")
    if not isinstance(translated, list):
        translated = _all_reviews(r)
    if not isinstance(translated, list):
        translated = []

    safe_reviews = []
    for rev in translated[:15]:
        if not isinstance(rev, dict):
            continue
        safe_reviews.append({
            "author": str(rev.get("author", "Anonymous")),
            "rating": int(rev.get("rating") or 0),
            "text": str(rev.get("text") or ""),
            "relative_time": str(rev.get("relative_time") or "n/a"),
        })

    pros = ai_data.get("pros")
    if not pros:
        pros = fallback_pros or ([f"Valoracion de {float(r.get('rating') or 0.0):.1f} estrellas."] if float(r.get('rating') or 0.0) >= 4.0 else ["Sin suficientes datos sobre puntos fuertes."])

    cons = ai_data.get("cons")
    if not cons:
        cons = fallback_cons or (["Pocas resenas disponibles."] if int(r.get("total_ratings") or 0) < 50 else ["No hay suficiente señal negativa en las reseñas para sacar una pega firme."])

    verdict = ai_data.get("verdict")
    if not verdict:
        verdict = fallback_verdict

    return {
        "id": r["place_id"],
        "name": str(r.get("name") or ""),
        "address": r.get("address", "") or "",
        "website": r.get("website"),
        "city": r.get("city") or _infer_city(r.get("address")),
        "rating": float(r.get("rating") or 0.0),
        "priceLevel": int(r.get("price_level") or 2),
        "photoUrl": r.get("photo_url", "") or "",
        "lat": float(r.get("lat") or 0.0),
        "lng": float(r.get("lng") or 0.0),
        "distanceM": int(r.get("distance_m") or 0),
        "tagline": ai_data.get("tagline") or str(r.get("name") or ""),
        "why": ai_data.get("why") or fallback_why,
        "pros": pros,
        "cons": cons,
        "verdict": verdict,
        "reviews": safe_reviews,
        "reviewsCount": int(r.get("total_ratings") or 0),
        "review_count": int(r.get("total_ratings") or 0),
        "bestReviewQuote": ai_data.get("best_quote") or r.get("best_review_quote") or fallback_quote,
        "reviewQualityScore": float(ai_data.get("quality_score") or r.get("review_quality_score") or _review_confidence(r)),
        "tags": ai_data.get("tags") or [],
        "liveData": live_data if isinstance(live_data, dict) else {"type": "none"},
    }


# ── Orchestrator ──────────────────────────────────────────────────────────────

async def recommend(parent_category: str, subcategory: str | None, mood: str, price_level: int | None, lat: float, lng: float, fast_mode: bool = False, language: str = "es") -> list[dict]:
    t_total = time.perf_counter()
    _llm_timings.clear()
    resolved_sub = subcategory or parent_category
    label = _category_label(parent_category)
    log.info("=" * 60)
    log.info("REQUEST category='%s' (%s) mood='%s' lang=%s", parent_category, label, mood, language)

    # ── PHASE 1: Search ─────────────────────────────────────────────────────
    t_step = time.perf_counter()
    raw = await search_places(parent_category, resolved_sub, mood, lat, lng, price_level, language=language)
    candidates = raw.get("restaurants", [])
    log.info("[PERF] Step A (Search): %.2fs — %d results", time.perf_counter() - t_step, len(candidates))

    if not candidates:
        return []

    # ── PHASE 2: Pre-filter ─────────────────────────────────────────────────
    t_step = time.perf_counter()
    candidates = _pre_filter(candidates, price_level)
    top_winners = candidates[:5]
    log.info("[PERF] Step B (Pre-filter): %.2fs — top %d", time.perf_counter() - t_step, len(top_winners))

    # ── PHASE 3: Smart fetch — ONLY places missing reviews ──────────────────
    t_step = time.perf_counter()
    needs_fetch = list(top_winners)
    already_good: list[dict] = []

    if needs_fetch:
        async def _deep_fetch_safe(r: dict) -> dict:
            try:
                data = await fetch_all_reviews(r["place_id"], r["name"], r["lat"], r["lng"], language=language)
                return {**r, **data}
            except Exception as e:
                log.warning("[C'] Deep fetch failed for %s: %s", r.get("name"), e)
                return r

        fetched = await asyncio.gather(*[_deep_fetch_safe(r) for r in needs_fetch], return_exceptions=True)
        needs_fetch = [r for r in fetched if isinstance(r, dict)]

    top_winners = already_good + needs_fetch
    log.info(
        "[PERF] Step C' (Smart Fetch): %.2fs — skipped %d, fetched %d",
        time.perf_counter() - t_step, len(already_good), len(needs_fetch),
    )

    # ── PHASE 4: PARALLEL — 2 LLM batches + live data ──────────────────────
    t_step = time.perf_counter()
    batch1 = top_winners[:LLM_BATCH_SPLIT]
    batch2 = top_winners[LLM_BATCH_SPLIT:]

    live_data_tasks = [
        get_live_data(
            category=parent_category,
            subcategory=subcategory,
            lat=r.get("lat") or lat,
            lng=r.get("lng") or lng,
            website=r.get("website"),
            name=r.get("name"),
            city=r.get("city") or _infer_city(r.get("address")),
        )
        for r in top_winners
    ]

    async def _noop():
        return {}

    # Run 2 LLM batches + all live data in parallel
    parallel_results = await asyncio.gather(
        _llm_batch(batch1, mood, language, parent_category),
        _llm_batch(batch2, mood, language, parent_category) if batch2 else _noop(),
        *live_data_tasks,
        return_exceptions=True,
    )

    # Unpack results
    ai_map1 = parallel_results[0] if isinstance(parallel_results[0], dict) else {}
    ai_map2 = parallel_results[1] if isinstance(parallel_results[1], dict) else {}
    ai_map = {**ai_map1, **ai_map2}
    live_results = parallel_results[2:]

    log.info(
        "[PERF] Step E+H (Parallel LLM+Live): %.2fs — AI enriched %d/%d places",
        time.perf_counter() - t_step, len(ai_map), len(top_winners),
    )

    # ── PHASE 5: Assemble final results ─────────────────────────────────────
    final_results = []
    for i, r in enumerate(top_winners):
        ai_data = ai_map.get(r["place_id"], {})
        ld = live_results[i] if i < len(live_results) and isinstance(live_results[i], dict) else {"type": "none"}

        if ai_data:
            final_results.append(_build_result(r, ai_data, ld))
        else:
            fb = _enrich_fallback(r)
            fb["liveData"] = ld
            final_results.append(fb)

    total_time = time.perf_counter() - t_total
    log.info("=" * 60)
    log.info("[PERF] PIPELINE v2 DONE in %.2fs — %d results", total_time, len(final_results))
    log.info("=" * 60)
    return final_results


async def enrich_place_result(
    *,
    place_id: str,
    parent_category: str,
    subcategory: Optional[str],
    lat: float,
    lng: float,
    language: str = "es",
    name: str = "",
    address: str = "",
    photo_url: str = "",
    rating: float | None = None,
    price_level: int | None = None,
    user_rating_count: int | None = None,
    google_reviews: Optional[list[dict]] = None,
    review_summary: str = "",
) -> dict:
    """Enrich a single place with WHIM's take for generic place detail views."""
    cache_key = (
        f"place_take:{place_id}:{parent_category}:{subcategory or ''}:{language}:"
        f"{round(lat, 4)}:{round(lng, 4)}"
    )
    cached = await cache_get(cache_key)
    if cached:
        log.info("[TAKE] cache hit for %s", place_id)
        return cached

    details = await get_google_place_details(place_id, language=language) or {}
    normalized_price = price_level or 2
    raw_price = details.get("price_level")
    if raw_price == "PRICE_LEVEL_INEXPENSIVE":
        normalized_price = 1
    elif raw_price == "PRICE_LEVEL_MODERATE":
        normalized_price = 2
    elif raw_price in ("PRICE_LEVEL_EXPENSIVE", "PRICE_LEVEL_VERY_EXPENSIVE"):
        normalized_price = 3

    candidate = {
        "place_id": place_id,
        "name": name or details.get("name") or "Unknown",
        "address": address or details.get("address") or "",
        "rating": float(rating if rating is not None else details.get("rating") or 0.0),
        "price_level": int(normalized_price),
        "lat": lat,
        "lng": lng,
        "photo_url": photo_url or details.get("photo_url") or "",
        "total_ratings": int(user_rating_count if user_rating_count is not None else details.get("user_rating_count") or 0),
        "distance_m": 0,
        "category_id": parent_category,
        "subcategory": subcategory or parent_category,
        "types": [],
        "phone": details.get("phone", ""),
        "website": details.get("website", ""),
        "google_reviews": google_reviews if google_reviews else details.get("google_reviews", []),
        "yelp_reviews": details.get("yelp_reviews", []),
        "review_summary": review_summary or details.get("review_summary", ""),
    }

    ai_map = await _llm_batch([candidate], "balanced", language, parent_category)
    ai_data = ai_map.get(place_id, {})
    if ai_data:
        result = _build_result(candidate, ai_data, {"type": "none"})
        log.info("[TAKE] generated LLM take for %s", place_id)
    else:
        result = _enrich_fallback(candidate)
        result["liveData"] = {"type": "none"}
        log.info("[TAKE] fallback take for %s", place_id)

    await cache_set(cache_key, result, ttl=3600)
    return result


# ── Streaming pipeline v2 — batched (STREAM_BATCH_SIZE places per LLM call) ─

async def _process_stream_batch(
    batch: list[dict],
    mood: str,
    language: str,
    parent_category: str,
    subcategory: str | None,
    lat: float,
    lng: float,
) -> list[dict]:
    """Process a batch: smart fetch + 1 LLM call + live data, all in parallel."""

    # Smart fetch — only for places missing reviews
    async def _smart_fetch(r: dict) -> dict:
        try:
            data = await fetch_all_reviews(r["place_id"], r["name"], r["lat"], r["lng"], language=language)
            return {**r, **data}
        except Exception:
            return r

    enriched = await asyncio.gather(*[_smart_fetch(r) for r in batch])
    enriched = [r for r in enriched if isinstance(r, dict)]

    # LLM batch + live data in parallel
    live_tasks = [
        get_live_data(
            category=parent_category, subcategory=subcategory,
            lat=r.get("lat") or lat, lng=r.get("lng") or lng,
            website=r.get("website"), name=r.get("name"),
            city=r.get("city") or _infer_city(r.get("address")),
        )
        for r in enriched
    ]

    parallel = await asyncio.gather(
        _llm_batch(enriched, mood, language, parent_category),
        *live_tasks,
        return_exceptions=True,
    )

    ai_map = parallel[0] if isinstance(parallel[0], dict) else {}
    live_results = parallel[1:]

    results = []
    for i, r in enumerate(enriched):
        ai_data = ai_map.get(r["place_id"], {})
        ld = live_results[i] if i < len(live_results) and isinstance(live_results[i], dict) else {"type": "none"}
        if ai_data:
            results.append(_build_result(r, ai_data, ld))
        else:
            fb = _enrich_fallback(r)
            fb["liveData"] = ld
            results.append(fb)

    return results


async def recommend_stream(
    parent_category: str,
    subcategory: str | None,
    mood: str,
    price_level: int | None,
    lat: float,
    lng: float,
    language: str = "es",
) -> AsyncGenerator[dict, None]:
    """Yield results in batches via SSE — 1 LLM call per batch of STREAM_BATCH_SIZE."""
    t_total = time.perf_counter()
    resolved_sub = subcategory or parent_category
    log.info("[STREAM v2] START category='%s' mood='%s'", parent_category, mood)

    # Phase 1: Search
    raw = await search_places(parent_category, resolved_sub, mood, lat, lng, price_level, language=language)
    candidates = raw.get("restaurants", [])
    if not candidates:
        yield {"event": "done", "total": 0}
        return

    # Phase 2: Pre-filter
    candidates = _pre_filter(candidates, price_level)
    yield {"event": "meta", "total": len(candidates)}

    # Phase 3: Process in batches — each batch = 1 LLM call
    result_index = 0
    for i in range(0, len(candidates), STREAM_BATCH_SIZE):
        batch = candidates[i:i + STREAM_BATCH_SIZE]
        try:
            results = await _process_stream_batch(
                batch, mood, language, parent_category, subcategory, lat, lng,
            )
            for result in results:
                result_index += 1
                yield {"event": "result", "index": result_index, "data": result}
        except Exception as e:
            log.error("[STREAM v2] Batch %d failed: %s", i // STREAM_BATCH_SIZE, e)
            # Yield fallbacks for this batch so the stream doesn't break
            for r in batch:
                result_index += 1
                fb = _enrich_fallback(r)
                fb["liveData"] = {"type": "none"}
                yield {"event": "result", "index": result_index, "data": fb}

    total_time = time.perf_counter() - t_total
    log.info("[STREAM v2] DONE in %.2fs, yielded %d results", total_time, result_index)
    yield {"event": "done", "total": result_index}
