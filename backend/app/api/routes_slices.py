from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.data.cache_reader import get_cache
from app.errors import InvalidDateError
from app.models.queries import OceanVariable
from app.models.responses import ModelColumnResponse, SliceResponse
from app.services.slice_service import (
    OutOfRegionError,
    VariableUnavailableError,
    get_model_column,
    get_slice,
)

router = APIRouter(prefix="/api/v1", tags=["slices"])


@router.get("/slice", response_model=SliceResponse)
def slice_route(
    variable: OceanVariable = Query(...),
    timestamp: str = Query(...),
    depth_m: float = Query(..., alias="depth_m"),
) -> SliceResponse:
    try:
        return get_slice(get_cache(), variable=variable.value, timestamp=timestamp, depth_m=depth_m)
    except VariableUnavailableError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except InvalidDateError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


@router.get("/model-column", response_model=ModelColumnResponse)
def model_column_route(
    variable: OceanVariable = Query(...),
    timestamp: str = Query(...),
    latitude: float = Query(...),
    longitude: float = Query(...),
) -> ModelColumnResponse:
    try:
        return get_model_column(
            get_cache(),
            variable=variable.value,
            timestamp=timestamp,
            latitude=latitude,
            longitude=longitude,
        )
    except VariableUnavailableError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except (OutOfRegionError, InvalidDateError) as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
