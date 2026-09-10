# OceanLens India — architecture

Living document. Phases 0–2 establish the typed foundation and real-data cache.
The next approved phase is the Python/FastAPI backend refactor, followed by the
React UI port.

## Stack

| Concern | Choice | Version (resolved) |
|---|---|---|
| Build / dev | Vite + `@vitejs/plugin-react` | vite 8.2, plugin 6.1 |
| UI | React | 19.3 |
| Language | TypeScript, strict + extras | 7.0 |
| State | Zustand | 5.0 |
| Tests | Vitest | 5.0 |
| Styling | CSS custom properties + CSS Modules (Modules arrive in Phase 3) | — |
| Charts | hand-rolled SVG (Phase 5) | — |
| Scene | canvas-2D + SVG oblique projection, behind a renderer interface (Phase 4) | — |
| Geo | `d3-geo`, `d3-contour`, `topojson-client`, TopoJSON vendored (Phase 4) | — |
| Backend | Python + FastAPI + Uvicorn (approved Phase 2.5 refactor) | planned |
| Scientific processing | NumPy + xarray + netCDF4/h5netcdf (backend refactor) | planned |
| Backend validation | pytest + httpx (backend refactor) | planned |

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
    CachedRealDataAdapter   (Phase 2 transition adapter; retained for tests/comparison)
    ApiOceanDataAdapter     (approved Phase 2.5 target; default after refactor)

  state/
    analysisStore.ts       the single linked analysis store (Zustand)
    analysisStore.test.ts

  styles/
    tokens.css             every colour + type + layout token, from the artboard
    global.css             reset + body + scrollbars + focus ring

scripts/                   (Phase 2) prepare-real-data.mjs, validate-real-data.mjs
public/data/               (Phase 2) real/, manifests/; backend reads this cache
backend/                   (approved Phase 2.5) FastAPI app, science services, tests
docs/                      audit, architecture, data provenance, backend/API contracts
```

## The data boundary

Everything the UI knows about ocean data continues to come through
`OceanDataAdapter` (`src/data/adapter.ts`). The approved target implementation
is `ApiOceanDataAdapter`, which calls FastAPI. The browser will not parse NetCDF,
perform collocation, or read scientific arrays directly.

The backend will own:

- NetCDF reading and normalization
- QC mapping and depth conversion
- Interpolation and spatial subsetting
- Model–observation collocation
- RMSE, mean bias and agreement statistics
- Provenance-aware API responses

The Phase 2 `CachedRealDataAdapter` remains a transition adapter for tests and
comparison while the backend is built. Four future-source placeholders
(`NetCDFAdapter`, `ERDDAPAdapter`, `OPeNDAPAdapter`, `OGCWMSAdapter`) remain
architectural adapters and are not active network services.

The approved data flow is:

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

- **Numerics**: Phase 2 TypeScript results are the compatibility reference. The
  Phase 2.5 Python science services must reproduce them within documented
  tolerances using the same real cached arrays. RMSE, mean bias and collocation
  distance must never be hard-coded.
- **Store**: transition tests (done, 15 cases).
- **Honesty**: `honesty.test.ts` fails the build if a forbidden claim string reappears.
- **Backend**: pytest and httpx will validate cache loading, API responses,
  provenance, unsupported layers and numerical compatibility.
- UI rendering is validated visually against the reference, not with snapshot tests, at
  hackathon scope.
