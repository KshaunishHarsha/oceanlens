# OceanLens India — architecture

Living document. Phases 0–2 establish the typed foundation and real-data
cache. The Python/FastAPI backend refactor is complete. The React UI port is
next — the backend is not yet wired into the on-screen product.

## Stack

| Concern | Choice | Version (resolved) |
|---|---|---|
| Build / dev | Vite + `@vitejs/plugin-react` | vite 8.2, plugin 6.1 |
| UI | React | 19.3 |
| Language | TypeScript, strict + extras | 7.0 |
| State | Zustand | 5.0 |
| Tests | Vitest | 5.0 |
| Styling | CSS custom properties + CSS Modules (Modules arrive in the UI phase) | — |
| Charts | hand-rolled SVG (next phase) | — |
| Scene | canvas-2D + SVG oblique projection, behind a renderer interface (next phase) | — |
| Geo | `d3-geo`, `d3-contour`, `topojson-client`, TopoJSON vendored (next phase) | — |
| Backend | Python + FastAPI + Uvicorn | implemented — `backend/` |
| Scientific processing | NumPy + xarray + netCDF4/h5netcdf | implemented — `backend/app/science/`, `backend/app/data/` |
| Backend validation | pytest + httpx | implemented — 89 tests |

**Deviation from the Phase 0 proposal:** npm resolved React 19 / TS 7 / Vite 8 / Vitest 5
rather than React 18. These are current stable releases; nothing in the plan depends on
React 18 specifically. Recorded here so it is a decision, not a surprise.

`tsconfig` strict extras in force: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`.

## Directory layout

```
src/
  main.tsx                 entry; mounts <App>
  App.tsx                  PHASE 1 scaffold — replaced wholesale in Phase 3
  honesty.test.ts          scans the tree for forbidden data claims

  domain/                  pure types and vocabularies, no React, no I/O
    variables.ts           OceanVariable + per-variable metadata, formatters
    platforms.ts           PlatformType + per-platform metadata
    quality.ts             QualityFlag + Argo QC mapping (verified in Phase 0)
    provenance.ts          DataStatus, DataSourceDescriptor, forbidden claims, DEMO ids
    layers.ts              EvidenceLayer registry shape (heterogeneous layers)
    types.ts               grids, slices, profiles, collocation, dataset metadata
    index.ts               barrel
    domain.test.ts

  data/
    adapter.ts             OceanDataAdapter interface + NotImplementedError
    adapters/              (Phase 1) future-source placeholders
      netcdf.ts
      erddap.ts
      opendap.ts
      ogcwms.ts
    api/
      client.ts             fetch wrapper: base URL, error types, no silent fallback
      types.ts               Api* wire types, snake_case, matching the Pydantic models
    ApiOceanDataAdapter.ts   DEFAULT production adapter — calls FastAPI, translates responses
    ApiOceanDataAdapter.test.ts               fetch-mocked, always runs
    ApiOceanDataAdapter.integration.test.ts   real HTTP, skips without a live backend
    CachedRealDataAdapter.ts  retained for fallback/comparison ONLY — gated behind
                              VITE_USE_LOCAL_CACHE_ADAPTER, never the default
    FixtureDataAdapter.ts    synthetic, imported by tests only, never the app

  state/
    analysisStore.ts       the single linked analysis store (Zustand)
    analysisStore.test.ts

  styles/
    tokens.css             every colour + type + layout token, from the artboard
    global.css             reset + body + scrollbars + focus ring

scripts/                   prepare-real-data.mjs, validate-real-data.mjs — still the
                            only thing that has produced the committed cache
public/data/               real/, manifest.json; the single source of truth, read
                            directly by the backend (no copy)
backend/                   FastAPI app, science modules, services, 89 tests
docs/                      audit, architecture, backend, api, data-contract,
                            data provenance
```

## The data boundary

Everything the UI will know about ocean data comes through `OceanDataAdapter`
(`src/data/adapter.ts`). The default implementation is now
`ApiOceanDataAdapter`, which calls FastAPI. The browser does not parse NetCDF,
perform collocation, or read scientific arrays directly on the default path.

The backend owns:

- NetCDF reading and normalisation (a real, tested capability in
  `backend/app/data/netcdf_reader.py` — but the running demo reads the
  already-normalised cache, not raw NetCDF; see `docs/backend.md`)
- QC mapping and depth conversion
- Interpolation and spatial subsetting
- Model–observation collocation
- RMSE, mean bias and agreement statistics
- Provenance-aware API responses, in its own status vocabulary
  (`docs/data-contract.md` documents the translation to the frontend's)

`CachedRealDataAdapter` remains a retained adapter for tests and comparison —
gated behind `VITE_USE_LOCAL_CACHE_ADAPTER=true` (development only, logs a
visible warning), never the default. Four future-source placeholders
(`NetCDFAdapter`, `ERDDAPAdapter`, `OPeNDAPAdapter`, `OGCWMSAdapter`) remain
architectural adapters and are not active network services.

The implemented data flow is:

```text
Argo / HYCOM NetCDF
        ↓
scripts/prepare-real-data.mjs (Node — unchanged in this phase)
        ↓
Validated local cache (public/data/real/)
        ↓
FastAPI services (backend/app — Python, science/ + services/ + api/)
        ↓
ApiOceanDataAdapter.ts (TypeScript — HTTP + shape translation only)
        ↓
React / Zustand workspace (next phase — not yet wired)
```

## Availability is data, not code

`OceanVariable` and `PlatformType` are the complete contract unions and are never narrowed.
Whether a given layer is actually available is carried by its `DataSourceDescriptor.status`,
one of:

```
REAL_CACHED  PRECOMPUTED_FROM_REAL  DERIVED_FROM_REAL
SYNTHETIC_FIXTURE  NOT_AVAILABLE_MVP  PLANNED_EXTENSION
```

Phase 2's per-layer investigation writes the registry; the backend will expose
availability and provenance through the API, and the UI will render those
responses. Unsupported layers must remain unavailable rather than being filled
with synthetic values.
Adding a real source later is a data change.

Heterogeneous evidence layers (`domain/layers.ts`) let surface rasters (satellite SST),
advisories, and ML-derived fields coexist with depth-resolved fields without being forced
through the profile/collocation workflow — each layer declares its `kind` and whether it is
`collocatable`.

## The analysis store

One Zustand store (`state/analysisStore.ts`) holds the linked state the brief requires to
stay synchronised: `variable`, `timestamp`/`timeIndex`, `depthM`, `verticalExaggeration`,
`renderMode`, `cameraPreset`, `layers`, `selectedObservationId`, `selectedTransect`,
`playback`, plus filters, workspace mode, evidence tab, colour scale and opacity.

Design notes:
- `timeIndex` and `timestamp` are kept mutually consistent by every mutator; `timestamp` is
  `null` until data loads, so no component ever shows a fabricated date.
- `stepTime` wraps, so timeline playback loops.
- `selectObservation(id)` also switches the evidence tab to `profile` — the brief requires a
  scene click to update the panel without a second action.
- `availableTimes` is owned by the data layer and pushed in via `setAvailableTimes`, which
  re-clamps the index if a shorter array loads.

## Component tree (Phase 3 target)

```
<App>
  <AppShell>                         CSS grid: nav / bar / strip / rail / stage / panel / timeline
    <NavRail/>                        60px; 7 sections (only Operations wired in MVP)
    <CommandBar/>                     58px; identity, dataset selector, search, mode toggle, share
    <ProvenanceStrip/>               26px; dataset, DEMO run id, CF note, locally-validated status
    <ControlRail/>                    300–338px
      <FieldConfiguration/>          variable picker (renderable variables only)
      <VisualAnalytics/>             layer toggles from the registry; unavailable ones disabled
      <DepthVerticalPerception/>     non-linear depth slider, exaggeration stepper
      <ScientificVisualStyling/>     palette, range, scale, opacity
      <ObservationFilters/>          platform types, time window, good-only, collocated-only
      <PlannedExtensions/>           NOT_AVAILABLE_MVP / PLANNED_EXTENSION layers, labelled
    <SceneStage/>                    flex; <OceanScene> (Phase 4) + camera toolbar + colorbar + legend
    <EvidencePanel/>                 360–398px
      <ObservationRecordHeader/>     platform id, position, time, real QC state, collocation
      <EvidenceTabs/>               PROFILE | COMPARISON | PROVENANCE
        <ProfileTab/>               <ProfileChart> (Phase 5) + RMSE/bias tiles (computed)
        <ComparisonTab/>            depth-band agreement, collocation diagrams
        <ProvenanceTab/>            DataSourceDescriptor rows + processing chain
      <BriefingView/> <OutreachView/>   alternate modes
    <TimelineRail/>                  106px; transport, anomaly sparkline, event register, scrubber
```

Phase 3 builds the shell against the four reviewed screenshots plus the five
deferred state screenshots. The shell should use the API adapter after the
Phase 2.5 backend refactor; it must not bypass the service boundary.

## Testing strategy

- **Numerics**: the Python `science/` modules are ports of `src/domain/stats.ts`,
  tested against the same hand-computed fixtures. The collocation pipeline is
  additionally cross-checked end-to-end against an independent implementation;
  see `docs/data-contract.md`'s "Numerical compatibility" section for the exact
  reference values and the 1e-3 tolerance. RMSE, mean bias and collocation
  distance are never hard-coded in either language.
- **Store**: transition tests (15 cases).
- **Honesty**: `honesty.test.ts` fails the frontend build if a forbidden claim
  string reappears; `backend/tests/test_provenance.py` does the equivalent for
  API responses (no layer claims a status it hasn't earned).
- **Backend**: 89 pytest cases — cache loading, every route, QC/depth/
  statistics/geometry, provenance, unsupported layers, and API error paths.
  `python -m compileall app` as a fast import/syntax gate.
- **Frontend/backend boundary**: `ApiOceanDataAdapter.test.ts` (fetch-mocked,
  always runs — response mapping, status translation, error handling, no
  silent synthetic fallback) and `ApiOceanDataAdapter.integration.test.ts`
  (real HTTP, skips cleanly without a live backend; `npm run test:integration`
  runs it against one).
- UI rendering is validated visually against the reference, not with snapshot tests, at
  hackathon scope.

## Production migration path

Not implemented in this phase — the MVP intentionally stops short of these.
A production deployment would likely add:

- **xarray + Dask** for out-of-core processing of full-resolution model
  archives instead of a pre-decimated slice cache.
- **Zarr** as the on-disk/object-store format for model data, replacing the
  flat `.f32` files, with chunking aligned to how the API actually slices.
- **Object storage** (S3-compatible) for the cache instead of a repo-committed
  directory, with the backend reading over a signed URL or a mounted volume.
- **PostGIS** for spatial indexing of observations once the platform count is
  too large for an in-memory linear scan.
- **OGC WMS/WCS and OPeNDAP** endpoints so third-party GIS clients (not just
  this frontend) can consume the same real data.
- **Redis** (or similar) only if a computed result — a collocation, a slice —
  becomes expensive enough to justify caching it; the current dataset does not.
- **Institutional deployment**: behind INCOIS's own infrastructure, with the
  ingestion step (`scripts/prepare-real-data.mjs`, or its eventual Python
  successor) running on a schedule against live INCOIS/Argo/HYCOM feeds
  instead of a one-time harvest.

None of a database, queue, container orchestration, or authentication layer
were added in this phase — they were explicitly out of scope.
