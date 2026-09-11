from __future__ import annotations

import math

from app.data.array_loader import bilinear_column, horizontal_slice, variable_available
from app.data.cache_reader import RealDataCache
from app.models.responses import ModelColumnResponse, SliceResponse
from app.services.provenance_service import source_descriptor

_UNITS = {"temperature": "°C", "salinity": "PSU", "currentSpeed": "m/s", "chlorophyll": "mg/m³"}


class VariableUnavailableError(Exception):
    def __init__(self, variable: str) -> None:
        self.variable = variable
        super().__init__(f"No real cached source exists for variable '{variable}'.")


class OutOfRegionError(Exception):
    def __init__(self, latitude: float, longitude: float) -> None:
        self.latitude = latitude
        self.longitude = longitude
        super().__init__(f"({latitude}, {longitude}) is outside the cached region.")


def get_slice(
    cache: RealDataCache, *, variable: str, timestamp: str, depth_m: float
) -> SliceResponse:
    if not variable_available(cache, variable):
        raise VariableUnavailableError(variable)

    values, actual_ts, actual_depth = horizontal_slice(
        cache, variable=variable, timestamp=timestamp, depth_m=depth_m
    )
    grid_values: list[list[float | None]] = [
        [None if not math.isfinite(v) else round(float(v), 4) for v in row] for row in values
    ]
    source = source_descriptor(cache, "hycom.uv" if variable == "currentSpeed" else "hycom.ts")

    return SliceResponse(
        variable=variable,
        unit=_UNITS[variable],
        requested_timestamp=timestamp,
        actual_timestamp=actual_ts,
        requested_depth_m=depth_m,
        actual_depth_m=actual_depth,
        latitudes=list(cache.grid.latitudes),
        longitudes=list(cache.grid.longitudes),
        values=grid_values,
        resolution={
            "nx": cache.grid.shape.nx,
            "ny": cache.grid.shape.ny,
        },
        decimation={"horizontal_stride": 3},
        source=source,
    )


def get_model_column(
    cache: RealDataCache, *, variable: str, timestamp: str, latitude: float, longitude: float
) -> ModelColumnResponse:
    if not variable_available(cache, variable):
        raise VariableUnavailableError(variable)
    bounds = cache.manifest.get("region", {})
    if bounds and not (
        bounds.get("minLat", -90) <= latitude <= bounds.get("maxLat", 90)
        and bounds.get("minLon", -180) <= longitude <= bounds.get("maxLon", 180)
    ):
        raise OutOfRegionError(latitude, longitude)

    depths, values = bilinear_column(
        cache, variable=variable, timestamp=timestamp, latitude=latitude, longitude=longitude
    )
    actual_ts = timestamp if timestamp in cache.grid.timestamps else cache.grid.timestamps[0]
    from app.science.geometry import nearest_index

    yi = nearest_index(list(cache.grid.latitudes), latitude)
    xi = nearest_index(list(cache.grid.longitudes), longitude)

    source = source_descriptor(cache, "hycom.uv" if variable == "currentSpeed" else "hycom.ts")
    return ModelColumnResponse(
        variable=variable,
        unit=_UNITS[variable],
        requested_timestamp=timestamp,
        actual_timestamp=actual_ts,
        requested_latitude=latitude,
        requested_longitude=longitude,
        grid_latitude=float(cache.grid.latitudes[yi]),
        grid_longitude=float(cache.grid.longitudes[xi]),
        depths_m=depths,
        values=[None if v is None else round(v, 4) for v in values],
        source=source,
    )
