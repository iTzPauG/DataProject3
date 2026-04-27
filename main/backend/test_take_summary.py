from services.recommendation.pipeline import _fallback_review_signals


def test_fallback_review_signals_summarizes_positive_consensus():
    candidate = {
        "place_id": "park-1",
        "rating": 4.7,
        "total_ratings": 240,
        "google_reviews": [
            {"rating": 5, "text": "Parque precioso, enorme y muy agradable para pasear con calma."},
            {"rating": 5, "text": "Muy bonito, con mucho verde y un entorno perfecto para desconectar."},
            {"rating": 4, "text": "Vale la pena ir con tiempo porque recorrerlo entero lleva bastante."},
        ],
        "review_summary": "",
    }

    pros, cons, verdict, why, _quote = _fallback_review_signals(candidate)

    assert pros
    assert all('"' not in item for item in pros)
    assert "gusta por razones concretas" in verdict or "consenso" in verdict.lower()
    assert cons
    assert "tiempo" in cons[0].lower() or "prisa" in cons[0].lower()
    assert '"' not in why


def test_fallback_review_signals_surfaces_hard_negatives():
    candidate = {
        "place_id": "clinic-1",
        "rating": 4.4,
        "total_ratings": 248,
        "google_reviews": [
            {"rating": 5, "text": "Muy profesionales y trato cercano."},
            {"rating": 5, "text": "Explican todo con claridad y transmiten mucha confianza."},
            {"rating": 1, "text": "Me recomendaron un tratamiento innecesario y acabé peor. Buscad segunda opinión."},
        ],
        "review_summary": "",
    }

    pros, cons, verdict, _why, _quote = _fallback_review_signals(candidate)

    assert any("profesional" in item.lower() or "confianza" in item.lower() for item in pros)
    assert any("confianza" in item.lower() or "criterio" in item.lower() or "cuidado" in verdict.lower() for item in cons + [verdict])
    assert all('"' not in item for item in cons)


def test_fallback_review_signals_handles_low_signal():
    candidate = {
        "place_id": "tiny-1",
        "rating": 4.2,
        "total_ratings": 8,
        "google_reviews": [
            {"rating": 4, "text": "Bien."},
            {"rating": 5, "text": "Correcto."},
        ],
        "review_summary": "",
    }

    pros, cons, verdict, _why, _quote = _fallback_review_signals(candidate)

    assert pros
    assert cons
    assert "poca" in cons[0].lower() or "muestra" in cons[0].lower() or "señal" in cons[0].lower()
    assert "pocas reseñas" in verdict.lower() or "poca muestra" in verdict.lower() or "no sería serio" in verdict.lower()
