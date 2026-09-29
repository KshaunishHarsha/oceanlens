"""Slicing helpers over the cache's in-memory numpy arrays.

Pure array operations only — no I/O, no science-vocabulary decisions. Used by
app.services.slice_service.
"""

from __future__ import annotations

import math

import numpy as np

from app.data.cache_reader import RealDataCache
from app.science.geometry import nearest_index, nearest_timestamp_index

VARIABLE_TO_SLICE_KEY: dict[str, str | None] = {
    "temperature": "temperature",
    "salinity": "salinity",
    "currentSpeed": None,  # derived from currentU/currentV
    "chlorophyll": None,  # not in the cache
}


def variable_available(cache: RealDataCache, variable: str) -> bool:
    if variable == "currentSpeed":
        return cache.has_currents
    key = VARIABLE_TO_SLICE_KEY.get(variable)
    return key is not None and key in cache.slices


def horizontal_slice(
    cache: RealDataCache, *, variable: str, timestamp: str, depth_m: float
) -> tuple[np.ndarray, str, float]:
    """Returns (values[ny,nx] with NaN for missing, actual timestamp used,
    actual nearest depth used)."""
    grid = cache.grid
    if timestamp in grid.timestamps:
        ti = grid.timestamps.index(timestamp)
    else:
        epochs = [_iso_to_epoch(t) for t in grid.timestamps]
        ti = nearest_index(epochs, _iso_to_epoch(timestamp))
    zi = nearest_index(list(grid.depths_m), depth_m)

    if variable == "currentSpeed":
        if not cache.has_currents:
            raise KeyError("currentSpeed slice unavailable: no cached u/v")
        u = cache.slices["currentU"][ti, zi]
        v = cache.slices["currentV"][ti, zi]
        values = np.sqrt(u.astype(np.float64) ** 2 + v.astype(np.float64) ** 2)
    else:
        key = VARIABLE_TO_SLICE_KEY.get(variable)
        if key is None or key not in cache.slices:
            raise KeyError(f"{variable} slice unavailable")
        values = cache.slices[key][ti, zi].astype(np.float64)

    return values, grid.timestamps[ti], float(grid.depths_m[zi])


def _iso_to_epoch(iso: str) -> float:
    from datetime import datetime
    from app.errors import InvalidDateError

    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp()
    except (ValueError, TypeError, AttributeError) as e:
        raise InvalidDateError(
            f"invalid date format: '{iso}'. Expected ISO 8601 string (e.g. 2023-09-25T00:00:00Z)"
        ) from e


def bilinear_column(
    cache: RealDataCache, *, variable: str, timestamp: str, latitude: float, longitude: float
) -> tuple[list[float], list[float | None], str]:
    """Nearest-node column (not true bilinear — matches the frontend's
    fallback path, which also snaps to nearest grid cell) at an arbitrary
    position, sampled at every cached slice depth.

    Returns (depths, values, actual_timestamp_used). The actual timestamp is
    always the real one the data was read from — previously this function
    fell back to the *first* cached timestamp (index 0) for any inexact
    request, and the caller (slice_service.get_model_column) separately and
    independently recomputed its own "actual timestamp" for the response,
    which could silently disagree with what was actually read. Returning it
    from here removes that duplication and the bug in one move: there is now
    exactly one place that decides which timestamp was used, and the
    reported value can never drift from the real one."""
    grid = cache.grid
    if timestamp in grid.timestamps:
        ti = grid.timestamps.index(timestamp)
    else:
        ti = nearest_timestamp_index(grid.timestamps, timestamp)
    actual_timestamp = grid.timestamps[ti]
    yi = nearest_index(list(grid.latitudes), latitude)
    xi = nearest_index(list(grid.longitudes), longitude)

    depths = list(grid.depths_m)
    values: list[float | None] = []
    for zi in range(len(depths)):
        if variable == "currentSpeed":
            if not cache.has_currents:
                values.append(None)
                continue
            u = float(cache.slices["currentU"][ti, zi, yi, xi])
            v = float(cache.slices["currentV"][ti, zi, yi, xi])
            val = math.sqrt(u * u + v * v) if math.isfinite(u) and math.isfinite(v) else None
        else:
            key = VARIABLE_TO_SLICE_KEY.get(variable)
            if key is None or key not in cache.slices:
                values.append(None)
                continue
            v = float(cache.slices[key][ti, zi, yi, xi])
            val = v if math.isfinite(v) else None
        values.append(val)
    return depths, values, actual_timestamp
