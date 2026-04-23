"""Mock Auth helpers — bypassing Firebase for local development."""
import hashlib
from typing import Optional

def get_optional_user(request) -> Optional[str]:
    """Return a fixed local user ID to bypass Firebase."""
    return "local-user"

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
