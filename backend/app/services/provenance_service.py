"""Builds SourceDescriptor / LayerProvenance from the cache manifest.

The manifest (written by scripts/prepare-real-data.mjs) stores its statuses in
the *frontend's* historical vocabulary (REAL_CACHED, PRECOMPUTED_FROM_REAL,
...). The API presents its own vocabulary (app.models.provenance.DataStatus).
This module is the one place that translates manifest status -> API status;
`src/data/ApiOceanDataAdapter.ts` does the second half of the round trip,
API status -> frontend `DataStatus`.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.data.cache_reader import RealDataCache
from app.models.provenance import (
    DataStatus,
    LayerProvenance,
    ProvenanceResponse,
    SourceDescriptor,
)

# manifest.json status string -> API DataStatus
_MANIFEST_STATUS_MAP: dict[str, DataStatus] = {
    "REAL_CACHED": DataStatus.REAL_SOURCE_LOCALLY_CACHED,
    "PRECOMPUTED_FROM_REAL": DataStatus.PRECOMPUTED_FROM_REAL_SOURCE,
    "DERIVED_FROM_REAL": DataStatus.DERIVED_FROM_REAL_SOURCE,
    "SYNTHETIC_FIXTURE": DataStatus.SYNTHETIC_TEST_FIXTURE,
    "NOT_AVAILABLE_MVP": DataStatus.NOT_AVAILABLE_MVP,
    "PLANNED_EXTENSION": DataStatus.PLANNED_EXTENSION,
}


def _manifest_source_to_descriptor(raw: dict) -> SourceDescriptor:
    status = _MANIFEST_STATUS_MAP.get(raw.get("status", ""), DataStatus.NOT_AVAILABLE_MVP)
    temporal = raw.get("temporal") or {}
    depth = raw.get("depth") or {}
    spatial = raw.get("spatial") or {}
    checksums = raw.get("checksums") or {}
    checksum = next(iter(checksums.values()), None) if checksums else None
    return SourceDescriptor(
        name=raw.get("datasetName", raw.get("id", "unknown")),
        status=status,
        url=raw.get("sourceUrl"),
        retrieved_at=raw.get("retrievedAt"),
        checksum=checksum,
        notes="; ".join(raw.get("caveats", [])) or None,
        originator=raw.get("originator"),
        source_files=raw.get("sourceFiles", []),
        variables=raw.get("sourceVariables", []),
        units=raw.get("sourceUnits", {}),
        coordinate_system=raw.get("coordinateSystem"),
        temporal_start=temporal.get("start"),
        temporal_end=temporal.get("end"),
        temporal_cadence=temporal.get("cadence"),
        depth_min_m=depth.get("minM"),
        depth_max_m=depth.get("maxM"),
        spatial_bounds=(
            {
                "minLat": spatial.get("minLat"),
                "maxLat": spatial.get("maxLat"),
                "minLon": spatial.get("minLon"),
                "maxLon": spatial.get("maxLon"),
            }
            if spatial
            else None
        ),
        qc_convention=raw.get("qcConvention"),
        transformations=raw.get("transformations", []),
        licence=raw.get("licence"),
        caveats=raw.get("caveats", []),
    )


def source_descriptor(cache: RealDataCache, source_id: str) -> SourceDescriptor:
    raw = cache.source(source_id)
    if raw is None:
        return SourceDescriptor(
            name=source_id,
            status=DataStatus.NOT_AVAILABLE_MVP,
            notes="No manifest entry for this source.",
        )
    return _manifest_source_to_descriptor(raw)


def _unavailable(name: str, status: DataStatus, note: str) -> SourceDescriptor:
    return SourceDescriptor(name=name, status=status, notes=note)


# The complete layer catalog. Every layer the product could ever show is
# listed here — availability comes from the cache, not from this list being
# edited to hide something.
def build_layer_registry(cache: RealDataCache) -> list[LayerProvenance]:
    argo = source_descriptor(cache, "argo.incois")
    hycom_ts = source_descriptor(cache, "hycom.ts")
    hycom_uv = source_descriptor(cache, "hycom.uv")

    derived_isosurface = hycom_ts.model_copy(
        update={
            "name": "Isosurface derived from HYCOM temperature",
            "status": (
                DataStatus.DERIVED_FROM_REAL_SOURCE
                if hycom_ts.status == DataStatus.PRECOMPUTED_FROM_REAL_SOURCE
                else DataStatus.NOT_AVAILABLE_MVP
            ),
            "transformations": [
                "Marching-squares contour of the cached model field, computed per request."
            ],
        }
    )

    layers = [
        LayerProvenance(
            layer_id="model.temperature",
            label="Model temperature",
            kind="MODEL_VOLUME",
            variable="temperature",
            collocatable=True,
            source=hycom_ts,
        ),
        LayerProvenance(
            layer_id="model.salinity",
            label="Model salinity",
            kind="MODEL_VOLUME",
            variable="salinity",
            collocatable=True,
            source=hycom_ts,
        ),
        LayerProvenance(
            layer_id="model.currents",
            label="Model currents",
            kind="VECTOR_FIELD",
            variable="currentSpeed",
            collocatable=True,
            source=hycom_uv
            if cache.has_currents
            else _unavailable(
                "HYCOM u/v currents", DataStatus.NOT_AVAILABLE_MVP, "uv3z subset not in cache"
            ),
        ),
        LayerProvenance(
            layer_id="obs.argo",
            label="Argo profiles",
            kind="OBSERVATION_PROFILE",
            platform_type="ARGO",
            collocatable=True,
            source=argo,
        ),
        LayerProvenance(
            layer_id="obs.bgc",
            label="BGC floats",
            kind="OBSERVATION_PROFILE",
            platform_type="BGC",
            collocatable=True,
            source=_unavailable(
                "BGC-Argo profiles",
                DataStatus.NOT_AVAILABLE_MVP,
                "No BGC float in the demo window and region carried usable co-located levels.",
            ),
        ),
        LayerProvenance(
            layer_id="obs.glider",
            label="Gliders",
            kind="OBSERVATION_PROFILE",
            platform_type="GLIDER",
            collocatable=True,
            source=_unavailable(
                "Glider sections",
                DataStatus.PLANNED_EXTENSION,
                "No open real glider section identified for this region and window.",
            ),
        ),
        LayerProvenance(
            layer_id="obs.ctd",
            label="CTD casts",
            kind="OBSERVATION_PROFILE",
            platform_type="CTD",
            collocatable=True,
            source=_unavailable(
                "CTD casts",
                DataStatus.PLANNED_EXTENSION,
                "No open real CTD cast identified for this region and window.",
            ),
        ),
        LayerProvenance(
            layer_id="satellite.sst",
            label="Satellite SST",
            kind="SURFACE_RASTER",
            variable="temperature",
            collocatable=False,
            source=_unavailable(
                "Satellite SST",
                DataStatus.PLANNED_EXTENSION,
                "Real L4 SST (e.g. GHRSST) is obtainable but not yet prepared into the cache.",
            ),
        ),
        LayerProvenance(
            layer_id="satellite.chlorophyll",
            label="Satellite chlorophyll",
            kind="SURFACE_RASTER",
            variable="chlorophyll",
            collocatable=False,
            source=_unavailable(
                "Satellite chlorophyll-a",
                DataStatus.PLANNED_EXTENSION,
                "Real ocean-colour products exist but are not yet prepared into the cache.",
            ),
        ),
        LayerProvenance(
            layer_id="derived.isosurface",
            label="Isosurface",
            kind="DERIVED_CONTOUR",
            collocatable=False,
            source=derived_isosurface,
        ),
        LayerProvenance(
            layer_id="context.coastline",
            label="Coastline",
            kind="GEOGRAPHIC_CONTEXT",
            collocatable=False,
            source=_unavailable(
                "Coastline (Natural Earth)",
                DataStatus.PLANNED_EXTENSION,
                "Vendored with the frontend scene, out of scope for this backend phase.",
            ),
        ),
        LayerProvenance(
            layer_id="context.bathymetry",
            label="Bathymetry / EEZ",
            kind="GEOGRAPHIC_CONTEXT",
            collocatable=False,
            source=_unavailable(
                "Bathymetry / EEZ",
                DataStatus.PLANNED_EXTENSION,
                "Derived generalisation added with the frontend scene; not GEBCO.",
            ),
        ),
        LayerProvenance(
            layer_id="advisory.incois",
            label="Advisories",
            kind="ADVISORY",
            collocatable=False,
            source=_unavailable(
                "INCOIS advisories",
                DataStatus.PLANNED_EXTENSION,
                "No stable public advisory feed integrated in the MVP.",
            ),
        ),
        LayerProvenance(
            layer_id="ml.anomaly",
            label="ML anomaly",
            kind="ML_DERIVED",
            collocatable=False,
            source=_unavailable(
                "ML anomaly layer",
                DataStatus.PLANNED_EXTENSION,
                "No trained model; future extension only.",
            ),
        ),
    ]
    return layers


def build_provenance_response(cache: RealDataCache) -> ProvenanceResponse:
    return ProvenanceResponse(
        layers=build_layer_registry(cache),
        generated_at=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        cache_id=cache.cache_id,
    )
