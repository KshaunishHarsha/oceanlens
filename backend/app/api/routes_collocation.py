from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.data.cache_reader import get_cache
from app.models.queries import OceanVariable
from app.models.responses import CollocationResponse
from app.services.collocation_service import (
    NoModelColumnError,
    ObservationNotFoundError,
    get_collocation,
)

router = APIRouter(prefix="/api/v1", tags=["collocation"])


@router.get("/collocation/{observation_id}", response_model=CollocationResponse)
def collocation(
    observation_id: str,
    variable: OceanVariable = Query(OceanVariable.temperature),
    timestamp: str | None = Query(None),
) -> CollocationResponse:
    try:
        return get_collocation(
            get_cache(), observation_id=observation_id, variable=variable.value, timestamp=timestamp
        )
    except ObservationNotFoundError as e:
        raise HTTPException(status_code=404, detail=f"observation '{observation_id}' not found") from e
    except NoModelColumnError as e:
        raise HTTPException(
            status_code=404,
            detail=f"no model column was extracted for observation '{observation_id}'",
        ) from e
