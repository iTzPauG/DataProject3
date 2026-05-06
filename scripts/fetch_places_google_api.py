#!/usr/bin/env python3
"""
scrape_valencia_places.py
--------------------------
Obtiene restaurantes y bares REALES de Valencia usando Google Places API (New).
Salida: scripts/output/places_valencia_2520.json + scripts/output/places_valencia_2520.sql

Uso:
    python3 scripts/scrape_valencia_places.py
"""

import json, time, uuid, re, os
from datetime import datetime, timezone
import requests

API_KEY = "AIzaSyD2H_7cGb1tZ0dZ80kibPXEdSrJzhYcTtI"
OUT_DIR = os.path.join(os.path.dirname(__file__), "output")
os.makedirs(OUT_DIR, exist_ok=True)

VALENCIA_CENTER = {"latitude": 39.4699, "longitude": -0.3763}

# Cuadrícula 6×6 sobre Valencia ciudad
GRID = [
    (lat, lng)
    for lat in [39.435, 39.450, 39.465, 39.480, 39.495, 39.510]
    for lng in [-0.420, -0.400, -0.380, -0.360, -0.340, -0.320]
]
GRID_RADIUS = 1800

# Tipos de lugar para la cuadrícula
GRID_TYPES = [
    "restaurant", "cafe", "bar", "bakery",
    "meal_takeaway", "night_club",
]

# Queries de texto para nichos específicos → (query, tags_extra)
TEXT_QUERIES = [
    ("paella restaurante Valencia",          ["must_try", "family"]),
    ("sushi Valencia",                       ["sushi", "international"]),
    ("pizzería Valencia",                    ["pizza"]),
    ("hamburguesería Valencia",              ["burger"]),
    ("tapas bar Ruzafa Valencia",            ["street_food", "friendly"]),
    ("tapas bar El Carmen Valencia",         ["street_food", "friendly"]),
    ("tapas bar Benimaclet Valencia",        ["street_food", "alternative"]),
    ("restaurante vegano Valencia",          ["vegan", "healthy"]),
    ("restaurante japonés Valencia",         ["sushi", "international"]),
    ("restaurante italiano Valencia",        ["pizza", "international"]),
    ("restaurante mexicano Valencia",        ["international", "street_food"]),
    ("restaurante chino Valencia",           ["international", "cheap"]),
    ("restaurante indio Valencia",           ["international"]),
    ("restaurante árabe Valencia",           ["international"]),
    ("restaurante coreano Valencia",         ["international"]),
    ("restaurante peruano Valencia",         ["international"]),
    ("restaurante thai Valencia",            ["international"]),
    ("restaurante vietnamita Valencia",      ["international"]),
    ("restaurante nikkei Valencia",          ["international", "premium"]),
    ("restaurante argentino Valencia",       ["international"]),
    ("marisquería Valencia",                 ["must_try", "premium"]),
    ("arrocería Valencia",                   ["must_try", "family"]),
    ("horchatería Valencia",                 ["must_try", "cheap"]),
    ("gastrobar Valencia",                   ["trending", "friendly"]),
    ("brunch Valencia",                      ["cafe", "instagrammable", "friendly"]),
    ("cafetería desayunos Valencia",         ["cafe", "cheap"]),
    ("ramen Valencia",                       ["international", "rainy_day"]),
    ("poke bowl Valencia",                   ["healthy", "instagrammable"]),
    ("kebab Valencia",                       ["cheap", "late_night", "street_food"]),
    ("taberna Valencia",                     ["cheap", "friendly"]),
    ("menú del día Valencia",                ["cheap", "work"]),
    ("estrella michelin Valencia",           ["premium", "must_try", "birthday"]),
    ("chiringuito playa Valencia",           ["terrace", "friendly"]),
    ("bodega vinos Valencia",                ["premium", "friendly"]),
    ("cervecería Valencia",                  ["cheap", "good_for_groups"]),
    ("restaurante Cabanyal Valencia",        ["alternative", "trending"]),
    ("restaurante Malvarrosa Valencia",      ["terrace"]),
    ("restaurante Benimaclet Valencia",      ["alternative", "cheap"]),
    ("coctelería Valencia",                  ["premium", "instagrammable", "late_night"]),
    ("rooftop bar Valencia",                 ["terrace", "instagrammable", "premium"]),
    ("karaoke Valencia",                     ["good_for_groups", "music_vibe", "birthday"]),
    ("sala conciertos Valencia",             ["music_vibe", "alternative"]),
    ("restaurante sin gluten Valencia",      ["gluten_free", "healthy"]),
    ("restaurante healthy Valencia",         ["healthy", "vegan"]),
    ("desayuno churros Valencia",            ["cheap", "must_try", "family"]),
    ("mercado central Valencia restaurante", ["must_try", "street_food"]),
    ("restaurante terraza Valencia",         ["terrace"]),
    ("restaurante cumpleaños Valencia",      ["birthday", "good_for_groups"]),
    ("restaurante romántico Valencia",       ["birthday", "premium"]),
    ("restaurante familiar Valencia",        ["family", "friendly"]),
    ("bar de tapas Valencia centro",         ["street_food", "cheap"]),
    ("restaurante Extramurs Valencia",       ["friendly"]),
    ("restaurante Patraix Valencia",         ["cheap", "family"]),
    ("restaurante La Saïdia Valencia",       ["family"]),
    ("restaurante Algirós Valencia",         ["friendly"]),
    ("restaurante Quatre Carreres Valencia", ["family", "cheap"]),
    ("restaurante Campanar Valencia",        ["family"]),
    ("restaurante Nou Moles Valencia",       ["cheap"]),
    ("restaurante Torrefiel Valencia",       ["cheap"]),
    ("restaurante Jesús Valencia",           ["cheap", "family"]),
    ("pub Valencia",                         ["late_night", "good_for_groups"]),
    ("discoteca Valencia",                   ["late_night", "music_vibe"]),
    ("bar de copas Valencia",                ["late_night"]),
    ("jazz bar Valencia",                    ["music_vibe", "rainy_day"]),
    ("vermut Valencia",                      ["friendly", "street_food"]),
    ("bocadería Valencia",                   ["cheap", "street_food"]),
    ("asador Valencia",                      ["premium", "family"]),
    ("restaurante griego Valencia",          ["international"]),
    ("restaurante turco Valencia",           ["international"]),
    ("restaurante marroquí Valencia",        ["international"]),
    ("restaurante libanés Valencia",         ["international"]),
    ("restaurante brasileño Valencia",       ["international"]),
    ("restaurante fusión Valencia",          ["trending", "instagrammable"]),
    ("food truck Valencia",                  ["street_food", "cheap", "trending"]),
    ("heladería artesanal Valencia",         ["dessert", "instagrammable"]),
    ("pastelería Valencia",                  ["dessert", "cafe"]),
    ("chocolatería Valencia",                ["dessert", "rainy_day"]),
    ("restaurante Poblats Marítims Valencia",["terrace", "must_try"]),
]

FIELDS = ",".join([
    "places.id", "places.displayName", "places.formattedAddress",
    "places.location", "places.rating", "places.userRatingCount",
    "places.priceLevel", "places.types", "places.currentOpeningHours",
    "places.photos", "places.googleMapsUri", "places.websiteUri",
    "places.internationalPhoneNumber",
])

# Mapeo tipo Google → tags base
TYPE_TAGS = {
    "cafe":                     ["cafe"],
    "coffee_shop":              ["cafe", "work"],
    "bakery":                   ["cafe", "dessert"],
    "bar":                      ["late_night"],
    "night_club":               ["late_night", "music_vibe"],
    "pizza_restaurant":         ["pizza"],
    "hamburger_restaurant":     ["burger"],
    "sushi_restaurant":         ["sushi"],
    "japanese_restaurant":      ["sushi", "international"],
    "fast_food_restaurant":     ["cheap", "street_food"],
    "fine_dining_restaurant":   ["premium", "birthday"],
    "seafood_restaurant":       ["must_try"],
    "steak_house":              ["premium"],
    "spanish_restaurant":       ["must_try", "family"],
    "mediterranean_restaurant": ["terrace"],
    "brunch_restaurant":        ["cafe", "friendly", "instagrammable"],
    "sandwich_shop":            ["cheap", "street_food"],
    "dessert_shop":             ["dessert", "instagrammable"],
    "ice_cream_shop":           ["dessert"],
    "wine_bar":                 ["premium", "friendly"],
    "pub":                      ["late_night", "good_for_groups"],
    "korean_restaurant":        ["international"],
    "chinese_restaurant":       ["international", "cheap"],
    "indian_restaurant":        ["international"],
    "thai_restaurant":          ["international"],
    "mexican_restaurant":       ["international", "street_food"],
    "italian_restaurant":       ["pizza", "international"],
    "american_restaurant":      ["burger"],
    "vegetarian_restaurant":    ["vegan", "healthy"],
    "vegan_restaurant":         ["vegan", "healthy"],
    "meal_takeaway":            ["cheap", "street_food"],
}

def _post(url, body):
    r = requests.post(url, headers={
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": FIELDS,
    }, json=body, timeout=20)
    r.raise_for_status()
    return r.json()

def nearby_search(lat, lng, place_type):
    return _post("https://places.googleapis.com/v1/places:searchNearby", {
        "includedTypes": [place_type],
        "locationRestriction": {
            "circle": {"center": {"latitude": lat, "longitude": lng}, "radius": GRID_RADIUS}
        },
        "languageCode": "es",
        "maxResultCount": 20,
    })

def text_search(query):
    return _post("https://places.googleapis.com/v1/places:searchText", {
        "textQuery": query,
        "locationBias": {
            "circle": {"center": VALENCIA_CENTER, "radius": 12000}
        },
        "languageCode": "es",
        "maxResultCount": 20,
    })

def is_valencia(addr):
    return bool(re.search(r"Valènc|Valenc|Alboraia|Alboraya", addr, re.I))

def derive_tags(p, extra=None):
    tags = set(extra or [])
    for t in p.get("types", []):
        tags.update(TYPE_TAGS.get(t, []))
    rating  = p.get("rating") or 0
    reviews = p.get("userRatingCount") or 0
    pl      = p.get("priceLevel", "")
    if rating >= 4.5 and reviews >= 300:  tags.add("must_try")
    if rating >= 4.7 and reviews >= 100:  tags.add("trending")
    if reviews >= 1500:                   tags.add("viral")
    if pl in ("PRICE_LEVEL_FREE", "PRICE_LEVEL_INEXPENSIVE"):       tags.add("cheap")
    if pl in ("PRICE_LEVEL_EXPENSIVE", "PRICE_LEVEL_VERY_EXPENSIVE"): tags.add("premium")
    return list(tags)

def price_int(p):
    m = {"PRICE_LEVEL_FREE": 1, "PRICE_LEVEL_INEXPENSIVE": 1,
         "PRICE_LEVEL_MODERATE": 2, "PRICE_LEVEL_EXPENSIVE": 3,
         "PRICE_LEVEL_VERY_EXPENSIVE": 4}
    return m.get(p.get("priceLevel", ""))

def parse_place(p, extra_tags=None):
    loc    = p.get("location", {})
    types  = p.get("types", [])
    hours  = p.get("currentOpeningHours", {})
    photos = p.get("photos", [])
    photo  = f"https://places.googleapis.com/v1/{photos[0]['name']}/media?maxWidthPx=800&key={API_KEY}" if photos else None
    # subcategory: primer tipo relevante de comida
    food_types = [t for t in types if t not in ("point_of_interest", "establishment", "food")]
    return {
        "google_place_id": p["id"],
        "name":            p.get("displayName", {}).get("text", ""),
        "address":         p.get("formattedAddress", ""),
        "lat":             loc.get("latitude"),
        "lng":             loc.get("longitude"),
        "rating":          p.get("rating"),
        "reviews":         p.get("userRatingCount"),
        "price_level":     price_int(p),
        "category_id":     "food",
        "subcategory":     food_types[0] if food_types else "restaurant",
        "types":           types,
        "opening_hours":   "; ".join(hours.get("weekdayDescriptions", [])) or None,
        "photo_url":       photo,
        "website":         p.get("websiteUri"),
        "phone":           p.get("internationalPhoneNumber"),
        "maps_url":        p.get("googleMapsUri", ""),
        "tags":            derive_tags(p, extra_tags),
    }

def fetch_all():
    seen = {}  # place_id → (raw_place, extra_tags)

    # Fase 1: cuadrícula
    total = len(GRID) * len(GRID_TYPES)
    done  = 0
    for lat, lng in GRID:
        for ptype in GRID_TYPES:
            done += 1
            try:
                data = nearby_search(lat, lng, ptype)
                new  = 0
                for p in data.get("places", []):
                    pid = p.get("id")
                    if pid and pid not in seen and is_valencia(p.get("formattedAddress", "")):
                        seen[pid] = (p, [])
                        new += 1
                print(f"  [{done}/{total}] ({lat:.3f},{lng:.3f}) {ptype}: +{new} → {len(seen)}", flush=True)
            except Exception as e:
                print(f"  ⚠ {e}", flush=True)
            time.sleep(0.12)

    print(f"\n  ✓ Fase 1: {len(seen)} lugares\n", flush=True)

    # Fase 2: text queries
    for i, (query, extra_tags) in enumerate(TEXT_QUERIES):
        try:
            data = text_search(query)
            new  = 0
            for p in data.get("places", []):
                pid = p.get("id")
                if not pid or not is_valencia(p.get("formattedAddress", "")):
                    continue
                if pid not in seen:
                    seen[pid] = (p, list(extra_tags))
                    new += 1
                else:
                    # enriquecer tags
                    ep, et = seen[pid]
                    seen[pid] = (ep, list(set(et + extra_tags)))
            print(f"  [{i+1}/{len(TEXT_QUERIES)}] '{query}': +{new} → {len(seen)}", flush=True)
        except Exception as e:
            print(f"  ⚠ '{query}': {e}", flush=True)
        time.sleep(0.15)

    return seen

def escape(s):
    if s is None: return "NULL"
    return "'" + str(s).replace("'", "''") + "'"

def to_sql(places):
    lines = [
        f"-- Valencia places seed — {len(places)} lugares reales de Google Places API",
        f"-- Generado: {datetime.now(timezone.utc).isoformat()}",
        "", "BEGIN;", "",
    ]
    for p in places:
        uid      = str(uuid.uuid4())
        tags_j   = json.dumps({t: True for t in p["tags"]}, ensure_ascii=False)
        meta_j   = json.dumps({
            "google_place_id":    p["google_place_id"],
            "maps_url":           p["maps_url"],
            "user_ratings_count": p["reviews"],
            "types":              p["types"],
        }, ensure_ascii=False)
        lines.append(
            f"INSERT INTO public.places "
            f"(id,external_id,source,category_id,subcategory,name,address,phone,website,"
            f"photo_url,rating,price_level,lat,lng,location,tags,opening_hours,metadata,is_verified) VALUES ("
            f"'{uid}',{escape(p['google_place_id'])},'google_places','food',"
            f"{escape(p['subcategory'])},{escape(p['name'])},{escape(p['address'])},"
            f"{escape(p['phone'])},{escape(p['website'])},{escape(p['photo_url'])},"
            f"{p['rating'] if p['rating'] is not None else 'NULL'},"
            f"{p['price_level'] if p['price_level'] is not None else 'NULL'},"
            f"{p['lat']},{p['lng']},"
            f"ST_SetSRID(ST_MakePoint({p['lng']},{p['lat']}),4326)::geography,"
            f"'{tags_j}'::jsonb,{escape(p['opening_hours'])},'{meta_j}'::jsonb,true"
            f") ON CONFLICT (external_id) DO UPDATE SET "
            f"rating=EXCLUDED.rating,tags=EXCLUDED.tags,updated_at=NOW();"
        )
    lines += ["", "COMMIT;"]
    return "\n".join(lines)

def main():
    print("🍽  Scraping restaurantes reales de Valencia…\n", flush=True)
    raw    = fetch_all()
    places = [parse_place(p, extra) for p, extra in raw.values()]
    places = [p for p in places if p["lat"] and p["lng"]]

    print(f"\n📍 Total: {len(places)} restaurantes con coordenadas\n", flush=True)

    from collections import Counter
    tags_count = Counter(t for p in places for t in p["tags"])
    print("Top tags:")
    for tag, n in tags_count.most_common(20):
        print(f"  {tag:25s}: {n}")

    json_path = os.path.join(OUT_DIR, "places_valencia_2520.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(places, f, ensure_ascii=False, indent=2)
    print(f"\n✅ JSON: {json_path}", flush=True)

    sql_path = os.path.join(OUT_DIR, "places_valencia_2520.sql")
    with open(sql_path, "w", encoding="utf-8") as f:
        f.write(to_sql(places))
    print(f"✅ SQL:  {sql_path}", flush=True)
    print(f"\n🎉 {len(places)} restaurantes reales de Valencia listos.", flush=True)

if __name__ == "__main__":
    main()
