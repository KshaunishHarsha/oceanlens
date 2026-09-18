# Slide 5 — Research and References

*(Details / links of the reference and research work)*

> Same deck-wide framing rule: confident present tense. Every link below is a real, working source actually used to build and validate the system — not a generic reading list.

## Layout guide

- **Row 1:** two grouped columns — `Data Sources` (left) and `Standards, Tooling & Methods` (right) — each a short list of name + link + one-line role.
- **Row 2:** `Research Literature` — a short numbered list of real, citable papers behind the science this system implements.
- **Row 3, full width:** `Market Gap Analysis` table — existing tools vs. what OceanLens adds.
- **Footer, full width:** the same evidence-backing line used on Slide 3, repeated here since this is the natural place a judge looks for it.

---

## Data Sources

*(Template section: "Links of the reference work" — the real, live data this system runs on.)*

- **Argo Global Data Assembly Centre (GDAC)** — data-argo.ifremer.fr — public, no-auth NetCDF archive of real float profiles; INCOIS is itself a registered DAC (`/dac/incois/`) with 625+ real floats.
- **HYCOM GOFS 3.1 (GLBy0.08, expt_93.0)** — ncss.hycom.org/thredds/ncss/grid/GLBy0.08/expt_93.0 — the real global ocean model field (temperature, salinity, currents) at 1/12° resolution, 40 z-levels.
- **Natural Earth / world-atlas TopoJSON** — github.com/topojson/world-atlas — the real 1:50m public-domain coastline geometry rendered in the 3D scene.
- **INCOIS — Indian National Centre for Ocean Information Services** — incois.gov.in — the target operational agency this workspace is built for.

## Standards, Tooling & Methods

*(Template section: "Details of the reference work" — the standards and open-source foundations the science and stack are built on.)*

- **Argo Quality Control flag convention** — argo.ucsd.edu (Argo Data Management, QC manual) — the 1/2/3/4 → GOOD/PROBABLY_GOOD/SUSPECT/BAD flag scheme used verbatim throughout the system, no reinterpretation.
- **UNESCO 1983 pressure-to-depth formula** — the latitude-dependent conversion used to turn Argo's raw pressure (dbar) readings into true depth (m).
- **React 19 / TypeScript / Vite** — react.dev, typescriptlang.org, vite.dev — the frontend framework and toolchain.
- **Three.js** — threejs.org — the WebGL engine behind the 3D evidence scene.
- **FastAPI / NumPy** — fastapi.tiangolo.com, numpy.org — the Python science-service layer computing QC filtering, interpolation, and collocation statistics.

## Research Literature

*(Template section: "Details of the reference work" — the real published research behind the science, not just the tools.)*

1. Riser, S. C. et al. (2016). *Fifteen years of ocean observations with the global Argo array.* Nature Climate Change, 6, 145–153. — the Argo program's own account of what the array actually measures and why, the foundation for every observation this system displays.
2. Chassignet, E. P. et al. (2007). *The HYCOM (HYbrid Coordinate Ocean Model) data assimilative system.* Journal of Marine Systems, 65, 60–83. — the model whose real depth-slice fields this system renders and compares against.
3. Roemmich, D. & Gilson, J. (2009). *The 2004–2008 mean and annual cycle of temperature, salinity, and steric height in the global ocean from the Argo Program.* Progress in Oceanography, 82(2), 81–100. — the standard reference for how Argo-derived climatological baselines are built and validated.
4. Xu, S. et al. (2020). *Argovis: A Web Application for Fast Delivery, Visualization, and Analysis of Argo Data.* Journal of Atmospheric and Oceanic Technology, 37(3). — the closest existing prior-art system to this project's observation-side visualization; see the gap analysis below.

## Market Gap Analysis

*(Real, existing, publicly available tools compared against what this system specifically adds — not a claim that nothing exists, but that nothing existing does this specific job.)*

| Existing product | What it does well | What it doesn't do |
|---|---|---|
| **Ocean Data View (ODV)** — odv.awi.de | Desktop-grade plotting/gridding for observational datasets (Argo, CTD, WOCE, etc.); 135,000+ registered users; the field's standard offline analysis tool. | Desktop software, not browser-native; no live model overlay; no per-observation model-vs-observation statistic; no built-in data-honesty/provenance labelling. |
| **Argovis** — argovis.colorado.edu | Fast, browser-based Argo float visualization and delivery, with a map/depth/time query interface and an API. | Observation-only — no ocean model field is rendered or compared; no RMSE/bias/agreement computation against a model; no 3D scene. |
| **Copernicus Marine Service Viewer** | Genuinely co-locates in-situ observations with model and satellite layers in a 4D (lat/lon/depth/time) viewer, for several Essential Ocean Variables. | A general-purpose exploration/download tool, not an evidence workspace — no per-float drill-down with a computed agreement verdict, no explicit QC-vs-model-error distinction, no instrument-fault-detection framing. |
| **INCOIS's own bulletins/portals** | Authoritative, India-specific operational ocean advisories and static reports. | Report-oriented, not interactive; no click-through from an advisory back to the specific float/model comparison that backs it. |

**The gap this system fills:** every listed tool does *observation visualization* **or** *model visualization* **or** *static co-location* — none of them pairs a specific real observation with the specific real model value at its exact position/depth/time, computes an honest agreement statistic for that pair, and uses the same view to double as an instrument-fault detector, inside a single browser-native, install-free 3D workspace.

---

## Footer

*Every fix and finding cited in this deck is verifiable in the public commit history — github.com/[your-username]/oceanlens*

---

## Explicitly kept off this slide (belongs elsewhere)

- The idea, workflow, and architecture → **Proposed Solution** / **Technical Approach**
- Risks and their mitigations → **Feasibility and Viability**
- Impact framing → **Impact and Benefits**
