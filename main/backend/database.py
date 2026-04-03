"""Supabase client helpers."""
from typing import Optional

from fastapi import HTTPException
from supabase import create_client, Client

from config import SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY


_supabase_anon: Optional[Client] = None
_supabase_service: Optional[Client] = None


def _build_client(key: str) -> Client:
    return create_client(SUPABASE_URL, key)


def get_supabase(*, use_service_role: bool = True) -> Client:
    """Return a shared Supabase client.

    The backend prefers the service-role client for server-managed reads/writes.
    It falls back to the anon key when the service key is not configured.
    """
    global _supabase_anon, _supabase_service

    if not SUPABASE_URL:
        raise HTTPException(status_code=500, detail="Supabase URL not configured")

    if use_service_role and SUPABASE_SERVICE_KEY:
        if _supabase_service is None:
            _supabase_service = _build_client(SUPABASE_SERVICE_KEY)
        return _supabase_service

    if not SUPABASE_ANON_KEY:
        raise HTTPException(status_code=500, detail="Supabase anon key not configured")
    if _supabase_anon is None:
        _supabase_anon = _build_client(SUPABASE_ANON_KEY)
    return _supabase_anon
