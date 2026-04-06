"""Deals / flash offers for restaurants."""
import uuid
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Request, HTTPException

from pydantic import BaseModel
from database import get_db
from auth import get_optional_user, _get_app

# Importamos las utilidades de Firebase directamente
from firebase_admin import firestore, messaging

router = APIRouter(prefix="/deals", tags=["deals"])

class DealBody(BaseModel):
    restaurant_id: str
    price: float
    cuisine: str
    available_at: datetime
    seats: int
    description: str | None = None

@router.get("")
def list_deals(
    cuisine: Optional[str] = None,
    price_max: Optional[float] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius: Optional[int] = 1500,
):
    """List available deals with optional filters. Not yet implemented."""
    pass

@router.get("/{deal_id}")
def get_deal(deal_id: str):
    """Get a single deal by ID. Not yet implemented."""
    pass

@router.post("")
async def create_deal(body: DealBody, request: Request):
    """Create a deal (requires auth)."""
    # 1. Verificar autenticación (opcional o requerido según tu lógica)
    user_id = get_optional_user(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Debes estar autenticado para crear una oferta.")

    deal_id = str(uuid.uuid4())
    
    # 2. Escribir en Cloud SQL (Fuente de la verdad)
    async with get_db() as conn:
        # Nota: Asumo que tienes una tabla 'deals' y que la tabla 'users' tiene un 'fcm_token'. 
        # Adapta los nombres de las columnas si son diferentes en tu esquema.
        insert_query = """
            INSERT INTO deals (id, restaurant_id, price, cuisine, available_at, seats, description)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        """
        try:
            row = await conn.fetchrow(
                insert_query, 
                deal_id, body.restaurant_id, body.price, body.cuisine,
                body.available_at, body.seats, body.description
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error al guardar en SQL: {str(e)}")

        # 3. Escribir en Firestore (Para el frontend en tiempo real)
        _get_app()  # Aseguramos que Firebase esté inicializado
        db = firestore.client()
        deal_data = {
            "id": deal_id,
            "restaurant_id": body.restaurant_id,
            "price": body.price,
            "cuisine": body.cuisine,
            "available_at": body.available_at.isoformat(),
            "seats": body.seats,
            "description": body.description,
            "created_at": firestore.SERVER_TIMESTAMP
        }
        db.collection("deals").document(deal_id).set(deal_data)

        # 4. Enviar Notificaciones Push
        # Buscamos los FCM tokens de los usuarios que han guardado este restaurante (item_id)
        # Ajusta esta query según cómo tengas estructurada tu tabla de favoritos/usuarios
        token_query = """
            SELECT u.fcm_token 
            FROM users u
            JOIN bookmarks b ON u.id = b.user_id
            WHERE b.item_id = $1 AND b.item_type = 'place' AND u.fcm_token IS NOT NULL
        """
        tokens_records = await conn.fetch(token_query, body.restaurant_id)
        tokens = [rec['fcm_token'] for rec in tokens_records]

        if tokens:
            # Firebase Cloud Messaging permite enviar hasta 500 tokens por lote (Multicast)
            message = messaging.MulticastMessage(
                notification=messaging.Notification(
                    title=f"¡Oferta de última hora! 🚨",
                    body=f"Plazas limitadas por {body.price}€. ¡Corre antes de que vuelen!"
                ),
                data={
                    "deal_id": deal_id, 
                    "restaurant_id": body.restaurant_id,
                    "type": "flash_deal"
                },
                tokens=tokens,
            )
            try:
                messaging.send_each_for_multicast(message)
            except Exception as e:
                print(f"Error enviando notificaciones: {e}")

    return {"success": True, "deal": dict(row)}

@router.patch("/{deal_id}")
def update_deal(deal_id: str, body: DealBody, request: Request):
    """Update a deal (requires auth). Not yet implemented."""
    pass

@router.delete("/{deal_id}")
def delete_deal(deal_id: str, request: Request):
    """Delete a deal (requires auth). Not yet implemented."""
    pass
