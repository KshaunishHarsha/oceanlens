# OceanLens India backend

Python/FastAPI service serving real, locally cached Argo + HYCOM data with
full provenance. See `../docs/backend.md` for the full architecture writeup
and `../docs/api.md` for the endpoint reference.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

Reads the real-data cache from `../public/data/real/` (override with the
`OCEANLENS_CACHE_DIR` environment variable). No network access, no live
downloads — everything served comes from that committed cache.

## Test

```bash
pytest                       # 89 tests
python -m compileall app     # import/syntax check without running tests
```

`tests/test_netcdf_reader.py` exercises the real NetCDF-ingestion capability
against `../.cache/raw/`; it skips cleanly if that (git-ignored, regenerable)
directory is absent.

## Verify manually

```bash
curl http://localhost:8000/health
curl http://localhost:8000/api/v1/metadata
curl http://localhost:8000/api/v1/provenance
curl "http://localhost:8000/api/v1/slice?variable=temperature&timestamp=2023-09-28T00:00:00Z&depth_m=100"
```
