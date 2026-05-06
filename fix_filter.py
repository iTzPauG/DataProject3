with open("main/backend/services/recommendation/pipeline.py", "r", encoding="utf-8") as f:
    content = f.read()

old_filter = """
    kept = []
    for r in candidates:
        rating = float(r.get("rating") or 0.0)
        dist = int(r.get("distance_m", 0) or 0)
        meta = r.get("metadata", {})
        pl = meta.get("price_level")

        # Basic quality bar
        if rating > 0 and rating < 3.8:
            continue

        if dist > MAX_DISTANCE_KM * 1000:
            continue

        # Strict price filtering: skip if it doesn't match the requested level
        if price_level is not None and pl is not None:
            if int(pl) != price_level:
                continue

        kept.append(r)
"""

new_filter = """
    kept = []
    for r in candidates:
        rating = float(r.get("rating") or 0.0)
        dist = int(r.get("distance_m", 0) or 0)
        meta = r.get("metadata", {})
        pl = meta.get("price_level")
        r["_price_diff"] = abs(int(pl) - price_level) if price_level and pl else 0

        # Basic quality bar
        if rating > 0 and rating < 3.5:
            continue

        if dist > MAX_DISTANCE_KM * 1000:
            continue

        kept.append(r)
"""
content = content.replace(old_filter.strip(), new_filter.strip())

old_sort = """
    def _sort_key(c: dict) -> float:
        rate = float(c.get("rating") or 0.0)
        count = int(c.get("total_ratings") or 0)
        dist = int(c.get("distance_m", 0) or 0)
        
        # Base score relies on rating and a logarithmic bump for popularity
        base_score = rate * math.log10(max(10, count))
        
        # Penalize distance mildly
        dist_penalty = (dist / 1000.0) * 0.5
        
        return base_score - dist_penalty
"""

new_sort = """
    def _sort_key(c: dict) -> float:
        rate = float(c.get("rating") or 0.0)
        count = int(c.get("total_ratings") or 0)
        dist = int(c.get("distance_m", 0) or 0)
        pdiff = c.get("_price_diff", 0)
        
        base_score = rate * math.log10(max(10, count))
        dist_penalty = (dist / 1000.0) * 0.5
        price_penalty = pdiff * 5.0
        
        return base_score - dist_penalty - price_penalty
"""
content = content.replace(old_sort.strip(), new_sort.strip())

with open("main/backend/services/recommendation/pipeline.py", "w", encoding="utf-8") as f:
    f.write(content)
