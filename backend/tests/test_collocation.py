"""Collocation route tests, including the numeric cross-check against an
independent TypeScript-algorithm replication (documented in
docs/data-contract.md's "Numerical compatibility" section). Absolute
tolerance: 1e-3, per the approved C7 decision. In practice these currently
agree to 1e-4 because both implementations read the same cached arrays with
the same interpolation and pairing logic.
"""

import math

import pytest

TOLERANCE = 1e-3

# id -> (rmse, mean_bias, horizontal_distance_km, time_offset_hours, sample_count)
# Produced by an independent Node.js replication of the collocation algorithm
# reading directly from public/data/real/ (see docs/data-contract.md).
CROSS_CHECK = {
    "ARGO-5907083-2": (0.2434, 0.1816, 0.357, -9.907, 102),
    "ARGO-4903775-2": (0.1061, -0.0437, 1.857, -9.925, 75),
    "ARGO-1902669-2": (0.4703, -0.1107, 3.431, -9.863, 100),
    "ARGO-7901127-2": (0.4567, -0.2641, 2.313, -9.919, 103),
}


@pytest.mark.parametrize("observation_id", list(CROSS_CHECK.keys()))
def test_collocation_matches_independent_reference(client, observation_id):
    rmse, bias, dist, offset, n = CROSS_CHECK[observation_id]
    r = client.get(f"/api/v1/collocation/{observation_id}?variable=temperature")
    assert r.status_code == 200
    body = r.json()
    assert body["sample_count"] == n
    assert math.isclose(body["rmse"], rmse, abs_tol=TOLERANCE)
    assert math.isclose(body["mean_bias"], bias, abs_tol=TOLERANCE)
    assert math.isclose(body["horizontal_distance_km"], dist, abs_tol=TOLERANCE)
    assert math.isclose(body["time_offset_hours"], offset, abs_tol=TOLERANCE)


def test_collocation_never_hard_codes_a_result(client):
    # Two different profiles must not coincidentally share every statistic —
    # a sign that a value was hard-coded rather than computed.
    a = client.get("/api/v1/collocation/ARGO-5907083-2?variable=temperature").json()
    b = client.get("/api/v1/collocation/ARGO-1902669-2?variable=temperature").json()
    assert a["rmse"] != b["rmse"]
    assert a["mean_bias"] != b["mean_bias"]


def test_collocation_qc_failed_profile_is_honest_not_hidden(client):
    r = client.get("/api/v1/collocation/ARGO-4903776-2?variable=temperature")
    assert r.status_code == 200
    body = r.json()
    assert body["sample_count"] == 0
    assert body["rmse"] is None
    assert body["mean_bias"] is None
    assert "no comparison can be made" in body["interpretation"].lower()
    # response is valid JSON with no NaN leaking through
    assert "NaN" not in r.text


def test_collocation_unknown_observation_404(client):
    r = client.get("/api/v1/collocation/NOT-A-REAL-ID?variable=temperature")
    assert r.status_code == 404


def test_collocation_salinity_variable(client):
    r = client.get("/api/v1/collocation/ARGO-5907083-2?variable=salinity")
    assert r.status_code == 200
    assert r.json()["unit"] == "PSU"


def test_collocation_bands_cover_the_water_column(client):
    r = client.get("/api/v1/collocation/ARGO-5907083-2?variable=temperature")
    bands = r.json()["bands"]
    assert len(bands) == 5
    assert bands[0]["from_m"] == 0
    assert bands[-1]["to_m"] == 1000


def test_collocation_current_speed_is_explicitly_unavailable(client):
    """Backend hardening fix regression test: compute_collocation() used to
    silently use the profile's TEMPERATURE array as the "observed" series
    for any variable other than "salinity" — so a currentSpeed request
    returned a 200 with a scientifically meaningless temperature-vs-current
    comparison, with no error at all. It must now be an explicit, honest
    validation failure instead."""
    r = client.get("/api/v1/collocation/ARGO-5907083-2?variable=currentSpeed")
    assert r.status_code == 422
    body = r.json()
    assert "not available" in body["detail"].lower()
    assert "currentspeed" in body["detail"].lower()


def test_collocation_chlorophyll_is_explicitly_unavailable_not_a_500(client):
    # Before the fix this raised an unhandled KeyError inside
    # compute_collocation (no _VARIABLE_META entry) — an ugly 500, not an
    # honest API response. Must now be the same clean 422 as currentSpeed.
    r = client.get("/api/v1/collocation/ARGO-5907083-2?variable=chlorophyll")
    assert r.status_code == 422
    assert "detail" in r.json()


def test_collocation_temperature_and_salinity_are_unaffected_by_the_fix(client):
    # The two genuinely supported variables must still work exactly as
    # before — this fix must not have narrowed them by accident.
    for variable in ("temperature", "salinity"):
        r = client.get(f"/api/v1/collocation/ARGO-5907083-2?variable={variable}")
        assert r.status_code == 200
        body = r.json()
        assert body["sample_count"] > 0
        assert body["rmse"] is not None


def test_collocation_invalid_timestamp_returns_422(client):
    r = client.get(
        "/api/v1/collocation/ARGO-5907083-2?variable=temperature&timestamp=not-a-timestamp"
    )
    assert r.status_code == 422
    assert "invalid date" in r.json()["detail"].lower()
