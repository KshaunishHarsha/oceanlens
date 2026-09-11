"""Slicing helpers over the cache's in-memory numpy arrays.

Pure array operations only — no I/O, no science-vocabulary decisions. Used by
app.services.slice_service.
"""

from __future__ import annotations

import math

import numpy as np

from app.data.cache_reader import RealDataCache
from app.science.geometry import nearest_index

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

    return datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp()


def bilinear_column(
    cache: RealDataCache, *, variable: str, timestamp: str, latitude: float, longitude: float
) -> tuple[list[float], list[float | None]]:
    """Nearest-node column (not true bilinear — matches the frontend's
    fallback path, which also snaps to nearest grid cell) at an arbitrary
    position, sampled at every cached slice depth."""
    grid = cache.grid
    ti = grid.timestamps.index(timestamp) if timestamp in grid.timestamps else 0
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
    return depths, values
