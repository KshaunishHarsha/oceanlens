from __future__ import annotations

from pydantic import BaseModel

from app.models.provenance import DataStatus, SourceDescriptor


class HealthResponse(BaseModel):
    status: str
    service: str
    cache_loaded: bool
    cache_id: str | None = None


class UnavailableResponse(BaseModel):
    """Returned (with an appropriate HTTP status) for a variable, layer, or
    position the real cache genuinely does not cover. Never a substitute for
    a value we could have computed — only for one we could not."""

    available: bool = False
    status: DataStatus
    reason: str


class SliceResponse(BaseModel):
    variable: str
    unit: str
    requested_timestamp: str
    actual_timestamp: str
    requested_depth_m: float
    actual_depth_m: float
    latitudes: list[float]
    longitudes: list[float]
    values: list[list[float | None]]  # [lat][lon], null = missing/land
    resolution: dict[str, float]
    decimation: dict[str, int] | None
    source: SourceDescriptor


class ModelColumnResponse(BaseModel):
    variable: str
    unit: str
    requested_timestamp: str
    actual_timestamp: str
    requested_latitude: float
    requested_longitude: float
    grid_latitude: float
    grid_longitude: float
    depths_m: list[float]
    values: list[float | None]
    source: SourceDescriptor


class BandAgreementModel(BaseModel):
    from_m: float
    to_m: float
    mean_delta: float | None
    rmse: float | None
    sample_count: int
    verdict: str


class CollocationResponse(BaseModel):
    observation_id: str
    variable: str
    unit: str
    model_source: str
    observation_source: str
    model_timestamp: str
    observation_timestamp: str
    horizontal_distance_km: float
    time_offset_hours: float
    rmse: float | None
    mean_bias: float | None
    depths_m: list[float]
    observed_values: list[float]
    modeled_values: list[float]
    sample_count: int
    bands: list[BandAgreementModel]
    interpretation: str
    source: SourceDescriptor


class ApiError(BaseModel):
    error: str
    detail: str
    status_code: int
