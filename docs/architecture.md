# OceanLens India — architecture

Living document. Phase 1 establishes the skeleton; later phases fill it in.

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
    DemoOceanDataAdapter    (Phase 2) reads the locally cached real-data extract

  state/
    analysisStore.ts       the single linked analysis store (Zustand)
    analysisStore.test.ts

  styles/
    tokens.css             every colour + type + layout token, from the artboard
    global.css             reset + body + scrollbars + focus ring

scripts/                   (Phase 2) prepare-real-data.mjs, validate-real-data.mjs
public/data/               (Phase 2) real/, manifests/
docs/                      audit, architecture, (Phase 2) data-provenance.md
```

## The data boundary

Everything the UI knows about ocean data comes through `OceanDataAdapter` (`data/adapter.ts`).
All methods are async even where the MVP answers synchronously, so a networked adapter is a
drop-in. Four placeholder adapters (`NetCDFAdapter`, `ERDDAPAdapter`, `OPeNDAPAdapter`,
`OGCWMSAdapter`) compile and throw `NotImplementedError` with a message that explains they
are architectural, not broken.

## Availability is data, not code

`OceanVariable` and `PlatformType` are the complete contract unions and are never narrowed.
Whether a given layer is actually available is carried by its `DataSourceDescriptor.status`,
one of:

```
REAL_CACHED  PRECOMPUTED_FROM_REAL  DERIVED_FROM_REAL
SYNTHETIC_FIXTURE  NOT_AVAILABLE_MVP  PLANNED_EXTENSION
```

Phase 2's per-layer investigation writes the registry; the UI renders availability from it.
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

Nothing above `domain/` and `state/` exists yet. Phase 3 builds it against the four reviewed
screenshots plus the five deferred state screenshots.

## Testing strategy

- **Numerics** (`domain/`, and Phase 2 stats): unit tested against hand-computed fixtures and
  real Phase 0 values. RMSE, mean bias, collocation distance must be provably correct and
  computed from the same arrays the chart plots — never hard-coded.
- **Store**: transition tests (done, 15 cases).
- **Honesty**: `honesty.test.ts` fails the build if a forbidden claim string reappears.
- UI rendering is validated visually against the reference, not with snapshot tests, at
  hackathon scope.
