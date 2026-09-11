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
| Current phase | **Phase 4A and Phase 5A (all three steps) complete, a backend correctness hardening pass, and a browser-based responsive/accessibility QA pass — all done as of 2026-09-12.** Step 3/4 wording overlap in 4A noted previously; treat 4A as functionally done. Both real backend bugs found-and-worked-around during 5A are now genuinely fixed in the backend. The narrow-viewport (300px control-rail) layout gap noted-but-never-checked across all three 5A step reports has now actually been checked in a real browser and four real defects it found are fixed — see "Responsive/accessibility QA pass" below. Internal-round plan (0→1→2→2.5→3→4A→5A→...) has no phase left before 4B/5B, which are explicitly deferred to finalist work — see below for the recommended next task. |
| Proposed next order | 0 → 1 → 2 → **2.5** → 3 → **4A** → **5A** → 4B → 5B → 6 → 7. The internal round should prioritise a working 3D model/observation loop before advanced rendering or data expansion. |
| Repo state | Backend: **101 pytest**, untouched by this responsive-QA pass (frontend-only: CSS + `title` attributes + tests). `SceneStage` renders a real Three.js/WebGL scene with clickable real Argo markers, recovers correctly from a lost WebGL context, verified working at both the desktop (1600x1000) and 300px-control-rail (1440x900) breakpoints. `EvidencePanel`'s three tabs are all real and now verified legible at both breakpoints: Profile, Comparison, Provenance. `/model-column` genuinely snaps to the nearest real timestamp; `/collocation` returns an honest `422` for `currentSpeed`/`chlorophyll`. **214 frontend tests green** (22 skipped without a live backend), tsc clean, build OK (bundle ~837 KB gzip ~225 KB, module count unchanged — no new imports this pass, only CSS/attribute edits). |

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

## Responsive/accessibility QA pass (2026-09-12) — the narrow-viewport gap from every 5A step report, actually checked

**A real headless-Chromium check at the 300px control-rail breakpoint (1440x900, the exact
size named in the Phase 1 locked layout decision) plus the desktop breakpoint (1600x1000,
the canonical artboard size) — the check every prior 5A step report flagged as "not yet
pixel-verified" and deferred.** Found four real, reproducible layout defects, all only at
the narrow breakpoint; fixed all four with CSS-only changes plus three `title` attributes.
No scientific calculation, backend API, or data source was touched — `git status --
backend/` is empty for this pass.

**Method**: Playwright screenshots plus `document.documentElement.scrollWidth >
clientWidth` overflow checks at both viewports, across: the default scene, Profile tab
(ready + no-valid-levels states), Comparison tab (ready + no-valid-levels +
unavailable-variable states), Provenance tab (both source blocks, scrolled to see both),
and a live marker click-to-select check at the narrow width. Every fix was re-verified with
a fresh screenshot before being considered done, and the *un-narrowed* desktop screenshots
were re-checked after each fix specifically to catch any unintended regression at the width
that was already fine — this caught one real regression before it shipped (below).

**Defect 1 — `ProvenanceStrip`'s trailing label visually ran into the text before it**:
at 1440px, `View ID: DEMO-OCN-2023-0925-BB` and the trailing `Bay of Bengal subset · Argo +
HYCOM` label rendered with **zero gap between them** — read as one merged, confusing string.
Root cause: `.grow`'s `flex: 1` spacer had no `min-width`, so once the row's other content
already filled the available width, the spacer legitimately computed to 0px. Fix: `min-
width: 12px` on `.grow` — the exact value `CommandBar.module.css`'s own `.spacer` already
uses for the identical purpose, so this is now consistent across both bars, not a new
convention.
- **Defect 2 — CommandBar's "Share view" button was reachable only by scrolling, with no
  visible affordance that scrolling was possible**: `.bar` already had `overflow-x: auto`
  (a deliberate, pre-existing pattern also used by `ProvenanceStrip`), so this was not a
  hard clip — the button was never destroyed, just off-screen by default with nothing
  indicating more content existed sideways. Confirmed both ways: `bar.scrollWidth (1460) >
  bar.clientWidth (1380)`, and manually scrolling the bar revealed "Share view" intact.
  Still counts as a real "inaccessible click target" per the task's own list. Fix: hide the
  `REAL CACHED DATA` badge (128px, the single widest reclaimable element) at the same
  `max-width: 1599px` breakpoint the rails already narrow at — chosen because it is fully
  redundant with `ProvenanceStrip`'s "Processing status: locally validated" line one row
  below and the per-layer REAL/PRECOMPUTED badges throughout the control rail; the
  honesty-critical `HISTORICAL DEMONSTRATION` badge was deliberately left untouched. This
  fully eliminated the bar's overflow (`scrollWidth === clientWidth` after the fix, both
  widths) rather than just shrinking it.
- **Defect 3 — the "UNAVAILABLE" badge on a disabled control-rail row (e.g. Chlorophyll-a,
  Model temperature-when-off-cache) could be silently clipped, not just truncated**: at
  1440px, `.unavailableWrap`'s row child (`FieldConfiguration`/`LayerToggles`'s shared row
  button) has its own `width: 100%`, correct when it is the row's only content but wrong
  once `UnavailableNote` adds a sibling badge — the row's fixed 100% left the badge with
  nowhere to go, and the control rail's own `overflow-x: hidden` (confirmed in
  `ControlRail.module.css`) clipped it with **no ellipsis, no scrollbar, no visible
  indication anything was missing** — read as `UNAVAILABL` with the box border cut off
  mid-character. **Regression caught mid-fix**: the first attempt (`width:100%;
  flex-wrap:wrap` on the base `.unavailableWrap`) fixed this but also changed
  `ProfileChart`'s/`CollocationPanel`'s *already-correct* unavailable-variable layout
  (EmptyState + badge, previously side-by-side at the top) into a wrapped two-line layout at
  **both** widths, including the desktop width where nothing was ever broken — caught by
  re-checking the desktop screenshot, not assumed safe. Fixed by scoping with
  `.unavailableWrap:has(> button)` so only the control-rail row usage (the one with a real
  defect) is affected; the EmptyState usage is provably back to its original layout
  (verified by screenshot, byte-for-byte the same composition as before this pass). The
  scoped rule adds `width:100%; flex-wrap:wrap` to the wrap, and `.unavailableWrap > button`
  changes the row's own sizing from a fixed `100%` to `flex:1 1 0%; min-width:0` so it
  shares the line with the badge — verified at both widths that this keeps everything on
  ONE line whenever there is room (which there always is once the row can actually share
  space, at both 300px and full desktop) rather than forcing a wrap unconditionally.
- **Defect 4 — three truncation points (`.layerLabel`, `.fieldName`, `.pickerId`) had no
  way to reveal their full text**: CSS `text-overflow: ellipsis` is an intentional,
  pre-existing pattern in this codebase (label flexes and truncates while an adjacent fixed
  badge/status column stays put) — not itself a bug — but with no `title` attribute, a
  sighted mouse user had no way to see the untruncated text ("Model temp…", "Model curre…"
  at 1440px). Screen readers were never affected (the truncation is CSS-only; the full text
  content was always in the DOM). Fix: added `title={layer?.label ?? id}` /
  `title={meta.name}` / `title={o.platformName}` to the three affected row/button
  components — native browser tooltip on hover/focus, zero layout impact, zero risk of new
  overflow.
- **Tests added**: `src/ui/responsiveLayout.guard.test.ts` (10) — source-level guards
  (same established pattern as `ThreeSceneCanvas.contextLoss.test.ts`, stated honestly:
  this project's Vitest has no jsdom/CSS-layout engine, so these assert the fix's specific
  CSS properties are present, not that the browser renders them correctly — that part is
  the screenshot verification above) for all four fixes, including an explicit check that
  the base (unscoped) `.unavailableWrap` rule does **not** carry `width:100%`/`flex-wrap` —
  guarding against exactly the regression caught above being silently reintroduced.
  `src/ui/ControlRail/ControlRail.responsive.test.tsx` (3) — a step further than source-
  grepping: real `renderToString` output asserted to actually contain the `title`
  attributes (e.g. `title="Chlorophyll-a"`), for `LayerToggles` and `FieldConfiguration` in
  their default (idle) render — sufficient here since both title values come from
  store-independent fallbacks. **214 total passing** (up from 201, +13 new), 22 skipped
  without a live backend (unchanged — no new adapter call this pass).
- **Verified**: `tsc --noEmit` clean; `npx vitest run` 214/214; `npm run build` clean, 78
  modules (unchanged — CSS/attribute-only edits, no new imports); backend `pytest` 101/101
  unchanged; `npm run test:integration` 21/21 unchanged against a live backend (this pass
  made no backend or adapter change, so live-integration behaviour is identical by
  construction — re-run anyway, as required, to confirm no accidental breakage).
- **Verified in an actual browser**, both required viewports (headless Chromium via
  Playwright, screenshots taken before and after every fix): default scene, Profile tab (2
  states), Comparison tab (3 states), Provenance tab (both source blocks) all render without
  clipping/overflow/overlap at 1440x900, matching the desktop 1600x1000 render exactly where
  no fix was needed; `document.documentElement.scrollWidth` never exceeded `clientWidth` at
  either width for any screen checked; marker click-to-select re-verified working at 1440px
  (selected a real observation, `ARGO 5907083`, with correct real data shown). Zero console
  errors/warnings introduced.
- **Gaps, stated plainly**:
  - Coverage is exactly the two viewports this task named (300px-control-rail /
    1440x900, and desktop / 1600x1000) plus the wider 1920x1080 composition mentioned in
    Phase 1's locked layout decision was **not** separately re-checked this pass (no defect
    was expected or found there in any prior gap note, and it is strictly wider than the
    1600px case already verified clean).
  - No viewport narrower than 1440px was checked — this project's own locked layout
    decision (`CLAUDE.md`'s "Locked decisions" #4) specifies only 300px-rail/1440x900 and
    1920x1080 as target sizes; there is no designed breakpoint below 1440px, so an
    arbitrarily narrower window (e.g. a real mobile viewport) was out of this task's
    "around 300px, plus the normal desktop layout" scope and is not claimed to work.
  - Keyboard-only navigation (tab order, focus-visible outlines) was not separately audited
    this pass — out of the task's stated focus list (clipping/overflow/overlap/unreadable
    labels/inaccessible click targets), though the `title` attributes added do also help
    keyboard/assistive-tech users via the accessible name they contribute.
  - The `UnavailableNote` fix's `:has()` selector requires a modern browser (broadly
    supported in Chromium/Firefox/Safari since 2023) — acceptable for this project's target
    (a demo run in a current browser), but worth a plain-CSS fallback if the deployment
    target ever needs to support older browsers.

## Backend correctness hardening (2026-09-12) — the two known bugs from 5A steps 1–2 are now genuinely fixed

**Both backend bugs found (and only worked around on the frontend) during Phase 5A are now
fixed in the backend itself.** No public API shape change — same endpoints, same request/
response schemas — only correct behaviour, plus one new, necessary HTTP status for a request
that was previously either silently wrong (`200` with garbage data) or an unhandled crash
(`500`). Frontend source is **completely untouched** this pass; only two live-integration
test files gained a case proving the backend fix end-to-end through the existing adapter.

**Diagnosis, confirmed by reading the code before editing:**
1. `/model-column` (`get_model_column` in `slice_service.py`, backed by
   `array_loader.bilinear_column`): `ti = grid.timestamps.index(timestamp) if timestamp in
   grid.timestamps else 0` — any inexact timestamp silently read data from index **0** (the
   *first* cached snapshot), and `get_model_column` separately, independently recomputed its
   own `actual_ts` with the exact same bug, so the reported label could never have caught a
   future divergence between "timestamp used" and "data actually read" even if only one of
   the two copies had been fixed.
2. `compute_collocation` (`app/science/collocation.py`): `obs_values = profile["salinity"] if
   variable == "salinity" else profile.get("temperature", [])` — `currentSpeed` had a full
   `_VARIABLE_META` entry (unit, tolerance range, bias words, structure name), so it looked
   fully supported, but this line silently used the profile's **temperature** array as the
   "observed" current speed. A request for `?variable=currentSpeed` returned `200` with a
   scientifically meaningless HYCOM-current-vs-Argo-temperature comparison and no error at
   all. `chlorophyll` has no `_VARIABLE_META` entry at all, so it hit an unhandled `KeyError`
   — an ugly `500`, not an honest API response either.

**Fix 1 — `/model-column` nearest-timestamp snapping**:
- New shared `nearest_timestamp_index(timestamps, target_iso)` in `app/science/geometry.py`
  — a linear scan (not the existing binary-search `nearest_index`, deliberately: this cache
  has at most a few dozen timestamps, so performance is immaterial, and a linear scan needs
  no assumption that the input is sorted ascending, removing one way this fix itself could
  have silently regressed).
- `array_loader.bilinear_column()` now uses it for the inexact-timestamp case, and — the
  structural half of the fix — **now returns the actual timestamp it read data from** as a
  third tuple element, instead of the caller separately/independently recomputing its own
  (buggy) copy. `slice_service.get_model_column()` was simplified to just use that returned
  value; the standalone `actual_ts = timestamp if timestamp in cache.grid.timestamps else
  cache.grid.timestamps[0]` line is gone entirely. There is now exactly one place that
  decides which timestamp was used, so the reported label cannot drift from the real data
  again — this is a stronger fix than only correcting the fallback index.
- `array_loader.horizontal_slice()` (backing `/slice`) already snapped correctly and was
  **not touched** — no risk taken on already-correct, already-tested code.
- **`docs/api.md`/CLAUDE.md's Phase 5A step 1 entry can now be corrected**: the frontend's
  `nearestTimestamp()` workaround in `src/ui/EvidencePanel/profileComparison.ts` is no
  longer masking a real backend gap for `/model-column` — the backend now does the right
  thing on its own. The frontend function is harmless to keep (it still produces an exact,
  known-valid timestamp, which is never wrong to send), so it was left in place rather than
  removed, but the stale "sidesteps the backend's fallback" test comment referencing the old
  bug was corrected in `profileComparison.integration.test.ts`.

**Fix 2 — `/collocation` unsupported-variable honesty**:
- `_VARIABLE_META` in `app/science/collocation.py` now contains only `temperature` and
  `salinity` — `currentSpeed`'s entry was removed rather than fixed, because there is no
  real fix: Argo floats in this cache carry no current-speed sensor, so there is no honest
  *observed* value to pair a current-speed comparison against at all. A new
  `_SUPPORTED_VARIABLES = frozenset(_VARIABLE_META)` derives the supported set from the
  dict's own keys, so "has a meta entry" and "has a real observed-side implementation" are
  the same set by construction — they cannot silently drift apart again the way they did
  before (a dict entry added without its matching observed-value branch).
- New `UnsupportedCollocationVariableError`, raised at the top of `compute_collocation()`
  before any data is touched. `routes_collocation.py` maps it to **`422`** (Unprocessable
  Entity — same status class already used for `OutOfRegionError` on `/model-column`, for
  the same "syntactically valid request, semantically unsatisfiable" reason), with a
  detail message naming the variable and explaining why.
- `_column_values()`'s `currentSpeed` branch (real HYCOM u/v model data) was **kept, not
  deleted** — it's correct and currently just unreachable from `compute_collocation`, kept
  for if a genuine current-observation source is ever added. `collocation_service.py`'s
  `_UNITS` dict had its now-unreachable `currentSpeed` entry removed for the same reason
  `_VARIABLE_META`'s was.
- **Frontend required no change**: `ApiOceanDataAdapter.getCollocation()` already (since
  Phase 5A step 2's own hardening) rethrows any non-`404` error rather than swallowing it,
  so a `422` here surfaces exactly as a real fetch error — and the UI never sends this
  request anyway, since `isCollocationVariable`/`isProfileChartVariable` already gate the
  Comparison and Profile tabs to temperature/salinity only. A live integration test was
  added proving the `422` propagates correctly through the real adapter (`ApiResponseError`
  with `status === 422`), as defence-in-depth verification of a path the app itself never
  exercises.

**Tests added**: `backend/tests/test_geometry.py` (7) — exact match, snapping far toward the
*last* timestamp (the exact scenario the old bug got wrong), mid-range snapping, an
exact-tie rule, empty-list and single-element edge cases. `test_slices.py` gained
`test_model_column_snaps_to_nearest_timestamp_not_first` (reproduces the bug scenario
end-to-end through the real route, asserts both the reported label AND the actual returned
values match a direct request for the true nearest timestamp — not just the label) and
`test_model_column_exact_timestamp_still_matches_itself` (regression guard for the unchanged
exact-match fast path). `test_collocation.py` gained three cases:
`test_collocation_current_speed_is_explicitly_unavailable` (422, honest detail message),
`test_collocation_chlorophyll_is_explicitly_unavailable_not_a_500` (422, not a crash),
`test_collocation_temperature_and_salinity_are_unaffected_by_the_fix` (both still return
real, non-null results — the fix did not narrow what already worked). **Backend: 101/101
passing** (up from 89, +12 new), all pre-existing tests unchanged and still green.
Frontend: two new live-only cases (`profileComparison.integration.test.ts`'s
`/model-column` nearest-snap end-to-end check; `collocationView.integration.test.ts`'s
`422`-propagates-through-the-adapter check) — **201 unit tests unchanged, 22 skipped
without a live backend** (up from 20).

**Verified**: Python `py_compile` clean on every edited file (and the whole `app/` tree);
`pytest` 101/101; `tsc --noEmit` clean; `npx vitest run` 201/201 (22 skipped); `npm run
build` clean, 78 modules, bundle unchanged (no frontend source touched); `npm run
test:integration` **21/21** (up from 19) against a live backend — including both new live
cases; manual `curl` sanity checks of all three changed responses (nearest-snap
`actual_timestamp`, `currentSpeed` 422, `chlorophyll` 422-not-500) before the automated
suite, all matching.

**Verified in an actual browser** (headless Chromium via Playwright, screenshot taken): the
Profile and Comparison tabs for a real observation (`ARGO 2902770`) render **byte-for-byte
the same real numbers** as before this pass (RMSE 0.70 °C, mean bias −0.21 °C, 102 levels,
same depth-band verdicts) — direct proof the hardening changed nothing about the supported
(temperature/salinity) path's behaviour or output. The 3D scene, marker selection, and all
three EvidencePanel tabs continued working with no regression.

**API-contract impact, stated explicitly**: no request/response schema changed anywhere.
The only externally-visible behaviour change is that two previously-broken responses are now
different: `GET /api/v1/model-column` with an inexact `timestamp` now returns *correct* data
under the same `200`/`ModelColumnResponse` shape (was: `200` with wrong data — a silent
correctness bug, not a documented contract, so this is a bugfix, not a breaking change); and
`GET /api/v1/collocation/{id}?variable=currentSpeed` (or `chlorophyll`) now returns `422`
with a `CollocationResponse`-shaped-error `{"detail": "..."}` (was: `200` with a bogus
comparison for `currentSpeed`, or an unhandled `500` for `chlorophyll` — neither was a
usable contract to begin with). No currently-shipped frontend code depended on either old,
broken behaviour.

**Remaining internal-round risks**:
- Both fixes are backend-internal; nothing about the frontend's honesty guarantees changed,
  but this was the last of the two named "worked around, not fixed" items called out across
  the three Phase 5A step reports — no further known-and-deferred correctness bugs remain
  documented in CLAUDE.md as of this pass.
- The `422` contract for `currentSpeed`/`chlorophyll` collocation is now real but still
  unreachable from the shipped UI (by design — the tabs gate to temperature/salinity). If a
  future phase ever lifts that gate without checking this backend behaviour first, it would
  correctly surface an `error` state rather than fabricate a result — worth a note for
  whoever does that, not an open bug.
- The still-open, lower-priority gaps from the three 5A step reports (narrow-viewport/300px
  layout not pixel-checked on Profile/Comparison/Provenance; chlorophyll's "unavailable
  model source" Provenance-tab branch verified only by unit test, since the UI correctly
  disables reaching it) are unchanged by this pass — not in scope here, still worth a future
  pass. **The narrow-viewport layout gap is fixed — see "Responsive/accessibility QA pass"
  above**, a later pass in this same session; the chlorophyll Provenance-tab gap remains
  open exactly as described.

## Phase 5A step 3 result (2026-09-12) — real provenance tab; Phase 5A now fully complete

**`EvidencePanel`'s Provenance tab no longer shows the flat 7-row field list.** It now
answers "where did this data come from, when, what was done to it, and what should a
scientist know before trusting it" for two sources at once — the selected float's real Argo
record, and whichever real HYCOM/satellite layer backs the *currently selected variable* —
without repeating any statistic (RMSE, bias, profile line, depth-band verdicts) already
shown on the other two tabs. **No new adapter method and no new fetch at all**: everything
rendered here was already loaded into `dataStore` at app init (`observations[].provenance`
from `getObservations()`, `layers` from the existing `getLayerRegistry()` call) — this step
is presentation-only.

- **New**: `src/ui/EvidencePanel/provenanceView.ts` (pure, unit-testable — same split as
  `profileComparison.ts`/`collocationView.ts`): `modelLayerIdForVariable()`,
  `formatSourceVariables()`, `formatTemporalCoverage()`, `formatRetrievedAt()`.
  `ProvenancePanel.tsx` + `.module.css` — a shared `SourceBlock` renders an
  `OBSERVATION SOURCE` block (the selected float's Argo provenance, from
  `observations[].provenance` — unaffected by which variable is selected, since it
  describes the float's own data origin) and a `MODEL SOURCE` block for the variable
  currently selected in the control rail, plus a `WINDOW` banner at the top repeating the
  real historical-demo label/dates/region from `dataStore.metadata` (the one piece of
  metadata this task explicitly required here too, despite also appearing on the other
  tabs — a genuine result like RMSE was never duplicated, only this label).
- **Real finding used, not invented**: `DataSourceDescriptor.transformations` (defined
  since Phase 1, populated by the backend's `provenance_service.py` from the real
  `manifest.json`, but never rendered anywhere before this step) turned out to already
  contain exactly the "Argo quality filtering/depth conversion" and "HYCOM
  subset/decimation" steps the task asked to expose, verbatim, e.g. Argo's *"Converted
  PRES (decibar) to depth (m) via UNESCO 1983, latitude-dependent"* / *"Dropped levels with
  PRES_QC = 4 (bad)"*, and HYCOM's *"NCSS subset: bbox N20.5/S8/W81/E93..."* / *"Slice
  cache: decimated horizontally by stride 3, kept 14 depth levels"*. Rendering them as a
  numbered `<ol>` was the entire task for that requirement — no new backend field, no new
  data.
- **Honest handling of chlorophyll**: chlorophyll has no HYCOM field at all (HYCOM carries
  only temperature/salinity/currents) — its only registered layer is
  `satellite.chlorophyll`, `NOT_AVAILABLE_MVP`/`PLANNED_EXTENSION` in this cache.
  `modelLayerIdForVariable('chlorophyll')` maps there rather than to nothing, so selecting
  chlorophyll shows a real, explicitly-unavailable `SourceBlock` (status badge "Not
  available in MVP"/"Planned extension", the real reason from `caveats[0]`, no fabricated
  originator/URL/processing steps — the `unavailable()` factory already guarantees this)
  instead of a silently blank Model Source section.
- **States**: a `SourceBlock` for an unavailable/planned source renders exactly the same
  layout as a real one, just with empty optional fields collapsing to nothing (the
  `Processing steps`/`Caveats`/`Licence` blocks only render when their arrays are
  non-empty) plus a closing honesty line quoting the real unavailability reason — never a
  separate "broken" look, and never implying live/forecast/ML data for a source that has
  none of those. `!obs` (observation dropped out of the loaded list) keeps the pre-existing
  `EmptyState` fallback.
- **Tests**: `provenanceView.test.ts` (12) — every variable's model-layer mapping is
  distinct, source-variable/unit pairing (including "no unit declared, list bare" and
  "empty, em dash"), temporal/retrieval formatting including the null cases, and an
  explicit honesty test asserting the `unavailable()` fixture used across the whole app
  produces no fabricated originator/URL/retrieval-date/transformations while still
  surfacing its real caveat text. **201 total passing** (up from 189), 20 skipped without a
  live backend (unchanged — this step added no integration test, since it makes no new
  adapter call to integration-test).
- **Verified**: `tsc --noEmit` clean; `vite build` clean, 78 modules (up from 75).
- **Verified in an actual browser** (headless Chromium via Playwright, screenshots taken):
  selecting a real observation and opening Provenance shows the real Argo block (dataset
  name, originator, a live clickable `data-argo.ifremer.fr` link, real retrieval date, all
  7 real processing steps, real caveats) and, after scrolling, the real HYCOM
  temperature/salinity block (NCSS URL, 5 real processing steps including the stride-3
  decimation, real licence text) — confirmed both blocks update independently: switching
  to Ocean current speed re-renders the Model Source block with HYCOM's real u/v dataset
  name/URL/variables, while the Observation block (Argo) stays unchanged, exactly as
  intended (per-variable model source, variable-independent observation source). Also
  confirmed live that the Chlorophyll-a field button is genuinely `disabled` in the control
  rail (an honest UI lockout, not a bug) — so the chlorophyll "unavailable model source"
  branch could only be exercised via the unit test above, not a live click; documented as a
  gap below rather than worked around. The 3D scene, Profile tab, and Comparison tab all
  continued working correctly throughout (no regression).
- **Gaps, stated plainly**:
  - The chlorophyll "Model Source" unavailable-block rendering was verified only via
    `provenanceView.test.ts`'s pure logic + `unavailable()`'s existing guarantees, not
    against a live-rendered `SourceBlock` — the chlorophyll field is correctly disabled in
    the control rail (Phase 3 behaviour, unrelated to this step), so there's no UI path to
    select it and see the component itself render that branch. The rendering logic is the
    same generic `SourceBlock` already visually verified for four other real sources, so
    the risk is low, but it's an honest, stated gap rather than a claimed full check.
  - `Source URL` is rendered as a live external `<a target="_blank">` link; not verified
    that `data-argo.ifremer.fr`/`ncss.hycom.org` are actually reachable from a demo
    environment at presentation time — acceptable (these are the same real URLs already
    shown as plain text pre-this-step; making them clickable is a presentation
    improvement, not a new claim about reachability).
  - `SourceBlock`'s row layout (a fixed 110px label column) is not pixel-checked at the
    narrower 300px control-rail breakpoint — same class of open item noted for
    `ProfileChart`/`CollocationPanel` in steps 1–2. **Checked — see "Responsive/
    accessibility QA pass" above**: the Provenance tab (both source blocks) renders
    correctly at 1440x900, no fix needed for this component specifically.

**Phase 5A is now fully complete: all three steps (profile chart, comparison tab,
provenance tab) implemented, tested, and browser-verified.** Per the proposed phase order
(0→1→2→2.5→3→4A→5A→4B→5B→6→7), 4B and 5B are the next items on that list, but both are
explicitly named under "Defer to finalist work (do not block the internal round)" above
(near-real-time ingestion, glider/CTD/BGC/satellite/advisory/ML layers, OGC/OPeNDAP,
advanced volume rendering) — none of that is scoped for the internal round. The
highest-value next task is therefore not a new phase number but hardening what already
exists: the two real, documented-but-unfixed backend inconsistencies found along the way
(the `/model-column` nearest-timestamp fallback bug from step 1, and the
`compute_collocation()` temperature-fallback-for-non-salinity-variables bug from step 2),
plus the several noted-but-unverified narrow-viewport layout gaps across all three tabs —
see "Recommended next task" in the final report for this session.

## Phase 5A step 2 result (2026-09-12) — real collocation/comparison tab

**`EvidencePanel`'s Comparison tab no longer shows the "implemented in a later phase"
shell.** It renders the selected Argo observation's real model-vs-observation collocation
result — RMSE, mean bias, horizontal distance, time offset, and per-depth-band agreement —
fetched through the existing `getCollocation` adapter method against the existing
`/api/v1/collocation/{id}` endpoint. No new endpoint, no statistic recomputed in the
frontend: every number shown is exactly what the backend already computed (`ProfileChart`
is unchanged; its own separate Phase 5A step 1 behaviour was not touched by this step).

- **Real gap found and fixed, additive only**: `ApiOceanDataAdapter.getCollocation` was
  silently dropping four fields the backend's `/collocation` response already returns —
  `unit`, `observation_timestamp`, `observation_source`, and the full provenance `source`
  descriptor. `CollocationResult` (`src/domain/types.ts`) gained four new **optional**
  fields (`unit`, `observationTimestamp`, `observationSource`, `source`) to carry them —
  additive, so `CachedRealDataAdapter`/`FixtureDataAdapter`, which predate this and don't
  set them, are unaffected. Without this fix, the task's "clearly label units" and "show
  source, historical-demo date... QC caveats" requirements could not have been met.
- **Real gap found and fixed, adapter-side only (no backend change)**:
  `ApiOceanDataAdapter.getCollocation` previously caught *every* error and returned `null`
  uniformly — meaning a genuine backend-down/500 failure was indistinguishable from "no
  collocation exists for this id" (both silently became `null`). Now only a `404`
  (`ObservationNotFoundError`/`NoModelColumnError`, both real, intentional "no collocation"
  answers per `docs/api.md`) maps to `null`; any other error (network failure, `5xx`,
  unexpected status) rethrows, so the UI's `error` state is reachable and honest rather than
  silently reported as "no comparison available." Verified both ways: existing 404 tests
  still pass, two new tests confirm a `500` and a network failure both reject.
- **No timestamp snapping workaround needed here** (unlike step 1's `/model-column` fix):
  read `backend/app/science/collocation.py`'s `compute_collocation()` — when no `timestamp`
  is passed it already calls its own `_nearest_timestamp()` internally, so the adapter is
  called with no timestamp and the backend picks the real nearest model snapshot correctly.
- **New**: `src/ui/EvidencePanel/collocationView.ts` (pure, unit-testable — same split as
  `profileComparison.ts`): `selectCollocationView()`, `verdictColorVar()`, `formatKm()`,
  `formatHours()`, `describeBiasDirection()`; re-exports `profileComparison.ts`'s
  `isProfileChartVariable` as `isCollocationVariable` rather than duplicating the gate.
  `useCollocation.ts` (race-guarded hook, mirrors `useProfileComparison.ts`).
  `CollocationPanel.tsx` + `.module.css` (meta rows, three stat tiles, a depth-band table,
  the backend's own interpretation sentence shown verbatim, and a caveats list).
- **Real finding, gate applied rather than a backend fix (out of this task's scope)**:
  reading `backend/app/science/collocation.py`'s `compute_collocation()` shows that for any
  `variable` other than `"salinity"` it unconditionally uses the profile's **temperature**
  array as the "observed" series — so a `currentSpeed` (or `chlorophyll`) collocation
  request would silently compare the model's current speed against the float's temperature,
  a real backend inconsistency. `isCollocationVariable` (= `isProfileChartVariable`) gates
  the tab to temperature/salinity only, exactly like the Profile tab, so this is never
  reached from the UI. Worth a backend fix later; documented here so nobody "discovers" it
  by accident. **Fixed 2026-09-12 — see "Backend correctness hardening" above**: the
  frontend gate described here is still in place (defence in depth), but the backend itself
  now also refuses these variables honestly (`422`) rather than silently mis-comparing them.
- **Design**: RMSE and mean bias each render via the existing `formatValue`/`formatDelta`
  helpers (`src/domain/variables.ts`), which already return "—" for a non-finite value —
  the unavailable/zero distinction the task required came for free from code that already
  existed, not a new formatter. Bias also gets a one-line direction phrase from the
  variable's own `biasWords` (e.g. "model cooler than observed") and the existing
  `DELTA_CONVENTION` string ("Δ = model − observation") is shown as a caption. Each depth
  band's `verdict` (`High`/`Fair`/`Moderate`/`Low`) is coloured via `verdictColorVar()` —
  styling of an already-real categorical value from the API, never an invented confidence
  score. The "READING" block shows `result.interpretation` verbatim — the backend's own
  deterministic sentence (ported 1:1 from `src/domain/stats.ts`'s
  `buildScientificInterpretation` during Phase 2.5) — satisfying "use existing project
  logic/thresholds" by construction, since nothing new was computed for it. A caveats list
  states the GOOD/PROBABLY_GOOD-only QC filter (real, from the backend) and shows the real
  provenance `source.caveats` array; a WINDOW row repeats the real historical-demo label and
  date range from `dataStore.metadata`, matching the Command Bar's own wording.
- **States covered** (`selectCollocationView`, verified live in all four below):
  `unavailable-variable` (current speed/chlorophyll), `loading`, `error` (with retry, now
  actually reachable per the fix above), `no-collocation` (adapter returned `null` — no
  model column exists; real, though every profile in this cache has 100% coverage so it
  wasn't reproducible live this step), `no-valid-levels` (a real zero-sample result — still
  shows real position/time metadata and the backend's own explanatory sentence, with every
  stat as "—", never fabricated as 0), `ready`.
- **Tests**: `collocationView.test.ts` (17) — variable gating, verdict→colour mapping,
  km/hour formatting incl. non-finite → "—", bias-direction wording incl. the NaN-safe
  empty-string case, every `selectCollocationView` branch.
  `collocationView.integration.test.ts` (4, live backend only) — `ARGO-5907083-2`'s real
  RMSE/bias (cross-checked against the Phase 2.5-documented value, 0.2434 °C / +0.1816 °C,
  within tolerance in case the cache is regenerated), the real all-BAD-QC profile
  `ARGO-4903776-2` resolving to `sampleCount: 0` with every statistic `NaN` (never 0) while
  distance/time-offset stay real and finite, a selection-change producing a genuinely
  different result, and salinity's collocation being independently computed from
  temperature's (not a duplicate). `ApiOceanDataAdapter.test.ts` gained 4 more
  `getCollocation` cases for the new field mapping and the error-vs-null distinction.
  **189 total passing** (up from 168), 20 skipped without a live backend (up from 16 — the
  new integration file).
- **Verified live** (`npm run test:integration`, backend running): 19/19 passing, including
  all 4 new collocation cases. Backend `pytest`: 89/89, unchanged.
- **Verified**: `tsc --noEmit` clean; `vite build` clean, 75 modules (up from 71).
- **Verified in an actual browser** (headless Chromium via Playwright, screenshots taken):
  selecting a real observation (`ARGO 2902770`) and opening Comparison shows real RMSE 0.70
  °C / mean bias −0.21 °C ("model cooler than observed") / 102 levels compared, a real
  5-row depth-band table with genuinely mixed verdicts (HIGH/MODERATE/LOW/FAIR — not all the
  same, proof the thresholds are doing real work), and the backend's own interpretation
  sentence; switching to salinity re-renders correctly with real PSU numbers and an
  independent RMSE; switching to current speed shows the `unavailable-variable` state;
  selecting the real BAD-QC float (`ARGO 4903776`) shows RMSE/MEAN BIAS as "—", all five
  bands as "—" with `n=0` and a LOW verdict, real distance (0.36 km) and time offset (−10.2
  h) still displayed, and the correct "no quality-controlled levels overlap" sentence. The
  3D scene and the Profile tab both continued working correctly throughout (no regression).
- **Gaps, stated plainly**:
  - `no-collocation` (the adapter returning `null` because no model column was ever
    extracted) was verified only via a fetch-mocked unit test, not live — every real profile
    in the current cache has a model column (100% coverage, established in Phase 4A step 2),
    so this state cannot currently be reproduced against the live backend. It will fire
    honestly if a future, sparser cache introduces a genuine gap.
  - The backend's `compute_collocation()` temperature-fallback-for-non-salinity-variables
    inconsistency (above) is avoided by gating, not fixed — a real, separate backend
    improvement for later. **Fixed 2026-09-12 — see "Backend correctness hardening" above.**
  - Depth-band table columns are fixed-width `<td>`s with no responsive collapse; not
    pixel-checked at the narrower 300px control-rail breakpoint, same open item noted for
    `ProfileChart` in step 1. **Checked — see "Responsive/accessibility QA pass" above**:
    the Comparison tab's depth-band table renders correctly at 1440x900, no fix needed.
  - The "distance (model grid cell to float position)" and "time offset (observation −
    model)" explanatory parentheticals are plain inline text, not a tooltip/help affordance
    — adequate for this round, would read better with a hover explanation in a later pass.

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
    improvement. **Fixed 2026-09-12 — see "Backend correctness hardening" above**: the
    frontend's `nearestTimestamp()` workaround described here is still in place and still
    harmless to keep, but is no longer masking a real backend gap.
  - The modelled line renders only as deep as HYCOM's own z-levels reach at that position;
    this is correct/honest behaviour (real data has a real depth limit), not a bug, but it
    was not obvious from the spec and is worth flagging so nobody "fixes" it into a
    fabricated deep extension.
  - No RMSE/bias numbers are shown on this tab by design — that is Comparison tab scope
    (Phase 5A step 2, explicitly deferred).
  - Chart is a fixed 320×300 viewBox scaled by CSS width:100% — not yet checked against the
    narrower 300px control-rail-driven layout breakpoints from Phase 1; likely fine given
    `viewBox` scaling but not pixel-verified at that width. **Checked — see "Responsive/
    accessibility QA pass" above**: confirmed correct at 1440x900 as predicted, `viewBox`
    scaling handled it with no fix needed.

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
