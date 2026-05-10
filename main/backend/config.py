"""Application settings loaded from environment variables."""
import os
from pathlib import Path

from dotenv import load_dotenv


def _load_env_files() -> None:
    """Load .env files only when explicitly enabled for local development."""
    raw_flag = os.getenv("ENABLE_DOTENV")
    if raw_flag is None:
        # Default to enabled in local/dev runtimes so API keys in repo-root .env work out
        # of the box. Managed runtimes typically inject environment variables directly.
        managed_runtime = any(
            os.getenv(var)
            for var in (
                "K_SERVICE",                   # Cloud Run
                "RAILWAY_ENVIRONMENT_NAME",    # Railway
                "GAE_ENV",                     # App Engine
            )
        )
        enabled = not managed_runtime
    else:
        enabled = (raw_flag or "").strip().lower() in ("1", "true", "yes", "on")
    if not enabled:
        return

    backend_dir = Path(__file__).resolve().parent
    repo_root = backend_dir.parent.parent

    for path in (
        repo_root / ".env",
        repo_root / ".env.production",
        backend_dir / ".env",
        backend_dir / ".env.production",
    ):
        if path.exists():
            load_dotenv(path, override=False)


_load_env_files()

# Cloud SQL
DATABASE_URL = os.getenv("DATABASE_URL", "")

# Firebase
FIREBASE_CREDENTIALS_PATH = os.getenv("FIREBASE_CREDENTIALS_PATH", "")
FIREBASE_STORAGE_BUCKET = os.getenv("FIREBASE_STORAGE_BUCKET", "")

# External APIs
HERE_API_KEY = os.getenv("HERE_API_KEY", "mock")
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")
# Strip protects against accidental newline/space in Secret Manager values.
YELP_API_KEY = os.getenv("YELP_API_KEY", "").strip()
TRIPADVISOR_API_KEY = os.getenv("TRIPADVISOR_API_KEY", "").strip()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GOOGLE_GENAI_API_KEY = os.getenv("GOOGLE_GENAI_API_KEY") or GEMINI_API_KEY
GOOGLE_CLOUD_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT", "")
GOOGLE_CLOUD_LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
BRAIN_PROVIDER = os.getenv("BRAIN_PROVIDER", "gemini")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5-coder:7b")
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "")
TMDB_API_KEY = os.getenv("TMDB_API_KEY", "")
YELP_API_KEY = os.getenv("YELP_API_KEY", "")

# App settings
MAX_DISTANCE_KM = float(os.getenv("MAX_DISTANCE_KM", "5.0"))
DEFAULT_REPORT_DURATION_HOURS = int(os.getenv("DEFAULT_REPORT_DURATION_HOURS", "4"))
DEFAULT_MAP_RADIUS_M = int(os.getenv("DEFAULT_MAP_RADIUS_M", "10000"))

# CORS — comma-separated list of allowed origins, e.g. "https://gado.up.railway.app,https://gado.com"
# Set to "*" only for local dev; always restrict in production.
_raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
ALLOWED_ORIGINS: list[str] = [o.strip() for o in _raw_origins.split(",") if o.strip()]
