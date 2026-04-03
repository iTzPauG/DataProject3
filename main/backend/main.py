"""Plan Recommendation API — FastAPI application entry point."""

import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from config import ALLOWED_ORIGINS
from routers import health, recommend, votes, places, events, reports, categories, bookmarks, search, brain, photos, preferences

logger = logging.getLogger(__name__)

app = FastAPI(title="Plan Recommendation API")


import time
import json
import traceback

class CatchAllMiddleware:
    """SIMPLE ASGI MIDDLEWARE: Catch exceptions without buffering the response."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        path = scope.get("path", "")
        # SKIP middleware for streaming endpoints to avoid buffering/timeouts
        if "/stream" in path:
            return await self.app(scope, receive, send)

        await self.app(scope, receive, send)

# app.add_middleware(CatchAllMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# ── Routers ──────────────────────────────────────────────────────────────────
app.include_router(health.router)
app.include_router(recommend.router)
app.include_router(votes.router)
app.include_router(categories.router)
app.include_router(places.router)
app.include_router(events.router)
app.include_router(reports.router)
app.include_router(bookmarks.router)
app.include_router(search.router)
app.include_router(brain.router)
app.include_router(photos.router)
app.include_router(preferences.router)
