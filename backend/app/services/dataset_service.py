from __future__ import annotations

from app.data.array_loader import variable_available
from app.data.cache_reader import RealDataCache
from app.models.metadata import DatasetMetadata, PlatformMetadata, TimesResponse, VariableMetadata
from app.services.provenance_service import source_descriptor

_VARIABLE_CF_NAMES = {
    "temperature": "sea_water_temperature",
    "salinity": "sea_water_salinity",
    "currentSpeed": "sea_water_speed",
    "chlorophyll": "mass_concentration_of_chlorophyll_a_in_sea_water",
}
_VARIABLE_UNITS = {
    "temperature": "°C",
    "salinity": "PSU",
    "currentSpeed": "m/s",
    "chlorophyll": "mg/m³",
}


def build_variable_metadata(cache: RealDataCache) -> list[VariableMetadata]:
    out = []
    for var in ("temperature", "salinity", "currentSpeed", "chlorophyll"):
        available = variable_available(cache, var)
        if var == "temperature" or var == "salinity":
            source = source_descriptor(cache, "hycom.ts")
        elif var == "currentSpeed":
            source = source_descriptor(cache, "hycom.uv")
        else:
            from app.models.provenance import DataStatus, SourceDescriptor

            source = SourceDescriptor(
                name="Chlorophyll-a",
                status=DataStatus.NOT_AVAILABLE_MVP,
                notes="No real source prepared into the cache for this variable.",
            )
        out.append(
            VariableMetadata(
                key=var,
                standard_name=_VARIABLE_CF_NAMES[var],
                unit=_VARIABLE_UNITS[var],
                available=available,
                source=source,
            )
        )
    return out


def build_platform_metadata(cache: RealDataCache) -> list[PlatformMetadata]:
    counts: dict[str, int] = {"ARGO": 0, "GLIDER": 0, "CTD": 0, "BGC": 0}
    for p in cache.profiles:
        counts[p["platformType"]] = counts.get(p["platformType"], 0) + 1
    labels = {"ARGO": "ARGO", "GLIDER": "GLIDER", "CTD": "CTD", "BGC": "BGC FLOAT"}
    return [
        PlatformMetadata(key=k, label=labels[k], available=counts.get(k, 0) > 0, count=counts.get(k, 0))
        for k in ("ARGO", "GLIDER", "CTD", "BGC")
    ]


def build_dataset_metadata(cache: RealDataCache) -> DatasetMetadata:
    m = cache.manifest
    region = m.get("region", {})
    return DatasetMetadata(
        dataset_id="oceanlens-india-bay-of-bengal",
        title=m.get("title", "OceanLens India"),
        region=region,
        region_name=m.get("regionName", ""),
        timestamps=cache.grid.timestamps,
        depths_m=list(cache.grid.depths_m),
        variables=build_variable_metadata(cache),
        platforms=build_platform_metadata(cache),
        observation_count=len(cache.profiles),
        historical_window=True,
        window_label=m.get("windowLabel", "Historical demonstration window"),
        view_id=m.get("viewId", "DEMO-UNKNOWN"),
        source=source_descriptor(cache, "argo.incois"),
    )


def build_times_response(cache: RealDataCache, variable: str) -> TimesResponse:
    available = variable_available(cache, variable)
    return TimesResponse(
        variable=variable,
        available=available,
        timestamps=list(cache.grid.timestamps) if available else [],
        reason=None if available else f"No real cached source exists for '{variable}'.",
    )
