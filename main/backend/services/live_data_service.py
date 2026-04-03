"""Live data fetchers for place-type-specific real-time info.

Supported addons:
  - weather       → parks, outdoor  (Open-Meteo, no key required)
  - fuel_prices   → gas stations  (Spanish Ministry API, no key required)
  - pharmacy_duty → pharmacies    (link to local pharmacy council)
  - cinema_info   → cinemas       (TMDB API or fallback link)
  - ev_charging   → EV stations   (framework / availability placeholder)
"""
from __future__ import annotations

import math
import os
import httpx
from typing import Any, Dict, Optional

from services.cache_service import cache_get, cache_set

# ── helpers ───────────────────────────────────────────────────────────────────

def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Return distance in metres between two WGS-84 points."""
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def _parse_es_price(value: str) -> Optional[float]:
    v = value.strip()
    if not v:
        return None
    try:
        return float(v.replace(",", "."))
    except ValueError:
        return None

# ── weather (Open-Meteo) ──────────────────────────────────────────────────────

async def get_weather_info(lat: float, lng: float) -> Dict[str, Any]:
    cache_key = f"weather_{round(lat, 2)}_{round(lng, 2)}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lng}"
        "&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m,weather_code"
        "&hourly=uv_index"
        "&forecast_days=1"
        "&timezone=auto"
    )
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return {"type": "none"}

    current = data.get("current", {})
    hourly = data.get("hourly", {})
    
    temp = current.get("temperature_2m", 0.0)
    precip = current.get("precipitation", 0.0)
    wind = current.get("wind_speed_10m", 0.0)
    wcode = current.get("weather_code", 0)
    uv_values = hourly.get("uv_index") or []
    hourly_times = hourly.get("time") or []
    current_time = current.get("time")
    uv = 0
    if current_time and hourly_times and uv_values and current_time in hourly_times:
        idx = hourly_times.index(current_time)
        if idx < len(uv_values):
            uv = uv_values[idx]
    elif uv_values:
        uv = uv_values[0]

    wmo_map = {
        0: ("Despejado", "sunny"),
        1: ("Parcialmente nublado", "partly-sunny"),
        2: ("Parcialmente nublado", "partly-sunny"),
        3: ("Parcialmente nublado", "partly-sunny"),
        45: ("Niebla", "cloud"),
        48: ("Niebla", "cloud"),
        51: ("Llovizna", "rainy"),
        53: ("Llovizna", "rainy"),
        55: ("Llovizna", "rainy"),
        61: ("Lluvia", "rainy"),
        63: ("Lluvia", "rainy"),
        65: ("Lluvia", "rainy"),
        71: ("Nieve", "snow"),
        73: ("Nieve", "snow"),
        75: ("Nieve", "snow"),
        80: ("Chubascos", "rainy"),
        81: ("Chubascos", "rainy"),
        82: ("Chubascos", "rainy"),
        95: ("Tormenta", "thunderstorm"),
        96: ("Tormenta con granizo", "thunderstorm"),
        99: ("Tormenta con granizo", "thunderstorm"),
    }
    label, emoji = wmo_map.get(wcode, ("Desconocido", "thermometer"))

    score = 100
    if precip > 0.5: score -= 50
    if wcode in {61,63,65,80,81,82,95,96,99}: score -= 30
    if temp < 5 or temp > 38: score -= 25
    if wind > 40: score -= 20
    if uv > 8: score -= 15
    score = max(0, min(100, score))

    if score >= 80:
        outdoor_label = "Perfecto para salir"
    elif score >= 50:
        outdoor_label = "Aceptable"
    else:
        outdoor_label = "Mejor quedarse en casa"

    alert = None
    if precip > 0.5 or wcode in {61,63,65,80,81,82,95,96,99}:
        alert = "Lluvia o tormenta detectada."
    elif temp > 35:
        alert = "Ola de calor."
    elif temp < 5:
        alert = "Mucho frío."

    result = {
        "type": "weather",
        "temperature": temp,
        "feels_like": current.get("apparent_temperature", temp),
        "humidity": current.get("relative_humidity_2m", 0),
        "wind_kmh": wind,
        "precipitation_mm": precip,
        "uv_index": uv,
        "weather_code": wcode,
        "weather_label": label,
        "weather_emoji": emoji,
        "outdoor_score": score,
        "outdoor_label": outdoor_label,
        "alert": alert,
    }

    await cache_set(cache_key, result, ttl=1800)
    return result

# ── fuel prices ───────────────────────────────────────────────────────────────

_MINETUR_URL = (
    "https://sedeaplicaciones.minetur.gob.es"
    "/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/"
)
_FUEL_CACHE_KEY = "fuel_prices_all"
_FUEL_CACHE_TTL = 1800  # 30 min — prices update at most once a day

async def _fetch_all_stations() -> list[dict]:
    cached = await cache_get(_FUEL_CACHE_KEY)
    if cached is not None:
        return cached

    async with httpx.AsyncClient(timeout=12) as client:
        resp = await client.get(_MINETUR_URL, headers={"Accept": "application/json"})
        resp.raise_for_status()
        data = resp.json()

    stations = data.get("ListaEESSPrecio", [])
    await cache_set(_FUEL_CACHE_KEY, stations, ttl=_FUEL_CACHE_TTL)
    return stations

async def get_fuel_prices_near(
    lat: float, lng: float, radius_m: float = 500
) -> Dict[str, Any]:
    stations = await _fetch_all_stations()

    best: Optional[dict] = None
    best_dist = float("inf")

    for s in stations:
        try:
            slat = float(s.get("Latitud", "0").replace(",", "."))
            slng = float(s.get("Longitud (WGS84)", "0").replace(",", "."))
        except (ValueError, AttributeError):
            continue

        dist = _haversine_m(lat, lng, slat, slng)
        if dist < best_dist:
            best_dist = dist
            best = s

    if best is None or best_dist > radius_m:
        return {"found": False, "distance_m": None, "prices": {}}

    prices: Dict[str, Optional[float]] = {}
    fuel_fields = {
        "gasolina_95":      "Precio Gasolina 95 E5",
        "gasolina_98":      "Precio Gasolina 98 E5",
        "gasoleo_a":        "Precio Gasoleo A",
        "gasoleo_premium":  "Precio Gasoleo Premium",
        "glp":              "Precio Gases licuados del petróleo",
        "gas_natural":      "Precio Gas Natural Comprimido",
        "gasolina_95_e10":  "Precio Gasolina 95 E10",
        "gasoleo_b":        "Precio Gasoleo B",
        "hidrogeno":        "Precio Hidrogeno",
    }
    for key, field in fuel_fields.items():
        val = _parse_es_price(best.get(field, ""))
        if val is not None:
            prices[key] = val

    return {
        "found": True,
        "distance_m": round(best_dist),
        "brand": best.get("Rótulo", "").title() or None,
        "address": best.get("Dirección", "").title() or None,
        "schedule": best.get("Horario", "") or None,
        "prices": prices,
        "updated_label": "MINETUR · actualizado hoy",
    }

# ── pharmacy on-duty ──────────────────────────────────────────────────────────

_PHARMACY_LINKS: Dict[str, Dict[str, str]] = {
    "valencia":    {"label": "Col·legi de Farmacèutics de València",  "url": "https://www.cofv.es/ciudadanos/farmacia-guardia/"},
    "madrid":      {"label": "Colegio de Farmacéuticos de Madrid",    "url": "https://www.cofm.es/es/ciudadanos/farmacias-de-guardia/"},
    "barcelona":   {"label": "Col·legi de Farmacèutics de Barcelona", "url": "https://www.farmaceuticonline.com/"},
    "sevilla":     {"label": "Colegio de Farmacéuticos de Sevilla",   "url": "https://www.cofsevilla.es/"},
    "zaragoza":    {"label": "Colegio de Farmacéuticos de Zaragoza",  "url": "https://www.cofzaragoza.org/"},
    "malaga":      {"label": "Colegio de Farmacéuticos de Málaga",    "url": "https://www.cofmalaga.com/"},
    "alicante":    {"label": "Col·legi de Farmacèutics d'Alacant",    "url": "https://www.cofalicante.org/"},
    "bilbao":      {"label": "Colegio de Farmacéuticos de Bizkaia",   "url": "https://www.cofbi.es/"},
}
_DEFAULT_PHARMACY = {
    "label": "Busca farmacias de guardia",
    "url": "https://www.elfarmaceutico.es/farmacia-guardia/",
}

def get_pharmacy_duty_info(city_hint: Optional[str] = None) -> Dict[str, Any]:
    link = _DEFAULT_PHARMACY
    if city_hint:
        key = city_hint.lower().strip()
        link = _PHARMACY_LINKS.get(key, _DEFAULT_PHARMACY)
    return {
        "type": "pharmacy_duty",
        "title": "Farmacia de guardia",
        "description": "Consulta qué farmacias están de guardia ahora mismo cerca de ti.",
        "link_label": link["label"],
        "link_url": link["url"],
    }

# ── cinema showtimes ──────────────────────────────────────────────────────────

_TMDB_CACHE_KEY = "cinema_showtimes_es"
_TMDB_CACHE_TTL = 21600  # 6 hours


async def get_cinema_showtimes(name: Optional[str] = None, website: Optional[str] = None, city: Optional[str] = None) -> Dict[str, Any]:
    api_key = os.getenv("TMDB_API_KEY")
    fallback = {
        "type": "cinema_showtimes",
        "title": "Cartelera de hoy",
        "cinema_name": name or "Cine cercano",
        "cinema_website": website or None,
        "movies": [],
        "link_label": f"Ver horarios de {name}" if name else "Ver cartelera completa",
        "link_url": website or "https://www.yelmo.com",
        "updated_label": "Consulta la web del cine",
    }

    if not api_key:
        return fallback

    # Check cache for movie list (shared across all cinemas)
    cached_movies = await cache_get(_TMDB_CACHE_KEY)
    if cached_movies is None:
        url = f"https://api.themoviedb.org/3/movie/now_playing?api_key={api_key}&language=es-ES&region=ES&page=1"
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()
        except Exception:
            return fallback

        results = data.get("results", [])[:5]
        cached_movies = []
        for r in results:
            cached_movies.append({
                "title": r.get("title", ""),
                "overview": (r.get("overview", "")[:117] + "...") if len(r.get("overview", "")) > 120 else r.get("overview", ""),
                "poster_url": f"https://image.tmdb.org/t/p/w200{r.get('poster_path', '')}" if r.get('poster_path') else None,
                "rating": r.get("vote_average", 0.0),
                "genres": [],
                "release_date": r.get("release_date", ""),
            })
        await cache_set(_TMDB_CACHE_KEY, cached_movies, ttl=_TMDB_CACHE_TTL)

    return {
        "type": "cinema_showtimes",
        "title": "Cartelera de hoy",
        "cinema_name": name or "Cine cercano",
        "cinema_website": website or None,
        "movies": cached_movies,
        "link_label": f"Ver horarios de {name}" if name else "Ver cartelera completa",
        "link_url": website or "https://www.yelmo.com",
        "updated_label": "TMDB · estrenos actuales",
    }

# ── EV charging ───────────────────────────────────────────────────────────────

def get_ev_charging_info(name: Optional[str] = None) -> Dict[str, Any]:
    return {
        "type": "ev_charging",
        "title": "Carga eléctrica",
        "description": "Estado en tiempo real del punto de carga.",
        "note": "Comprueba disponibilidad en la app del operador (Endesa X, Iberdrola, etc.).",
    }

# ── dispatcher ────────────────────────────────────────────────────────────────

_GAS_SUBCATEGORIES = {"gas_station", "gasolinera", "fuel", "petrol_station"}
_EV_SUBCATEGORIES  = {"ev_charging", "ev_charging_auto", "electric_vehicle_charging_station"}
_PHARMACY_SUBCATS  = {"pharmacy", "farmacia"}
_CINEMA_CATS       = {"cinema"}
_WEATHER_CATEGORIES = {"nature", "sport"}

async def get_live_data(
    *,
    category: Optional[str],
    subcategory: Optional[str],
    lat: Optional[float],
    lng: Optional[float],
    website: Optional[str] = None,
    name: Optional[str] = None,
    city: Optional[str] = None,
) -> Dict[str, Any]:
    sub = (subcategory or "").lower()
    cat = (category or "").lower()
    has_coords = lat is not None and lng is not None

    if cat in _WEATHER_CATEGORIES:
        if not has_coords:
            return {"type": "none"}
        weather_data = await get_weather_info(lat, lng)
        return {"type": "weather", **weather_data}

    if sub in _GAS_SUBCATEGORIES:
        if not has_coords:
            return {"type": "none"}
        prices = await get_fuel_prices_near(lat, lng, radius_m=5000)
        return {"type": "fuel_prices", **prices}

    if sub in _EV_SUBCATEGORIES:
        return get_ev_charging_info(name=name)

    if sub in _PHARMACY_SUBCATS or (cat == "health" and sub == "pharmacy"):
        return get_pharmacy_duty_info(city_hint=city)

    if cat in _CINEMA_CATS:
        return await get_cinema_showtimes(name=name, website=website, city=city)

    return {"type": "none"}
