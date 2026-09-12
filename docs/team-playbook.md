# OceanLens India — Team Playbook

> **Purpose:** This is the shared guide for anyone working on, testing, presenting, or extending OceanLens. Read this before making changes.

## 1. The project in one sentence

OceanLens is a browser-based 3D ocean **evidence workspace** for INCOIS: at a chosen location, depth, and time, it shows what an ocean model estimates, what a real instrument measured, and how closely they agree.

It is not a generic dashboard and it is not a forecasting or machine-learning product today. It is a tool for comparing trustworthy, labelled historical ocean data in one place.

## 2. The problem we solve

Ocean scientists and forecasters often need to switch between separate tools to inspect a model map, find an Argo profile, inspect a depth plot, and decide whether the model matches a real observation. That is slow and makes it harder to understand complex three-dimensional ocean conditions.

OceanLens brings those pieces together in one browser experience:

```text
Choose variable, depth, and date
             ↓
See the model's 3D depth slice
             ↓
Click a real Argo float
             ↓
Compare its measured vertical profile with the closest model profile
             ↓
See the evidence, quality information, source, and limitations
```

This supports the SIH/INCOIS goal of a browser-native 3D ocean visualization system that integrates model output and in-situ observations.

### Why this matters — explanation for non-ocean judges

The ocean is not a flat map. Temperature, saltiness, and currents can be very
different near the surface, 100 m below it, and 1,000 m below it. A numerical
ocean model provides a useful **continuous regional estimate**, but it is still
a calculation. An Argo float provides a **real measurement**, but only at the
few places where floats happen to be.

OceanLens combines their strengths:

```text
Model: broad coverage of the whole sea, at many depths and times
                              +
Argo: real vertical measurement at one location and time
                              ↓
OceanLens: explore the model anywhere; validate it where evidence exists
```

This is why the product is an *evidence workspace*, not only a map. A colourful
model picture answers “what does the model estimate?” OceanLens also helps a
user ask “what evidence supports that estimate here?” and “what are its
limitations?”

### Target users and their use cases

| Target user | What they need | What OceanLens changes |
|---|---|---|
| INCOIS ocean forecaster / analyst (primary user) | Quickly inspect a condition at a place, depth, and time before supporting an advisory or internal assessment. | Replaces switching among a model viewer, profile files, charts, and provenance records. |
| Ocean modeller / researcher | Check whether a model is systematically too warm/cool or too salty/fresh at real profiles. | Shows the model and measured profile together with repeatable metrics. |
| Search-and-rescue, fisheries, hazard, or climate-support team | Obtain understandable regional context before using their own operational procedures. | Makes depth and time patterns visible, with clear limits rather than a black-box answer. |
| Student, policymaker, or public visitor (secondary) | Understand why ocean data is complex and why observations matter. | Turns arrays and NetCDF files into an interactive 3D explanation. |

OceanLens does **not** issue a rescue instruction, fishery advisory, or hazard
warning by itself. It is decision support: it makes data and uncertainty easier
for qualified users to inspect.

### Why each main feature exists

| Feature | Why it exists | What it lets a user say or do |
|---|---|---|
| 3D depth slice | Ocean processes vary vertically, so a 2D surface map is incomplete. | “Show me this variable at 100 m, not only at the surface.” |
| Time control | A single snapshot can hide change over time. | Step through the historical daily snapshots. |
| Variable control | Temperature, salinity, and current speed describe different parts of ocean state. | Choose the evidence relevant to the question. |
| Click-anywhere model probe | Models cover the full grid, whereas floats do not. | Analyse a real model column at any selected grid location. |
| Argo markers | Real observations give ground truth at specific locations. | Select a measured profile from the same 3D scene. |
| Profile chart | A float measures many depths, not one value. | Compare how a variable changes through the water column. |
| Comparison metrics | Visual comparison alone is subjective. | Quantify model agreement and explain its limits. |
| Provenance and QC | Scientific decisions require origin, processing, and quality context. | Show exactly where a result came from and what was excluded. |
| Briefing Mode | Not every operational user speaks in RMSE and bias. | Ask a constrained plain-language question about the selected evidence. |

## 3. What is in the prototype now

The internal-round prototype is complete and uses real, locally cached data.

| Area | What works now |
|---|---|
| 3D view | A Three.js/WebGL scene renders a real model depth slice. It supports temperature, salinity, and current speed. |
| Map interaction | Real Argo markers are placed at their recorded latitude/longitude. Users can hover and click them. |
| Controls | Variable, depth, time, opacity, and vertical-exaggeration controls are connected to the scene. |
| Time | The demonstration has 11 daily time steps, with playback and scrubbing. |
| Profile tab | A selected float's observed temperature or salinity profile is shown beside the model profile at the float's location. |
| Comparison tab | Real model-versus-observation statistics and depth-band results are shown. |
| Provenance tab | Sources, dates, processing steps, licences, and caveats are shown for the selected observation and model layer. |
| Data quality | Per-level Argo quality flags are retained. Bad data is never silently treated as good data. |
| Honesty | Unsupported sources and variables are visibly labelled unavailable or planned; no synthetic science is shown in the app. |
| Reliability | The scene recovers from a lost WebGL context, an issue that was found and fixed through real browser testing. |
| Click-anywhere analysis | Clicking the coloured model plane selects a real latitude/longitude and loads the model's full vertical column there. It is explicitly labelled **model-only** unless an Argo observation is selected. |
| Live scene probe | A crosshair cursor reports live latitude, longitude, selected depth/time, and the nearest real model-grid value; land/missing cells remain unavailable. |
| Selected-point visibility | A high-contrast magenta target ring, crosshair, and vertical beacon mark the selected model point in 3D. |
| Flexible workspace | Controls and Evidence panels can retract, giving the WebGL scene more room; it resizes with the available workspace. |
| Briefing Mode | A server-side OpenAI-backed explanation of selected temperature/salinity evidence, constrained to supplied cached facts; it is not general web chat. |

### What a user can demonstrate

1. Select **temperature**.
2. Change depth or date and see the real model field change.
3. Click an Argo marker.
4. Open **Profile** to compare measured and modelled temperature by depth.
5. Open **Comparison** to see RMSE, bias, distance, time offset, and depth-band agreement.
6. Open **Provenance** to explain exactly where the two datasets came from and what processing happened.
7. Click an empty ocean location to show that model analysis works even where no float exists; point out that it is correctly labelled model-only.
8. Open **Briefing Mode** to translate the selected validated evidence into plain language.

## 4. Demonstration data: scope and honesty

This is a **historical demonstration window**, not a live feed.

| Item | Current value |
|---|---|
| Region | Bay of Bengal: 8–20.5° N, 81–93° E |
| Time window | 25 September 2023 through 5 October 2023 |
| Model times | 11 daily snapshots at 00:00 UTC |
| Observations | 28 real Argo profiles from 27 floats; 19 are from INCOIS |
| Observation depth | Irregular real float levels, reaching about 2,010 m |
| Model depth | Cached 3D fields; visual slice cache has 14 depth levels and model columns use native 40-level data |

The period was chosen because it has good usable INCOIS Argo coverage inside the real HYCOM archive. Do not claim this is current, real-time, a forecast, or an INCOIS operational feed.

## 5. Data sources

### A. Real in-water observations: Argo profiling floats

- **Primary web source:** [Argo GDAC at Ifremer](https://data-argo.ifremer.fr/dac/)
- **Data providers represented:** mainly INCOIS / Indian Argo Project (`incois` data centre), plus China Argo / CSIO partner floats (`csio`).
- **What each float provides:** its location, time, pressure/depth, temperature, salinity, and quality flags at many depths.
- **Files:** NetCDF profile files, selected from the official Argo index and cached locally.
- **Data used:** `PRES`, `TEMP`, `PSAL`, adjusted values where delayed/adjusted data exists, and per-level quality flags.

Plain-language explanation: an Argo float is an autonomous instrument that moves through the water column and reports how warm and salty the sea is from near the surface downwards. Each profile is a real vertical measurement of the ocean at one place and time.

### B. Model fields: HYCOM GOFS 3.1

- **Temperature and salinity:** [HYCOM NCSS `ts3z`](https://ncss.hycom.org/thredds/ncss/grid/GLBy0.08/expt_93.0/ts3z)
- **Currents:** [HYCOM NCSS `uv3z`](https://ncss.hycom.org/thredds/ncss/grid/GLBy0.08/expt_93.0/uv3z)
- **Provider:** HYCOM Consortium / Naval Oceanographic Office.
- **What it provides:** gridded water temperature, salinity, east/west current, and north/south current values over time and depth.

Plain-language explanation: HYCOM is a physics-based ocean simulation. Instead of a measurement at one float location, it estimates conditions across the entire region. OceanLens uses it to create the coloured 3D depth slices.

### C. Derived results we calculate from those sources

- Current speed: `sqrt(u² + v²)` from HYCOM's east/west and north/south current components.
- Model–observation comparison: calculated from real cached model and Argo values; never hard-coded.
- Isosurface: derived from real HYCOM temperature where enabled; it is not a separately downloaded source.

### D. Sources not yet integrated

| Source/layer | Status | Why |
|---|---|---|
| BGC-Argo | Not available in this prototype | No suitable co-located BGC data prepared for the chosen window. |
| Gliders | Planned | No open real section prepared yet. |
| CTD casts | Planned | No open real source prepared yet. |
| Satellite SST | Planned | A source is known, but it is not in the cache. |
| Satellite chlorophyll | Planned | A source is known, but it is not in the cache. |
| INCOIS advisories | Planned | No stable public feed is integrated. |
| ML anomaly layer | Planned | No trained model exists yet. |

Never turn these into fake demo data. Say they are planned extensions.

### Why a user can analyse any point but cannot validate every point

The model is a gridded field, so OceanLens can request a vertical model column
at any clicked coordinate inside the cached Bay of Bengal domain. The backend
uses the real model grid and its existing location sampling, then returns the
actual model timestamp and depth values used.

An RMSE or bias requires two datasets at comparable positions and times. It is
only scientifically meaningful where there is a real observed profile. Thus:

| Selected location | What OceanLens can honestly show |
|---|---|
| Any point on the model plane | Model variable, depth slice value, time, and full model depth column. |
| An Argo float point | Everything above, plus observed profile, model–observation metrics, depth-band agreement, and a grounded briefing. |
| A point with no suitable observation | Model-only analysis. No fabricated RMSE, bias, or confidence score. |

## 6. Data preparation and quality handling

The application runs offline after setup because the real scientific data is preprocessed and committed as a compact cache in `public/data/real/`.

### Argo preparation

1. Select files using the Argo index for the Bay of Bengal and demo dates.
2. Prefer adjusted values for delayed/adjusted Argo profiles.
3. Convert pressure in decibars to depth in metres using the UNESCO 1983 method.
4. Drop levels where pressure quality is explicitly bad (`PRES_QC = 4`).
5. Keep quality information on the remaining levels.
6. Sort each profile shallow to deep.

Argo flags are shown honestly:

| Argo flag | Meaning in the app |
|---|---|
| 1 | Good |
| 2 | Probably good |
| 3 | Suspect |
| 4 | Bad |

One real profile has no usable levels because it failed quality control. It remains in the system as a real location/identity record and the UI shows that no valid comparison can be made. That is a feature of the evidence workflow, not an error to hide.

### HYCOM preparation

1. Request a Bay of Bengal subset for each date from the HYCOM NCSS endpoints.
2. Convert packed values to normal floating-point values using the source scale/offset.
3. Convert fill values to missing values (`null` in API JSON), never zero.
4. Store a decimated version for fast visual slices.
5. Store full native-resolution model columns at the float positions for scientifically better profile comparisons.

## 7. Metrics in plain language

All comparison metrics apply to temperature or salinity only. We do **not** compare model current speed with Argo because this cache has no observed current-speed value from the floats.

| Metric | What it means | How to explain it in a demo |
|---|---|---|
| Horizontal distance | Great-circle distance from the float to the model location/column used. | “How far the model point is from the real instrument.” |
| Time offset | Observation time minus the model snapshot time. | “How far apart in time the two records are.” |
| Difference / delta | `model − observation` at a depth. | Positive temperature bias means the model is warmer; negative means cooler. Positive salinity bias means saltier; negative means fresher. |
| Mean bias | Average of `model − observation` across valid paired depths. | “Does the model tend to be too warm/cool or too salty/fresh overall?” |
| RMSE | Root mean square error across valid paired depths: `sqrt(mean((model − observation)²))`. | “Typical size of the model’s mismatch; lower is better.” |
| Sample count | Number of QC-acceptable depth pairs used in the calculation. | “How much valid evidence supports the statistic.” |
| Depth-band agreement | The same comparison split into depth ranges, with a verdict such as High, Moderate, Fair, or Low. | “Where in the water column the model agrees well, and where it does not.” |
| Interpretation | Deterministic text built from the calculated metrics. | “A concise evidence summary, not an AI-generated claim.” |

Important rules:

- A missing statistic is shown as `—`, never as zero.
- Bad-QC or no-overlap profiles produce zero valid samples and no invented RMSE or bias.
- RMSE and mean bias are calculated by the Python backend, not hand-entered in the frontend.

### What the metrics imply — and what they do not

- **Lower RMSE** means the model and float were closer at the valid paired
  depths for this one comparison. It does not prove the model is accurate
  everywhere in the Bay of Bengal.
- **Bias near zero** means the model does not have a strong average direction
  of error for that profile. It can still have large errors at individual
  depths, which is why depth bands are shown too.
- **A large distance or time offset** makes a mismatch less conclusive: the
  ocean can genuinely vary between the float and model grid location, or
  between their timestamps.
- **More valid levels** means more evidence supports the statistic. It is not
  a percentage accuracy score.
- **A dash (`—`) is a result.** It means the required evidence does not exist
  or did not pass quality control; it never means zero error.

Useful judge-ready example:

> “An RMSE of 0.70 °C means that, across the valid depths for this historical
> profile, the model was typically about 0.70 °C away from the float's real
> temperature measurement. A mean bias of −0.21 °C means it tended to be
> slightly cooler on average. We still inspect the depth bands, distance, and
> time offset before drawing a conclusion.”

## 8. Technical architecture

```text
Real Argo + HYCOM source files
             ↓
Preparation scripts / NetCDF parsing / validation
             ↓
Committed local cache: public/data/real/
             ↓
FastAPI backend (Python)
  QC, depth conversion, slices, columns, collocation, provenance
             ↓  JSON over HTTP
React + TypeScript frontend
  Three.js scene, controls, charts, comparison, provenance
             ↓
Browser user
```

### Frontend

- React + TypeScript + Vite.
- Zustand stores hold linked selection, filters, depth, time, and display state.
- Three.js/WebGL renders the model slice and Argo markers.
- SVG renders the profile and comparison graphics.
- `ApiOceanDataAdapter` is the standard frontend boundary to the backend. Components must not read raw cache files directly.
- The 3D scene has recovery handling for lost WebGL contexts.
- Raycasting maps a mouse position to the real horizontal model plane. A
  shared geographic projection converts that point to latitude/longitude;
  the inverse mapping is unit-tested so a selected point cannot drift from
  the displayed slice.
- The live probe samples the nearest real visual-grid cell. Missing/land cells
  render as unavailable rather than a made-up number.
- A `ResizeObserver` resizes the renderer when retractable panels change the
  scene dimensions.

### Backend

- Python + FastAPI.
- Loads the local real-data cache once into memory.
- Owns NetCDF ingestion capability, data-quality processing, model interpolation, collocation, and statistics.
- The scientific-data API is read-only (`GET` JSON routes). The sole exception
  is the optional, server-side `POST` Briefing endpoint, which requests a
  textual explanation and never alters cached science data.
- Never returns partial/synthetic science when the cache is unavailable.
- Briefing Mode is the one deliberate `POST` route. It sends only the selected
  collocation facts and optional focused question to the OpenAI Responses API
  from the backend. The API key is read server-side from `.env`; it is never
  bundled into the browser. Requests set `store: false`, have no web-search
  tool, and are instructed to call the cache historical—not live or forecast—data.

### Important backend routes

| Route | Use |
|---|---|
| `GET /health` | Verify cache/backend health. |
| `GET /api/v1/metadata` | Region, dates, variables, source metadata. |
| `GET /api/v1/times` | Real available timestamps for a variable. |
| `GET /api/v1/observations` | Filtered list of observation summaries. |
| `GET /api/v1/profile/{id}` | Full observed temperature/salinity profile. |
| `GET /api/v1/slice` | One real model depth slice for the 3D view. |
| `GET /api/v1/model-column` | Model profile at a selected location. Nearest cached time is now correctly used. |
| `GET /api/v1/collocation/{id}` | RMSE, bias, distance, offset, depth bands, interpretation. |
| `GET /api/v1/provenance` | Real and planned layer/source registry. |
| `POST /api/v1/briefing/{id}` | Optional grounded explanation for the selected temperature/salinity evidence. Requires the server-side OpenAI key. |

## 9. Repository map

| Location | What is there |
|---|---|
| `src/ui/scene/` | Three.js scene, texture mapping, marker appearance, WebGL recovery. |
| `src/ui/EvidencePanel/` | Profile, comparison, provenance panels and their pure mapping logic. |
| `src/state/` | User selection, controls, filters, and shared observation filtering. |
| `src/data/` | API client and adapter boundary. |
| `src/domain/` | Scientific types, variables, provenance, quality definitions. |
| `backend/app/` | FastAPI routes, cache reader, science algorithms, services, models. |
| `public/data/real/` | Committed, normalised real demonstration cache and manifest. |
| `scripts/` | Real-data harvesting, preparation, and validation. |
| `docs/data-provenance.md` | Detailed source and transformation record. |
| `docs/api.md` | API contract. |
| `AGENTS.md` | Current project status and working rules. |

## 10. Run the project locally

### Requirements

- Node.js 20 or newer.
- Python 3.11 or newer.

### Start the backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

Check that it is healthy:

```bash
curl http://localhost:8000/health
```

### Start the frontend

In a second terminal:

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

### Verification commands

```bash
# Frontend
npm run typecheck
npx vitest run
npm run build
npm run test:integration  # backend must be running

# Backend
cd backend
pytest
python -m compileall app
```

The current verified baseline is **240 frontend tests** and **101 backend
tests**. Some frontend integration tests intentionally skip when no live
backend is running.

## 11. Suggested 90-second demo flow

1. **Start with the problem:** “Forecasters must compare a model map with separate instrument files. OceanLens puts both in one evidence workspace.”
2. **Show the 3D scene:** select temperature, move the depth control, and step through time.
3. **Show real observations:** point out that each marker is a real Argo profile; select one.
4. **Show Profile:** explain that the two lines are the instrument measurement and model estimate at the same location.
5. **Show Comparison:** explain RMSE, bias direction, distance, and depth bands in plain language.
6. **Show Provenance:** show the Argo and HYCOM URLs, processing steps, historical dates, and QC caveats.
7. **Close with impact:** “This shortens the path from a complex model field to an evidence-backed operational judgment.”

### Suggested judge questions and concise answers

| Likely question | Good answer |
|---|---|
| “Why not just show a map?” | “A map hides the vertical ocean. We show depth, time, and the measured profile needed to judge a model result.” |
| “Why is a model needed if you have Argo?” | “Argo is precise but sparse. The model covers the whole region; Argo lets us validate it where a float exists.” |
| “Can you analyse a location with no float?” | “Yes. Click anywhere for a model-only column. We deliberately reserve RMSE and bias for locations with real observational evidence.” |
| “Are these numbers live?” | “No. This prototype is an accurately labelled historical cache. Near-real-time ingestion is a finals extension.” |
| “What does the AI do?” | “It explains supplied model–observation facts in plain language. It has no web access, does not calculate science, and cannot turn historical data into a forecast.” |
| “Why should INCOIS use this?” | “It reduces tool-switching and makes model confidence, data quality, and provenance visible in one browser workspace.” |

### Demo language to use

- “Historical demonstration window.”
- “Real public Argo observations, locally cached.”
- “Model estimate compared with a measured profile.”
- “The system preserves data quality and source caveats.”
- “Near-real-time ingestion is a finals extension.”

### Claims to avoid

- Do not call the current system live, real-time, or a forecast.
- Do not claim machine learning or anomaly detection exists.
- Do not say chlorophyll, gliders, CTDs, BGC-Argo, or satellite layers are already integrated.
- Do not imply a missing value means zero.

## 12. Finals scope

The internal-round core is intentionally complete before adding more sources. For the national finals, expand in this order.

### Priority 1: Near-real-time operational pipeline

- Replace the historical HYCOM GOFS 3.1 source with a current operational model feed.
- Poll/synchronise real-time Argo files on a schedule.
- Store refresh time, source availability, data freshness, and quality state visibly.
- Keep delayed-mode versus real-time quality distinctions clear.

### Priority 2: More real observation and model layers

- Add one real Glider, CTD, or BGC-Argo source end-to-end first.
- Add satellite sea-surface temperature and chlorophyll from real sources.
- Add coastal/operational sources where access permits: moorings, HF radar, ADCP, advisories.
- Ensure every new layer has its own provenance, units, QA, and availability state.

### Priority 3: More capable ingestion and interoperability

- Add delimited text/ASCII ingestion alongside NetCDF.
- Make the adapter/source model genuinely plug-in-like.
- Add OPeNDAP and OGC WMS/WCS integration for appropriate sources.
- Move larger operational data to chunked/object-storage formats such as Zarr when needed.

### Priority 4: Richer visualization and operational workflows

- Full volumetric rendering and robust isosurface extraction.
- User-editable colour scale, min/max range, log/linear mode, and saved views.
- Extend the existing Briefing Mode with tested retrieval, role-aware workflows, multilingual output, and operational review/approval—not autonomous advice.
- Outreach mode designed for students and public demonstrations.
- Machine-learning-derived layers only after a real trained model, uncertainty story, and validation are available.

## 13. Team working rules

1. Preserve data honesty. A source that is not loaded must remain unavailable in the UI.
2. Keep scientific processing in the backend; do not recalculate or fake science in a React component.
3. Keep source, timestamp, unit, QC, and caveat information visible wherever users interpret a result.
4. Add tests with every behaviour change. Use live-backend integration tests for API-bound changes.
5. Perform an actual browser check for visual work; a build passing is not enough for WebGL/CSS changes.
6. Do not regress the WebGL context-loss recovery logic.
7. Before any shared handoff, run `git diff --check`, the appropriate tests, and update `AGENTS.md` or this guide if the project state changes.
8. Commit coherent, tested checkpoints with clear messages. Avoid mixing unrelated refactors with feature work.

## 14. Known limitations today

- The prototype is historical and offline-capable, not live.
- It has Argo observations only; no Glider, CTD, BGC, satellite, advisory, or ML product is loaded.
- Current speed is visualised from HYCOM, but it has no matching Argo current observation in this cache, so profile/collocation comparison is intentionally unavailable for it.
- Model-only click analysis is available across the cached model region, but it currently shows a vertical column rather than a complete point time-series or nearest-observation recommendation; those are sensible finals additions.
- Briefing Mode depends on a configured backend OpenAI key. Without one it truthfully reports that the optional explanation service is unavailable; scientific model/profile/comparison features still work.
- The layout has been browser-checked at the supported 1440×900 and 1600×1000 desktop targets. It is not claimed to be mobile-ready.
- Keyboard-only focus order has not had a dedicated full audit.
- The project uses modern browser CSS such as `:has()` for one responsive control-rail fix; use a current browser for the demo.

## 15. Useful references

- [README](../README.md): quick start and top-level project overview.
- [Current working context](../AGENTS.md): current implementation status and detailed technical handoff.
- [Data provenance](data-provenance.md): source transformations and attribution.
- [API reference](api.md): endpoint contract.
- [Data contract](data-contract.md): frontend/backend mapping and numerical compatibility.
- [Architecture](architecture.md): component and deployment architecture.
