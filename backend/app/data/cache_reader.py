"""Loads the validated real-data cache written by scripts/prepare-real-data.mjs.

This is the ONLY thing the running demo backend reads. It never touches raw
NetCDF, never downloads anything, and never invents a value for a file it
cannot find — a missing or malformed cache fails loudly at startup rather than
serving a partial or fabricated response.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np


class CacheLoadError(RuntimeError):
    """Raised when the real-data cache is missing or structurally invalid."""


@dataclass(frozen=True)
class GridShape:
    nt: int
    nz: int
    ny: int
    nx: int


@dataclass(frozen=True)
class Grid:
    latitudes: np.ndarray  # (ny,) ascending
    longitudes: np.ndarray  # (nx,) ascending
    depths_m: np.ndarray  # (nz,) ascending
    timestamps: list[str]  # (nt,) ISO 8601 UTC, ascending
    shape: GridShape


class RealDataCache:
    """In-memory handle onto public/data/real/. Load once at startup."""

    def __init__(self, cache_dir: Path) -> None:
        self.cache_dir = cache_dir
        self.manifest: dict = self._read_json("manifest.json")
        self.grid: Grid = self._read_grid()
        self.profiles: list[dict] = self._read_json("observations/profiles.json")
        self.profiles_by_id: dict[str, dict] = {p["id"]: p for p in self.profiles}
        self.columns: list[dict] = self._read_json("model/columns.json")
        self.columns_by_observation: dict[str, dict] = {
            c["observationId"]: c for c in self.columns
        }
        self.slices: dict[str, np.ndarray] = self._read_slices()
        self.cache_id = self._compute_cache_id()

    # -- loading -----------------------------------------------------------

    def _read_json(self, rel: str) -> dict | list:
        path = self.cache_dir / rel
        if not path.exists():
            raise CacheLoadError(f"required cache file missing: {path}")
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)

    def _read_grid(self) -> Grid:
        raw = self._read_json("model/grid.json")
        shape = GridShape(**raw["shape"])
        return Grid(
            latitudes=np.asarray(raw["latitudes"], dtype=np.float64),
            longitudes=np.asarray(raw["longitudes"], dtype=np.float64),
            depths_m=np.asarray(raw["depthsM"], dtype=np.float64),
            timestamps=list(raw["timestamps"]),
            shape=shape,
        )

    def _read_slices(self) -> dict[str, np.ndarray]:
        shape = self.grid.shape
        expected = shape.nt * shape.nz * shape.ny * shape.nx
        out: dict[str, np.ndarray] = {}
        for var in ("temperature", "salinity", "currentU", "currentV"):
            path = self.cache_dir / "model" / f"{var}.f32"
            if not path.exists():
                continue  # honestly absent — e.g. currents when uv3z failed
            arr = np.fromfile(path, dtype="<f4")
            if arr.size != expected:
                raise CacheLoadError(
                    f"{var}.f32 has {arr.size} floats; grid shape implies {expected}"
                )
            out[var] = arr.reshape(shape.nt, shape.nz, shape.ny, shape.nx)
        if "temperature" not in out or "salinity" not in out:
            raise CacheLoadError("cache is missing required temperature/salinity slices")
        return out

    def _compute_cache_id(self) -> str:
        """Stable identifier for /health and provenance — not a security hash,
        just something that changes if the cache content changes."""
        h = hashlib.sha256()
        h.update(json.dumps(self.manifest, sort_keys=True).encode("utf-8"))
        for var, arr in sorted(self.slices.items()):
            h.update(var.encode("utf-8"))
            h.update(arr.tobytes()[:4096])  # sample, not the whole array
        return h.hexdigest()[:16]

    # -- convenience ---------------------------------------------------------

    @property
    def has_currents(self) -> bool:
        return "currentU" in self.slices and "currentV" in self.slices

    def source(self, source_id: str) -> dict | None:
        for s in self.manifest.get("sources", []):
            if s.get("id") == source_id:
                return s
        return None


_cache: RealDataCache | None = None


def get_cache() -> RealDataCache:
    """Process-wide singleton. Loaded lazily, once, at first use (or eagerly
    at app startup — see app.main)."""
    global _cache
    if _cache is None:
        from app.config import settings

        _cache = RealDataCache(settings.cache_dir)
    return _cache


def reset_cache_for_tests(cache_dir: Path | None = None) -> RealDataCache:
    """Force a reload. Used by tests that point at a fixture cache directory."""
    global _cache
    from app.config import settings

    _cache = RealDataCache(cache_dir or settings.cache_dir)
    return _cache
