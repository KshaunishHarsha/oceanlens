from __future__ import annotations

from fastapi import APIRouter, Query

from app.data.cache_reader import get_cache
from app.models.metadata import DatasetMetadata, TimesResponse
from app.models.queries import OceanVariable
from app.services.dataset_service import build_dataset_metadata, build_times_response

router = APIRouter(prefix="/api/v1", tags=["metadata"])


@router.get("/metadata", response_model=DatasetMetadata)
def metadata() -> DatasetMetadata:
    return build_dataset_metadata(get_cache())


@router.get("/times", response_model=TimesResponse)
def times(variable: OceanVariable = Query(...)) -> TimesResponse:
    return build_times_response(get_cache(), variable.value)
