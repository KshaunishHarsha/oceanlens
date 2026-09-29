"""Geographic calculations. Mirrors src/domain/types.ts's haversineKm and
src/domain/stats.ts's nearestIndex / collocateObservationToModel."""

from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass(frozen=True)
class GeoPoint:
    latitude: float
    longitude: float


def haversine_km(a: GeoPoint, b: GeoPoint) -> float:
    r = 6371.0088
    d_lat = math.radians(b.latitude - a.latitude)
    d_lon = math.radians(b.longitude - a.longitude)
    la1 = math.radians(a.latitude)
    la2 = math.radians(b.latitude)
    h = math.sin(d_lat / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin(d_lon / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(h)))


def _iso_to_epoch(iso: str) -> float:
    from datetime import datetime
    from app.errors import InvalidDateError

    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp()
    except (ValueError, TypeError, AttributeError) as e:
        raise InvalidDateError(
            f"invalid date format: '{iso}'. Expected ISO 8601 string (e.g. 2023-09-25T00:00:00Z)"
        ) from e


def nearest_timestamp_index(timestamps: list[str], target_iso: str) -> int:
    """Index of the timestamp in `timestamps` closest to `target_iso` by
    absolute time difference. Returns -1 for an empty list — never a
    fabricated index.

    Backend hardening fix (see CLAUDE.md): two call sites used to fall back
    to index 0 (the *first* cached timestamp) whenever the requested
    timestamp wasn't an exact match, instead of snapping to the nearest one
    — a real, silent correctness bug for `/model-column`. This is now the
    one shared implementation both use.

    Deliberately a linear scan, not a binary search over `nearest_index`:
    this cache has at most a few dozen timestamps, so the performance
    difference is immaterial, and a linear scan needs no assumption that
    `timestamps` is sorted ascending (it always is here, but this function
    has no way to verify that of a caller, and getting it wrong would
    silently reintroduce a version of the same bug this fixes)."""
    if not timestamps:
        return -1
    target = _iso_to_epoch(target_iso)
    best_i = 0
    best_diff = abs(_iso_to_epoch(timestamps[0]) - target)
    for i in range(1, len(timestamps)):
        diff = abs(_iso_to_epoch(timestamps[i]) - target)
        if diff < best_diff:
            best_i, best_diff = i, diff
    return best_i


def nearest_index(axis: list[float], value: float) -> int:
    """Nearest index on an ascending axis, via binary search."""
    if not axis:
        return -1
    lo, hi = 0, len(axis) - 1
    if value <= axis[lo]:
        return lo
    if value >= axis[hi]:
        return hi
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if axis[mid] < value:
            lo = mid
        else:
            hi = mid
    return lo if (value - axis[lo]) <= (axis[hi] - value) else hi


@dataclass(frozen=True)
class GeoBounds:
    min_lat: float
    max_lat: float
    min_lon: float
    max_lon: float


@dataclass(frozen=True)
class CollocationGrid:
    latitudes: list[float]
    longitudes: list[float]
    bounds: GeoBounds


@dataclass(frozen=True)
class CollocationResultLite:
    grid_point: GeoPoint
    horizontal_distance_km: float
    lat_index: int
    lon_index: int
    within_grid: bool


def collocate_observation_to_model(
    observation: GeoPoint, grid: CollocationGrid
) -> CollocationResultLite:
    lat_index = nearest_index(grid.latitudes, observation.latitude)
    lon_index = nearest_index(grid.longitudes, observation.longitude)
    grid_point = GeoPoint(
        latitude=grid.latitudes[lat_index] if lat_index >= 0 else float("nan"),
        longitude=grid.longitudes[lon_index] if lon_index >= 0 else float("nan"),
    )
    within_grid = (
        grid.bounds.min_lat <= observation.latitude <= grid.bounds.max_lat
        and grid.bounds.min_lon <= observation.longitude <= grid.bounds.max_lon
    )
    return CollocationResultLite(
        grid_point=grid_point,
        horizontal_distance_km=haversine_km(observation, grid_point),
        lat_index=lat_index,
        lon_index=lon_index,
        within_grid=within_grid,
    )
