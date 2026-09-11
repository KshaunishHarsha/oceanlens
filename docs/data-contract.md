# OceanLens India — frontend/backend data contract

## The boundary

Before this refactor, `CachedRealDataAdapter` (TypeScript, browser) parsed the
cache directly — JSON + raw `.f32` arrays fetched over HTTP, NetCDF-adjacent
math (interpolation, collocation, RMSE, bias) run in the browser.

After this refactor, `ApiOceanDataAdapter` (TypeScript, browser) does none of
that. It calls the FastAPI backend and maps typed JSON responses onto the
*same* frontend domain types (`src/domain/types.ts`) that
`CachedRealDataAdapter` already produced — so nothing above the adapter layer
(the analysis store, and eventually the UI) needs to know which adapter is
active.

```
backend/app/models/*.py  (Pydantic, snake_case)
        ↓  JSON over HTTP
src/data/api/types.ts     (Api* interfaces, snake_case — the wire shape)
        ↓  ApiOceanDataAdapter.ts (the one translation point)
src/domain/types.ts       (OceanDataAdapter's existing camelCase contract)
```

## Provenance status: two vocabularies, one explicit translation

The backend's `DataStatus` (`backend/app/models/provenance.py`) and the
frontend's `DataStatus` (`src/domain/provenance.ts`) are **deliberately
different enums** — this was an explicit decision (C2 of the backend-refactor
approval), not an oversight:

| API (`ApiDataStatus`) | Frontend (`DataStatus`) |
|---|---|
| `REAL_SOURCE_LOCALLY_CACHED` | `REAL_CACHED` |
| `PRECOMPUTED_FROM_REAL_SOURCE` | `PRECOMPUTED_FROM_REAL` |
| `DERIVED_FROM_REAL_SOURCE` | `DERIVED_FROM_REAL` |
| `SYNTHETIC_TEST_FIXTURE` | `SYNTHETIC_FIXTURE` |
| `NOT_AVAILABLE_MVP` | `NOT_AVAILABLE_MVP` |
| `PLANNED_EXTENSION` | `PLANNED_EXTENSION` |

The mapping lives in exactly one place: `mapApiStatus()` in
`src/data/ApiOceanDataAdapter.ts`, unit-tested in
`src/data/ApiOceanDataAdapter.test.ts`. Neither vocabulary was renamed to
match the other — the frontend vocabulary is threaded through
`domain/provenance.ts`, `domain/layers.ts`, `CachedRealDataAdapter`, and
existing tests; renaming it would have been unnecessary churn for a refactor
that doesn't otherwise touch those files. The manifest written by
`scripts/prepare-real-data.mjs` uses a *third*, historical set of strings
(`REAL_CACHED`, `PRECOMPUTED_FROM_REAL`, ...) — `backend/app/services/
provenance_service.py` translates manifest → API status on the way out.

## Layer registry

`GET /api/v1/provenance` is the single source of truth for the complete
14-layer registry — including the ten layers with no real backing data. There
is no separate "layers" endpoint; `ApiOceanDataAdapter.getLayerRegistry()`
builds the frontend's `LayerRegistry` from this one response.

## Observation lists vs. full profiles

`GET /api/v1/observations` returns lightweight summaries (no depth/value
arrays) — a many-observation query stays cheap. `ApiOceanDataAdapter
.getObservations()` maps these to `ObservationProfile` objects with empty
`depthsM`/`variables`/`qcByVariable`. Call `adapter.getObservation(id)` for
one observation once selected: it fetches `/observations/{id}` plus
`/profile/{id}?variable=temperature` and `?variable=salinity` in parallel and
merges them into a complete, depth-resolved `ObservationProfile`. This
mirrors how the eventual UI actually uses the two calls (a marker list, then
a detail fetch on click) and avoids an N+1 fetch for every marker on screen.

## `null` vs `NaN`

JSON has no `NaN`. Where a backend statistic cannot be computed (e.g. zero
QC-good overlapping levels), the API returns `null`.
`ApiOceanDataAdapter` maps `null` → `NaN` when constructing frontend
`CollocationResult`/`DepthBandAgreement` objects, matching the convention
`CachedRealDataAdapter` already used (`domain/stats.ts`'s `calculateRMSE`
etc. return `NaN` for "not computable"). Nothing downstream has to learn a
second "missing" convention.

## Numerical compatibility

The Python `science/` modules (`qc.py`, `depth.py`, `interpolation.py`,
`geometry.py`, `statistics.py`, `collocation.py`) are direct ports of
`src/domain/stats.ts`, function-for-function, verified against the same
hand-computed fixtures the TypeScript tests use (real Argo positions, hand-
checked RMSE/bias arithmetic).

The collocation pipeline was additionally cross-checked end-to-end: an
independent, standalone Node.js script (not part of the app; not a copy of
either implementation's source file) re-derives the exact algorithm from
`src/domain/stats.ts` + `CachedRealDataAdapter.getCollocation()` — pairing,
interpolation, RMSE, bias, distance, time offset — reading directly from
`public/data/real/`, with no dependency on either the TS adapter or the
Python backend. Its output for four real profiles matched the Python
backend's `/api/v1/collocation` responses to four decimal places:

| Observation | RMSE (°C) | Mean bias (°C) | Distance (km) | Time offset (h) |
|---|---|---|---|---|
| ARGO-5907083-2 | 0.2434 | +0.1816 | 0.357 | −9.907 |
| ARGO-4903775-2 | 0.1061 | −0.0437 | 1.857 | −9.925 |
| ARGO-1902669-2 | 0.4703 | −0.1107 | 3.431 | −9.863 |
| ARGO-7901127-2 | 0.4567 | −0.2641 | 2.313 | −9.919 |

These values are asserted in `backend/tests/test_collocation.py` with an
absolute tolerance of `1e-3` (the approved C7 decision).

**Note on the Phase-2 report's numbers:** the RMSE figures quoted when the
real-data cache was first built (e.g. "ARGO-5907083-2: RMSE 0.669 °C") came
from an ad-hoc verification script that capped the comparison at 0–500 m
using a cruder nearest-depth pairing — not from `CachedRealDataAdapter
.getCollocation()` itself. The adapter's actual method (matched by both
implementations above) uses the observation's full depth axis with linear
interpolation, giving 0.2434 °C for that profile. The table above is the
authoritative reference going forward.

## What the frontend must never do (post-refactor)

- Parse NetCDF, or fetch `.f32`/`public/data/real/` arrays directly, on the
  default path. `CachedRealDataAdapter` still can (that's its only job now)
  but is gated behind `VITE_USE_LOCAL_CACHE_ADAPTER=true`, which logs a
  visible console warning when set.
- Recompute RMSE, mean bias, interpolation, or collocation from raw arrays.
- Substitute a synthetic value when the API reports a layer or variable
  unavailable. `ApiOceanDataAdapter` propagates `available: false` /
  `NOT_AVAILABLE_MVP` / `PLANNED_EXTENSION` and empty timestamp arrays
  as-is; it never falls back to `FixtureDataAdapter`, which is imported only
  by tests.
