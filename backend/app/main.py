"""OceanLens India backend.

Reads the validated real-data cache once at startup — never on request, never
from the network. If the cache is missing or malformed, the app still starts
(so /health can report the problem) but every data route fails loudly rather
than serving a fabricated response.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    routes_collocation,
    routes_health,
    routes_metadata,
    routes_observations,
    routes_profiles,
    routes_provenance,
    routes_slices,
)
from app.config import settings
from app.data.cache_reader import CacheLoadError, get_cache

logger = logging.getLogger("oceanlens")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        cache = get_cache()
        logger.info(
            "real-data cache loaded: %d profiles, %d model timestamps, cache_id=%s",
            len(cache.profiles),
            len(cache.grid.timestamps),
            cache.cache_id,
        )
    except CacheLoadError as e:
        logger.error("cache failed to load at startup: %s", e)
    yield


app = FastAPI(
    title="OceanLens India backend",
    description=(
        "Serves real, locally cached Argo and HYCOM data with full provenance. "
        "No live downloads, no synthetic data on the default path."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(routes_health.router)
app.include_router(routes_metadata.router)
app.include_router(routes_observations.router)
app.include_router(routes_slices.router)
app.include_router(routes_profiles.router)
app.include_router(routes_collocation.router)
app.include_router(routes_provenance.router)
