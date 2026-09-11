from __future__ import annotations

from pydantic import BaseModel

from app.models.provenance import SourceDescriptor


class PlatformIdentity(BaseModel):
    wmo: str
    data_centre: str
    cycle_number: int
    data_mode: str | None
    project_name: str | None
    principal_investigator: str | None
    positioning_system: str | None
    instrument_type: str | None
    position_qc: str | None
    profile_temperature_qc_letter: str | None = None
    profile_salinity_qc_letter: str | None = None
    used_adjusted_fields: bool = False


class ObservationSummary(BaseModel):
    """One row in the observations list — cheap to compute, no level arrays."""

    id: str
    platform_type: str
    platform_name: str
    latitude: float
    longitude: float
    observed_at: str
    qc: str
    level_count: int
    identity: PlatformIdentity


class ObservationsListResponse(BaseModel):
    observations: list[ObservationSummary]
    total: int
    filters_applied: dict[str, object]
    source: SourceDescriptor


class ObservationLevel(BaseModel):
    depth_m: float
    value: float | None
    qc: str | None


class ProfileResponse(BaseModel):
    observation_id: str
    variable: str
    unit: str
    platform_type: str
    platform_name: str
    latitude: float
    longitude: float
    observed_at: str
    qc: str
    levels: list[ObservationLevel]
    identity: PlatformIdentity
    source: SourceDescriptor
