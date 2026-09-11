"""Provenance vocabulary and models — the API's own contract.

This is deliberately a different vocabulary from the frontend's internal
`DataStatus` (src/domain/provenance.ts). `src/data/ApiOceanDataAdapter.ts`
translates between the two; nothing here is renamed to match the frontend, and
nothing in the frontend is renamed to match this. See docs/data-contract.md.
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class DataStatus(str, Enum):
    REAL_SOURCE_LOCALLY_CACHED = "REAL_SOURCE_LOCALLY_CACHED"
    PRECOMPUTED_FROM_REAL_SOURCE = "PRECOMPUTED_FROM_REAL_SOURCE"
    DERIVED_FROM_REAL_SOURCE = "DERIVED_FROM_REAL_SOURCE"
    SYNTHETIC_TEST_FIXTURE = "SYNTHETIC_TEST_FIXTURE"
    NOT_AVAILABLE_MVP = "NOT_AVAILABLE_MVP"
    PLANNED_EXTENSION = "PLANNED_EXTENSION"


# Statuses that may back an active, renderable layer.
RENDERABLE_STATUSES = frozenset(
    {
        DataStatus.REAL_SOURCE_LOCALLY_CACHED,
        DataStatus.PRECOMPUTED_FROM_REAL_SOURCE,
        DataStatus.DERIVED_FROM_REAL_SOURCE,
        DataStatus.SYNTHETIC_TEST_FIXTURE,
    }
)


class SourceDescriptor(BaseModel):
    name: str
    status: DataStatus
    url: str | None = None
    retrieved_at: str | None = None
    checksum: str | None = None
    notes: str | None = None

    # Fields beyond the brief's minimal example, carried through because the
    # cache manifest already has them and dropping them would be a real loss
    # of provenance detail.
    originator: str | None = None
    source_files: list[str] = Field(default_factory=list)
    variables: list[str] = Field(default_factory=list)
    units: dict[str, str] = Field(default_factory=dict)
    coordinate_system: str | None = None
    temporal_start: str | None = None
    temporal_end: str | None = None
    temporal_cadence: str | None = None
    depth_min_m: float | None = None
    depth_max_m: float | None = None
    spatial_bounds: dict[str, float] | None = None
    qc_convention: str | None = None
    transformations: list[str] = Field(default_factory=list)
    licence: str | None = None
    caveats: list[str] = Field(default_factory=list)


class LayerProvenance(BaseModel):
    """One entry in the full layer registry — active or not."""

    layer_id: str
    label: str
    kind: str
    variable: str | None = None
    platform_type: str | None = None
    collocatable: bool = False
    source: SourceDescriptor


class ProvenanceResponse(BaseModel):
    layers: list[LayerProvenance]
    generated_at: str
    cache_id: str
