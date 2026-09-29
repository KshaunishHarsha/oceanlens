from __future__ import annotations

from datetime import datetime

from app.data.cache_reader import RealDataCache
from app.models.observations import (
    ObservationLevel,
    ObservationsListResponse,
    ObservationSummary,
    PlatformIdentity,
    ProfileResponse,
)
from app.services.provenance_service import source_descriptor


from app.errors import InvalidDateError


def _to_identity(raw: dict) -> PlatformIdentity:
    ident = raw["identity"]
    return PlatformIdentity(
        wmo=ident["wmo"],
        data_centre=ident["dataCentre"],
        cycle_number=ident["cycleNumber"],
        data_mode=ident.get("dataMode"),
        project_name=ident.get("projectName"),
        principal_investigator=ident.get("principalInvestigator"),
        positioning_system=ident.get("positioningSystem"),
        instrument_type=ident.get("instrumentType"),
        position_qc=ident.get("positionQc"),
        profile_temperature_qc_letter=ident.get("profileTempQcLetter"),
        profile_salinity_qc_letter=ident.get("profilePsalQcLetter"),
        used_adjusted_fields=bool(ident.get("usedAdjustedFields", False)),
    )


def _parse_iso(s: str, field_name: str = "date") -> datetime:
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except (ValueError, TypeError, AttributeError) as e:
        raise InvalidDateError(
            f"invalid date format for {field_name}: '{s}'. Expected ISO 8601 string (e.g. 2023-09-25T00:00:00Z)"
        ) from e


def list_observations(
    cache: RealDataCache,
    *,
    platform_types: list[str] | None = None,
    data_centres: list[str] | None = None,
    qc: str | None = None,
    from_time: str | None = None,
    to_time: str | None = None,
    min_lat: float | None = None,
    max_lat: float | None = None,
    min_lon: float | None = None,
    max_lon: float | None = None,
    collocated_only: bool = False,
) -> ObservationsListResponse:
    from_dt = _parse_iso(from_time, "from_time") if from_time else None
    to_dt = _parse_iso(to_time, "to_time") if to_time else None

    def keep(raw: dict) -> bool:
        if platform_types and raw["platformType"] not in platform_types:
            return False
        if data_centres and raw["identity"]["dataCentre"] not in data_centres:
            return False
        if qc and raw["qc"] != qc:
            return False
        if min_lat is not None and raw["latitude"] < min_lat:
            return False
        if max_lat is not None and raw["latitude"] > max_lat:
            return False
        if min_lon is not None and raw["longitude"] < min_lon:
            return False
        if max_lon is not None and raw["longitude"] > max_lon:
            return False
        t = _parse_iso(raw["observedAt"])
        if from_dt and t < from_dt:
            return False
        if to_dt and t > to_dt:
            return False
        if collocated_only and raw["id"] not in cache.columns_by_observation:
            return False
        return True

    kept = [p for p in cache.profiles if keep(p)]
    summaries = [
        ObservationSummary(
            id=p["id"],
            platform_type=p["platformType"],
            platform_name=p["platformName"],
            latitude=p["latitude"],
            longitude=p["longitude"],
            observed_at=p["observedAt"],
            qc=p["qc"],
            level_count=len(p["depthsM"]),
            identity=_to_identity(p),
        )
        for p in kept
    ]
    return ObservationsListResponse(
        observations=summaries,
        total=len(summaries),
        filters_applied={
            "platform_types": platform_types,
            "data_centres": data_centres,
            "qc": qc,
            "from_time": from_time,
            "to_time": to_time,
            "bbox": [min_lat, max_lat, min_lon, max_lon]
            if None not in (min_lat, max_lat, min_lon, max_lon)
            else None,
            "collocated_only": collocated_only,
        },
        source=source_descriptor(cache, "argo.incois"),
    )


def get_observation_summary(cache: RealDataCache, observation_id: str) -> ObservationSummary | None:
    raw = cache.profiles_by_id.get(observation_id)
    if raw is None:
        return None
    return ObservationSummary(
        id=raw["id"],
        platform_type=raw["platformType"],
        platform_name=raw["platformName"],
        latitude=raw["latitude"],
        longitude=raw["longitude"],
        observed_at=raw["observedAt"],
        qc=raw["qc"],
        level_count=len(raw["depthsM"]),
        identity=_to_identity(raw),
    )


def get_profile(cache: RealDataCache, observation_id: str, variable: str) -> ProfileResponse | None:
    raw = cache.profiles_by_id.get(observation_id)
    if raw is None:
        return None
    if variable == "temperature":
        values, qcs, unit = raw["temperature"], raw["temperatureQc"], "°C"
    elif variable == "salinity":
        values, qcs, unit = raw["salinity"], raw["salinityQc"], "PSU"
    else:
        values, qcs, unit = [None] * len(raw["depthsM"]), [None] * len(raw["depthsM"]), ""

    levels = [
        ObservationLevel(depth_m=d, value=v, qc=q)
        for d, v, q in zip(raw["depthsM"], values, qcs)
    ]

    return ProfileResponse(
        observation_id=raw["id"],
        variable=variable,
        unit=unit,
        platform_type=raw["platformType"],
        platform_name=raw["platformName"],
        latitude=raw["latitude"],
        longitude=raw["longitude"],
        observed_at=raw["observedAt"],
        qc=raw["qc"],
        levels=levels,
        identity=_to_identity(raw),
        source=source_descriptor(cache, "argo.incois"),
    )
