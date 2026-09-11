"""Tests the real, tested NetCDF-ingestion capability (see app/data/netcdf_reader.py).

This is NOT on the running demo's request path — the demo reads the
normalised cache (test_cache_reader.py). These tests prove Python genuinely
owns NetCDF reading, against the raw files staged by
scripts/prepare-real-data.mjs in .cache/raw/. They skip cleanly when that
directory is absent (e.g. a fresh clone that has only run the offline demo).
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.config import settings
from app.data.netcdf_reader import read_argo_profile, read_hycom_variable

RAW_ARGO = settings.raw_cache_dir / "argo"
RAW_HYCOM = settings.raw_cache_dir / "hycom"

pytestmark = pytest.mark.skipif(
    not RAW_ARGO.exists() or not RAW_HYCOM.exists(),
    reason="raw NetCDF not staged (.cache/raw/ absent) — run `npm run data:prepare` first",
)


def _first(dir_: Path, pattern: str) -> Path:
    return sorted(dir_.glob(pattern))[0]


def test_reads_a_real_argo_profile():
    path = _first(RAW_ARGO, "incois_*5907083*.nc")
    record = read_argo_profile(path)
    assert record.wmo == "5907083"
    assert record.data_centre == "IN"
    assert record.used_adjusted is True
    assert len(record.levels) > 50
    surface = record.levels[0]
    assert 25 < surface.temperature < 31
    assert surface.temperature_qc in ("GOOD", "PROBABLY_GOOD", "SUSPECT", "BAD", None)


def test_argo_depths_strictly_ascending():
    path = _first(RAW_ARGO, "incois_*5907083*.nc")
    record = read_argo_profile(path)
    depths = [lv.depth_m for lv in record.levels]
    assert depths == sorted(depths)
    assert len(depths) == len(set(depths))


def test_reads_real_hycom_temperature():
    path = RAW_HYCOM / "ts_2023-09-28.nc"
    if not path.exists():
        pytest.skip("ts_2023-09-28.nc not staged")
    subset = read_hycom_variable(path, "water_temp")
    assert subset.unit == "degC"
    assert subset.timestamp.startswith("2023-09-28")
    assert subset.values.shape == (len(subset.depths_m), len(subset.latitudes), len(subset.longitudes))
    surface = subset.values[0]
    finite = surface[~__import__("numpy").isnan(surface)]
    assert 20 < finite.min() and finite.max() < 32


def test_reads_real_hycom_currents_if_staged():
    path = RAW_HYCOM / "uv_2023-09-28.nc"
    if not path.exists():
        pytest.skip("uv_2023-09-28.nc not staged")
    subset = read_hycom_variable(path, "water_u")
    assert subset.values.shape[1:] == (len(subset.latitudes), len(subset.longitudes))
