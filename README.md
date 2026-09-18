# OceanLens India

A browser-native 3D ocean **evidence workspace** for INCOIS. For a chosen location, depth and
time: see what the numerical model predicts, what the instrument actually observed, and how well
they agree — in one scene, with provenance and quality flags always visible.

![The 3D evidence scene](slides/screenshots/slide1-fig1-3d-scene.png)

*A real, depth-referenced 3D scene. Every marker is a clickable Argo float; the slice plane sits at
the selected depth inside a fixed depth-box frame.*

---

## The problem

Ocean forecasts are only as trustworthy as their agreement with real measurements. Today, answering
*"does the model match reality at this location and depth?"* means:

- pulling model output (HYCOM/NEMO subsets) and observation data (Argo NetCDF) from separate
  services, in separate formats;
- writing a one-off script to interpolate, depth-match and compare them;
- doing it again per variable, per float, per study.

The comparison lives in throwaway notebooks, not in an operational tool. Quality flags and
provenance — which float, which processing steps, which QC level — get lost along the way. And when
model and observation *do* disagree, there is no fast way to tell whether the model is wrong or the
instrument is failing.

## The solution

OceanLens collapses that whole workflow into one click-through loop:

1. **Pick** a variable, depth and time in the control rail.
2. **See** the real model depth-slice and real observations together in a depth-referenced 3D scene.
3. **Click** any observation marker.
4. **Inspect** it in three linked views:
   - **Profile** — the float's own measured depth curve against the nearest real model column.
   - **Comparison** — RMSE, mean bias, horizontal distance, time offset, and a per-depth-band
     agreement verdict.
   - **Provenance** — dataset origin, originator, retrieval time, every processing step, QC summary,
     caveats and licence.

Because the same loop shows *both* sides of the comparison, it doubles as an instrument-health
monitor: a float whose salinity drifts ~2 PSU from the model below 200 m while still passing its own
routine QC flag is visible immediately.

<p align="center">
  <img src="slides/screenshots/slide1-fig2-profile-chart.png" width="45%" alt="Profile view" />
  <img src="slides/screenshots/slide1-fig3-comparison-stats.png" width="45%" alt="Comparison view" />
</p>

*Left: observed vs. modelled, depth by depth. Right: agreement isn't asserted, it's computed —
RMSE, mean bias, and per-depth-band verdicts from real data.*

### What makes it different

- **Evidence-first.** Most tools show model fields *or* observations. This fuses them into one
  inspectable object per observation.
- **Radically honest about data.** Nothing is labelled *verified*, *official*, *live* or *real-time*
  unless it genuinely is. Unavailable capability is explicitly marked, never faked — and a unit test
  fails the build if a forbidden claim string reappears in the source.
- **Browser-native.** No native install, no GPU cluster, no desktop GIS licence. WebGL2 in any
  modern browser.

---

## Technical architecture

![Architecture](slides/screenshots/slide2-fig1-architecture-methodology.png)

Three zones, one direction of trust: raw public data → validated local cache → science API → client.

### 1. Ingestion & validation (Node scripts, offline)

`scripts/prepare-real-data.mjs` harvests real NetCDF from the Argo GDAC and HYCOM's NCSS service,
decodes it, and normalises it into a committed cache. `scripts/validate-real-data.mjs` is a hard
gate: it fails on missing variables, bad units, unsorted depths, out-of-region coordinates,
unparseable times, dropped QC, or a source claiming to be "real" with no source reference. A
truncated HYCOM download (valid header, partial body — a real and frequent failure of that service)
is rejected on file size before it can reach the cache.

This stage is **off the request path** — it runs on a schedule, not per user request.

### 2. Python + FastAPI science service

Owns everything scientific. The browser never parses NetCDF and never sees a raw array.

| Module | Responsibility |
|---|---|
| `app/data/cache_reader.py` | Loads `public/data/real/` into NumPy arrays once, at startup. No network. |
| `app/data/netcdf_reader.py` | A real, tested NetCDF reader for raw Argo/HYCOM — used by ingestion, not the demo request path. |
| `app/data/array_loader.py` | Bilinear horizontal slices and model columns; nearest-timestamp snapping. |
| `app/science/` | QC mapping, UNESCO-1983 depth conversion, interpolation, geometry (haversine), statistics, collocation. |
| `app/services/` | Slice, observation, profile, collocation, provenance and briefing services. |
| `app/api/` | 8 route modules under `/api/v1`. |

Every statistic is computed per-request from the real arrays. Nothing is hard-coded. Requests that
cannot be answered honestly fail loudly — e.g. a collocation for `currentSpeed` (Argo floats in this
cache carry no current sensor) returns `422`, not a plausible-looking wrong number.

**Endpoints:** `/health`, `/api/v1/metadata`, `/times`, `/observations`, `/observations/{id}`,
`/slice`, `/model-column`, `/profile/{id}`, `/collocation/{id}`, `/provenance`,
`POST /briefing/{id}`.

### 3. React + TypeScript client

| Layer | What it does |
|---|---|
| `src/domain/` | The typed vocabulary — variables, platforms, QC flags, provenance/`DataStatus`, layer registry. |
| `src/data/` | `OceanDataAdapter` interface; `ApiOceanDataAdapter` (the default) is the *only* thing that talks HTTP. |
| `src/state/` | Two Zustand stores: `dataStore` (adapter + loaded data) and `analysisStore` (variable/depth/time/selection/filters). |
| `src/ui/scene/` | Three.js scene — depth-slice plane, geospatially projected Argo markers, vendored real coastline, depth-box frame, WebGL context-loss recovery. |
| `src/ui/EvidencePanel/` | Profile, Comparison, Provenance, Model-point and Briefing panels. |
| `src/ui/ControlRail/` | Variable/layer/depth/observation-filter controls, with real per-variable availability. |

No component reads the data cache or calls `fetch` directly. Charts are hand-rolled SVG — no chart
library. Colour ramps used by the WebGL texture are copied from the same CSS custom properties the
legend uses, so the scene and the legend cannot drift apart.

### Stack

**Frontend:** React 19 · TypeScript (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) ·
Vite · Three.js · Zustand · CSS Modules
**Backend:** Python 3.11+ · FastAPI · NumPy · Pydantic
**Deliberately absent:** Tailwind, any chart library, any 3D-globe framework, any UI kit.

---

## Requirements

- Node ≥ 20 (developed on Node 26)
- Python ≥ 3.11 (developed on Python 3.12)
- No login, API key or network access is needed for the offline demonstration once the cache and
  backend environment are prepared.

## Run

**Backend:**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

```bash
curl http://localhost:8000/health
curl http://localhost:8000/api/v1/metadata
curl http://localhost:8000/api/v1/provenance
```

**Frontend:**

```bash
npm install
npm run dev                        # http://localhost:5173
```

The frontend reaches the backend via `VITE_API_BASE_URL` (defaults to `http://localhost:8000`; see
[`.env.example`](.env.example)). CORS on the backend is locked to the dev origin.

### Optional: briefing mode

`POST /api/v1/briefing/{id}` generates a short natural-language reading of an *already-computed*
collocation result. It is strictly optional and off by default — without
`OCEANLENS_OPENAI_API_KEY` set on the backend, the route returns `503` and the UI hides the feature.
The model is sent only the already-calculated evidence; it gets no tools, no live data access, and no
ability to alter a science result.

## Tests and verification

```bash
npm run typecheck                  # tsc --noEmit, strict
npm test                           # 240 unit tests (22 integration tests skip without a backend)
npm run test:integration           # real HTTP against a running backend
npm run build                      # tsc + vite build

cd backend && pytest               # 100 tests
```

`tests/test_netcdf_reader.py` additionally exercises the raw NetCDF reader against files in
`.cache/raw/`; it needs the optional `netCDF4` package and the raw downloads present.

Every phase of this project was verified the same way: unit + integration tests, a clean
typecheck/build, **and** a live browser check against the real running backend — not code review
alone. Real defects caught and fixed this way include a backend nearest-timestamp bug that silently
returned the wrong day's data, a WebGL context-loss crash that blacked out the scene mid-session, and
several narrow-viewport layout failures.

---

## Real data

The project runs on a **locally cached extract of real public data** in `public/data/real/`
(committed, ~13 MB / ~5 MB gzipped). FastAPI reads this cache directly and serves normalised,
provenance-aware JSON. The demonstration window is **historical and labelled as such**: 2023-09-25 →
2023-10-05, 11 daily steps, Bay of Bengal.

| Dataset | Real or synthetic | Source | Variables | Time range | Transformations |
|---|---|---|---|---|---|
| Argo profiles — 28 profiles, 19 from INCOIS (Indian Argo Project) | **Real, locally cached** | Argo GDAC — `https://data-argo.ifremer.fr/dac/` (`incois/`, `csio/`) | `PRES`, `TEMP`, `PSAL` (+ `_ADJUSTED`, per-level `_QC`) | 2023-09-25 … 2023-10-05 | index-selected for region+window; primary vertical-sampling record; adjusted fields used in delayed/adjusted mode; `PRES` (decibar) → depth (m) via UNESCO 1983; `PRES_QC = 4` levels dropped; QC mapped to `GOOD/PROBABLY_GOOD/SUSPECT/BAD` (per-level values retained); duplicate depths collapsed; sorted shallow→deep |
| HYCOM GOFS 3.1 temperature & salinity (GLBy0.08 `expt_93.0`) | **Real, precomputed subset** | NCSS — `https://ncss.hycom.org/thredds/ncss/grid/GLBy0.08/expt_93.0/ts3z` | `water_temp`, `salinity` | 2023-09-25 … 2023-10-05, daily 00:00 UTC (11 steps) | NCSS bbox subset (8–20.5 °N, 81–93 °E); `short` → float via `scale_factor`/`add_offset`; `_FillValue` → NaN; render cache decimated (stride 3) to 14 depth levels; native-resolution 40-level model columns extracted at every float position |
| HYCOM GOFS 3.1 u/v currents (`expt_93.0`) | **Real, precomputed subset** | NCSS — `…/expt_93.0/uv3z` | `water_u`, `water_v` | same window | same pipeline; current speed shown = √(u² + v²) |
| Coastline geometry (India, Sri Lanka, Bangladesh, Myanmar, Thailand, Indonesia) | **Real, vendored** | Natural Earth 1:50m via world-atlas (public domain) | polygon rings | — | clipped to within 6° of the region, long rings decimated; served as a static asset, never fetched from a CDN at runtime |
| Model–observation collocation (RMSE, mean bias, band agreement, distance, time offset) | **Derived from real source** | computed per-request in the backend | — | — | haversine distance to nearest model grid column; observation time − model time; RMSE and mean bias over QC-good, depth-paired levels; deterministic interpretation string |
| BGC-Argo, gliders, CTD casts, satellite SST, satellite chlorophyll, advisories, ML anomaly | **Not available in MVP / planned extension** | — | — | — | investigated; no usable real source prepared for this window. Shown as unavailable, never faked. |

Full provenance — exact file names, SHA-256 checksums, retrieval timestamps, units, coordinate
systems, QC semantics and every transformation — is in
[`public/data/real/manifest.json`](public/data/real/manifest.json) and
[`docs/data-provenance.md`](docs/data-provenance.md).

### Regenerating the cache

```bash
npm run data:prepare     # download real Argo + HYCOM into .cache/raw/, then normalise
npm run data:validate    # the gate (see "Ingestion & validation" above)
```

`.cache/raw/` is git-ignored; `public/data/real/` is committed. HYCOM's NCSS service is slow and
intermittent, so the preparation script retries with backoff and rejects short files.

## Data honesty rules

Non-negotiable, and enforced in code:

- Nothing is labelled *verified*, *official*, *live* or *real-time*. `src/honesty.test.ts` scans the
  tree and fails the build if a forbidden claim string reappears.
- Demo identifiers are obviously demo (`DEMO-OCN-…`).
- The historical window is labelled everywhere it is shown.
- Three separate provenance vocabularies exist — manifest status → API `DataStatus` → frontend
  `DataStatus` — with one explicit mapping per hop, so a cached source can never be presented as a
  live one. Covered by `backend/tests/test_provenance.py`.
- Unavailable capability renders as *Future adapter* / *Planned extension* / *Not available in MVP* —
  never as a fabricated result.
- No fabricated DOIs, institutional identifiers, live feeds, alerts or accuracy claims.

---

## Project layout

```
backend/            Python + FastAPI science service (app/{data,science,models,services,api}, tests/)
src/domain/         Typed vocabulary: variables, QC, provenance, layer registry
src/data/           OceanDataAdapter + ApiOceanDataAdapter (the only HTTP caller)
src/state/          Zustand stores: dataStore, analysisStore
src/ui/             AppShell, NavRail, CommandBar, ControlRail/, SceneStage, EvidencePanel/, TimelineRail
src/ui/scene/       Three.js scene, slice textures, palettes, markers, coastline
scripts/            Ingestion, normalisation, validation, coastline preparation
public/data/real/   The committed real-data cache + manifest.json
docs/               architecture, backend, api, data-contract, data-provenance, phase-0-audit
slides/             SIH deck content + screenshots
```

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — component tree and boundaries
- [`docs/backend.md`](docs/backend.md) — service internals
- [`docs/api.md`](docs/api.md) — endpoint reference
- [`docs/data-contract.md`](docs/data-contract.md) — the adapter boundary, field by field
- [`docs/data-provenance.md`](docs/data-provenance.md) — layer classification and regeneration

## Roadmap

Deferred deliberately, not overlooked:

- Scheduled near-real-time ingestion, replacing the historical HYCOM archive with a current
  operational feed.
- Additional platforms and layers: gliders, CTD casts, BGC-Argo, satellite SST/chlorophyll,
  advisories.
- OGC WMS/WCS and OPeNDAP source integration; a true sensor-plugin system.
- Volume rendering beyond the depth-slice plane; colourbar editing and log scaling.

## Data attribution

- **Argo** — data collected and made freely available by the International Argo Program and the
  national programmes that contribute to it (https://argo.ucsd.edu), part of the Global Ocean
  Observing System. INCOIS is itself an Argo DAC.
- **HYCOM GOFS 3.1** — HYCOM consortium / U.S. Naval Research Laboratory (https://www.hycom.org).
- **Coastline** — Natural Earth (public domain) via world-atlas.

Built for Smart India Hackathon 2026.
