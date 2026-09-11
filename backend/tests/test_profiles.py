def test_temperature_profile_is_real(client):
    r = client.get("/api/v1/profile/ARGO-5907083-2?variable=temperature")
    assert r.status_code == 200
    body = r.json()
    assert body["unit"] == "°C"
    assert len(body["levels"]) > 0
    surface = body["levels"][0]
    assert 25 < surface["value"] < 31  # real Bay of Bengal surface temperature
    assert surface["qc"] in ("GOOD", "PROBABLY_GOOD", "SUSPECT", "BAD")


def test_salinity_profile_is_real(client):
    r = client.get("/api/v1/profile/ARGO-5907083-2?variable=salinity")
    assert r.status_code == 200
    body = r.json()
    assert body["unit"] == "PSU"
    surface = body["levels"][0]
    assert 25 < surface["value"] < 37


def test_depth_ordering(client):
    r = client.get("/api/v1/profile/ARGO-2902770-132?variable=temperature")
    depths = [lv["depth_m"] for lv in r.json()["levels"]]
    assert depths == sorted(depths)
    assert len(depths) == len(set(depths))  # strictly ascending, no duplicates


def test_profile_preserves_per_level_qc(client):
    r = client.get("/api/v1/profile/ARGO-1902669-2?variable=temperature")
    levels = r.json()["levels"]
    flags = {lv["qc"] for lv in levels}
    assert flags <= {"GOOD", "PROBABLY_GOOD", "SUSPECT", "BAD", None}


def test_qc_failed_profile_has_zero_levels_but_still_resolves(client):
    r = client.get("/api/v1/profile/ARGO-4903776-2?variable=temperature")
    assert r.status_code == 200
    body = r.json()
    assert body["levels"] == []
    assert body["qc"] == "BAD"


def test_profile_carries_platform_identity(client):
    r = client.get("/api/v1/profile/ARGO-5907083-2?variable=temperature")
    identity = r.json()["identity"]
    assert identity["data_centre"] == "IN"
    assert identity["wmo"] == "5907083"
    assert identity["data_mode"] == "D"


def test_unknown_observation_404(client):
    r = client.get("/api/v1/profile/NOT-REAL?variable=temperature")
    assert r.status_code == 404
