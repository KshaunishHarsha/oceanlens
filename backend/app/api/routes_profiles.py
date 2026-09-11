from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.data.cache_reader import get_cache
from app.models.observations import ProfileResponse
from app.models.queries import OceanVariable
from app.services.observation_service import get_profile

router = APIRouter(prefix="/api/v1", tags=["profiles"])


@router.get("/profile/{observation_id}", response_model=ProfileResponse)
def profile(
    observation_id: str, variable: OceanVariable = Query(OceanVariable.temperature)
) -> ProfileResponse:
    result = get_profile(get_cache(), observation_id, variable.value)
    if result is None:
        raise HTTPException(status_code=404, detail=f"observation '{observation_id}' not found")
    return result
