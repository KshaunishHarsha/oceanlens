from app.models.provenance import DataStatus

EXPECTED_LAYER_IDS = {
    "model.temperature",
    "model.salinity",
    "model.currents",
    "obs.argo",
    "obs.bgc",
    "obs.glider",
    "obs.ctd",
    "satellite.sst",
    "satellite.chlorophyll",
    "derived.isosurface",
    "context.coastline",
    "context.bathymetry",
    "advisory.incois",
    "ml.anomaly",
}


def test_provenance_lists_every_layer(client):
    r = client.get("/api/v1/provenance")
    assert r.status_code == 200
    ids = {layer["layer_id"] for layer in r.json()["layers"]}
    assert ids == EXPECTED_LAYER_IDS


def test_real_layers_are_real_status(client):
    r = client.get("/api/v1/provenance")
    by_id = {layer["layer_id"]: layer for layer in r.json()["layers"]}
    assert by_id["obs.argo"]["source"]["status"] == DataStatus.REAL_SOURCE_LOCALLY_CACHED.value
    assert (
        by_id["model.temperature"]["source"]["status"]
        == DataStatus.PRECOMPUTED_FROM_REAL_SOURCE.value
    )
    assert (
        by_id["model.currents"]["source"]["status"]
        == DataStatus.PRECOMPUTED_FROM_REAL_SOURCE.value
    )


def test_unsupported_layers_are_explicitly_unavailable(client):
    r = client.get("/api/v1/provenance")
    by_id = {layer["layer_id"]: layer for layer in r.json()["layers"]}
    for layer_id in ("obs.bgc",):
        assert by_id[layer_id]["source"]["status"] == DataStatus.NOT_AVAILABLE_MVP.value
    for layer_id in (
        "obs.glider",
        "obs.ctd",
        "satellite.sst",
        "satellite.chlorophyll",
        "context.coastline",
        "context.bathymetry",
        "advisory.incois",
        "ml.anomaly",
    ):
        assert by_id[layer_id]["source"]["status"] == DataStatus.PLANNED_EXTENSION.value


def test_no_layer_claims_synthetic_status(client):
    r = client.get("/api/v1/provenance")
    statuses = {layer["source"]["status"] for layer in r.json()["layers"]}
    assert DataStatus.SYNTHETIC_TEST_FIXTURE.value not in statuses


def test_real_sources_carry_url_and_checksum(client):
    r = client.get("/api/v1/provenance")
    by_id = {layer["layer_id"]: layer for layer in r.json()["layers"]}
    argo = by_id["obs.argo"]["source"]
    assert argo["url"]
    assert argo["retrieved_at"]
    assert argo["checksum"]
    assert argo["transformations"]


def test_derived_layer_is_derived_not_precomputed(client):
    r = client.get("/api/v1/provenance")
    by_id = {layer["layer_id"]: layer for layer in r.json()["layers"]}
    assert (
        by_id["derived.isosurface"]["source"]["status"]
        == DataStatus.DERIVED_FROM_REAL_SOURCE.value
    )
