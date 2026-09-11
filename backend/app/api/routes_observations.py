from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.data.cache_reader import get_cache
from app.models.observations import ObservationsListResponse, ObservationSummary
from app.models.queries import PlatformType, QualityFlag
from app.services.observation_service import get_observation_summary, list_observations

router = APIRouter(prefix="/api/v1", tags=["observations"])


@router.get("/observations", response_model=ObservationsListResponse)
def observations(
    platform_type: list[PlatformType] | None = Query(None),
    dac: list[str] | None = Query(None, description="Argo DATA_CENTRE code, e.g. IN, HZ"),
    qc: QualityFlag | None = Query(None),
    from_time: str | None = Query(None),
    to_time: str | None = Query(None),
    min_lat: float | None = Query(None),
    max_lat: float | None = Query(None),
    min_lon: float | None = Query(None),
    max_lon: float | None = Query(None),
    collocated_only: bool = Query(False),
) -> ObservationsListResponse:
    return list_observations(
        get_cache(),
        platform_types=[p.value for p in platform_type] if platform_type else None,
        data_centres=dac,
        qc=qc.value if qc else None,
        from_time=from_time,
        to_time=to_time,
        min_lat=min_lat,
        max_lat=max_lat,
        min_lon=min_lon,
        max_lon=max_lon,
        collocated_only=collocated_only,
    )


@router.get("/observations/{observation_id}", response_model=ObservationSummary)
def observation_by_id(observation_id: str) -> ObservationSummary:
    result = get_observation_summary(get_cache(), observation_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"observation '{observation_id}' not found")
    return result
