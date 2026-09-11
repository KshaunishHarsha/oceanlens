# OceanLens India — API reference

Base URL: `http://localhost:8000` (override with `VITE_API_BASE_URL` on the
frontend, or `OCEANLENS_CORS_ORIGINS`/host flags on the backend). All routes
are `GET` — the API is read-only. All responses are JSON.

## `GET /health`

```json
{ "status": "ok", "service": "oceanlens-backend", "cache_loaded": true, "cache_id": "f49a4149c49aa5c0" }
```

`status` is `"degraded"` and `cache_loaded` is `false` if the real-data cache
failed to load at startup — every other route will fail loudly rather than
serve a partial response.

## `GET /api/v1/metadata`

Region, real timestamps, real depth levels, per-variable availability +
provenance, per-platform-type counts, dataset identity (`view_id` always
`DEMO-` prefixed), `window_label` (always "Historical demonstration window" —
never implies live data).

## `GET /api/v1/times?variable={temperature|salinity|currentSpeed|chlorophyll}`

```json
{ "variable": "chlorophyll", "available": false, "timestamps": [], "reason": "No real cached source exists for 'chlorophyll'." }
```

Returns only timestamps actually present in the cache. An unsupported
variable returns `available: false` with a `reason`, never an empty-but-`200`
success that could be mistaken for "zero timestamps happen to exist."

## `GET /api/v1/observations`

Query params (all optional, combinable): `platform_type` (repeatable —
`ARGO`/`GLIDER`/`CTD`/`BGC`), `dac` (repeatable — Argo `DATA_CENTRE`, e.g.
`IN` for INCOIS, `HZ` for China Argo), `qc` (`GOOD`/`PROBABLY_GOOD`/
`SUSPECT`/`BAD`), `from_time`/`to_time` (ISO 8601 UTC), `min_lat`/`max_lat`/
`min_lon`/`max_lon`, `collocated_only` (bool).

Returns lightweight summaries (position, time, QC, platform identity) — no
depth/value arrays, to keep a many-observation query cheap. Fetch
`/profile/{id}` for the full depth-resolved profile.

## `GET /api/v1/observations/{observation_id}`

One observation summary, or `404` if the id is unknown.

## `GET /api/v1/slice?variable=...&timestamp=...&depth_m=...`

```
GET /api/v1/slice?variable=temperature&timestamp=2023-09-28T00:00:00Z&depth_m=100
```

Returns the actual timestamp and depth used (nearest cached values — snapping
is explicit, not silent), the lat/lon axes, a `[lat][lon]` value grid (`null`
= land/missing, never a fabricated number), decimation metadata, and
provenance. A variable with no real cached source (currently `chlorophyll`,
or `currentSpeed` if `uv3z` failed to harvest) returns `404` — never a
synthetic grid.

## `GET /api/v1/model-column?variable=...&timestamp=...&latitude=...&longitude=...`

Model profile at an arbitrary position (not tied to an observation) — used
for the profile chart's model curve at a clicked point. `422` if the position
falls outside the cached region; `404` if the variable is unavailable. Never
fabricates a column for a position or variable it doesn't have.

## `GET /api/v1/profile/{observation_id}?variable=temperature|salinity`

Full depth-resolved profile for one observation and variable: depths, values,
per-level QC, platform identity, provenance. A profile whose levels all
failed QC (e.g. `ARGO-4903776-2`, real `PROFILE_TEMP_QC = F`) returns `200`
with `levels: []` and `qc: "BAD"` — retained and honestly flagged, not hidden
and not a `404`.

## `GET /api/v1/collocation/{observation_id}?variable=...&timestamp=...`

Model-vs-observation comparison computed from the cached arrays on every
request: RMSE, mean bias, horizontal distance, time offset, per-depth-band
agreement, and a deterministic plain-language interpretation. `timestamp` is
optional — defaults to the model snapshot nearest the observation's own time.

When there is no QC-good overlap (the QC-failed profile above), `rmse` and
`mean_bias` are `null` — JSON has no `NaN`, and a statistic that could not be
computed is never rendered as zero or omitted silently. `sample_count: 0` and
the interpretation say so explicitly.

## `GET /api/v1/provenance`

The complete 14-layer registry — active and unsupported alike:
`model.temperature`, `model.salinity`, `model.currents`, `obs.argo`,
`obs.bgc`, `obs.glider`, `obs.ctd`, `satellite.sst`, `satellite.chlorophyll`,
`derived.isosurface`, `context.coastline`, `context.bathymetry`,
`advisory.incois`, `ml.anomaly`. Each carries a `source.status` from:

```
REAL_SOURCE_LOCALLY_CACHED
PRECOMPUTED_FROM_REAL_SOURCE
DERIVED_FROM_REAL_SOURCE
SYNTHETIC_TEST_FIXTURE
NOT_AVAILABLE_MVP
PLANNED_EXTENSION
```

This is the single source of truth `ApiOceanDataAdapter.getLayerRegistry()`
builds the frontend's layer registry from.

## Errors

Non-2xx responses are FastAPI's standard `{"detail": "..."}` shape. Used
consistently for: `404` (unknown observation, unavailable variable/layer),
`422` (invalid enum value, out-of-region position; also FastAPI's automatic
query-parameter validation errors). No route returns `200` with a body that
misrepresents what happened.
