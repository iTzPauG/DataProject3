"""Auth endpoints — local profile sync bypass."""
from typing import Optional
import uuid
import logging
import re

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from auth import get_optional_user
from config import GOOGLE_MAPS_API_KEY
from database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

PROFILE_SELECT = """
SELECT
    id,
    firebase_uid,
    display_name,
    avatar_url,
    reputation_score,
    reports_count,
    role,
    restaurant_name,
    restaurant_address,
    restaurant_phone,
    restaurant_place_id,
    restaurant_lat,
    restaurant_lng
FROM profiles
"""


DEV_BUSINESS_PROFILES = {
    "test-business-1": {
        "restaurant_name": "La Pepica",
        "restaurant_address": "Passeig de Neptú, 2, 46011 Valencia",
        "restaurant_phone": "+34 963 71 03 66",
        "restaurant_place_id": "ChIJa9ZBqHhQYA0RqJBJJJJJJJJ",
        "restaurant_lat": 39.4607,
        "restaurant_lng": -0.3340,
    },
    "test-business-2": {
        "restaurant_name": "Riff Restaurante",
        "restaurant_address": "Carrer del Comte d'Altea, 18, 46005 Valencia",
        "restaurant_phone": "+34 963 35 53 53",
        "restaurant_place_id": "ChIJb9ZBqHhQYA0RqJBJJJJJJJK",
        "restaurant_lat": 39.4648,
        "restaurant_lng": -0.3812,
    },
    "test-business-3": {
        "restaurant_name": "Bar Pilar",
        "restaurant_address": "Carrer del Moro Zeit, 13, 46003 Valencia",
        "restaurant_phone": "+34 963 91 04 97",
        "restaurant_place_id": "ChIJc9ZBqHhQYA0RqJBJJJJJJJL",
        "restaurant_lat": 39.4762,
        "restaurant_lng": -0.3762,
    },
}


class SyncProfileBody(BaseModel):
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None


@router.post("/sync")
async def sync_profile(body: SyncProfileBody, request: Request):
    """Create or update the profile for the local test user."""
    firebase_uid = get_optional_user(request)
    
    new_id = str(uuid.uuid4())
    async with get_db() as db:
        try:
            await db.execute(
                """
                INSERT INTO profiles (id, firebase_uid, display_name, avatar_url)
                VALUES (?, ?, ?, ?)
                ON CONFLICT (firebase_uid) DO UPDATE
                SET display_name = COALESCE(excluded.display_name, profiles.display_name),
                    avatar_url   = COALESCE(excluded.avatar_url,   profiles.avatar_url),
                    updated_at   = CURRENT_TIMESTAMP
                """,
                (new_id, firebase_uid, body.display_name or "Local User", body.avatar_url),
            )

            if firebase_uid in DEV_BUSINESS_PROFILES:
                business = DEV_BUSINESS_PROFILES[firebase_uid]
                await db.execute(
                    """UPDATE profiles SET
                       role = ?,
                       restaurant_name = ?,
                       restaurant_address = ?,
                       restaurant_phone = ?,
                       restaurant_place_id = ?,
                       restaurant_lat = ?,
                       restaurant_lng = ?,
                       updated_at = CURRENT_TIMESTAMP
                       WHERE firebase_uid = ?""",
                    (
                        "business",
                        business["restaurant_name"],
                        business["restaurant_address"],
                        business["restaurant_phone"],
                        business["restaurant_place_id"],
                        business["restaurant_lat"],
                        business["restaurant_lng"],
                        firebase_uid,
                    ),
                )

            await db.commit()
            
            cursor = await db.execute(
                f"{PROFILE_SELECT} WHERE firebase_uid = ?",
                (firebase_uid,)
            )
            row = await cursor.fetchone()
            return dict(row)
        except Exception as e:
            logger.error(f"Error syncing profile: {e}")
            raise HTTPException(status_code=500, detail=str(e))


@router.get("/me")
async def get_me(request: Request):
    """Get the local test user's profile."""
    firebase_uid = get_optional_user(request)

    async with get_db() as db:
        cursor = await db.execute(
            f"{PROFILE_SELECT} WHERE firebase_uid = ?",
            (firebase_uid,),
        )
        row = await cursor.fetchone()

    if not row:
        # Auto-sync for local dev if not found
        return await sync_profile(SyncProfileBody(), request)
    return dict(row)


class RegisterBusinessBody(BaseModel):
    restaurant_name: str
    restaurant_address: str
    restaurant_phone: str          # phone as typed by user
    google_maps_url: Optional[str] = None


class CompleteBusinessBody(BaseModel):
    place_id: str
    restaurant_name: str
    restaurant_address: str
    restaurant_phone: str
    lat: float
    lng: float


def _normalize_phone(phone: str) -> str:
    """Strip spaces, dashes, parentheses for comparison."""
    return re.sub(r"[\s\-\(\)\+]", "", phone)


@router.post("/register-business/verify")
async def verify_business(body: RegisterBusinessBody):
    """
    Step 1: Look up the restaurant in Google Places and compare phone numbers.
    Returns place data if phone matches, so the frontend can proceed to OTP.
    """
    if not GOOGLE_MAPS_API_KEY:
        raise HTTPException(status_code=503, detail="Google Maps API key not configured")

    query = f"{body.restaurant_name} {body.restaurant_address}"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            "https://places.googleapis.com/v1/places:searchText",
            headers={
                "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
                "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,"
                                    "places.location,places.internationalPhoneNumber,places.googleMapsUri",
            },
            json={"textQuery": query, "languageCode": "es", "maxResultCount": 1},
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Error consultando Google Places")

    places = resp.json().get("places", [])
    if not places:
        raise HTTPException(status_code=404, detail="Restaurante no encontrado en Google Maps")

    place = places[0]
    maps_phone = place.get("internationalPhoneNumber", "")
    user_phone = body.restaurant_phone

    phone_match = _normalize_phone(maps_phone) == _normalize_phone(user_phone)

    return {
        "place_id": place["id"],
        "name": place.get("displayName", {}).get("text", ""),
        "address": place.get("formattedAddress", ""),
        "maps_phone": maps_phone,
        "lat": place.get("location", {}).get("latitude"),
        "lng": place.get("location", {}).get("longitude"),
        "maps_url": place.get("googleMapsUri", ""),
        "phone_match": phone_match,
        # If phone doesn't match, frontend offers corporate email fallback
    }


@router.post("/register-business/complete")
async def complete_business_registration(body: CompleteBusinessBody, request: Request):
    """
    Step 2: After OTP/email verification, upgrade the profile to business role.
    """
    firebase_uid = get_optional_user(request)
    if not firebase_uid:
        raise HTTPException(status_code=401, detail="Autenticación requerida")

    async with get_db() as db:
        await db.execute(
            """UPDATE profiles SET
               role = ?, restaurant_name = ?, restaurant_address = ?,
               restaurant_phone = ?, restaurant_place_id = ?,
               restaurant_lat = ?, restaurant_lng = ?
               WHERE firebase_uid = ?""",
            (
                "business",
                body.restaurant_name,
                body.restaurant_address,
                body.restaurant_phone,
                body.place_id,
                body.lat,
                body.lng,
                firebase_uid,
            ),
        )
        await db.commit()
        cursor = await db.execute(
            f"{PROFILE_SELECT} WHERE firebase_uid = ?",
            (firebase_uid,),
        )
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Perfil no encontrado")

    return dict(row)
