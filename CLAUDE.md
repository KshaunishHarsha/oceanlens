# OceanLens India — Claude Code working context

> Maintained across sessions. Read this first; it should save you from re-reading the
> Claude Design project or re-probing data endpoints.

## What this is

Smart India Hackathon 2026 project for **INCOIS**. A browser-native 3D ocean *evidence
workspace*: for a given location, depth and time, show what the model predicts, what the
instrument observed, and how well they agree.

Not a dashboard. A scientific operations console for a government audience.

## Status

| | |
|---|---|
| Current phase | **Phase 2.5 (Python/FastAPI backend refactor) complete — awaiting approval before Phase 3 UI wiring.** |
| Phase order | 0 → 1 → 2 → **2.5** → 3 → **5** → **4** → 6 → 7 (backend first; evidence before advanced scene) |
| Repo state | Backend (89 pytest) serves the real cache; frontend has `ApiOceanDataAdapter` (default) + `CachedRealDataAdapter` (retained, gated). 84 frontend tests green, tsc clean, build OK. **UI not yet wired to either adapter** — no product screens changed. |

## Phase 2 result (2026-09-10) — APPROVED; BACKEND REFACTOR NEXT

**Demo window: 2023-09-25 → 2023-10-05, 11 daily steps.** Labelled "Historical
demonstration window". Chosen for densest INCOIS Bay of Bengal Argo coverage inside HYCOM
expt_93.0's span (which ends 2024-09-05, so the artboard's 2026 date was impossible with
real model data).

- **Real Argo**: 28 profiles / 27 floats, **19 INCOIS** (`DAC=IN`), 28 delayed-mode (`D`).
  From `data-argo.ifremer.fr/dac/{incois,csio}`. Includes a real W→E transect line at ~13°N
  on 28–29 Sep, a near-daily 9-cycle series from float 6990608, and one retained QC-failed
  shell (INCOIS 4903776 cycle 2, all `PRES_QC=4`) shown with a BAD flag rather than hidden.
  French real-time float 1902594 was **excluded** (R-mode, no adjusted fields, merged level
  axis — did not normalise cleanly).
- **Real HYCOM GOFS 3.1** (GLBy0.08 expt_93.0), NCSS subset, 11 daily 00:00Z snapshots:
  `water_temp`, `salinity` (`ts3z`) **and `water_u`, `water_v` (`uv3z`)** — currents ARE real.
- **Real collocation** computed from the cached arrays: e.g. ARGO-5907083-2 vs HYCOM
  RMSE 0.67 °C, bias **+0.38 °C** (real warm model bias), 0.4 km, ~14 h offset.
  ARGO-4903775-2 near-perfect (bias −0.02). No hard-coded stats anywhere.
- Cache in `public/data/real/`: `manifest.json` (full provenance, checksums, transforms),
  `model/{grid.json, temperature.f32, salinity.f32, currentU.f32, currentV.f32, columns.json}`,
  `observations/profiles.json`. **13 MB on disk, 5.3 MB gzipped.** Committed.
  Slice cache = decimated (stride 3) + 14 depths; `columns.json` = native 40-level model
  columns at each float position (what the stats use).
- Code: `src/domain/stats.ts` (RMSE, meanBias, interpolateProfile, collocate*, haversine,
  timeOffset, bandAgreement, buildScientificInterpretation) — 21 tests.
  `src/data/CachedRealDataAdapter.ts` is the Phase 2 transition adapter. It remains useful
  for compatibility tests, but the approved target is a Python/FastAPI service boundary.
  `src/data/FixtureDataAdapter.ts` is synthetic, tests only, never in the app.
- Scripts: `scripts/prepare-real-data.mjs` (`--argo`/`--hycom`/`--normalise`),
  `scripts/validate-real-data.mjs` (the gate), `scripts/config.mjs`, `scripts/lib/netcdf.mjs`.
  npm: `data:prepare`, `data:normalise`, `data:validate`.
- `docs/data-provenance.md` = layer classification table + regeneration steps + attribution.
- Raw downloads staged in `.cache/raw/` (git-ignored). Re-harvest via `npm run data:prepare`.
  **HYCOM NCSS is very flaky** — the harvest needs generous retries; a killed download can
  leave a valid header + truncated body, so `prepare` now rejects HYCOM files under 5 MB.
- Layers NOT available (honestly, in the registry): BGC, glider, CTD, satellite SST,
  satellite chlorophyll, advisories, ML anomaly — all `PLANNED_EXTENSION` /
  `NOT_AVAILABLE_MVP`, none faked.

## Phase 2.5 result (2026-09-11) — Python/FastAPI backend refactor, AWAITING APPROVAL

**Fully implemented and tested. UI not touched — no product screens exist to wire yet.**

- **Backend** (`backend/`, Python 3.12 venv): `app/data/` (cache_reader — loads
  `public/data/real/` once into numpy arrays, no copy, no network; netcdf_reader — a
  genuine tested NetCDF reader for raw Argo/HYCOM, exercised against `.cache/raw/`, NOT
  on the demo request path; array_loader), `app/science/` (qc, depth, interpolation,
  geometry, statistics, collocation — direct ports of `src/domain/stats.ts`), `app/models/`
  (Pydantic — own `DataStatus` enum, distinct from the frontend's, see below), `app/services/`,
  `app/api/` (7 route files, all `GET`, CORS locked to :5173). **89/89 pytest passing.**
- **Endpoints**: `/health`, `/api/v1/{metadata,times,observations,observations/{id},
  slice,model-column,profile/{id},collocation/{id},provenance}`. `model-column` was added
  beyond the brief's list — needed to fulfil `OceanDataAdapter.getModelColumn`.
- **Real data through every route**: 28 Argo profiles (19 INCOIS, 9 China Argo) — verified
  live via curl and pytest. HYCOM T/S/U/V real. Collocation computed per-request in Python,
  never hard-coded.
- **Numeric cross-check**: an independent Node.js replication of the collocation algorithm
  (not copied from either implementation) matched the Python backend to 4 decimal places on
  4 real profiles. **Correction to the Phase 2 numbers below**: those used a cruder ad-hoc
  script capped at 0–500 m. The adapter's real method (both languages agree) gives
  ARGO-5907083-2 RMSE **0.2434 °C**, bias **+0.1816 °C** — not 0.67/+0.38. Full table +
  1e-3-tolerance test: `docs/data-contract.md`, `backend/tests/test_collocation.py`.
- **Provenance vocabulary — THREE strings for the same concept, one mapping each hop**:
  manifest.json (`REAL_CACHED`...) → API `DataStatus` (`REAL_SOURCE_LOCALLY_CACHED`...,
  `backend/app/services/provenance_service.py`) → frontend `DataStatus`
  (`ApiOceanDataAdapter.mapApiStatus()`). Never conflate these three when reading code.
- **Frontend**: `src/data/ApiOceanDataAdapter.ts` is now the **default** (`createDataAdapter()`
  in `src/data/index.ts`). `CachedRealDataAdapter` retained, gated behind
  `VITE_USE_LOCAL_CACHE_ADAPTER=true` (dev-only, logs a warning if set).
  `src/data/api/{client,types}.ts`. `ObservationQuery.dataCentres?` added (additive).
  `getObservations()` returns lightweight summaries (no depth arrays — cheap list query);
  `getObservation(id)` fetches the full temperature+salinity profile. This split is
  deliberate — see `docs/data-contract.md`.
- **Tests**: `ApiOceanDataAdapter.test.ts` (fetch-mocked, always runs, 84 total incl. rest of
  suite) + `ApiOceanDataAdapter.integration.test.ts` (real HTTP, `npm run test:integration`,
  skips cleanly without a live backend — verified both ways: 5/5 pass against a running
  uvicorn, and clean skip without one).
- Docs written: `docs/backend.md`, `docs/api.md`, `docs/data-contract.md` (new);
  `README.md`, `docs/architecture.md`, `docs/data-provenance.md` updated in place.
  `docs/phase-0-audit.md` untouched, as instructed.
- **Nothing committed yet** — see the report for the exact commit about to be made.

## Phase 1 result (2026-09-10) — APPROVED

- Toolchain: **React 19.3 / TS 7.0 / Vite 8.2 / Vitest 5.0** — npm resolved newer than the
  proposed React 18. Current stable; nothing depended on 18. `tsc --noEmit` clean under
  strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`.
- Domain model in `src/domain/`: `variables.ts` (OceanVariable + meta + formatters),
  `platforms.ts`, `quality.ts` (Argo QC mapping from Phase 0), `provenance.ts`
  (DataStatus + DataSourceDescriptor + forbidden-claims list + DEMO ids), `layers.ts`
  (heterogeneous EvidenceLayer registry), `types.ts` (grids/slices/profiles/collocation).
- `src/data/adapter.ts` = `OceanDataAdapter` interface. `src/data/adapters/{netcdf,erddap,
  opendap,ogcwms}.ts` = placeholders that throw `NotImplementedError`.
- `src/state/analysisStore.ts` = the one linked Zustand store. 15 transition tests.
- `src/honesty.test.ts` scans the tree for forbidden claims ("Processing status: verified"
  etc.) and fails the build if any reappear. **Keep this passing.**
- `src/App.tsx` is a labelled scaffold ("PHASE 1 FOUNDATION — NOT THE PRODUCT UI"), replaced
  wholesale in Phase 3.
- Architecture + component tree: `docs/architecture.md`.
- **Availability is data, not code.** Type unions are complete; `DataSourceDescriptor.status`
  decides what renders. Phase 2 writes the layer registry.

**Working agreement: one phase at a time.** Implement → run → test → visually verify against
the Claude Design reference → document known issues → report → *wait for explicit approval*.
No speculative cross-phase work.

## Source of the design

Claude Design project `02b36dfc-4d04-4d3e-8cc9-2252628d1e04`, read via the `DesignSync`
tool (needs `/design-login` once per session).

```
OceanLens India.dc.html   canonical artboard, 1600x1000, 134 KB  <- layout/palette/copy authority
support.js                Claude Design canvas runtime           <- DO NOT ship; spec only
ocean-field.js            domain module (window.OceanField)      <- data/math authority
ocean-scene.jsx           React scene, d3-geo + topojson
profile-chart.jsx         React SVG depth profile
timeline-rail.jsx         React playback rail
screenshots/*.png         9 refs; full.png, scene.png, contrast.png, 01-states.png reviewed
```

`.jsx` files are plain React (`React.createElement`, no JSX syntax) with `module.exports`.
They port to TS with little friction.

## Locked decisions

1. **Renderer: canvas-2D + SVG oblique projection.** No Three.js / R3F / Cesium without
   explicit approval. Keep it behind a renderer interface for a future WebGL path.
2. **Reconciliation:** `ocean-field.js` wins data structures, field math, platforms,
   profiles, statistics, timeline. `.dc.html` wins layout, hierarchy, palette, copy, design.
   One canonical vocabulary — never ship two.
3. **Vocabulary:**
   ```ts
   type OceanVariable = "temperature" | "salinity" | "currentSpeed" | "chlorophyll";
   type QualityFlag  = "GOOD" | "PROBABLY_GOOD" | "SUSPECT" | "BAD";
   ```
4. **Layout:** left rail 300px, right panel 360px at 1440x900; full composition at 1920x1080;
   flexible centre stage; no horizontal scroll.
5. **Stack:** React 19 + TypeScript strict + Vite + Zustand for the browser; Python + FastAPI
   for scientific data services; CSS custom properties/Modules; hand-rolled SVG charts.
   Smallest dependency set possible. No Tailwind, no chart library.

## Data integrity rules (non-negotiable)

Real data preferred, in this order: INCOIS → public Argo → ERDDAP → NetCDF/OPeNDAP →
other public model data → deterministic synthetic *only* where real is unobtainable.

Never display synthetic data as `verified`, `official`, or `live`. Use:
- `Processing status: locally validated`
- `Source status: real source, locally cached`
- `Source status: synthetic test fixture`
- `Source status: precomputed derived layer`

Demo identifiers must be obviously demo: `DEMO-OCN-2026-001`, `DEMO-RUN-…`, `DEMO-PROVENANCE`.

Do not fabricate: live INCOIS feeds, official Argo results, DOIs, institutional identifiers,
real-time alerts, ML anomaly layers, auth/roles, or unmeasured accuracy claims. Unavailable
capability is shown as `Future adapter` / `Planned extension` / `Not available in MVP`.

## Verified real data sources (probed 10 Sep 2026)

### Argo GDAC — observations. CONFIRMED WORKING.
- Host `https://data-argo.ifremer.fr/` — public, no auth.
- **INCOIS is itself an Argo DAC**: `/dac/incois/` → **625 real floats**.
- Daily Indian Ocean aggregate: `/geo/indian_ocean/YYYY/MM/YYYYMMDD_prof.nc` (~4.2 MB/day,
  ~83 profiles, ~3 in the Bay of Bengal box 5–23°N 78–95°E).
- Per-float full history: `/dac/incois/<wmo>/<wmo>_prof.nc` (~147 KB, many cycles) —
  **preferred harvest route**: few files, many timesteps.
- Global index `ar_index_global_prof.txt.gz` = 58 MB, updated daily.
- **Format is NetCDF-3 classic (`CDF\x01`)**. Phase 2 verified the source by parsing it with
  the pure-JS `netcdfjs` npm package. That parser is now a transition-era feasibility tool;
  the approved backend refactor will use Python NetCDF tooling for application services.
- Real values pulled: WMO 1902594 @ 9.11°N 86.80°E, 2026-09-03, 242 good levels to 1974 dbar,
  29.38 °C surface → 24.26 @100 m → 14.45 @200 m → 10.20 @500 m; S 33.92 surface / 34.91 @50 m.
- Provenance fields available: `PLATFORM_NUMBER`, `DATA_CENTRE`, `CYCLE_NUMBER`, `DATA_MODE`
  (R/A/D), `PI_NAME`, `PROJECT_NAME`, `POSITIONING_SYSTEM`, `WMO_INST_TYPE`, `POSITION_QC`,
  `PROFILE_<VAR>_QC`, per-level `<VAR>_QC`, plus `_ADJUSTED` and `_ADJUSTED_ERROR`.
- **Argo QC flags map exactly onto our enum**: `1`→GOOD, `2`→PROBABLY_GOOD, `3`→SUSPECT,
  `4`→BAD. No invention required.

### HYCOM GOFS 3.1 — model field. AVAILABLE, WITH A DATE CONSTRAINT.
- NCSS: `https://ncss.hycom.org/thredds/ncss/grid/GLBy0.08/expt_93.0/ts3z` (HTTP 200).
- `water_temp`, `salinity`; 1/12°; 40 z-levels (0,2,…,100,125,150,200,250,…).
- **Time coverage 2018-12-04 → 2024-09-05.** Does *not* reach Sep 2026. See open question Q2.

### Not usable / not yet resolved
- Argovis `/profiles` → `not found` (API path changed; not needed given GDAC works).
- NOAA NCEI WOA23 THREDDS → timed out on probe. Fallback only; recheck if HYCOM is dropped.
- No public INCOIS ERDDAP confirmed yet. INCOIS data reaches us *through* the Argo GDAC.

## Gotchas discovered

- **Phase 2 `netcdfjs` reader returns 2-D char variables flattened one char per element.**
  If the transition script is used, slice by the
  trailing string-dimension width; do not index `[i]`. Numeric 2-D vars are flat row-major
  `[i * N_LEVELS + k]`. `variable.dimensions` holds dimension **ids**, resolve via
  `nc.dimensions[id]`. Cost me three probe iterations — don't repeat it.
- `JULD` is days since 1950-01-01 UTC. Fill value 99999.
- Real INCOIS floats sometimes have `PROFILE_TEMP_QC = E/F` (near-zero good levels) in
  real-time mode. This is genuine and *useful* — the QC badge and good-only filter have real
  work to do. Do not filter it away silently.
- `ocean-scene.jsx` fetches world-atlas TopoJSON from jsDelivr at runtime and waits on
  `window.d3` / `window.topojson`. **Must be vendored** — the demo has to run offline.
- The artboard is fixed 1600x1000; `full.png` shows the provenance strip visibly overlapping
  when narrower. Rails must become responsive.
- The artboard currently asserts `Processing status: verified`, `✓ Verified source`, a DOI
  and `INCOIS-OPS-2026-114` over non-real data. All must change.

## Local tooling

Node v26.5.0 · npm 11.17.0 · Python 3.12.13. The approved backend refactor will add a
Python virtual environment with NumPy, xarray and a NetCDF reader. Until that refactor is
complete, the Phase 2 transition scripts remain JavaScript-based. Afterward, Python owns
scientific ingestion and service delivery; the browser does not parse NetCDF.

## Scratch

Probe scripts and decoded screenshots:
`/private/tmp/claude-501/-Users-kshaunish/a3e34b40-8851-40eb-af8a-6372886a30d8/scratchpad/`
(`probe/probe3.mjs` is the working Argo reader — start from it in Phase 2.)
