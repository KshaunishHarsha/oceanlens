# Phase 0 — Repository, design and data audit

Date: 2026-09-10 · Status: complete, awaiting approval

---

## 1. Repository map

`/Users/kshaunish/code/oceanlens` was **empty**. No git, no package.json, no source.
After Phase 0 it contains only documentation:

```
oceanlens/
  CLAUDE.md                 cross-session working context
  docs/phase-0-audit.md     this file
```

No dependencies installed in the project. No application source created.
(`netcdfjs` was installed in a throwaway scratch directory purely to verify that real Argo
NetCDF is parseable in JS — a Phase 0 feasibility question.)

---

## 2. Design inventory

Claude Design project `02b36dfc-4d04-4d3e-8cc9-2252628d1e04`.

| File | Role | Reviewed |
|---|---|---|
| `OceanLens India.dc.html` | 134 KB canonical artboard + inline logic | full |
| `support.js` | Claude Design canvas runtime (generated) | surveyed |
| `ocean-field.js` | Domain module `window.OceanField` | full |
| `ocean-scene.jsx` | React scene, d3-geo/topojson, layered canvas + SVG | full |
| `profile-chart.jsx` | React SVG depth-profile chart | full |
| `timeline-rail.jsx` | React playback rail with event register | full |
| `screenshots/full.png` | whole composition (narrow — shows strip overlap) | inspected |
| `screenshots/scene.png` | hero scene at true scale | inspected |
| `screenshots/contrast.png` | composition incl. evidence panel | inspected |
| `screenshots/01-states.png` | full composition incl. timeline | inspected |
| `screenshots/02/03/04-states.png`, `contrast2.png`, `full2.png` | component-state variants | **deferred to Phase 3** |

Deferring five screenshots is deliberate: they document component states that only become
actionable when the shell is being ported. They are not needed to choose an architecture.

### Artboard structure (1600 × 1000)

60px nav rail · 58px command bar · 26px provenance strip · 338px left control rail ·
flexible canvas stage · 398px right evidence panel (PROFILE / COMPARISON / PROVENANCE tabs,
plus BRIEFING and OUTREACH modes) · 106px bottom timeline.

Already genuinely functional in the prototype: variable/depth/time/layer/filter state,
depth-slice raster, transect curtain, isosurface tracing, current vectors, platform
select/hover, profile chart with |Δ| band, **RMSE and mean bias actually computed**,
depth-band verdicts, deterministic interpretation strings, provenance rows, playback.

---

## 3. Binding translation table

`.dc.html` is not React. `support.js` compiles it at runtime. Translation for Phase 3:

| `x-dc` construct | Meaning | React target |
|---|---|---|
| `{{ expr }}` | value from `renderVals()` | `{expr}` |
| `<sc-if value="{{ x }}">` | conditional subtree | `{x && (…)}` |
| `<sc-for list="{{ xs }}" as="i">` | list render | `xs.map(i => …)` |
| `hint-placeholder-val` / `-count` | canvas-editor preview hints | **drop** |
| `style="…"` CSS string | inline style | `style={{…}}` object |
| `style-hover="…"` | hover pseudo-class | CSS Module `:hover` rule |
| `onClick="{{ fn }}"`, `onMouseDown`, `onMouseEnter/Leave` | handlers | props |
| `ref="{{ fn }}"` | callback ref | `ref={fn}` |
| `<helmet>` | document head injection | `index.html` |
| `class Component extends DCLogic` + `renderVals()` | one god-component | decomposed components + Zustand |
| `data-props` JSON | canvas editor knobs (`mode`, `renderMode`) | store fields |

`support.js` itself is **not shipped**.

---

## 4. Data-source inventory (probed live, 2026-09-10)

| Source | Endpoint | Status | Verdict |
|---|---|---|---|
| Argo GDAC — INCOIS DAC | `data-argo.ifremer.fr/dac/incois/` | 200, 625 floats | **primary observations** |
| Argo GDAC — Indian Ocean daily | `/geo/indian_ocean/YYYY/MM/YYYYMMDD_prof.nc` | 200, 4.2 MB/day | secondary harvest route |
| Argo global index | `ar_index_global_prof.txt.gz` | 200, 58 MB, updated today | discovery only |
| HYCOM GOFS 3.1 GLBy0.08 | `ncss.hycom.org/thredds/ncss/grid/…/ts3z` | 200; **time ends 2024-09-05** | model field, date-constrained |
| Argovis | `argovis-api.colorado.edu/profiles` | `not found` | not needed |
| NOAA NCEI WOA23 | `ncei.noaa.gov/thredds-ocean/…` | probe timed out | fallback only |
| INCOIS public ERDDAP | — | none confirmed | INCOIS data reaches us via GDAC |

### Format finding (decisive)

Argo files are **NetCDF-3 classic** (`CDF\x01`). The pure-JS `netcdfjs` package parses them.
Verified end to end by reading a real file and extracting a real profile. No Python, no HDF5,
no native dependency — which matters because this machine has no numpy/xarray/netCDF4/ncdump.

### Real profile extracted (proof)

```
WMO 1902594   DAC=IF   cycle=125   DATA_MODE=R   PROFILE_TEMP_QC=A
9.112°N 86.795°E   2026-09-03T23:00:25Z   POSITION_QC=1
project="NAOS"  PI="Vincent TAILLANDIER"  WMO_INST_TYPE=834  positioning=GPS
242 good levels, 3.5 – 1974.6 dbar
T:  0m 29.38  50m 27.76  100m 24.26  150m 18.62  200m 14.45  300m 12.10  500m 10.20  (°C)
S:  0m 33.92  50m 34.91  100m 34.87  150m 34.78  200m 34.96  (PSU)
```

A textbook Bay of Bengal thermocline with the characteristic fresh surface cap. This alone
satisfies the brief's "surface 27–30 °C, decreasing substantially by 200 m" requirement —
with **real measurements** rather than a synthetic curve.

Two genuine INCOIS floats also present that day (WMO 1902669, 5907083; `DAC=IN`,
`project="Argo INDIA"`, `PI="M Ravichandran"`) but with `PROFILE_TEMP_QC = E/F` and 0–1 good
levels. Real-world QC failure — kept and surfaced, not hidden.

### QC mapping — no invention needed

| Argo flag | Meaning | Our `QualityFlag` |
|---|---|---|
| `1` | good | `GOOD` |
| `2` | probably good | `PROBABLY_GOOD` |
| `3` | probably bad / correctable | `SUSPECT` |
| `4` | bad | `BAD` |
| `5`/`8` | changed / interpolated | surfaced in provenance |
| `9` | missing | dropped |

---

## 5. Real-versus-synthetic classification

| Element | Today (design) | After Phase 2 | Notes |
|---|---|---|---|
| Argo profiles (T, S) | synthetic | **REAL** | Argo GDAC, locally cached |
| Platform metadata, QC, provenance | fabricated | **REAL** | WMO, DAC, cycle, PI, DATA_MODE, QC |
| Model T/S field | synthetic analytic | **REAL if HYCOM date aligned** | else labelled synthetic |
| Collocation distance / time offset | fabricated strings | **REAL, computed** | haversine + JULD delta |
| RMSE / mean bias | computed on synthetic | **REAL, computed** | from cached arrays |
| Current vectors (u, v) | synthetic streamfunction | REAL if HYCOM `uv3z` added | else drop or label |
| Chlorophyll | synthetic | **no source identified** | → `Not available in MVP` |
| Glider tracks | synthetic | **no source identified** | → `Planned extension` |
| CTD casts | synthetic | **no source identified** | → `Planned extension` |
| BGC floats | synthetic | possible via Argo BGC (`SPROF`) | investigate Phase 2 |
| Bathymetry / EEZ contours | derived from coastline | derived, **labelled** | generalised, not GEBCO |
| Isosurface | derived | derived from real field | label `derived` |
| Coastlines | real (Natural Earth) | **REAL, vendored** | remove CDN fetch |
| "Verified source" chip | fabricated | **REMOVED** | replaced by real QC state |
| DOI, `INCOIS-OPS-2026-114`, view ID | fabricated | **DEMO- identifiers** | |
| `Processing status: verified` | fabricated | `locally validated` | |

**Consequence to accept:** the platform-type filter will legitimately show fewer types than
the mock. Argo (and possibly BGC) will be real; Glider and CTD become planned extensions
unless a source is found. This is the honest outcome and I recommend it.

---

## 6. Conflict ledger — the two tracks

| # | Field | `.dc.html` | `ocean-field.js` | Resolution |
|---|---|---|---|---|
| C1 | Variable keys | `temp/sal/cur/chl` | `temperature/salinity/currents/chlorophyll` | canonical enum; `currents`→`currentSpeed` |
| C2 | Platform count | 16 | 35 | **neither** — however many are real |
| C3 | Platform IDs | `ARGO-2902345` etc. | `2902345` etc. | real WMO numbers |
| C4 | QC vocabulary | `GOOD`/`MIXED` | `GOOD`/`PROBABLY_GOOD`/`QUESTIONABLE` | canonical 4-value enum from Argo |
| C5 | Field math | Gaussian eddy | fbm noise + thermocline | `ocean-field` shape; real data supersedes |
| C6 | Salinity range | 32–35.5 | 31.5–35.2 | derive from real data, clamp sensibly |
| C7 | Chlorophyll range | 0.02–1.2 | 0–2.4 | moot — variable likely dropped |
| C8 | Profile depth | 0–1000 m | 0–500 m | real Argo reaches ~2000 m; display 0–1000 m |
| C9 | Transect A→B | 13.2,84.6 → 18.6,90.4 | 86.6,14.4 → 90.6,18.6 (lon,lat) | `.dc.html` values, lat/lon order normalised |
| C10 | Analysis volume | 11–20°N, 82–92°E | 10.4–19.3°N, 84.6–93°E | `.dc.html` (matches the copy) |
| C11 | Timesteps | 7 × 3 h | 0–18 h continuous | 7 × 3 h; real cadence from data |
| C12 | Palettes | 6-stop ramps | 4–7-stop ramps | `.dc.html` (design authority) |
| C13 | Instrument colours | argo `#4FC3D9`, glider `#8FD3C0` | argo `#4CC8D8`, glider `#7FA8E8` | `.dc.html` |
| C14 | Scene projection | hand-rolled linear | d3 Mercator + real coastline | **`ocean-scene.jsx`** (far better) |
| C15 | Chart geometry | canvas, `pow(d,0.72)` depth | SVG, linear depth | SVG; keep non-linear depth option |

---

## 7. Risk register

| # | Risk | Sev | Mitigation |
|---|---|---|---|
| R1 | Two inconsistent tracks | High | §6 ledger, resolved before code |
| R2 | 1600px artboard vs 1440 target; strip overlap seen in `full.png` | High | rails 300/360, flex stage, verify per breakpoint |
| R3 | Scene fetches TopoJSON from CDN at runtime | High | vendor into `public/`, d3 via npm |
| R4 | **HYCOM ends 2024-09-05; demo copy says Sep 2026** | High | **open question Q2** |
| R5 | Sparse real data: ~3 BoB profiles/day, ~1 good | High | harvest per-float `_prof.nc` across many cycles |
| R6 | Synthetic obs presented as verified | High | removed; real QC only |
| R7 | Fabricated DOI / institutional IDs | High | `DEMO-` identifiers |
| R8 | Chlorophyll/Glider/CTD have no real source | Med | mark `Not available in MVP` / `Planned extension` |
| R9 | `buildGeo` recomputes on every resize (132² `geoContains` + 16 smoothing passes + 3 contours) | Med | precompute mask offline; debounce; decouple from viewport |
| R10 | ~2000 lines of inline-style translation | Med | tokens first, component-by-component vs screenshots |
| R11 | Google Fonts at runtime | Low | self-host via `@fontsource` |
| R12 | `netcdfjs` char/dim indexing traps | Low | **solved**; working reader in scratch |

---

## 8. Recommended first real dataset

**Argo GDAC — INCOIS and Indian Ocean floats in the Bay of Bengal.**

Rationale: it is simultaneously source priority #1 (real INCOIS) and #2 (real public Argo);
it is public and unauthenticated; it is NetCDF-3 so it parses in pure JS; it carries complete
real provenance and QC; and it *is* the observation half of the product's core question.

Harvest plan for Phase 2:
1. Select ~8–12 real floats with Bay of Bengal trajectories, preferring `DAC=IN`.
2. Download each `<wmo>_prof.nc` (~147 KB) — each file holds the float's full cycle history,
   giving genuine time evolution rather than one snapshot.
3. Parse with `netcdfjs`, filter by bbox + QC, normalise pressure→depth, order depth downward.
4. Emit a compact typed cache into `public/data/` with a provenance sidecar
   (source URL, retrieval date, file checksum, variables, units, transformations).
5. Ship the cache. **No network access at demo time.**

Model half: resolve Q2 first.

---

## 9. Open questions

**Q1 — Scope of honesty.** Confirmed: Chlorophyll, Glider and CTD have no identified real
source. Do you accept them being shown as `Not available in MVP` / `Planned extension`,
reducing the MVP to Temperature + Salinity (+ currents if HYCOM `uv3z` is added), Argo-only?
This is fewer layers but fully defensible. *My recommendation: yes.*

**Q2 — Demo date vs. real model coverage.** HYCOM `expt_93.0` covers 2018-12-04 → 2024-09-05.
Options:
- **(a) Move the demo date into the covered window** (e.g. Sep 2023) and harvest real Argo for
  the same window. **Both sides real, real collocation.** Requires changing "03 Sep 2026" copy.
  *My recommendation.*
- (b) Find a newer HYCOM experiment covering 2026 (needs investigation, may not exist publicly).
- (c) Keep 2026 dates with real Argo, and label the model field explicitly as
  `synthetic test field` — honest but weaker.

**Q3 — Currents.** Adding HYCOM `uv3z` gives real u/v vectors but doubles model download and
prep. Include, or ship currents as a planned extension?

**Q4 — Cache size budget.** Real Argo cache ≈ 1–3 MB. A HYCOM Bay of Bengal subset
(T+S, 40 levels, ~7 timesteps, 1/12° over 11–20°N/82–92°E) ≈ 10–25 MB depending on precision.
Acceptable to commit to the repo, or should it be a documented prep script that the user runs
once?
