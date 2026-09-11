# OceanLens India — backend

Python 3.11+ / FastAPI service that owns all scientific data processing. The
frontend no longer parses NetCDF, converts pressure to depth, maps QC,
interpolates, collocates, or computes RMSE/bias — this backend does, from the
real cached arrays, on every request.

## Why Python/FastAPI

The Node.js prep scripts (`scripts/prepare-real-data.mjs`) proved the harvest
and normalisation pipeline and produced a validated real-data cache. Moving
*serving* and *scientific computation* into Python gives the project:

- NumPy/xarray/netCDF4 — the standard, well-tested scientific Python stack,
  rather than hand-rolled NetCDF-3 parsing in JavaScript.
- A typed API contract (Pydantic) that is the same shape regardless of what
  the frontend eventually does with it — a future non-browser client (a
  notebook, a CLI, another team's service) gets the same guarantees.
- A clean seam for a real production ingestion path (see "Production
  migration" in `docs/architecture.md`) without touching the frontend at all.

## What runs where

```
Running offline demo:
  Python backend reads the validated normalised cache (public/data/real/).

Data-ingestion capability:
  Python includes a real, tested NetCDF reader (app/data/netcdf_reader.py)
  for raw Argo/HYCOM files, exercised against .cache/raw/ when present.
  It is NOT on the running demo's request path.

Current transition-era preparation:
  The existing Node scripts (scripts/prepare-real-data.mjs,
  scripts/validate-real-data.mjs) remain the ONLY thing that has actually
  produced the committed cache. A future ingestion phase can replace them
  with a Python/xarray-based pipeline; that has not happened in this phase.
```

Do not claim the full raw-data preparation pipeline has migrated to Python —
it has not. What has moved to Python is everything downstream of the cache:
serving, QC semantics, depth handling, interpolation, collocation, and every
statistic.

## Directory structure

```
backend/
  app/
    main.py              FastAPI app, CORS, startup cache load, route mounting
    config.py             Settings — cache_dir, raw_cache_dir, CORS origins

    api/                  HTTP + request validation only, no calculations
      routes_health.py
      routes_metadata.py       /metadata, /times
      routes_observations.py   /observations, /observations/{id}
      routes_slices.py         /slice, /model-column
      routes_profiles.py       /profile/{id}
      routes_collocation.py    /collocation/{id}
      routes_provenance.py     /provenance

    models/                Pydantic response/request contracts
      provenance.py        DataStatus enum, SourceDescriptor, LayerProvenance
      metadata.py
      observations.py
      queries.py            OceanVariable / PlatformType / QualityFlag enums
      responses.py          Slice / ModelColumn / Collocation / Health / Error

    services/              Use-case orchestration; the only layer that reads
                            the cache AND calls science/ — routes never do both
      dataset_service.py
      observation_service.py
      slice_service.py
      collocation_service.py
      provenance_service.py  builds the full 14-layer registry + the
                              manifest-status -> API-status translation

    data/                  I/O only, no science
      cache_reader.py       loads public/data/real/ once, in memory
      netcdf_reader.py       real raw-NetCDF capability (see above)
      array_loader.py        numpy slicing helpers over the loaded cache

    science/                pure functions, no I/O, ported from
                            src/domain/stats.ts with matching test fixtures
      qc.py                  Argo QC flag + profile-letter mapping
      depth.py                UNESCO 1983 pressure -> depth
      interpolation.py        linear, never extrapolates
      statistics.py           RMSE, mean bias, band agreement, interpretation
      geometry.py              haversine, nearest-index, collocation snap
      collocation.py           orchestrates the above into one result

    adapters/               reserved for future source adapters (empty in
                            this phase — not to be confused with the
                            frontend's src/data/adapters/)

  tests/                   89 tests; pytest + httpx (FastAPI TestClient)
  requirements.txt
  README.md
```

## Local setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pytest                                    # 89 tests
uvicorn app.main:app --reload --port 8000
```

## Cache location

The backend reads `public/data/real/` **directly** — no copy, no duplication.
Configurable via `OCEANLENS_CACHE_DIR` (see `app/config.py`); defaults to the
repo-root cache written by `scripts/prepare-real-data.mjs`. The cache is
loaded once at startup and held in memory (13 MB — trivial). No network
access, no re-parsing NetCDF, on any request.

## CORS

Restricted to `http://localhost:5173` and `http://127.0.0.1:5173` (the Vite
dev server). No wildcard origin. GET only — the API is read-only.

## Provenance policy

Every response touching data carries a `source: SourceDescriptor` with name,
status, URL, retrieval timestamp, variables, units, coordinate system,
temporal/depth/spatial coverage, QC convention, transformations, licence, and
caveats. Statuses use the API's own vocabulary (`DataStatus` in
`app/models/provenance.py`) — see `docs/data-contract.md` for why this differs
from the frontend's vocabulary and how the two are translated at the adapter
boundary. Unsupported layers return `NOT_AVAILABLE_MVP` or `PLANNED_EXTENSION`
explicitly; nothing is silently omitted or filled with a plausible-looking
value.

## Tests

```bash
cd backend && source .venv/bin/activate
pytest                    # everything, including the real-cache read
pytest tests/test_netcdf_reader.py   # skips cleanly if .cache/raw/ is absent
python -m compileall app  # syntax/import sanity, no test framework needed
```

89 tests: health, cache loading (incl. a deliberately malformed-path failure),
QC mapping (incl. the real INCOIS float with `PROFILE_TEMP_QC = F`), depth
conversion, interpolation/statistics/geometry against hand-computed values,
collocation (with a documented numeric cross-check against an independent
implementation — see `docs/data-contract.md`), observation filtering (INCOIS
vs China Argo DAC, QC, bbox, collocated-only), slices (temperature, salinity,
real currents, nearest-depth/time snapping, unavailable-variable 404), model
columns (including an out-of-region 422), profiles (depth ordering, QC
preserved, the QC-failed profile resolving with zero levels rather than
erroring), and the full provenance registry (every layer, real and
unavailable).
