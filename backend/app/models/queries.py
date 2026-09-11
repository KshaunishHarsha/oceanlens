"""Shared enums and query-shape models used by route parameter validation."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel


class OceanVariable(str, Enum):
    temperature = "temperature"
    salinity = "salinity"
    currentSpeed = "currentSpeed"
    chlorophyll = "chlorophyll"


class PlatformType(str, Enum):
    ARGO = "ARGO"
    GLIDER = "GLIDER"
    CTD = "CTD"
    BGC = "BGC"


class QualityFlag(str, Enum):
    GOOD = "GOOD"
    PROBABLY_GOOD = "PROBABLY_GOOD"
    SUSPECT = "SUSPECT"
    BAD = "BAD"


class ObservationFilters(BaseModel):
    platform_types: list[PlatformType] | None = None
    data_centres: list[str] | None = None
    qc: QualityFlag | None = None
    from_time: str | None = None
    to_time: str | None = None
    min_lat: float | None = None
    max_lat: float | None = None
    min_lon: float | None = None
    max_lon: float | None = None
    collocated_only: bool = False
