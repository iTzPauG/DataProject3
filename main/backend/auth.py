"""Auth helpers — Firebase JWT decoding + local dev fallbacks."""
import base64
import hashlib
import json
from typing import Optional


def _decode_firebase_jwt(token: str) -> Optional[str]:
    """Extract Firebase UID (sub) from a JWT without verifying signature."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        payload_b64 = parts[1]
        padding = 4 - len(payload_b64) % 4
        if padding != 4:
            payload_b64 += "=" * padding
        payload = json.loads(base64.b64decode(payload_b64))
        return payload.get("sub") or payload.get("user_id")
    except Exception:
        return None


def get_optional_user(request) -> Optional[str]:
    """Resolve Firebase UID from Bearer token.

    Supported formats:
    - Bearer local-token                -> local-user
    - Bearer local-token:<uid>          -> <uid>
    - Bearer <firebase_jwt>             -> decoded sub claim
    - Bearer <uid>                      -> <uid> (local dev)
    """
    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        return "local-user"

    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        return "local-user"

    if token == "local-token":
        return "local-user"

    if token.startswith("local-token:"):
        uid = token.split(":", 1)[1].strip()
        return uid or "local-user"

    # Real Firebase JWT — decode and extract sub
    uid = _decode_firebase_jwt(token)
    if uid:
        return uid

    # Fallback for local dev (bare UID passed directly)
    return token

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
