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


def test_missing_values_are_null_not_fabricated(client):
    # A depth colder/deeper than the cache's land mask at some cells should
    # surface as null, never as a synthesised number.
    r = client.get(
        "/api/v1/slice?variable=temperature&timestamp=2023-09-28T00:00:00Z&depth_m=0"
    )
    values = r.json()["values"]
    flat = [v for row in values for v in row]
    assert None in flat  # land cells exist in this bounding box
