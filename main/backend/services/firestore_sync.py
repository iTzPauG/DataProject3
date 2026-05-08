"""Firestore sync helpers for deals and reservations.

This module provides a small, explicit API used by the deals router to ensure
that every write goes to Firestore first, then SQL.
"""

from __future__ import annotations

from decimal import Decimal
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import HTTPException

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except ImportError:  # pragma: no cover - dependency handled at deploy/runtime
    firebase_admin = None
    credentials = None
    firestore = None

from config import FIREBASE_CREDENTIALS_PATH


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_firestore_client():
    if firebase_admin is None or firestore is None:
        raise HTTPException(
            status_code=503,
            detail="Firestore no está disponible: falta dependencia firebase-admin",
        )

    if not firebase_admin._apps:
        if FIREBASE_CREDENTIALS_PATH:
            cred = credentials.Certificate(FIREBASE_CREDENTIALS_PATH)
            firebase_admin.initialize_app(cred)
        else:
            firebase_admin.initialize_app()

    return firestore.client()


def _doc_payload(payload: dict[str, Any]) -> dict[str, Any]:
    data = _normalize_firestore_value(dict(payload))
    if "is_active" in data:
        data["is_active"] = bool(data["is_active"])
    data["updated_at"] = _iso_now()
    if "created_at" not in data:
        data["created_at"] = data["updated_at"]
    return data


def _normalize_firestore_value(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): _normalize_firestore_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_normalize_firestore_value(item) for item in value]
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def upsert_deal(deal: dict[str, Any]) -> None:
    client = _get_firestore_client()
    deal_id = deal.get("id")
    if not deal_id:
        raise HTTPException(status_code=500, detail="Deal inválida para sync en Firestore")
    client.collection("deals").document(str(deal_id)).set(_doc_payload(deal), merge=True)


def delete_deal(deal_id: str) -> None:
    client = _get_firestore_client()
    client.collection("deals").document(deal_id).set(
        {
            "id": deal_id,
            "is_active": False,
            "deleted_at": _iso_now(),
            "updated_at": _iso_now(),
        },
        merge=True,
    )


def create_reservation(deal_id: str, reservation: dict[str, Any]) -> None:
    client = _get_firestore_client()
    reservation_id = reservation.get("id")
    if not reservation_id:
        raise HTTPException(status_code=500, detail="Reserva inválida para sync en Firestore")

    payload = _doc_payload({**reservation, "deal_id": deal_id})
    client.collection("reservations").document(str(reservation_id)).set(payload, merge=True)
    client.collection("deals").document(str(deal_id)).set({"reservation": payload, "updated_at": _iso_now()}, merge=True)


def update_reservation_status(deal_id: str, status: str, reason: str | None = None) -> None:
    client = _get_firestore_client()
    reason_value = (reason or "").strip()
    now_iso = _iso_now()

    reservations = (
        client.collection("reservations")
        .where("deal_id", "==", deal_id)
        .where("status", "==", "confirmed")
        .limit(1)
        .stream()
    )
    doc = next(iter(reservations), None)
    if doc is not None:
        doc.reference.set(
            {
                "status": status,
                "status_reason": reason_value,
                "updated_at": now_iso,
            },
            merge=True,
        )

    # Mark deal with appropriate timestamp and inactive
    field_name = "not_presented_at" if status == "no_show" else "cancelled_at"
    deal_update = {
        "reservation": {
            "status": status,
            "status_reason": reason_value,
            "deal_id": deal_id,
            "updated_at": now_iso,
        },
        "is_active": False,
        field_name: now_iso,
        "updated_at": now_iso,
    }
    client.collection("deals").document(str(deal_id)).set(deal_update, merge=True)
