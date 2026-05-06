"""Health-check endpoint."""
from fastapi import APIRouter
from database import using_postgres

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    return {
        "status": "ok",
        "database_backend": "postgres" if using_postgres() else "sqlite",
    }
