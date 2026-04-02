"""Simple in-memory cache with TTL (per-process)."""
from __future__ import annotations

import time
from typing import Any, Dict, Tuple

_CACHE: Dict[str, Tuple[float, Any]] = {}


def _now() -> float:
    return time.time()


async def cache_get(key: str) -> Any | None:
    entry = _CACHE.get(key)
    if not entry:
        return None
    expires_at, value = entry
    if expires_at < _now():
        _CACHE.pop(key, None)
        return None
    return value


async def cache_set(key: str, value: Any, ttl: int = 300) -> None:
    _CACHE[key] = (_now() + ttl, value)


async def cache_purge() -> None:
    now = _now()
    expired = [k for k, (exp, _) in _CACHE.items() if exp < now]
    for k in expired:
        _CACHE.pop(k, None)
