# OceanLens India

A browser-native ocean **evidence workspace** for INCOIS: for a chosen location,
depth and time, see what the numerical model predicts, what an instrument
actually observed, and how well they agree.

> Status: under construction, phase by phase. Phases 0–2 (typed foundation,
> linked analysis state, real-data layer), the Python/FastAPI backend
> refactor, the UI shell, and the interactive 3D depth-slice scene are
> complete. `npm run dev` shows real model slices and clickable real Argo
> markers alongside the operational controls. The profile chart and detailed
> comparison views remain shells for the next phase.

## Requirements

- Node ≥ 20 (developed on Node 26)
- Python ≥ 3.11 (developed on Python 3.12)
- No login, API key, or network access is required for the offline
  demonstration once the cache and backend environment are prepared.

## Run

**Frontend:**

```bash
npm install
npm run dev            # http://localhost:5173
```

```bash
npm run typecheck      # tsc --noEmit, strict
npm test               # unit tests — numerics, store, honesty, cache, API adapter mapping
npm run test:integration  # real HTTP tests against a running backend (see below)
npm run build           # tsc + vite build
```

**Backend:**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pytest                              # 89 tests
uvicorn app.main:app --reload --port 8000
```

```bash
curl http://localhost:8000/health
curl http://localhost:8000/api/v1/metadata
curl http://localhost:8000/api/v1/provenance
```

The frontend talks to the backend via `VITE_API_BASE_URL` (defaults to
`http://localhost:8000`; see `.env.example`). Everything scientific — NetCDF
parsing, QC mapping, depth conversion, interpolation, collocation, RMSE, mean
bias — runs in the Python backend; the frontend only requests, displays, and
manages interaction state. Full reference: [`docs/backend.md`](docs/backend.md),
[`docs/api.md`](docs/api.md), [`docs/data-contract.md`](docs/data-contract.md).

## Real data

The project uses a **locally cached extract of real public data** from
`public/data/real/` (committed, ~13 MB / ~5 MB gzipped). FastAPI reads this
cache directly and serves normalised, provenance-aware JSON; the browser never
parses NetCDF or reads the scientific arrays itself. The demo is fully
offline-capable once the cache and backend environment are prepared.

| Dataset | Real or synthetic | Source | Variables | Time range | Transformations |
|---|---|---|---|---|---|
| Argo profiles — 28 profiles, 19 from INCOIS (Indian Argo Project) | **Real, locally cached** | Argo GDAC — `https://data-argo.ifremer.fr/dac/` (`incois/`, `csio/`) | `PRES`, `TEMP`, `PSAL` (+ `_ADJUSTED`, per-level `_QC`) | 2023-09-25 … 2023-10-05 | index-selected for region+window; primary vertical-sampling record; adjusted fields used in delayed/adjusted mode; `PRES` (decibar) → depth (m) via UNESCO 1983; `PRES_QC = 4` levels dropped; QC mapped to `GOOD/PROBABLY_GOOD/SUSPECT/BAD` (per-level values retained); duplicate depths collapsed; sorted shallow→deep |
| HYCOM GOFS 3.1 temperature & salinity (GLBy0.08 `expt_93.0`) | **Real, precomputed subset** | NCSS — `https://ncss.hycom.org/thredds/ncss/grid/GLBy0.08/expt_93.0/ts3z` | `water_temp`, `salinity` | 2023-09-25 … 2023-10-05, daily 00:00 UTC (11 steps) | NCSS bbox subset (8–20.5 °N, 81–93 °E); `short` → float via `scale_factor`/`add_offset`; `_FillValue` → NaN; render cache decimated (stride 3) to 14 depth levels; native-resolution 40-level model columns extracted at every float position |
| HYCOM GOFS 3.1 u/v currents (`expt_93.0`) | **Real, precomputed subset** | NCSS — `…/expt_93.0/uv3z` | `water_u`, `water_v` | same window | same pipeline; current speed shown = √(u² + v²) |
| Model–observation collocation (RMSE, mean bias, band agreement, distance, time offset) | **Derived from real source** | computed in-app | — | — | haversine distance to nearest model grid column; observation time − model time; RMSE and mean bias over QC-good, depth-paired levels; deterministic interpretation string |
| BGC-Argo, gliders, CTD casts, satellite SST, satellite chlorophyll, advisories, ML anomaly | **Not available in MVP / planned extension** | — | — | — | investigated; no usable real source prepared for this window. Shown as unavailable, never faked. |

Full provenance — exact file names, SHA-256 checksums, retrieval timestamps,
units, coordinate systems, QC semantics and every transformation — is in
[`public/data/real/manifest.json`](public/data/real/manifest.json) and
[`docs/data-provenance.md`](docs/data-provenance.md).

### Regenerating the cache

```bash
npm run data:prepare     # download real Argo + HYCOM into .cache/raw/, then normalise
npm run data:validate    # gate: fails on missing vars, bad units, unsorted depths,
                         # out-of-region coords, unparseable times, dropped QC, or a
                         # "real" source with no source reference
```

`.cache/raw/` (raw downloads) is git-ignored; `public/data/real/` (the normalized
cache read by the backend) is committed. HYCOM's NCSS service is slow and
intermittent, so the preparation script retries with backoff.

## Data honesty

Nothing in this project is labelled *verified*, *official*, *live* or
*real-time*. Identifiers shown in the UI are `DEMO-` prefixed. The demonstration
window is historical and labelled as such. A unit test (`src/honesty.test.ts`)
fails the build if a forbidden claim string reappears in the source; the
backend's own manifest-status translation and provenance responses are
covered by `backend/tests/test_provenance.py`.

## Architecture

See [`docs/architecture.md`](docs/architecture.md). In brief: React +
TypeScript and Zustand for the browser client, talking over HTTP to a Python +
FastAPI backend that owns NetCDF ingestion, QC/depth/statistics, and
provenance; the frontend's `ApiOceanDataAdapter` is the only thing that talks
to it, translating typed JSON into the app's existing domain types
([`docs/data-contract.md`](docs/data-contract.md) documents that boundary in
full). A single linked analysis store, hand-rolled SVG for charts, and a
canvas-2D + SVG oblique scene (next phase) behind a renderer interface.

The `CachedRealDataAdapter` (reads the cache directly in the browser) is
retained for fallback/comparison testing only — never the default; see
`docs/data-contract.md`.
