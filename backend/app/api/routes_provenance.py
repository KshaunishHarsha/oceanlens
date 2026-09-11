from __future__ import annotations

from fastapi import APIRouter

from app.data.cache_reader import get_cache
from app.models.provenance import ProvenanceResponse
from app.services.provenance_service import build_provenance_response

router = APIRouter(prefix="/api/v1", tags=["provenance"])


@router.get("/provenance", response_model=ProvenanceResponse)
def provenance() -> ProvenanceResponse:
    return build_provenance_response(get_cache())
