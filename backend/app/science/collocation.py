"""Orchestrates a full model-vs-observation collocation from cached arrays.

Pure computation: given a profile dict and a model-column dict (both already
loaded from the cache — see app.data.cache_reader), produce every statistic
the API needs. Nothing here is hard-coded; every number is derived from the
arrays passed in.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from app.science.geometry import GeoPoint, haversine_km, nearest_timestamp_index
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
}

# Collocation requires a real per-level *observed* value to compare against
# the model. Argo floats in this cache carry no current or chlorophyll-a
# sensor, so there is no honest observed side for those two variables —
# they are deliberately absent from _VARIABLE_META, not just "not yet
# implemented". Backend hardening fix (see CLAUDE.md): "currentSpeed" used
# to have a _VARIABLE_META entry (implying it was fully supported) while the
# observed-value lookup below silently used the profile's TEMPERATURE array
# for any variable other than "salinity" — comparing HYCOM current speed
# against Argo temperature with no error at all. Deriving the supported set
# from _VARIABLE_META's own keys makes "has a meta entry" and "has a real
# observed-side implementation" the same set by construction, so they can't
# drift apart silently again.
_SUPPORTED_VARIABLES = frozenset(_VARIABLE_META)


class UnsupportedCollocationVariableError(Exception):
    """Raised when collocation is requested for a variable with no real
    per-level Argo observation to compare against — an explicit, honest
    "not available" rather than a silent wrong-variable comparison or an
    unhandled KeyError."""

    def __init__(self, variable: str) -> None:
        self.variable = variable
        super().__init__(
            f"Collocation is not available for '{variable}': Argo profiles in this "
            "cache carry no per-level observation for it, so no honest "
            "observed-vs-modelled comparison can be computed."
        )


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
    # currentSpeed's real MODEL-side data (HYCOM u/v) does exist and this
    # branch reads it correctly — it is unreachable from compute_collocation
    # today only because there is no real OBSERVED-side current for it to be
    # paired against (see _SUPPORTED_VARIABLES above). Kept, not deleted, in
    # case a genuine current-observation source (e.g. an ADCP glider) is
    # added later — that would only need _VARIABLE_META extended, not this.
    if variable == "currentSpeed":
        u, v = slot["currentU"], slot["currentV"]
        return [
            None if (ui is None or vi is None) else math.sqrt(ui * ui + vi * vi)
            for ui, vi in zip(u, v)
        ]
    return [None for _ in slot.get("temperature", [])]


def compute_collocation(
    *,
    profile: dict,
    column: dict,
    variable: str,
    model_source: str,
    requested_timestamp: str | None = None,
) -> CollocationOutcome:
    if variable not in _SUPPORTED_VARIABLES:
        raise UnsupportedCollocationVariableError(variable)
    meta = _VARIABLE_META[variable]
    by_ts = {slot["timestamp"]: slot for slot in column["byTimestamp"]}
    all_ts = list(by_ts.keys())
    model_timestamp = (
        requested_timestamp
        if requested_timestamp in by_ts
        else all_ts[nearest_timestamp_index(all_ts, profile["observedAt"])]
    )
    slot = by_ts[model_timestamp]

    # variable is "temperature" or "salinity" here — guaranteed by the
    # _SUPPORTED_VARIABLES check above, so this is no longer a silent
    # fallback for anything else (see _SUPPORTED_VARIABLES's comment).
    obs_values = profile["salinity"] if variable == "salinity" else profile["temperature"]
    obs_qc = profile["salinityQc"] if variable == "salinity" else profile["temperatureQc"]

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
