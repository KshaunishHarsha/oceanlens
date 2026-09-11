"""A genuine NetCDF reader for raw Argo and HYCOM files.

This is a real, tested data-ingestion capability — Python owns NetCDF
reading — but it is NOT on the running demo's request path. The demo backend
reads the already-normalised, committed cache (see cache_reader.py); this
module is exercised by tests/test_cache_reader.py-adjacent ingestion tests
against files staged in `.cache/raw/` by scripts/prepare-real-data.mjs, and by
a future ingestion phase that replaces those Node scripts outright.

Uses netCDF4-python's automatic mask-and-scale: packed HYCOM shorts arrive
already unpacked to physical units with `_FillValue` masked, and Argo char
variables decode via `nc.chartostring`.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

import netCDF4 as nc
import numpy as np

from app.science.depth import pressure_to_depth_m
from app.science.qc import argo_qc_to_flag

ARGO_JULD_EPOCH = datetime(1950, 1, 1, tzinfo=timezone.utc)


def _chartostring(var) -> list[str]:
    """Decode a 2-D Argo char variable [N, STRING] to trimmed Python strings."""
    raw = var[:]
    if raw.ndim == 1:
        raw = raw.reshape(1, -1)
    decoded = nc.chartostring(raw)
    return [str(np.ma.filled(x, "")).strip() for x in np.atleast_1d(decoded)]


def decode_juld(days: float) -> str:
    """Argo JULD is days since 1950-01-01 UTC."""
    return (ARGO_JULD_EPOCH + timedelta(days=float(days))).isoformat().replace(
        "+00:00", "Z"
    )


def decode_cf_time(value: float, units: str) -> str:
    """Decode a CF "<unit> since <epoch>" time coordinate to ISO 8601 UTC."""
    unit, _, epoch_str = units.partition(" since ")
    unit = unit.strip().lower()
    epoch = datetime.fromisoformat(epoch_str.strip().replace(" ", "T")).replace(
        tzinfo=timezone.utc
    )
    per_unit = {
        "seconds": 1,
        "minutes": 60,
        "hours": 3600,
        "days": 86400,
    }[unit]
    return (epoch + timedelta(seconds=float(value) * per_unit)).isoformat().replace(
        "+00:00", "Z"
    )


@dataclass(frozen=True)
class ArgoLevel:
    depth_m: float
    temperature: float | None
    salinity: float | None
    temperature_qc: str | None
    salinity_qc: str | None


@dataclass(frozen=True)
class ArgoProfileRecord:
    wmo: str
    data_centre: str
    cycle_number: int
    data_mode: str
    project_name: str
    pi_name: str
    latitude: float
    longitude: float
    observed_at: str
    profile_temp_qc_letter: str
    profile_psal_qc_letter: str
    used_adjusted: bool
    levels: list[ArgoLevel]


def read_argo_profile(path: str | Path) -> ArgoProfileRecord:
    """Read the primary (most-levels) N_PROF record from a real Argo profile
    file. Mirrors scripts/prepare-real-data.mjs's normalisation exactly:
    prefers *_ADJUSTED fields in delayed/adjusted mode, converts pressure to
    depth via UNESCO 1983, and maps per-level QC to our four-value flag.
    """
    with nc.Dataset(str(path)) as ds:
        n_prof = ds.dimensions["N_PROF"].size
        pres = ds.variables["PRES"][:]
        # pick the record with the most non-fill pressure levels
        counts = [int((~np.ma.getmaskarray(pres[i])).sum()) for i in range(n_prof)]
        i = int(np.argmax(counts))

        wmo = _chartostring(ds.variables["PLATFORM_NUMBER"])[i]
        dac = _chartostring(ds.variables["DATA_CENTRE"])[i]
        mode = _chartostring(ds.variables["DATA_MODE"])[i] or "R"
        project = _chartostring(ds.variables["PROJECT_NAME"])[i]
        pi = _chartostring(ds.variables["PI_NAME"])[i]
        p_temp_qc = _chartostring(ds.variables["PROFILE_TEMP_QC"])[i]
        p_psal_qc = _chartostring(ds.variables["PROFILE_PSAL_QC"])[i]
        cycle = int(ds.variables["CYCLE_NUMBER"][i])
        lat = float(ds.variables["LATITUDE"][i])
        lon = float(ds.variables["LONGITUDE"][i])
        juld = float(ds.variables["JULD"][i])

        use_adj = mode in ("D", "A") and "TEMP_ADJUSTED" in ds.variables
        pres_v = ds.variables["PRES_ADJUSTED"] if use_adj else ds.variables["PRES"]
        temp_v = ds.variables["TEMP_ADJUSTED"] if use_adj else ds.variables["TEMP"]
        psal_v = ds.variables["PSAL_ADJUSTED"] if use_adj else ds.variables["PSAL"]
        pres_qc_v = (
            ds.variables.get("PRES_ADJUSTED_QC") if use_adj else ds.variables.get("PRES_QC")
        )
        temp_qc_v = (
            ds.variables.get("TEMP_ADJUSTED_QC") if use_adj else ds.variables.get("TEMP_QC")
        )
        psal_qc_v = (
            ds.variables.get("PSAL_ADJUSTED_QC") if use_adj else ds.variables.get("PSAL_QC")
        )

        pres_row = pres_v[i]
        temp_row = temp_v[i]
        psal_row = psal_v[i]
        pres_qc_row = _chartostring(pres_qc_v)[i] if pres_qc_v is not None else ""
        temp_qc_row = _chartostring(temp_qc_v)[i] if temp_qc_v is not None else ""
        psal_qc_row = _chartostring(psal_qc_v)[i] if psal_qc_v is not None else ""

        levels: list[ArgoLevel] = []
        seen_depths: set[float] = set()
        for k in range(pres_row.shape[0]):
            if np.ma.is_masked(pres_row[k]):
                continue
            pqc = pres_qc_row[k] if k < len(pres_qc_row) else " "
            if argo_qc_to_flag(pqc) == "BAD":
                continue
            depth = round(pressure_to_depth_m(float(pres_row[k]), lat), 2)
            if depth in seen_depths:
                continue
            seen_depths.add(depth)
            t = None if np.ma.is_masked(temp_row[k]) else float(temp_row[k])
            s = None if np.ma.is_masked(psal_row[k]) else float(psal_row[k])
            levels.append(
                ArgoLevel(
                    depth_m=depth,
                    temperature=t,
                    salinity=s,
                    temperature_qc=argo_qc_to_flag(
                        temp_qc_row[k] if k < len(temp_qc_row) else " "
                    ),
                    salinity_qc=argo_qc_to_flag(
                        psal_qc_row[k] if k < len(psal_qc_row) else " "
                    ),
                )
            )
        levels.sort(key=lambda lv: lv.depth_m)

        return ArgoProfileRecord(
            wmo=wmo,
            data_centre=dac,
            cycle_number=cycle,
            data_mode=mode,
            project_name=project,
            pi_name=pi,
            latitude=lat,
            longitude=lon,
            observed_at=decode_juld(juld),
            profile_temp_qc_letter=p_temp_qc,
            profile_psal_qc_letter=p_psal_qc,
            used_adjusted=use_adj,
            levels=levels,
        )


@dataclass(frozen=True)
class HycomSubset:
    variable: str
    unit: str
    timestamp: str
    latitudes: np.ndarray
    longitudes: np.ndarray
    depths_m: np.ndarray
    values: np.ndarray  # (depth, lat, lon), NaN = land/missing


def read_hycom_variable(path: str | Path, variable: str) -> HycomSubset:
    """Read one variable from a real HYCOM NCSS subset file (ts3z or uv3z).
    netCDF4's automatic mask-and-scale already unpacks `short` -> physical
    units and masks `_FillValue`; masked cells become NaN.
    """
    with nc.Dataset(str(path)) as ds:
        var = ds.variables[variable]
        unit = getattr(var, "units", "")
        time_var = ds.variables["time"]
        ts = decode_cf_time(float(time_var[0]), time_var.units)
        lat = np.asarray(ds.variables["lat"][:], dtype=np.float64)
        lon = np.asarray(ds.variables["lon"][:], dtype=np.float64)
        depth = np.asarray(ds.variables["depth"][:], dtype=np.float64)
        raw = var[0]  # (depth, lat, lon)
        values = np.ma.filled(raw.astype(np.float32), np.nan)
        return HycomSubset(
            variable=variable,
            unit=unit,
            timestamp=ts,
            latitudes=lat,
            longitudes=lon,
            depths_m=depth,
            values=values,
        )
