def test_lists_all_real_observations(client):
    r = client.get("/api/v1/observations")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 28
    assert len(body["observations"]) == 28


def test_incois_filter(client):
    r = client.get("/api/v1/observations?dac=IN")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 19
    assert all(o["identity"]["data_centre"] == "IN" for o in body["observations"])


def test_china_argo_filter(client):
    r = client.get("/api/v1/observations?dac=HZ")
    body = r.json()
    assert body["total"] == 9
    assert all(o["identity"]["data_centre"] == "HZ" for o in body["observations"])


def test_combined_dac_filter(client):
    r = client.get("/api/v1/observations?dac=IN&dac=HZ")
    assert r.json()["total"] == 28


def test_no_filter_returns_everything(client):
    r = client.get("/api/v1/observations")
    all_total = r.json()["total"]
    r2 = client.get("/api/v1/observations?dac=IN")
    r3 = client.get("/api/v1/observations?dac=HZ")
    assert r2.json()["total"] + r3.json()["total"] == all_total


def test_platform_type_filter(client):
    r = client.get("/api/v1/observations?platform_type=ARGO")
    assert r.json()["total"] == 28  # every real observation in the cache is Argo


def test_qc_filter(client):
    r = client.get("/api/v1/observations?qc=BAD")
    body = r.json()
    assert body["total"] == 1
    assert body["observations"][0]["id"] == "ARGO-4903776-2"


def test_bbox_filter(client):
    r = client.get("/api/v1/observations?min_lat=8&max_lat=12&min_lon=88&max_lon=90")
    body = r.json()
    assert body["total"] > 0
    for o in body["observations"]:
        assert 8 <= o["latitude"] <= 12
        assert 88 <= o["longitude"] <= 90


def test_collocated_only_matches_column_cache(client, cache):
    r = client.get("/api/v1/observations?collocated_only=true")
    assert r.json()["total"] == len(cache.columns_by_observation)


def test_get_one_observation(client):
    r = client.get("/api/v1/observations/ARGO-5907083-2")
    assert r.status_code == 200
    body = r.json()
    assert body["identity"]["data_centre"] == "IN"
    assert body["identity"]["wmo"] == "5907083"


def test_get_unknown_observation_404(client):
    r = client.get("/api/v1/observations/NOT-A-REAL-ID")
    assert r.status_code == 404
    assert "detail" in r.json()


def test_never_returns_a_synthetic_observation(client, cache):
    r = client.get("/api/v1/observations")
    ids = {o["id"] for o in r.json()["observations"]}
    assert ids == set(cache.profiles_by_id.keys())
    assert all(not i.startswith("FIXTURE") for i in ids)


def test_invalid_date_filters_return_422(client):
    r1 = client.get("/api/v1/observations?from_time=garbage")
    assert r1.status_code == 422
    assert "invalid date" in r1.json()["detail"].lower()

    r2 = client.get("/api/v1/observations?to_time=not-a-date")
    assert r2.status_code == 422
    assert "invalid date" in r2.json()["detail"].lower()
