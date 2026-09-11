"""Application settings.

No database, no secrets, no cloud config. The one thing that matters is where
the validated real-data cache lives — everything else has a sane default.
"""

from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parent.parent  # backend/
REPO_ROOT = BACKEND_ROOT.parent  # project root


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="OCEANLENS_", extra="ignore")

    # The single source of truth is the repo-root cache written by
    # scripts/prepare-real-data.mjs. Overridable for tests or an alternate
    # layout; never duplicated by default.
    cache_dir: Path = REPO_ROOT / "public" / "data" / "real"

    # Raw NetCDF staged by scripts/prepare-real-data.mjs (git-ignored, not
    # required for the running demo). Only used by the netcdf_reader tests
    # and the data-ingestion capability, never by the API routes.
    raw_cache_dir: Path = REPO_ROOT / ".cache" / "raw"

    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    api_prefix: str = "/api/v1"


settings = Settings()
