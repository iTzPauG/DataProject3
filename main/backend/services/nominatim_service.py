"""
Nominatim — geocoding y reverse geocoding gratuito basado en OSM.
Requiere User-Agent identificativo. Límite: 1 req/s (respetar).
"""
from __future__ import annotations

import asyncio
import time
from typing import Optional

import httpx

NOMINATIM_URL = "https://nominatim.openstreetmap.org"
HEADERS = {"User-Agent": "WHIM-App/1.0 (contact@whim.app)"}

_rate_lock = asyncio.Lock()
_last_call = 0.0


async def _rate_limit() -> None:
    global _last_call
    async with _rate_lock:
        now = time.time()
        delta = now - _last_call
        if delta < 1.0:
            await asyncio.sleep(1.0 - delta)
        _last_call = time.time()


async def geocode(query: str, lat: Optional[float] = None, lng: Optional[float] = None) -> list[dict]:
    """Convierte texto a coordenadas."""
    await _rate_limit()
    params: dict = {
        "q": query,
        "format": "jsonv2",
        "limit": 5,
        "addressdetails": 1,
    }
    if lat is not None and lng is not None:
        params["viewbox"] = f"{lng-0.5},{lat+0.5},{lng+0.5},{lat-0.5}"
        params["bounded"] = 1

    async with httpx.AsyncClient(timeout=10.0, headers=HEADERS) as client:
        resp = await client.get(f"{NOMINATIM_URL}/search", params=params)
        resp.raise_for_status()
        return resp.json()


async def reverse_geocode(lat: float, lng: float) -> dict:
    """Convierte coordenadas a dirección."""
    await _rate_limit()
    params = {"lat": lat, "lon": lng, "format": "jsonv2", "addressdetails": 1}
    async with httpx.AsyncClient(timeout=10.0, headers=HEADERS) as client:
        resp = await client.get(f"{NOMINATIM_URL}/reverse", params=params)
        resp.raise_for_status()
        return resp.json()
