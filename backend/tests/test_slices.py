import math


def test_temperature_slice_is_real(client, cache):
    r = client.get(
        "/api/v1/slice?variable=temperature&timestamp=2023-09-28T00:00:00Z&depth_m=100"
    )
    assert r.status_code == 200
    body = r.json()
    assert body["actual_timestamp"].startswith("2023-09-28")
    assert body["actual_depth_m"] == 100.0
    assert len(body["values"]) == cache.grid.shape.ny
    assert len(body["values"][0]) == cache.grid.shape.nx
    finite = [v for row in body["values"] for v in row if v is not None]
    assert len(finite) > 0
    assert 0 < min(finite) < max(finite) < 40  # physically sane Bay of Bengal range


def test_salinity_slice_is_real(client):
    r = client.get("/api/v1/slice?variable=salinity&timestamp=2023-09-29T00:00:00Z&depth_m=50")
    assert r.status_code == 200
    finite = [v for row in r.json()["values"] for v in row if v is not None]
    assert 20 < min(finite) < max(finite) < 40


def test_current_speed_slice_is_real(client):
    r = client.get(
        "/api/v1/slice?variable=currentSpeed&timestamp=2023-09-29T00:00:00Z&depth_m=0"
    )
    assert r.status_code == 200
    finite = [v for row in r.json()["values"] for v in row if v is not None]
    assert len(finite) > 0
    assert min(finite) >= 0  # speed is a magnitude


def test_nearest_depth_snapping(client):
    r = client.get(
        "/api/v1/slice?variable=temperature&timestamp=2023-09-28T00:00:00Z&depth_m=97"
    )
    assert r.json()["actual_depth_m"] == 100.0  # nearest cached depth


def test_nearest_timestamp_snapping(client, cache):
    r = client.get(
        "/api/v1/slice?variable=temperature&timestamp=2023-09-28T11:00:00Z&depth_m=0"
    )
    assert r.json()["actual_timestamp"] in cache.grid.timestamps


def test_chlorophyll_unavailable_not_fabricated(client):
    r = client.get(
        "/api/v1/slice?variable=chlorophyll&timestamp=2023-09-28T00:00:00Z&depth_m=0"
    )
    assert r.status_code == 404
    assert "detail" in r.json()


def test_out_of_region_model_column_rejected(client):
    r = client.get(
        "/api/v1/model-column?variable=temperature&timestamp=2023-09-28T00:00:00Z"
        "&latitude=50&longitude=50"
    )
    assert r.status_code == 422


def test_model_column_returns_native_depth_count(client, cache):
    r = client.get(
        "/api/v1/model-column?variable=temperature&timestamp=2023-09-28T00:00:00Z"
        "&latitude=13.2&longitude=86.7"
    )
    assert r.status_code == 200
    body = r.json()
    assert len(body["depths_m"]) == len(body["values"])
    assert math.isclose(body["grid_latitude"], 13.2, abs_tol=0.25)


def test_model_column_snaps_to_nearest_timestamp_not_first(client, cache):
    """Backend hardening fix regression test: get_model_column() used to
    silently fall back to `cache.grid.timestamps[0]` (the FIRST cached
    timestamp) for any inexact request, no matter how far away the target
    actually was. This reproduces exactly that scenario — a target far from
    the first timestamp and close to the LAST one — and proves both the
    reported label and the actual data now come from the correct nearest
    snapshot."""
    first_ts = cache.grid.timestamps[0]
    last_ts = cache.grid.timestamps[-1]
    assert first_ts != last_ts  # sanity: this cache really has more than one

    # 23:00 on the day before the last cached timestamp is far closer to the
    # last timestamp (1h away) than to the first (many days away).
    from datetime import datetime, timedelta

    near_last = (
        datetime.fromisoformat(last_ts.replace("Z", "+00:00")) - timedelta(hours=1)
    ).isoformat().replace("+00:00", "Z")

    r = client.get(
        f"/api/v1/model-column?variable=temperature&timestamp={near_last}"
        "&latitude=13.2&longitude=86.7"
    )
    assert r.status_code == 200
    body = r.json()
    assert body["actual_timestamp"] == last_ts
    assert body["actual_timestamp"] != first_ts

    # Not just the label — the VALUES themselves must match a direct request
    # for the exact nearest timestamp, proving the data lookup (not only the
    # reported string) used the correct snapshot.
    exact = client.get(
        f"/api/v1/model-column?variable=temperature&timestamp={last_ts}"
        "&latitude=13.2&longitude=86.7"
    ).json()
    assert body["values"] == exact["values"]


def test_model_column_exact_timestamp_still_matches_itself(client, cache):
    # Regression guard: the exact-match fast path must still work exactly
    # as before the fix.
    exact_ts = cache.grid.timestamps[2]
    r = client.get(
        f"/api/v1/model-column?variable=temperature&timestamp={exact_ts}"
        "&latitude=13.2&longitude=86.7"
    )
    assert r.status_code == 200
    assert r.json()["actual_timestamp"] == exact_ts


def test_missing_values_are_null_not_fabricated(client):
    # A depth colder/deeper than the cache's land mask at some cells should
    # surface as null, never as a synthesised number.
    r = client.get(
        "/api/v1/slice?variable=temperature&timestamp=2023-09-28T00:00:00Z&depth_m=0"
    )
    values = r.json()["values"]
    flat = [v for row in values for v in row]
    assert None in flat  # land cells exist in this bounding box
