from routers.places import _coerce_optional_int, _normalize_query_price_level
from routers.report_helpers import report_row_to_dict
from services.place_persistence_service import _canonical_place_row


def test_report_row_to_dict_strips_postgis_location():
    row = {
        "id": "r1",
        "title": "Queue outside",
        "lat": 39.47,
        "lng": -0.37,
        "location": "0101000020E6100000",
    }

    data = report_row_to_dict(row)

    assert "location" not in data
    assert data["title"] == "Queue outside"
    assert data["lat"] == 39.47


def test_canonical_place_row_normalizes_google_price_levels():
    item = {
        "id": "abc",
        "lat": 39.47,
        "lng": -0.37,
        "name": "Test Place",
        "metadata": {"price_level": "PRICE_LEVEL_MODERATE"},
    }

    row = _canonical_place_row(item, fallback_category="food")

    assert row is not None
    assert row["price_level"] == 2


def test_canonical_place_row_ignores_unknown_google_price_levels():
    item = {
        "id": "abc",
        "lat": 39.47,
        "lng": -0.37,
        "name": "Test Place",
        "metadata": {"price_level": "PRICE_LEVEL_FREE"},
    }

    row = _canonical_place_row(item, fallback_category="food")

    assert row is not None
    assert row["price_level"] is None


def test_take_query_price_level_accepts_google_enum_or_int():
    assert _normalize_query_price_level("PRICE_LEVEL_INEXPENSIVE") == 1
    assert _normalize_query_price_level("2") == 2
    assert _normalize_query_price_level(3) == 3
    assert _normalize_query_price_level("PRICE_LEVEL_VERY_EXPENSIVE") == 3
    assert _normalize_query_price_level("garbage") is None


def test_coerce_optional_int_accepts_only_valid_ints():
    assert _coerce_optional_int("42") == 42
    assert _coerce_optional_int(7) == 7
    assert _coerce_optional_int("") is None
    assert _coerce_optional_int(None) is None
    assert _coerce_optional_int("oops") is None
