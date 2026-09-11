import numpy as np
import pytest

from app.data.cache_reader import CacheLoadError, RealDataCache


def test_loads_real_cache(cache):
    assert len(cache.profiles) > 0
    assert len(cache.grid.timestamps) == 11
    assert cache.grid.shape.nz == len(cache.grid.depths_m)


def test_contains_incois_and_china_argo(cache):
    dacs = {p["identity"]["dataCentre"] for p in cache.profiles}
    assert "IN" in dacs
    assert "HZ" in dacs


def test_keeps_qc_failed_profile(cache):
    p = cache.profiles_by_id.get("ARGO-4903776-2")
    assert p is not None
    assert p["qc"] == "BAD"
    assert len(p["depthsM"]) == 0  # every level failed QC


def test_slice_shape_matches_grid(cache):
    shape = cache.grid.shape
    arr = cache.slices["temperature"]
    assert arr.shape == (shape.nt, shape.nz, shape.ny, shape.nx)
    assert arr.dtype == np.float32


def test_has_real_currents(cache):
    assert cache.has_currents is True
    assert "currentU" in cache.slices
    assert "currentV" in cache.slices


def test_grid_axes_ascending(cache):
    lat = cache.grid.latitudes
    lon = cache.grid.longitudes
    depth = cache.grid.depths_m
    assert np.all(np.diff(lat) > 0)
    assert np.all(np.diff(lon) > 0)
    assert np.all(np.diff(depth) > 0)


def test_missing_cache_dir_raises(tmp_path):
    with pytest.raises(CacheLoadError):
        RealDataCache(tmp_path / "does-not-exist")


def test_cache_id_is_stable_for_same_content(cache):
    from app.data.cache_reader import RealDataCache
    from app.config import settings

    second = RealDataCache(settings.cache_dir)
    assert second.cache_id == cache.cache_id
