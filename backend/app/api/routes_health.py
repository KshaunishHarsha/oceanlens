from __future__ import annotations

from fastapi import APIRouter

from app.data.cache_reader import CacheLoadError, get_cache
from app.models.responses import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    try:
        cache = get_cache()
        return HealthResponse(
            status="ok", service="oceanlens-backend", cache_loaded=True, cache_id=cache.cache_id
        )
    except CacheLoadError:
        return HealthResponse(
            status="degraded", service="oceanlens-backend", cache_loaded=False, cache_id=None
        )
