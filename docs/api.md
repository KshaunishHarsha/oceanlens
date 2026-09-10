# OceanLens India — API contract

The frontend will consume scientific data through FastAPI after the Phase 2.5
backend refactor. The browser must not parse NetCDF files or read scientific
arrays directly from the cache.

## Base URL

```text
http://localhost:8000
```

The frontend reads this from:

```text
VITE_API_BASE_URL
```

## Endpoints

```text
GET /health
GET /api/v1/metadata
GET /api/v1/times?variable=temperature
GET /api/v1/observations
GET /api/v1/observations/{observation_id}
GET /api/v1/slice
GET /api/v1/profile/{observation_id}
GET /api/v1/collocation/{observation_id}
GET /api/v1/provenance
```

## Response requirements

Every data response must include:

- Dataset name
- Source status
- Source URL where available
- Retrieval timestamp where available
- Variable and unit
- Time and depth context
- Relevant transformations
- Error or unavailable reason when data cannot be provided

Unsupported layers must return an explicit unavailable response rather than a
synthetic value:

```json
{
  "available": false,
  "status": "NOT_AVAILABLE_MVP",
  "reason": "No real cached source exists for this layer."
}
```

## Data statuses

```text
REAL_SOURCE_LOCALLY_CACHED
PRECOMPUTED_FROM_REAL_SOURCE
DERIVED_FROM_REAL_SOURCE
SYNTHETIC_TEST_FIXTURE
NOT_AVAILABLE_MVP
PLANNED_EXTENSION
```

The frontend must preserve these statuses and display them honestly.

## Scientific calculations

The backend is responsible for calculating:

- RMSE
- Mean bias
- Profile interpolation
- Haversine distance
- Time offset
- Model-observation collocation
- Depth-band agreement
- Deterministic scientific interpretation

The frontend displays these values but does not recalculate them from raw
scientific files.
