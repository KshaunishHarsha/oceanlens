def test_metadata_reflects_real_cache(client, cache):
    r = client.get("/api/v1/metadata")
    assert r.status_code == 200
    body = r.json()
    assert body["observation_count"] == len(cache.profiles)
    assert body["timestamps"] == cache.grid.timestamps
    assert body["historical_window"] is True
    assert body["view_id"].startswith("DEMO-")
    assert "2026" not in body["window_label"]


def test_metadata_variables_report_real_availability(client):
    r = client.get("/api/v1/metadata")
    by_key = {v["key"]: v for v in r.json()["variables"]}
    assert by_key["temperature"]["available"] is True
    assert by_key["salinity"]["available"] is True
    assert by_key["currentSpeed"]["available"] is True
    assert by_key["chlorophyll"]["available"] is False


def test_times_endpoint_real_variable(client, cache):
    r = client.get("/api/v1/times?variable=temperature")
    assert r.status_code == 200
    body = r.json()
    assert body["available"] is True
    assert body["timestamps"] == cache.grid.timestamps


def test_times_endpoint_unsupported_variable(client):
    r = client.get("/api/v1/times?variable=chlorophyll")
    body = r.json()
    assert body["available"] is False
    assert body["timestamps"] == []
    assert "reason" in body and body["reason"]


def test_times_endpoint_invalid_variable_rejected(client):
    r = client.get("/api/v1/times?variable=not-a-real-variable")
    assert r.status_code == 422
