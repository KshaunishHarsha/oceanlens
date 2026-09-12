"""Grounded, optional OpenAI briefing for a selected historical observation.

The route sends only the already-calculated collocation evidence.  It never
gives the model tools, live data access, or a way to alter science results.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.config import settings
from app.data.cache_reader import get_cache
from app.models.responses import BriefingRequest, BriefingResponse
from app.science.collocation import UnsupportedCollocationVariableError
from app.services.collocation_service import NoModelColumnError, ObservationNotFoundError, get_collocation
from app.services.briefing_service import generate_briefing

router = APIRouter(prefix="/api/v1", tags=["briefing"])


@router.post("/briefing/{observation_id}", response_model=BriefingResponse)
async def briefing(observation_id: str, request: BriefingRequest) -> BriefingResponse:
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=503,
            detail="Briefing mode is not configured. Set OCEANLENS_OPENAI_API_KEY on the backend server.",
        )
    try:
        evidence = get_collocation(get_cache(), observation_id=observation_id, variable=request.variable)
    except ObservationNotFoundError as e:
        raise HTTPException(status_code=404, detail=f"observation '{observation_id}' not found") from e
    except NoModelColumnError as e:
        raise HTTPException(status_code=404, detail="no model comparison exists for this observation") from e
    except UnsupportedCollocationVariableError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    try:
        text = await generate_briefing(evidence, question=request.question)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail="The briefing service did not return a usable answer.") from e

    cache = get_cache()
    return BriefingResponse(
        observation_id=observation_id,
        variable=request.variable,
        briefing=text,
        generated_by="OpenAI, constrained to the selected cached evidence",
        historical_window_label=cache.manifest.get("windowLabel", "Historical demonstration window"),
    )
