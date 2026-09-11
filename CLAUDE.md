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
| Current phase | **Phase 4A complete. Phase 5A step 1 (real observed-vs-modelled profile chart) complete.** Step 3/4 wording overlap in 4A noted previously; treat 4A as functionally done. 5A steps 2–3 (real comparison/RMSE tab, provenance polish) not started. |
| Proposed next order | 0 → 1 → 2 → **2.5** → 3 → **4A** → **5A** → 4B → 5B → 6 → 7. The internal round should prioritise a working 3D model/observation loop before advanced rendering or data expansion. |
| Repo state | Backend (89 pytest, **unchanged across both 4A steps, the context-loss fix, and 5A step 1** — no API contract change; 5A step 1 exercises only the existing `/api/v1/observation(s)`, `/profile`, `/model-column` endpoints through the existing adapter). `SceneStage` renders a real Three.js/WebGL scene with a depth slice AND clickable real Argo markers, recovers correctly from a lost WebGL context. `EvidencePanel`'s Profile tab now renders a **real observed-vs-modelled depth chart** (hand-rolled SVG) for the selected Argo observation's temperature or salinity — see the Phase 5A step 1 entry below. 168 frontend tests green (16 skipped without a live backend), tsc clean, build OK (bundle ~824 KB gzip ~223 KB). Comparison tab and detailed provenance visualisations are still shells — Phase 5A steps 2–3. |

## Internal-round pivot — authoritative next work

The goal is not a broad data portal. It is a credible, browser-native **3D evidence
workspace**: select a variable, depth and time; see the model field and real Argo
observations in one scene; select an observation; inspect its vertical profile and its
agreement with the model. Use the committed historical cache for this round and label its
dates and provenance accurately.

### Phase 4A — 3D evidence scene (do now)

1. Replace `SceneStage`'s shell with a WebGL/Three.js scene fed only through the existing
   `OceanDataAdapter` / backend API boundary.
2. Render a real model depth slice for temperature, salinity and currents; use a simple,
   legible slice plane first rather than attempting full volume ray-marching.
3. Render geospatially correct Argo markers, honour the existing observation filters, and
   connect marker selection to `analysisStore.selectObservation`.
4. Connect the existing timeline, variable, depth, opacity and vertical-exaggeration state
   to the rendered scene. Preserve loading, error and unavailable-data states.

### Phase 5A — evidence panels (do now, after 4A)

1. Replace the profile shell with a depth-vs-variable chart for the selected Argo profile
   and closest model column.
2. Replace the comparison shell with the existing API's real collocation output: RMSE,
   mean bias, distance, time offset and depth-band agreement. Never fabricate a statistic.
3. Keep the source URL, source time, QC summary and historical-demo label visible beside
   every result.

### Defer to finalist work (do not block the internal round)

- Near-real-time scheduled ingestion and replacement of historical HYCOM GOFS 3.1 with a
  current operational model feed.
- Glider, CTD, BGC-Argo, satellite, advisory and ML-derived layers.
- ASCII/delimited-text ingestion, OGC WMS/WCS, OPeNDAP source integration and a true
  sensor-plugin system.
- Advanced volume rendering, full colourbar editing/log scaling, production scaling and
  polished outreach mode.

## Phase 5A step 1 result (2026-09-11) — real observed-vs-modelled profile chart

**`EvidencePanel`'s Profile tab no longer shows the "implemented in a later phase" shell.**
It renders a real depth-vs-variable chart comparing the selected Argo observation's own
measured levels against the closest real HYCOM model column at that position, for
temperature or salinity — the two variables Argo floats in this cache actually measure.
Backend untouched (`git status -- backend/` empty; 89/89 pytest), no new endpoint — only the
existing `getObservation`/`getModelColumn` adapter calls, already used elsewhere.

- **New**: `src/ui/EvidencePanel/profileComparison.ts` (pure, unit-testable — same split as
  `sliceTexture.ts`/`sceneStageState.ts`): `nearestTimestamp()`, `buildObservedSeries()`,
  `buildModeledSeries()`, `computeChartDomain()`, `selectProfileChartView()`.
  `useProfileComparison.ts` (hook, race-guarded like `useVolumeSlice.ts`: fetches the full
  observation then its model column; a model-column failure degrades to "observed only",
  never fails the whole view or fabricates a curve). `ProfileChart.tsx` +
  `ProfileChart.module.css` (hand-rolled SVG — no charting dependency added, per the
  project's locked "no chart library" decision).
- **Real finding, verified by reading the backend source, worked around rather than
  patched (out of this task's scope)**: `backend/app/services/slice_service.py`'s
  `get_model_column` does **not** snap to the nearest cached timestamp — an inexact
  `timestamp` query param silently falls back to `cache.grid.timestamps[0]` (the *first*
  cached timestamp), unlike `/slice`, which does snap and documents it. `nearestTimestamp()`
  sidesteps this by always requesting an exact, known-valid timestamp chosen from the
  already-loaded `analysisStore.availableTimes` axis (confirmed live: `times` always
  contains the value `nearestTimestamp()` returns — see the integration test). Worth a
  backend fix later so this isn't just a frontend workaround.
- **Chart design**: depth axis (y) increases downward, metres labelled; value axis (x)
  scaled to the real data's own min/max (not the variable's broad default range), so a
  single profile's actual shape is legible. Observed = solid line in `--cyan-bright` with
  per-level markers shaped (not just coloured) by QC — filled dot = GOOD/PROBABLY_GOOD,
  open ring = SUSPECT, cross = BAD — so quality survives greyscale viewing, and a BAD/SUSPECT
  level is never silently drawn as good or omitted. Modelled = dashed line in `--cyan-deep`
  (already reserved in `tokens.css` as "MODELED badge outline", now given its first real
  use). A meta row shows float id, variable+unit, real observed time, real model time, and
  the real dataset-name provenance strings (Argo + HYCOM) pulled from `dataStore.metadata`,
  never hardcoded. An HTML (not SVG-only) legend list plus an `aria-label` summary on the
  `<svg role="img">` cover accessibility; missing/QC-less levels are skipped, never
  zero-filled or interpolated across.
- **States covered** (`selectProfileChartView`, verified live in all three below):
  `unavailable-variable` (current speed / chlorophyll — Argo carries no such sensor; no
  fetch even attempted), `loading`, `error` (with retry), `no-valid-levels` (a real
  all-QC-failed profile like `ARGO-4903776-2`, `qc: BAD`, shows an honest empty message
  quoting its QC summary, not a broken/blank chart), `ready`. No-selection isn't a chart
  state — `EvidencePanel` already gates the tabs behind a selection.
- **Tests**: `profileComparison.test.ts` (20) — nearest-timestamp correctness (including
  "always one of the given real candidates" and "empty candidates → null, never a
  fabricated timestamp"), observed/modelled series extraction (null/missing-QC skipping,
  BAD levels retained not hidden), chart-domain padding against the real data extent, and
  every `selectProfileChartView` branch. `profileComparison.integration.test.ts` (3, live
  backend only) — a real temperature series end-to-end through the adapter, confirms
  `ARGO-4903776-2` stays a `200`/empty-series result rather than a `404`, confirms an
  out-of-region model-column request genuinely rejects. **168 total passing** (up from 148),
  16 skipped without a live backend (up from 13 — the new integration file).
- **Verified live** (`npm run test:integration`, backend running): 15/15 passing, including
  the 3 new cases. Backend `pytest`: 89/89, unchanged.
- **Verified**: `tsc --noEmit` clean; `vite build` clean, 71 modules (up from 67); dev
  server curl-probed implicitly via the browser check below.
- **Verified in an actual browser** (headless Chromium via Playwright, screenshots taken):
  selecting a real observation (`ARGO 2902770`) renders a real 102-level temperature curve
  with a visible dashed modelled line near the surface (HYCOM's shallower z-levels — the
  model line honestly stops where real model data ends, never extended to match the
  observation's full depth); switching to salinity re-renders correctly with real PSU
  values; switching to current speed shows the `unavailable-variable` state with its
  `UNAVAILABLE` badge; selecting the real QC-failed float (`ARGO 4903776`, `qc: BAD`) shows
  the honest `no-valid-levels` message, not a blank or broken chart. The 3D scene continued
  rendering correctly throughout (no regression from this change).
- **Gaps, stated plainly**:
  - The backend's model-column nearest-timestamp fallback bug (above) is worked around, not
    fixed — a future change to `get_model_column` itself would be a real, separate
    improvement.
  - The modelled line renders only as deep as HYCOM's own z-levels reach at that position;
    this is correct/honest behaviour (real data has a real depth limit), not a bug, but it
    was not obvious from the spec and is worth flagging so nobody "fixes" it into a
    fabricated deep extension.
  - No RMSE/bias numbers are shown on this tab by design — that is Comparison tab scope
    (Phase 5A step 2, explicitly deferred).
  - Chart is a fixed 320×300 viewBox scaled by CSS width:100% — not yet checked against the
    narrower 300px control-rail-driven layout breakpoints from Phase 1; likely fine given
    `viewBox` scaling but not pixel-verified at that width.

## Rendering regression fix (2026-09-11) — black SceneStage after WebGL context loss

**Real browser visual-QA finding, confirmed and fixed.** The user reported that with a real
backend running and real data confirmed loaded (2023-09-25, requested 685 m, actual 700 m),
the entire `SceneStage` rendered as a solid black rectangle — no plane, texture, legend,
loading, or error state visible. This was diagnosed as a genuine rendering bug, not a
test-only artefact, using headless Chromium via Playwright (no native browser tool was
available; `chromium-cli` was not installed, so the `run` skill's documented Playwright
fallback was used directly).

- **Root cause**: an unhandled **WebGL context loss**. Browser console capture showed
  `CONTEXT_LOST_WEBGL: loseContext: context lost` followed by Three.js's own internal
  `Context Lost.` / `Context Restored.` log lines — but `ThreeSceneCanvas.tsx` had no code
  listening for either event. React 19 `<StrictMode>` (wrapping `<App/>` in `main.tsx`)
  double-invokes mount effects in dev mode (mount → cleanup → mount); the first
  `WebGLRenderer` created during that cycle gets disposed, which force-loses the GL context
  on the shared `<canvas>` element. Three.js's built-in context-loss handling resets its own
  bookkeeping on restore but does **not** re-upload application-created textures/geometries —
  so every GPU resource this component had built (the depth-slice texture, the plane
  geometry, the marker sprite materials) was silently invalid from that point on, and the
  canvas stayed black forever with no visible error, matching the report exactly.
  Confirmed by direct inspection of `node_modules/three/build/three.module.js`:
  `WebGLRenderer.dispose()` removes its own context-loss listeners but does not itself call
  `forceContextLoss()`, and there is no automatic app-resource re-upload path.
- **Fix, in `src/ui/scene/ThreeSceneCanvas.tsx`**: added `webglcontextlost` (calling
  `event.preventDefault()`, required by the WebGL spec for the browser to attempt automatic
  restoration at all — without it the context is gone for good) and `webglcontextrestored`
  listeners on the canvas, registered and torn down in the same effect that owns the render
  loop. Loss stops the RAF loop; restore bumps a new `renderGeneration` state counter and
  restarts it. `renderGeneration` was added to the dependency arrays of both content-building
  effects (the plane/texture effect and the marker-sprite effect), so a restore forces a full,
  fresh rebuild of every GPU resource rather than trying to selectively patch anything.
- **Verified live, twice, in headless Chromium (Playwright)**: first run caught a real
  context-loss/restore cycle in the console and the post-fix screenshot showed the scene
  rendering correctly afterward (colour ramp plane, real Argo markers, full legend, real
  data) — direct proof the recovery path works, not just that the steady-state case works.
  A second, independent fresh run had no context loss at all and rendered correctly and
  consistently — confirms the fix does not regress the normal (no-loss) path.
- **Click-to-select re-verified in the same pass**: an earlier ad-hoc check using
  Playwright's single `page.mouse.click()` gave an ambiguous result (a hover ring appeared
  but the EvidencePanel didn't visibly update). Root-caused as a Playwright harness artefact,
  not an app bug: the app binds `pointerdown`/`pointerup` + `setPointerCapture`, and a single
  synthesized `mouse.click()` did not reliably reproduce that sequence. Separate
  `page.mouse.down()` / `page.mouse.up()` calls at the same coordinates selected two
  different real observations correctly (`ARGO 2902772`, `ARGO 5907083`, each with distinct
  real position/QC/timestamp data shown in the panel) — click-to-select is confirmed working.
- **Regression test added**: `src/ui/scene/ThreeSceneCanvas.contextLoss.test.ts` (4 cases).
  **Stated honestly**: this project's Vitest config runs in the `node` environment with no
  jsdom, no WebGL mock, and no `@testing-library/react` (confirmed absent from
  `package.json`), so a real behavioural mount-and-dispatch-context-loss-event test is not
  feasible without adding a meaningfully sized new test harness, which was out of scope for
  this fix. The added test is a source-level guard instead: it asserts the critical wiring
  (both listeners present, `preventDefault()` called on loss, `setRenderGeneration`/
  `startLoop()` called on restore, both listeners removed on cleanup, `renderGeneration`
  present in both content-effect dependency arrays) is actually in the file, so a future
  edit cannot silently delete the recovery path without a test failing. It cannot catch a
  logic-only regression that keeps these strings present but breaks their behaviour — only
  a real browser check (as performed for this fix) can do that. If a future phase adds
  jsdom + a WebGL context double to the test harness, this test should be upgraded to a real
  behavioural one.
- **Verified**: `tsc --noEmit` clean; `npx vitest run` 148/148 passing (up from 144, +4 new
  regression cases), 13 skipped without a live backend (unchanged); `npm run build` clean,
  67 modules (unchanged); `git status -- backend/` empty, backend untouched by this fix.

## Phase 4A step 2 result (2026-09-11) — real Argo markers + selection wiring

**The scene now shows real Argo observation markers, clickable, selecting through the
existing `analysisStore`/`EvidencePanel` path — no new backend endpoint, no synthetic
position or QC.** Backend confirmed unchanged (`git status -- backend/` empty; 89/89 pytest).

- **New**: `src/state/filterObservations.ts` — the ONE shared filter function (platform
  type, INCOIS/China Argo DAC, good-QC-only, collocated-only) now used by BOTH
  `EvidencePanel`'s observation picker and the scene's markers, so they can never disagree
  about which real observations are shown for a given filter state. This also **fixed a
  real pre-existing gap**: `EvidencePanel`'s picker never actually applied
  `collocatedOnly` (the toggle existed in the control rail but silently did nothing to the
  panel's list) — it does now, for both surfaces.
  `src/ui/scene/markerAppearance.ts` — pure QC/selection/hover → colour/scale mapping,
  colours copied verbatim from `tokens.css` (`--good`/`--warn`/`--bad`/`--cyan-bright`),
  same "no drift" principle as `palettes.ts`. `projectGeoToWorld()` added to
  `sliceTexture.ts` (not a new file — reuses the exact `WORLD_UNITS_PER_DEGREE` and
  longitude-correction constants the plane already uses, refactored into a shared private
  helper, so a marker cannot drift off the plane it's supposed to sit on).
- **Backend interface extended, not the backend itself**: `ObservationQuery` gained
  `collocatedOnly?: boolean` (additive). `ApiOceanDataAdapter.getObservations` now passes
  `collocated_only` to the **already-existing** `/api/v1/observations` query param
  (`routes_observations.py`, present since Phase 2.5, tested in
  `backend/tests/test_observations.py::test_collocated_only_matches_column_cache`) — no
  route added. `CachedRealDataAdapter.getObservations` (the retained, non-default adapter)
  was also given `dataCentres`/`collocatedOnly` support for interface parity, since it's
  meant to be a drop-in comparison adapter and silently ignoring a filter there would be
  its own honesty bug.
- **`dataStore`** now fetches `collocatedObservationIds` (one extra
  `getObservations({collocatedOnly:true})` call, parallel with the existing init fetches)
  and stores it as a `Set<string>` — **verified live: in this cache, all 28 real profiles
  have an extracted model column, so `collocated_only=true` returns 28/28.** The filter is
  genuinely wired and genuinely round-trips through the real API (see the live test below);
  it simply has no visible effect on THIS dataset because collocation coverage happens to
  be 100% — an honest fact about the data, not a bug being papered over.
- **Marker rendering** (`ThreeSceneCanvas.tsx`, extended not replaced): each filtered real
  observation gets a billboard sprite at its real (lat, lon) projected via
  `projectGeoToWorld(obs.latitude, obs.longitude, slice.bounds)`, positioned at the
  surface (y=0 — where a profiling float actually transmits from) with a thin vertical
  stem down to the currently-viewed depth-slice plane. Colour: GOOD/PROBABLY_GOOD = teal
  (`--good`), SUSPECT = amber (`--warn`), BAD = coral (`--bad`) — **BAD observations are
  never hidden by marker-drawing logic**, only by the user's own good-quality-only toggle
  (on by default, matching the pre-existing `INITIAL_STATE.filters.goodQualityOnly = true`).
  Selected = larger + cyan ring (`--cyan-bright`); hovered (not selected) = larger + white
  ring. One filled-circle texture and one ring texture are created ONCE and tinted
  per-marker via `SpriteMaterial.color`, not regenerated per marker/rebuild.
- **Selection**: `THREE.Raycaster` against marker sprites on `pointerup`, gated by a
  6px movement threshold so an orbit-drag release never accidentally selects. A hit calls
  the **existing, untouched** `analysisStore.selectObservation(id)` — the same action
  `EvidencePanel`'s picker already called — so `EvidencePanel` updates via its existing
  subscription, no new wiring on that side. Hover (raycast on `pointermove` while not
  dragging) calls the existing `hoverObservation(id | null)`; cursor switches to `pointer`
  over a marker. Clicking empty space is a no-op (deselection stays on EvidencePanel's
  existing "Clear" button) — matches the literal requirement ("clicking a marker must
  select"), not a broader click-to-deselect behaviour that wasn't asked for.
- **Accessibility**: WebGL canvas content has no native screen-reader representation, so
  this does NOT claim the canvas itself is accessible. Two real things instead: (1) a
  visually-hidden `aria-live="polite"` region in `SceneStage` announces the selected
  platform name, QC, and position whenever selection changes — from the same store
  selection, whether triggered by a marker click or the panel; (2) the pre-existing,
  fully keyboard-operable `EvidencePanel` observation list is the accessible primary
  selection path and was NOT removed or hidden behind the new markers — the scene's hint
  text was updated to say both paths select the same record, not that one replaces the
  other. A visible on-canvas legend (QC dot colours + a cyan ring sample + a real
  "N of M observations shown" count) was added to the scene's existing legend box.
- **Tests**: `filterObservations.test.ts` (8) — every filter combination, explicitly
  including "BAD is shown once good-quality-only is off" and "collocated-only uses the
  real id set". `markerAppearance.test.ts` (8) — colour-per-QC, selection/hover priority,
  render-order. `sliceTexture.test.ts` gained 6 `projectGeoToWorld` cases (bounds-centre
  at world origin, south=+Z/north=-Z, west/east sign, exact span match against
  `computePlaneWorldSize`, off-grid safety, two real Argo positions never collapsing to
  the same point). Existing tests untouched and still passing. **144 total passing** (up
  from 122), 13 skipped without a live backend (up from 11 — two new live checks below).
- **Verified live** (`npm run test:integration`, backend running): 12/12 integration
  tests passing, including two new ones added this step —
  `getObservations({dataCentres:['IN']})` returns exactly 19 (matches the Phase 2 count),
  `['HZ']` returns exactly 9, and `collocatedOnly:true` genuinely calls through to the
  real backend filter (asserted `<=` the unfiltered count and a real subset check, not an
  exact-28 hard-code, since a future cache rebuild could legitimately change that number).
- **Verified**: `tsc --noEmit` clean; `pytest` 89/89 unchanged; `vite build` clean, 67
  modules (up from 64); dev server (`vite --port 5173`) curl-probed for every new/changed
  module (`ThreeSceneCanvas.tsx`, `markerAppearance.ts`, `sliceTexture.ts`,
  `filterObservations.ts`, `SceneStage.tsx`, `EvidencePanel.tsx`) — all `200`, no
  transform errors in the Vite log.
- **Gaps, stated plainly**:
  - **Still no browser tool — the markers, their colours, their screen positions relative
    to the plane, and the click/hover interaction have never been seen.** Every claim
    above is verified by shared-constant code construction and unit/integration tests on
    real data, not by looking at it. This compounds with step 1's identical caveat; a real
    visual check is now overdue before any demo.
  - `collocated_only` has no visible effect on the current cache (100% coverage) — a
    future, sparser cache is the only way this filter will visibly do anything. Documented
    above so nobody mistakes a no-op result for a broken filter later.
  - The 6px click/drag threshold, ring/scale sizes, and stem opacity are reasonable
    defaults, not tuned against an actual rendered view for legibility at real scene
    scale — likely to need adjustment once someone can see it.
  - Markers project via `projectGeoToWorld` without clamping to the plane's own bounds; an
    observation meaningfully outside the model region (none currently in this cache) would
    render off the visible plane rather than being clipped or flagged — acceptable for 28
    known-real, known-nearby floats, worth a bounds check if the observation set grows.

## Phase 4A step 1 result (2026-09-11) — real 3D depth-slice scene

**`SceneStage` no longer shows a placeholder grid box.** It renders a real Three.js/WebGL
scene: one textured horizontal plane, positioned at the real selected depth, coloured from a
real model depth slice fetched through the **unchanged** `OceanDataAdapter`/backend boundary
(no API contract change — `backend/` untouched, 89 pytest still passing). Step 1 only, per
scope: no Argo markers yet, no volume/isosurface, camera is a simple drag-orbit + wheel-zoom
(no external controls library).

- **New**: `src/ui/scene/` — `palettes.ts` (ramp stops copied verbatim from `tokens.css`'s
  `--ramp-*` gradients, so the WebGL texture and the legend swatch can never drift apart),
  `sliceTexture.ts` (pure: `VolumeSlice` + palette + domain range → RGBA buffer; also plane
  world-sizing from real `GeoBounds` with a cos-latitude correction, and depth→world-Y),
  `useVolumeSlice.ts` (hook: fetches via `dataStore.adapter.getVolumeSlice()` on
  variable/timestamp/depth change, request-id-guarded against race conditions, no synthetic
  fallback — a failure surfaces as `status:'error'`), `ThreeSceneCanvas.tsx` (mounts
  renderer/scene/camera in a `useEffect` — never at module scope or during render, so SSR
  stays safe), `sceneStageState.ts` (see below).
- **Dependency added**: `three@0.186.0` + `@types/three@0.185.4` (dev). No other new deps.
- **Real values confirmed live** (`npm run test:integration`, `sceneData.integration.test.ts`,
  new this step): real temperature/salinity/current-speed slices fetched and textured against
  a running backend; land cells (`valid[i]===0`) always render alpha 0, never a colour;
  chlorophyll's `getVolumeSlice` call genuinely rejects (no slice exists), asserted directly.
- **Corrected a stale doc comment while verifying row order**: `VolumeSlice`'s JSDoc in
  `src/domain/types.ts` said `values` was "north-to-south by row" — false. Traced the actual
  pipeline (Node prep script → Python `cache_reader` → `routes_slices` → `ApiOceanDataAdapter`)
  and confirmed row 0 = `bounds.minLat` (south), ascending north, everywhere. Fixed the
  comment; `ThreeSceneCanvas.tsx` documents the resulting south=+Z/north=-Z world convention
  in detail since it could not be checked by eye (see gap below).
- **Real finding, fixed properly rather than hidden**: while writing "component state" tests
  for `SceneStage`, discovered that Zustand's React binding
  (`node_modules/zustand/esm/react.mjs`) hard-codes SSR's `getServerSnapshot` to the store's
  state **at module creation**, by design — so `renderToString` on a Zustand-backed component
  always renders the INITIAL store state, regardless of any `setState` called beforehand.
  This means **Phase 3's `App.smoke.test.tsx` "7 cases across every store state" never
  actually verified different content** — only that nothing throws (still true and still
  useful, just narrower than claimed). Fixed by extracting `SceneStage`'s top-level branch
  choice into a pure function, `sceneStageState.ts` / `selectSceneStageView()`, tested directly
  (9 cases, no React/Zustand/SSR involved) in `sceneStageState.test.ts`. `App.smoke.test.tsx`
  and the new `SceneStage.smoke.test.tsx` got header comments explaining this so nobody trusts
  their content assertions again. **If a future phase needs genuine per-state SSR/DOM
  assertions, it will need `jsdom` + client-rendering (`createRoot`/Testing Library), not
  `renderToString`** — not added here, out of this step's scope.
- **Tests**: `palettes.test.ts` (6), `sliceTexture.test.ts` (12) — pure data-mapping, the core
  ask; `sceneStageState.test.ts` (9) — pure component-state branching;
  `SceneStage.smoke.test.tsx` (2, narrowed per the finding above);
  `sceneData.integration.test.ts` (4, live-backend only) — real slices → real textures for
  all 3 renderable variables + the chlorophyll-rejects case. 122 total passing (11 skipped
  without a live backend, up from 7 — the new integration file).
- **Verified**: `tsc --noEmit` clean; `vite build` clean, 64 modules (up from 57);
  `pytest` 89/89 unchanged; dev server curl-probed for every new module (200, no Vite
  transform errors); `npm run test:integration` 10/10 against a live `uvicorn`.
- **Gaps, stated plainly**:
  - **No browser tool was available — the scene has never been looked at.** Every geographic
    orientation, colour, and camera claim above is verified by code construction and unit
    tests, not by seeing it render. This is the single biggest open risk before demoing.
  - Bundle grew from ~264 KB to ~800 KB gzipped ~216 KB (three.js is not small). Not
    code-split; Vite's build warns about it. Acceptable for an internal round, worth a dynamic
    `import()` later.
  - `ErrorState`'s retry button inside the slice-loading sub-branch is currently a no-op
    (the fetch re-runs automatically on any dependency change, but there's no manual nudge for
    "same params, try again" — noted in the component, not fixed this step).
  - `@types/three@0.185.4` is one minor version behind the installed `three@0.186.0` package;
    no type errors resulted, but worth pinning together if bumped later.

## Phase 3 result (2026-09-11) — UI shell, AWAITING APPROVAL

**`src/App.tsx` is no longer the Phase 1 scaffold — it now renders `<AppShell/>`, the real
operational shell.** Ported from the Claude Design artboard structure documented in Phase 0.

- **New store**: `src/state/dataStore.ts` — owns the adapter instance + `getMetadata()` /
  `getLayerRegistry()` / `getObservations({})` / `getAvailableTimes()` for all 4
  `OceanVariable`s, called once from `AppShell`'s mount effect. `status: idle|loading|ready|
  error`. `analysisStore.ts` gained `filters.dataCentres: {IN, HZ}` + `toggleDataCentre()`
  (additive, matches the backend's real DAC filter).
- **Components** (`src/ui/`, one `.module.css` per section, all reading `var(--token)` from
  Phase 1's `tokens.css`): `NavRail` (7 sections, only Operations wired — rest visibly inert,
  not fake-clickable), `CommandBar` (real dataset/window/region from `/metadata`, Briefing
  toggle wired), `ProvenanceStrip` (real window label + view ID), `ControlRail/` →
  `FieldConfiguration` (4 variables, real per-variable availability — chlorophyll disabled +
  `UnavailableNote`), `LayerToggles` (14-layer registry, unsupported ones disabled with their
  real caveat as the tooltip), `DepthControls` (non-linear 0/50/100/250/500/1000 slider +
  exaggeration stepper), `ObservationFilters` (platform type + **INCOIS/China Argo DAC** +
  good-QC + collocated-only, counts computed from the real 28-observation list),
  `PlannedExtensions` (the unsupported layers, explicitly). `SceneStage` and `EvidencePanel`
  are **shells only** — real readouts (variable/depth/time/exaggeration, selected
  observation's real position/QC/identity/provenance fields) but no canvas, no chart, no
  RMSE/bias tiles, no comparison bands — each says "implemented in a later phase" where it
  stops short, per your explicit exclusion list. `TimelineRail` plays/pauses/steps/scrubs
  across the **real 11-timestamp axis** from `/api/v1/times`.
- **No component reads `public/data/real/` or the API client directly** — everything goes
  through `dataStore`/`analysisStore`, which go through `ApiOceanDataAdapter`.
- **Verification without a browser tool**: `tsc`/`vite build` clean (57 modules now
  bundled, up from 24 — proof the shell is actually wired in, not dead code); a new
  `App.smoke.test.tsx` SSR-renders the full tree (`renderToString`) across idle/loading,
  error, ready, all 3 evidence tabs with a selection, briefing/outreach, chlorophyll-selected,
  and combined-filter states — 7 cases, all render without throwing; the live-backend
  integration suite grew a test that runs `dataStore.initialize()`'s exact call sequence
  against a running `uvicorn` and asserts on the real counts (28 obs, 19 INCOIS, 11
  timestamps × 3 real variables, chlorophyll `[]`). Dev server (`vite --port 5173`) probed via
  curl for every new module — all 200, no transform errors in the Vite log. **No actual
  browser was available in this session — no pixel screenshot, no real console-error check.**
  Flag this to the user if a visual sign-off is needed beyond structural/SSR verification.
- Layout: rails already responsive from Phase 1 tokens (300/360 below 1600px, 338/398 at
  1920). Not verified in an actual browser viewport — CSS-only, same caveat as above.

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
- **Real collocation** computed from the cached arrays. No hard-coded stats anywhere.
  **SUPERSEDED — see the Phase 2.5 section below for the authoritative numbers.** This
  entry originally quoted "RMSE 0.67 °C, bias +0.38 °C" for ARGO-5907083-2 from an ad-hoc
  0–500 m verification script; the adapter's real method gives RMSE 0.2434 °C, bias
  +0.1816 °C. Never cite 0.67/0.38 as a current result.
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
