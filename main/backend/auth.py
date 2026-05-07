"""Mock Auth helpers — bypassing Firebase for local development."""
import hashlib
from typing import Optional

def get_optional_user(request) -> Optional[str]:
    """Resolve user ID from Bearer token in local/dev mode.

    Supported local formats:
    - Bearer local-token                -> local-user
    - Bearer local-token:<firebase_uid> -> <firebase_uid>
    - Bearer <firebase_uid>             -> <firebase_uid>
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

    # In local dev we also allow directly passing the uid as bearer token.
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
