from __future__ import annotations

from pydantic import BaseModel

from app.models.provenance import SourceDescriptor


class VariableMetadata(BaseModel):
    key: str
    standard_name: str | None
    unit: str
    available: bool
    source: SourceDescriptor


class PlatformMetadata(BaseModel):
    key: str
    label: str
    available: bool
    count: int


class DatasetMetadata(BaseModel):
    dataset_id: str
    title: str
    region: dict[str, float]
    region_name: str
    timestamps: list[str]
    depths_m: list[float]
    variables: list[VariableMetadata]
    platforms: list[PlatformMetadata]
    observation_count: int
    historical_window: bool
    window_label: str
    view_id: str
    source: SourceDescriptor


class TimesResponse(BaseModel):
    variable: str
    available: bool
    timestamps: list[str]
    reason: str | None = None
