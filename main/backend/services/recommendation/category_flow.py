"""Category flow metadata for guided discovery.

Each category has UNIQUE subcategories and moods that actually make sense
for that domain — not copy-pasted from the food flow.
"""
from __future__ import annotations

from copy import deepcopy


FLOW_DEFINITIONS: dict[str, dict] = {
    "food": {
        "label": "Comida y bebida",
        "search_mode": "guided_ranked",
        "requires_price": True,
        "fallback_radius_m": 3000,
        "max_radius_m": 12000,
        "provider_types": ["restaurant", "cafe", "bar", "bakery", "meal_delivery"],
        "mood_title": "¿Cuál es el plan?",
        "mood_subtitle": "Elige el ambiente perfecto",
        "subcategories": [
            {"id": "pizza", "label": "Pizza", "emoji": "🍕"},
            {"id": "sushi", "label": "Sushi", "emoji": "🍱"},
            {"id": "tapas", "label": "Tapas", "emoji": "🥘"},
            {"id": "burgers", "label": "Hamburguesas", "emoji": "🍔"},
            {"id": "asian", "label": "Asiática", "emoji": "🍜"},
            {"id": "italian", "label": "Italiana", "emoji": "🍝"},
            {"id": "mexican", "label": "Mexicana", "emoji": "🌮"},
            {"id": "healthy", "label": "Saludable", "emoji": "🥗"},
            {"id": "vegan", "label": "Vegano", "emoji": "🌱"},
            {"id": "kebab", "label": "Kebab", "emoji": "🥙"},
        ],
        "moods": [
            {"id": "quick", "label": "Algo rápido", "emoji": "⚡"},
            {"id": "casual", "label": "Informal", "emoji": "😊"},
            {"id": "date", "label": "Cita", "emoji": "❤️"},
            {"id": "family", "label": "Familiar", "emoji": "👨‍👩‍👧"},
            {"id": "celebration", "label": "Celebración", "emoji": "🎉"},
            {"id": "sharing", "label": "Para compartir", "emoji": "🥂"},
        ],
    },
    "nightlife": {
        "label": "Ocio nocturno",
        "search_mode": "guided_ranked",
        "requires_price": True,
        "fallback_radius_m": 5000,
        "max_radius_m": 15000,
        "provider_types": ["night_club", "bar", "pub"],
        "mood_title": "¿Qué rollo buscas?",
        "mood_subtitle": "Elige el ambiente de la noche",
        "subcategories": [
            {"id": "bar", "label": "Bar", "emoji": "🍻"},
            {"id": "club", "label": "Discoteca", "emoji": "🕺"},
            {"id": "pub", "label": "Pub", "emoji": "🍺"},
            {"id": "cocktail", "label": "Cócteles", "emoji": "🍸"},
            {"id": "lounge", "label": "Lounge", "emoji": "🛋️"},
        ],
        "moods": [
            {"id": "chill", "label": "Tranquilo", "emoji": "🍷"},
            {"id": "party", "label": "Fiesta", "emoji": "💃"},
            {"id": "date", "label": "Íntimo", "emoji": "🥂"},
            {"id": "friends", "label": "Con amigos", "emoji": "🍻"},
            {"id": "music", "label": "Música en vivo", "emoji": "🎸"},
        ],
    },
    "shopping": {
        "label": "Compras",
        "search_mode": "guided_ranked",
        "requires_price": True,
        "fallback_radius_m": 4000,
        "max_radius_m": 10000,
        "provider_types": ["shopping_mall", "store", "supermarket"],
        "mood_title": "¿Cómo quieres comprar?",
        "mood_subtitle": "Elige tu estilo de compras",
        "subcategories": [
            {"id": "clothes", "label": "Ropa", "emoji": "👗"},
            {"id": "shoes", "label": "Zapatos", "emoji": "👞"},
            {"id": "electronics", "label": "Electrónica", "emoji": "💻"},
            {"id": "accessories", "label": "Accesorios", "emoji": "👜"},
            {"id": "books", "label": "Libros", "emoji": "📚"},
        ],
        "moods": [
            {"id": "quick", "label": "Rápido", "emoji": "⏱️"},
            {"id": "window", "label": "Mirar", "emoji": "👀"},
            {"id": "treat_myself", "label": "Capricho", "emoji": "🎁"},
            {"id": "sale", "label": "Ofertas", "emoji": "🏷️"},
            {"id": "luxury", "label": "Lujo", "emoji": "💎"},
        ],
    },
    "health": {
        "label": "Salud y farmacia",
        "search_mode": "guided_ranked",
        "requires_price": False,
        "fallback_radius_m": 6000,
        "max_radius_m": 15000,
        "provider_types": ["pharmacy", "hospital", "doctor", "dentist"],
        "mood_title": "¿Cuál es la urgencia?",
        "mood_subtitle": "Elige tu situación actual",
        "subcategories": [
            {"id": "pharmacy", "label": "Farmacia", "emoji": "💊"},
            {"id": "hospital", "label": "Hospital", "emoji": "🏥"},
            {"id": "clinic", "label": "Clínica", "emoji": "⚕️"},
            {"id": "dentist", "label": "Dentista", "emoji": "🦷"},
            {"id": "acupuncture", "label": "Acupuntura", "emoji": "🫙"},
        ],
        "moods": [
            {"id": "urgent", "label": "Urgente", "emoji": "🚨"},
            {"id": "checkup", "label": "Revisión", "emoji": "📅"},
            {"id": "specialist", "label": "Especialista", "emoji": "👨‍⚕️"},
        ],
    },
    "nature": {
        "label": "Naturaleza",
        "search_mode": "guided_ranked",
        "requires_price": False,
        "fallback_radius_m": 10000,
        "max_radius_m": 25000,
        "provider_types": ["park", "campground", "tourist_attraction"],
        "mood_title": "¿Qué plan tienes?",
        "mood_subtitle": "Elige qué quieres hacer",
        "subcategories": [
            {"id": "park", "label": "Parque", "emoji": "🌲"},
            {"id": "viewpoint", "label": "Mirador", "emoji": "🔭"},
            {"id": "hiking", "label": "Senderismo", "emoji": "🥾"},
            {"id": "garden", "label": "Jardín", "emoji": "🌺"},
        ],
        "moods": [
            {"id": "relax", "label": "Relajante", "emoji": "🧘"},
            {"id": "picnic", "label": "Picnic", "emoji": "🧺"},
            {"id": "family", "label": "Para niños", "emoji": "👶"},
            {"id": "photo_spot", "label": "Para fotos", "emoji": "📸"},
        ],
    },
    "culture": {
        "label": "Cultura y ocio",
        "search_mode": "guided_ranked",
        "requires_price": True,
        "fallback_radius_m": 7000,
        "max_radius_m": 15000,
        "provider_types": ["museum", "art_gallery", "library", "tourist_attraction"],
        "mood_title": "¿Cuál es tu objetivo?",
        "mood_subtitle": "Elige qué buscas de esta visita",
        "subcategories": [
            {"id": "museum", "label": "Museo", "emoji": "🏛️"},
            {"id": "gallery", "label": "Galería", "emoji": "🖼️"},
            {"id": "theater", "label": "Teatro", "emoji": "🎭"},
            {"id": "monument", "label": "Monumento", "emoji": "🗿"},
        ],
        "moods": [
            {"id": "learn", "label": "Aprender", "emoji": "🧠"},
            {"id": "interactive", "label": "Interactivo", "emoji": "🎨"},
            {"id": "classic", "label": "Clásico", "emoji": "🏛️"},
            {"id": "entertainment", "label": "Entretenimiento", "emoji": "🍿"},
        ],
    },
    "services": {
        "label": "Servicios",
        "search_mode": "guided_ranked",
        "requires_price": False,
        "fallback_radius_m": 4000,
        "max_radius_m": 10000,
        "provider_types": ["bank", "post_office", "laundry"],
        "mood_title": "¿Qué buscas?",
        "mood_subtitle": "Elige lo que más te importa ahora",
        "subcategories": [
            {"id": "bank", "label": "Banco", "emoji": "🏦"},
            {"id": "post_office", "label": "Correos", "emoji": "📮"},
            {"id": "laundry", "label": "Lavandería", "emoji": "👕"},
            {"id": "notary", "label": "Notaría", "emoji": "📜"},
            {"id": "copy_shop", "label": "Copistería", "emoji": "🖨️"},
        ],
        "moods": [
            {"id": "express", "label": "Exprés", "emoji": "⚡"},
            {"id": "open_now", "label": "Abierto ahora", "emoji": "🟢"},
            {"id": "trusted", "label": "De confianza", "emoji": "⭐"},
        ],
    },
    "sport": {
        "label": "Deporte",
        "search_mode": "guided_ranked",
        "requires_price": False,
        "fallback_radius_m": 8000,
        "max_radius_m": 20000,
        "provider_types": ["gym", "stadium", "sports_club"],
        "mood_title": "¿Cómo quieres entrenar?",
        "mood_subtitle": "Elige la intensidad o compañía",
        "subcategories": [
            {"id": "gym", "label": "Gimnasio", "emoji": "🏋️"},
            {"id": "football", "label": "Fútbol", "emoji": "⚽"},
            {"id": "basketball", "label": "Baloncesto", "emoji": "🏀"},
            {"id": "tennis", "label": "Tenis", "emoji": "🎾"},
            {"id": "padel", "label": "Pádel", "emoji": "🏓"},
        ],
        "moods": [
            {"id": "classes", "label": "Clases dirigidas", "emoji": "🏋️"},
            {"id": "casual", "label": "Para pasar el rato", "emoji": "😆"},
            {"id": "competition", "label": "Competición", "emoji": "🏆"},
            {"id": "outdoor", "label": "Al aire libre", "emoji": "🌳"},
            {"id": "beginner", "label": "Principiante", "emoji": "🌱"},
        ],
    },
    "education": {
        "label": "Educación",
        "search_mode": "guided_ranked",
        "requires_price": False,
        "fallback_radius_m": 5000,
        "max_radius_m": 15000,
        "provider_types": ["school", "university"],
        "mood_title": "¿Qué centro buscas?",
        "mood_subtitle": "Primero elige el tipo y luego afina etapa, apoyo o idioma",
        "subcategories": [
            {"id": "public_school", "label": "Público", "emoji": "🏛️"},
            {"id": "private_school", "label": "Privado", "emoji": "🏫"},
            {"id": "concerted_school", "label": "Concertado", "emoji": "🤝"},
            {"id": "special_education", "label": "Especial", "emoji": "⭐"},
        ],
        "moods": [
            {"id": "infant_primary", "label": "Infantil / Primaria", "emoji": "🧒"},
            {"id": "secondary_baccalaureate", "label": "ESO / Bachillerato", "emoji": "📘"},
            {"id": "vocational_path", "label": "FP media / superior", "emoji": "🛠️"},
            {"id": "university_path", "label": "Grado / Máster", "emoji": "🎓"},
            {"id": "special_support", "label": "Apoyo específico", "emoji": "🫶"},
            {"id": "bilingual_languages", "label": "Bilingüe / Idiomas", "emoji": "🗣️"},
        ],
    },
    "cinema": {
        "label": "Cine",
        "search_mode": "guided_ranked",
        "requires_price": True,
        "fallback_radius_m": 9000,
        "max_radius_m": 20000,
        "provider_types": ["movie_theater"],
        "mood_title": "¿Cuál es la ocasión?",
        "mood_subtitle": "Elige con quién vas",
        "subcategories": [
            {"id": "blockbuster", "label": "Estrenos", "emoji": "🍿"},
            {"id": "indie", "label": "Cine Indie", "emoji": "📽️"},
            {"id": "vos", "label": "Versión original", "emoji": "🇬🇧"},
            {"id": "action", "label": "Acción", "emoji": "💥"},
            {"id": "comedy", "label": "Comedia", "emoji": "😂"},
            {"id": "drama", "label": "Drama", "emoji": "🎭"},
            {"id": "kids", "label": "Infantil", "emoji": "👦"},
            {"id": "horror", "label": "Terror", "emoji": "👻"},
        ],
        "moods": [
            {"id": "date_night", "label": "Cita romántica", "emoji": "❤️"},
            {"id": "friends", "label": "Con amigos", "emoji": "🍿"},
            {"id": "family", "label": "En familia", "emoji": "👨‍👩‍👧"},
            {"id": "solo", "label": "Solo/a", "emoji": "🎧"},
        ],
    },
    "wellness": {
        "label": "Bienestar",
        "search_mode": "guided_ranked",
        "requires_price": True,
        "fallback_radius_m": 8000,
        "max_radius_m": 20000,
        "provider_types": ["spa", "physiotherapist"],
        "mood_title": "¿Qué tipo de bienestar?",
        "mood_subtitle": "Elige tu experiencia de relax",
        "subcategories": [
            {"id": "spa", "label": "Spa", "emoji": "💆"},
            {"id": "massage", "label": "Masaje", "emoji": "💆‍♂️"},
            {"id": "sauna", "label": "Sauna", "emoji": "🔥"},
            {"id": "meditation", "label": "Meditación", "emoji": "🧘"},
            {"id": "yoga", "label": "Yoga", "emoji": "🧘‍♀️"},
            {"id": "beauty", "label": "Estética", "emoji": "💅"},
        ],
        "moods": [
            {"id": "disconnect", "label": "Desconectar", "emoji": "🧘"},
            {"id": "couples", "label": "En pareja", "emoji": "💑"},
            {"id": "detox", "label": "Detox", "emoji": "🍃"},
            {"id": "stress_relief", "label": "Aliviar estrés", "emoji": "😮‍💨"},
            {"id": "luxury", "label": "Lujo", "emoji": "💎"},
        ],
    },
    "coworking": {
        "label": "Coworking",
        "search_mode": "guided_ranked",
        "requires_price": True,
        "skip_price_subcategories": ["library", "cafe_workspace"],
        "fallback_radius_m": 6000,
        "max_radius_m": 15000,
        "provider_types": ["library"],
        "mood_title": "¿Qué tipo de espacio?",
        "mood_subtitle": "Elige donde trabajar",
        "subcategories": [
            {"id": "open_space", "label": "Espacio abierto", "emoji": "🏢"},
            {"id": "private_office", "label": "Oficina privada", "emoji": "🚪"},
            {"id": "meeting_room", "label": "Sala de reuniones", "emoji": "📊"},
            {"id": "cafe_workspace", "label": "Café con WiFi", "emoji": "☕"},
            {"id": "phone_booth", "label": "Cabina privada", "emoji": "📞"},
        ],
        "moods": [
            {"id": "focus", "label": "Concentración", "emoji": "🤫"},
            {"id": "networking", "label": "Networking", "emoji": "🤝"},
            {"id": "cheap", "label": "Económico", "emoji": "💰"},
            {"id": "premium", "label": "Premium", "emoji": "✨"},
            {"id": "quiet", "label": "Silencio", "emoji": "🤫"},
        ],
    },
    "pets": {
        "label": "Mascotas",
        "search_mode": "guided_ranked",
        "requires_price": False,
        "fallback_radius_m": 8000,
        "max_radius_m": 20000,
        "provider_types": ["veterinary_care", "pet_store"],
        "mood_title": "¿Qué necesita tu mascota?",
        "mood_subtitle": "Elige el servicio",
        "subcategories": [
            {"id": "vet", "label": "Veterinario", "emoji": "🏥"},
            {"id": "pet_shop", "label": "Tienda mascotas", "emoji": "🐾"},
            {"id": "dog_park", "label": "Parque canino", "emoji": "🐕"},
            {"id": "grooming", "label": "Peluquería animal", "emoji": "✂️"},
            {"id": "cat_cafe", "label": "Cat café", "emoji": "🐱"},
            {"id": "pet_hotel", "label": "Residencia animal", "emoji": "🏨"},
        ],
        "moods": [
            {"id": "urgent", "label": "Urgencia", "emoji": "🚨"},
            {"id": "routine_care", "label": "Cuidado regular", "emoji": "📅"},
            {"id": "new_pet", "label": "Nuevo miembro", "emoji": "🐣"},
            {"id": "training", "label": "Entrenamiento", "emoji": "🐕‍🦺"},
        ],
    },
    "automotive": {
        "label": "Vehículo",
        "search_mode": "guided_ranked",
        "requires_price": False,
        "skip_price_moods": ["breakdown"],
        "fallback_radius_m": 8000,
        "max_radius_m": 20000,
        "provider_types": ["gas_station", "car_repair", "car_wash", "parking", "car_rental"],
        "mood_title": "¿Qué necesita tu vehículo?",
        "mood_subtitle": "Elige el servicio",
        "subcategories": [
            {"id": "gas_station", "label": "Gasolinera", "emoji": "⛽"},
            {"id": "ev_charging", "label": "Carga eléctrica", "emoji": "🔌"},
            {"id": "mechanic", "label": "Taller mecánico", "emoji": "🔧"},
            {"id": "car_wash", "label": "Lavado", "emoji": "🚿"},
            {"id": "parking", "label": "Parking", "emoji": "🅿️"},
            {"id": "tire_shop", "label": "Neumáticos", "emoji": "🛞"},
            {"id": "itv", "label": "ITV", "emoji": "📋"},
            {"id": "car_rental", "label": "Alquiler coches", "emoji": "🚗"},
        ],
        "moods": [
            {"id": "breakdown", "label": "Avería urgente", "emoji": "🆘"},
            {"id": "maintenance", "label": "Mantenimiento", "emoji": "📅"},
            {"id": "quick_stop", "label": "Parada rápida", "emoji": "⚡"},
            {"id": "roadtrip", "label": "Preparar viaje", "emoji": "📍"},
        ],
    },

    # ─────────────────────────────────────────────────────────────
    # EVENT-BASED CATEGORIES
    # ─────────────────────────────────────────────────────────────
    "event": {
        "label": "Eventos",
        "search_mode": "event_list",
        "requires_price": False,
        "fallback_radius_m": 10000,
        "max_radius_m": 25000,
        "provider_types": [],
        "mood_title": "Eventos",
        "mood_subtitle": "Cultura y ocio hoy",
        "subcategories": [
            {"id": "festivales", "label": "Festivales", "emoji": "🎡"},
            {"id": "talleres", "label": "Talleres / Cursos", "emoji": "🎨"},
            {"id": "conferencias", "label": "Charlas / Conferencias", "emoji": "🎤"},
            {"id": "exposiciones", "label": "Exposiciones", "emoji": "🖼️"},
        ],
        "moods": [],
    },
    "market": {
        "label": "Mercados",
        "search_mode": "event_list",
        "requires_price": False,
        "fallback_radius_m": 8000,
        "max_radius_m": 20000,
        "provider_types": [],
        "mood_title": "Mercadillos",
        "mood_subtitle": "Ferias y puestos locales",
        "subcategories": [
            {"id": "gastronomico", "label": "Gastro / Foodies", "emoji": "🍔"},
            {"id": "artesania", "label": "Artesania / Hand-made", "emoji": "🧶"},
            {"id": "antiguedades", "label": "Antigüedades / Vintage", "emoji": "📻"},
            {"id": "mercadillo", "label": "Mercadillo local", "emoji": "🧺"},
        ],
        "moods": [],
    },
    "music": {
        "label": "Musica en vivo",
        "search_mode": "event_list",
        "requires_price": False,
        "fallback_radius_m": 10000,
        "max_radius_m": 25000,
        "provider_types": [],
        "mood_title": "Conciertos",
        "mood_subtitle": "La mejor musica cerca de ti",
        "subcategories": [
            {"id": "rock", "label": "Rock / Indie", "emoji": "🎸"},
            {"id": "jazz", "label": "Jazz / Blues", "emoji": "🎷"},
            {"id": "electronica", "label": "DJ / Electronica", "emoji": "🎧"},
            {"id": "acustico", "label": "Acustico / Cantautores", "emoji": "🎤"},
        ],
        "moods": [],
    },
    "report": {
        "label": "Reportes",
        "search_mode": "report_only",
        "requires_price": False,
        "fallback_radius_m": 10000,
        "max_radius_m": 25000,
        "provider_types": [],
        "mood_title": "Incidencias",
        "mood_subtitle": "Avisos de la comunidad",
        "subcategories": [],
        "moods": [],
    },
}

DEFAULT_FLOW = {
    "label": "Explorar",
    "search_mode": "guided_ranked",
    "requires_price": False,
    "fallback_radius_m": 5000,
    "max_radius_m": 20000,
    "provider_types": [],
    "mood_title": "¿Que buscas?",
    "mood_subtitle": "Elige la opcion que mejor encaja contigo",
    "subcategories": [],
    "moods": [],
}


def get_flow_definition(category_id: str | None) -> dict:
    if not category_id:
        return deepcopy(DEFAULT_FLOW)
    base = FLOW_DEFINITIONS.get(category_id, DEFAULT_FLOW)
    return deepcopy(base)


def merge_category_row(row: dict | None, category_id: str) -> dict:
    flow = get_flow_definition(category_id)
    merged = {**flow}
    if row:
        merged.update(row)
        if "has_price" in row:
            merged["requires_price"] = row["has_price"]
        if "default_radius_m" in row:
            merged["default_radius_m"] = row["default_radius_m"]
    merged["id"] = row.get("id", category_id) if row else category_id
    merged["label"] = row.get("label", merged["label"]) if row else merged["label"]
    merged["active"] = row.get("is_active", row.get("active", True)) if row else True
    return merged


def build_flow_payload(category_row: dict | None, *, subcategories: list[dict] | None = None, moods: list[dict] | None = None) -> dict:
    category_id = (category_row or {}).get("id") or "food"
    merged = merge_category_row(category_row, category_id)
    return {
        "category": {
            key: merged[key]
            for key in (
                "id", "label", "icon", "color", "sort_order", "is_active", "active",
                "search_mode", "requires_price", "skip_price_moods", "skip_price_subcategories", 
                "default_radius_m", "fallback_radius_m",
                "max_radius_m", "provider_types", "mood_title", "mood_subtitle",
            )
            if key in merged
        },
        "subcategories": deepcopy(subcategories if subcategories is not None else merged["subcategories"]),
        "moods": deepcopy(moods if moods is not None else merged["moods"]),
    }


def get_price_required(category_id: str | None) -> bool:
    return bool(get_flow_definition(category_id).get("requires_price", False))
