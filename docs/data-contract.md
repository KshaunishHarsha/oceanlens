# OceanLens India — frontend/backend data contract

This contract defines the boundary between the FastAPI backend and the React
frontend.

## Shared vocabulary

```text
temperature
salinity
currentSpeed
chlorophyll
```

The active real-data MVP currently supports temperature, salinity, current
fields and Argo observations. Unsupported variables remain in the broader
domain vocabulary so future adapters do not require a breaking type change.

## Quality flags

```text
GOOD
PROBABLY_GOOD
SUSPECT
BAD
```

Argo flags 1, 2, 3 and 4 map to these values respectively. The original QC
value must remain available in provenance or observation metadata.

## Platform types

```text
ARGO
GLIDER
CTD
BGC
```

The current cache contains real Argo observations. Other platform types must
be marked unavailable or planned until a real source is prepared.

## Adapter boundary

The frontend adapter should expose asynchronous methods for:

- Metadata
- Available times
- Model slices
- Observations
- Profiles
- Collocation results
- Provenance

The adapter must not know how NetCDF is parsed or how scientific statistics are
calculated. Those responsibilities belong to the Python backend.

## No silent fallback

If the backend reports that a variable, platform or layer is unavailable, the
frontend must show that state. It must not silently substitute synthetic data.
