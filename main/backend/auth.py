"""Authentication and identification helpers."""
import hashlib
import os
from typing import Optional

from fastapi import Request


def get_voter_id(request: Request) -> str:
    """Build a stable anonymous voter ID from the client IP + User-Agent.

    Returns the first 16 hex chars of SHA-256(IP:UA).
    This ensures uniqueness without requiring login.
    """
    forwarded = request.headers.get("x-forwarded-for")
    ip = (
        forwarded.split(",")[0].strip()
        if forwarded
        else (request.client.host if request.client else "unknown")
    )
    ua = request.headers.get("user-agent", "")
    raw = f"{ip}:{ua}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def get_optional_user(request: Request) -> Optional[str]:
    """Extract user_id from a JWT Bearer token if present, else None.

    Looks for an ``Authorization: Bearer <token>`` header and decodes the
    JWT to retrieve the ``sub`` claim.  Returns *None* when the header is
    missing or the token is invalid so that unauthenticated requests can
    still proceed (the caller decides whether auth is required).

    SECURITY NOTE: Token signature verification is delegated to Supabase's
    Row Level Security (RLS) policies.  If you need server-side enforcement
    (e.g. admin routes), verify the JWT signature using the Supabase JWT
    secret (``SUPABASE_JWT_SECRET`` env var) and the ``jose`` library:

        from jose import jwt, JWTError
        secret = os.getenv("SUPABASE_JWT_SECRET", "")
        payload = jwt.decode(token, secret, algorithms=["HS256"],
                             options={"verify_aud": False})
    """
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header[len("Bearer "):]
    if not token:
        return None

    try:
        from jose import jwt

        # Attempt verified decode first if the JWT secret is configured.
        jwt_secret = os.getenv("SUPABASE_JWT_SECRET", "")
        if jwt_secret:
            payload = jwt.decode(
                token,
                jwt_secret,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
        else:
            # Fallback: unverified decode — Supabase RLS handles authorization.
            # Set SUPABASE_JWT_SECRET in production to enable signature checks.
            payload = jwt.get_unverified_claims(token)

        sub = payload.get("sub")
        # Validate that sub is a non-empty string before returning
        return str(sub) if sub else None
    except Exception:
        return None
