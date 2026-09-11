from __future__ import annotations

import math

from app.data.cache_reader import RealDataCache
from app.models.responses import BandAgreementModel, CollocationResponse
from app.science.collocation import compute_collocation
from app.services.provenance_service import source_descriptor

# Only variables compute_collocation() actually supports (temperature,
# salinity) — currentSpeed was removed here to match its removal from
# app.science.collocation._VARIABLE_META; a request for it now fails
# through UnsupportedCollocationVariableError before this dict is ever
# consulted, not through a leftover unit entry implying it works.
_UNITS = {"temperature": "°C", "salinity": "PSU"}


class ObservationNotFoundError(Exception):
    pass


class NoModelColumnError(Exception):
    """A real observation with no extracted model column — should not happen
    for anything in the cache, but handled explicitly rather than assumed."""


def _round_or_none(value: float, digits: int = 4) -> float | None:
    """JSON has no NaN. A statistic that could not be computed (e.g. zero
    overlapping levels in a band) must serialise as null, never as a
    fabricated number and never as an invalid JSON document."""
    if value is None or not math.isfinite(value):
        return None
    return round(value, digits)


def get_collocation(
    cache: RealDataCache, *, observation_id: str, variable: str, timestamp: str | None = None
) -> CollocationResponse:
    profile = cache.profiles_by_id.get(observation_id)
    if profile is None:
        raise ObservationNotFoundError(observation_id)
    column = cache.columns_by_observation.get(observation_id)
    if column is None:
        raise NoModelColumnError(observation_id)

    outcome = compute_collocation(
        profile=profile,
        column=column,
        variable=variable,
        model_source="HYCOM GOFS 3.1 (GLBy0.08 expt_93.0)",
        requested_timestamp=timestamp,
    )

    return CollocationResponse(
        observation_id=observation_id,
        variable=variable,
        unit=_UNITS.get(variable, ""),
        model_source=outcome.model_source,
        observation_source="Argo GDAC",
        model_timestamp=outcome.model_timestamp,
        observation_timestamp=profile["observedAt"],
        horizontal_distance_km=round(outcome.horizontal_distance_km, 3),
        time_offset_hours=round(outcome.time_offset_hours, 3),
        rmse=_round_or_none(outcome.rmse),
        mean_bias=_round_or_none(outcome.mean_bias),
        depths_m=outcome.depths_m,
        observed_values=outcome.observed_values,
        modeled_values=[round(v, 4) for v in outcome.modeled_values],
        sample_count=outcome.sample_count,
        bands=[
            BandAgreementModel(
                from_m=b.from_m,
                to_m=b.to_m,
                mean_delta=_round_or_none(b.mean_delta),
                rmse=_round_or_none(b.rmse),
                sample_count=b.sample_count,
                verdict=b.verdict,
            )
            for b in outcome.bands
        ],
        interpretation=outcome.interpretation,
        source=source_descriptor(cache, "argo.incois"),
    )
