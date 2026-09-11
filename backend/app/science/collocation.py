"""Orchestrates a full model-vs-observation collocation from cached arrays.

Pure computation: given a profile dict and a model-column dict (both already
loaded from the cache — see app.data.cache_reader), produce every statistic
the API needs. Nothing here is hard-coded; every number is derived from the
arrays passed in.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from app.science.geometry import GeoPoint, haversine_km
from app.science.interpolation import Level, interpolate_profile
from app.science.statistics import (
    BandAgreement,
    BandDefinition,
    build_scientific_interpretation,
    calculate_band_agreement,
    calculate_mean_bias,
    calculate_rmse,
    calculate_time_offset_hours,
    pair_finite,
)

# Depth bands used for the comparison tab. Matches the frontend's TypeScript
# adapter so a future UI wiring sees identical band boundaries.
DEFAULT_BANDS = [
    BandDefinition(0, 50),
    BandDefinition(50, 100),
    BandDefinition(100, 150),
    BandDefinition(150, 300),
    BandDefinition(300, 1000),
]

_VARIABLE_META = {
    "temperature": {
        "unit": "°C",
        "range": (16.0, 30.0),
        "bias_words": ("warmer", "cooler"),
        "structure": "thermocline",
    },
    "salinity": {
        "unit": "PSU",
        "range": (32.0, 35.5),
        "bias_words": ("saltier", "fresher"),
        "structure": "halocline",
    },
    "currentSpeed": {
        "unit": "m/s",
        "range": (0.0, 1.6),
        "bias_words": ("faster", "slower"),
        "structure": "jet core",
    },
}


@dataclass(frozen=True)
class CollocationOutcome:
    model_source: str
    model_timestamp: str
    horizontal_distance_km: float
    time_offset_hours: float
    rmse: float
    mean_bias: float
    depths_m: list[float]
    observed_values: list[float]
    modeled_values: list[float]
    sample_count: int
    bands: list[BandAgreement]
    interpretation: str


def _column_values(slot: dict, variable: str) -> list[float | None]:
    if variable == "temperature":
        return slot["temperature"]
    if variable == "salinity":
        return slot["salinity"]
    if variable == "currentSpeed":
        u, v = slot["currentU"], slot["currentV"]
        return [
            None if (ui is None or vi is None) else math.sqrt(ui * ui + vi * vi)
            for ui, vi in zip(u, v)
        ]
    return [None for _ in slot.get("temperature", [])]


def _nearest_timestamp(target_iso: str, timestamps: list[str]) -> str:
    from datetime import datetime

    t = datetime.fromisoformat(target_iso.replace("Z", "+00:00"))
    best, best_diff = timestamps[0], None
    for ts in timestamps:
        d = abs(
            (datetime.fromisoformat(ts.replace("Z", "+00:00")) - t).total_seconds()
        )
        if best_diff is None or d < best_diff:
            best, best_diff = ts, d
    return best


def compute_collocation(
    *,
    profile: dict,
    column: dict,
    variable: str,
    model_source: str,
    requested_timestamp: str | None = None,
) -> CollocationOutcome:
    meta = _VARIABLE_META[variable]
    by_ts = {slot["timestamp"]: slot for slot in column["byTimestamp"]}
    all_ts = list(by_ts.keys())
    model_timestamp = (
        requested_timestamp
        if requested_timestamp in by_ts
        else _nearest_timestamp(profile["observedAt"], all_ts)
    )
    slot = by_ts[model_timestamp]

    obs_values = (
        profile["salinity"] if variable == "salinity" else profile.get("temperature", [])
    )
    obs_qc = (
        profile["salinityQc"]
        if variable == "salinity"
        else profile.get("temperatureQc", [])
    )

    axis: list[float] = []
    obs_on_axis: list[float] = []
    for depth, value, flag in zip(profile["depthsM"], obs_values, obs_qc):
        if flag in ("GOOD", "PROBABLY_GOOD") and value is not None and math.isfinite(value):
            axis.append(depth)
            obs_on_axis.append(value)

    model_col_depths = column["depthsM"]
    model_col_values = _column_values(slot, variable)
    model_levels = [
        Level(depth_m=d, value=v)
        for d, v in zip(model_col_depths, model_col_values)
        if v is not None and math.isfinite(v)
    ]
    modeled_on_axis = interpolate_profile(model_levels, axis)

    pairs = pair_finite(axis, obs_on_axis, modeled_on_axis)
    obs = [p.observed for p in pairs]
    mod = [p.modeled for p in pairs]
    rmse = calculate_rmse(obs, mod)
    bias = calculate_mean_bias(obs, mod)

    tolerance = (meta["range"][1] - meta["range"][0]) / 14
    bands = calculate_band_agreement(pairs, DEFAULT_BANDS, tolerance)

    distance_km = haversine_km(
        GeoPoint(profile["latitude"], profile["longitude"]),
        GeoPoint(column["gridLatitude"], column["gridLongitude"]),
    )
    time_offset = calculate_time_offset_hours(profile["observedAt"], model_timestamp)

    interpretation = build_scientific_interpretation(
        unit=meta["unit"],
        bias_words=meta["bias_words"],
        structure_name=meta["structure"],
        overall_rmse=rmse,
        overall_bias=bias,
        bands=bands,
        sample_count=len(pairs),
    )

    return CollocationOutcome(
        model_source=model_source,
        model_timestamp=model_timestamp,
        horizontal_distance_km=distance_km,
        time_offset_hours=time_offset,
        rmse=rmse,
        mean_bias=bias,
        depths_m=[p.depth_m for p in pairs],
        observed_values=obs,
        modeled_values=mod,
        sample_count=len(pairs),
        bands=bands,
        interpretation=interpretation,
    )
