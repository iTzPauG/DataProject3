"""Firebase Auth helpers."""
import hashlib
import os
from typing import Optional

_firebase_app = None


def _get_app():
    global _firebase_app
    if _firebase_app is None:
        import firebase_admin
        from firebase_admin import credentials
        cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "")
        cred = credentials.Certificate(cred_path) if cred_path else credentials.ApplicationDefault()
        _firebase_app = firebase_admin.initialize_app(cred)
    return _firebase_app


def get_optional_user(request) -> Optional[str]:
    """Extract uid from Firebase JWT Bearer token if present, else None."""
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header[len("Bearer "):]
    if not token:
        return None
    try:
        from firebase_admin import auth
        _get_app()
        decoded = auth.verify_id_token(token)
        return decoded.get("uid")
    except Exception:
        return None


def get_voter_id(request) -> str:
    """Build a stable anonymous voter ID from IP + User-Agent."""
    forwarded = request.headers.get("x-forwarded-for")
    ip = (
        forwarded.split(",")[0].strip()
        if forwarded
        else (request.client.host if request.client else "unknown")
    )
    ua = request.headers.get("user-agent", "")
    return hashlib.sha256(f"{ip}:{ua}".encode()).hexdigest()[:16]
