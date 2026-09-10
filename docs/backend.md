# OceanLens India — backend direction

This document describes the approved backend refactor. The backend is planned
for Phase 2.5 and must be completed before the React UI is wired to scientific
data.

## Responsibility boundary

The browser is responsible for interaction state and rendering. Python is
responsible for scientific data access and processing.

```text
Argo / HYCOM NetCDF
        ↓
Python ingestion and normalization
        ↓
Validated local cache
        ↓
FastAPI services
        ↓
TypeScript API adapter
        ↓
React / Zustand workspace
```

## Planned stack

- Python 3.11+
- FastAPI
- Uvicorn
- Pydantic v2
- NumPy
- xarray
- netCDF4 or h5netcdf
- SciPy where required for scientific interpolation
- pytest and httpx

The backend will not download data when it starts. It will read the validated
local cache produced from real Argo and HYCOM sources.

## Scientific responsibilities

Python will own:

- NetCDF reading
- Variable and coordinate normalization
- Unit handling
- Pressure-to-depth conversion
- Fill-value handling
- Argo QC mapping
- Spatial subsetting
- Time alignment
- Profile interpolation
- Model-observation collocation
- RMSE and mean-bias calculations
- Provenance-aware responses

## Local development

The planned local development setup uses two processes:

```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend, in a separate terminal
npm install
VITE_API_BASE_URL=http://localhost:8000 npm run dev
```

The backend must support the offline judging workflow after the real cache has
been prepared. It must not require a live data endpoint during the demo.

## Source status

Every response must preserve one of the approved status classes:

- `REAL_SOURCE_LOCALLY_CACHED`
- `PRECOMPUTED_FROM_REAL_SOURCE`
- `DERIVED_FROM_REAL_SOURCE`
- `SYNTHETIC_TEST_FIXTURE`
- `NOT_AVAILABLE_MVP`
- `PLANNED_EXTENSION`

Synthetic fixtures may be used in isolated tests, but must never be the default
application data path.

## Production direction

The hackathon backend is intentionally local and small. A production INCOIS
deployment could later add xarray/Dask processing, Zarr, object storage,
PostGIS metadata, Redis caching, scheduled ingestion and OGC/OPeNDAP services.
Those systems are not part of the current refactor.
