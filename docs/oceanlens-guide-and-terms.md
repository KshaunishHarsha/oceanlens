# OceanLens India — Complete Guide, Terminology & Project Handbook

> **A Plain-Language Guide to the Problem Statement, the Left Control Panel, and the Scientific Importance of OceanLens**

---

## Part 1: The Big Picture — Why This Project Matters

### 1. The Context: India's Ocean Frontier
India possesses a coastline of over 7,500 kilometers and an **Exclusive Economic Zone (EEZ)** covering more than 2 million square kilometers of the Indian Ocean, Arabian Sea, and Bay of Bengal. 
- Millions of citizens depend directly on coastal economies and marine fisheries for their livelihoods.
- The northern Indian Ocean is prone to intense tropical cyclones, storm surges, monsoons, and maritime navigation risks.

To protect lives, optimize shipping, guide fishermen, and understand climate patterns, the **Ministry of Earth Sciences** established **INCOIS** (Indian National Centre for Ocean Information Services) in Hyderabad. INCOIS runs supercomputer simulations (numerical ocean models) and deploys autonomous instruments in the sea to observe ocean conditions.

---

### 2. The Problem Statement: Why Existing Systems Fall Short

Every single day, INCOIS produces massive volumes of 3D data:
1. **Numerical Models** (such as HYCOM, ROMS, MOM): Supercomputer mathematical forecasts predicting water temperature, saltiness, and currents across grids at multiple depth levels and future time steps.
2. **In-situ Observations** (such as Argo robotic floats, gliders, shipboard CTD sensors): Real physical probes drifting or diving in the ocean that record actual measurements.

#### The Operational Bottlenecks:
- **Fragmented Desktop Tools**: Ocean forecasters currently have to switch between command-line Python scripts, 2D desktop GIS programs, and specialized NetCDF viewer software just to compare a forecast with a real measurement.
- **2D Blindness in a 3D World**: Most web portals only show flat 2D maps of the sea surface. But the ocean is deep (averaging 3,000 to 4,000 meters). The critical drivers of cyclones, ocean heat content, acoustic submarine channels, and marine nutrients all happen **below the surface in 3D**.
- **No Instant Model Validation (Ground-Truthing)**: When an operational forecaster issues a cyclone intensity warning or a search-and-rescue drift forecast, they must urgently know: *"Can I trust today's numerical model? How closely does it match the real robotic sensors in the water right now?"*

---

### 3. The Expected Solution: OceanLens India

OceanLens is a **browser-native, interactive 3D ocean evidence workspace**. 
Without installing heavy desktop GIS software or coding in Python:
- Any user opens a web browser and sees a **dynamic 3D volumetric view** of the ocean water column.
- The user can slide down through depth levels (from the sunlit surface down to the deep abyssal layers) and play back time steps.
- Floating in that same 3D world are **real robotic instruments (Argo floats)**.
- Clicking any float immediately brings up its measured vertical profile alongside the model's estimate, computing statistical agreement (**RMSE, Mean Bias**) in real time.

---

### 4. The Three Real-World Impacts

| Domain | How OceanLens Helps in Plain Terms |
|---|---|
| **1. Disaster Management & Search & Rescue (SAR)** | When a vessel capsizes or a person falls overboard, surface and subsurface ocean currents carry them away. Combining 3D current vectors with real float data allows the Coast Guard and INCOIS to calculate accurate drift trajectories, saving lives. For cyclones, deep warm water (Ocean Thermal Energy) fuels superstorms; viewing subsurface heat slices in 3D reveals how much storm fuel is available. |
| **2. Fishery Advisories (PFZ - Potential Fishing Zones)** | Fish congregate at boundaries where cold, nutrient-rich water upwells to meet warm water, and where salinity changes rapidly. Ocean forecasters can pinpoint these 3D thermoclines and upwelling fronts to guide coastal fishing communities, saving fuel and boosting catch. |
| **3. Public Outreach & Science Communication** | To a school student, college researcher, or government policy maker, raw NetCDF files and complex math formulas look intimidating. OceanLens turns supercomputer data into an intuitive, visually stunning 3D interactive model, democratizing ocean science for India. |

---

## Part 2: The Left Panel (Control Rail) Explained in Easy Terms

The Left Panel (called the **Control Rail**) is the operational cockpit of OceanLens. It provides immediate, tactile control over multi-dimensional ocean data. 

Below is a complete breakdown of every section, term, and toggle on this panel, why it is there, and why it is critical.

```
┌─────────────────────────────────────────────────────────┐
│                     LEFT CONTROL PANEL                  │
│                                                         │
│  [1] FIELD CONFIGURATION (Which ocean property to see)   │
│      ├── Temperature (T) [REAL]                         │
│      ├── Salinity (S)    [REAL]                         │
│      ├── Current Speed (U,V) [REAL]                     │
│      └── Chlorophyll (Chl)   [N/A / PLANNED]            │
│                                                         │
│  [2] VISUAL ANALYTICS (Which 3D layers to turn on/off)  │
│      ├── Model Temperature 3D Field                     │
│      ├── Model Salinity 3D Field                        │
│      ├── Derived Isosurface (e.g., 26°C isotherm)       │
│      ├── Model Currents (Vector flow)                   │
│      └── Instrument Platforms (Argo, BGC, Gliders, CTD) │
│                                                         │
│  [3] DEPTH & VERTICAL PERCEPTION                        │
│      ├── Depth Slider (0 m to 1,000 m below surface)    │
│      └── Vertical Exaggeration Stepper (1x to 30x)      │
│                                                         │
│  [4] OBSERVATION FILTERS                                │
│      ├── Platform Types (Argo floats, Gliders, etc.)    │
│      ├── Argo Data Centre (INCOIS vs China Argo)        │
│      ├── Good Quality Observations Only (QC Toggle)     │
│      └── Show Only Collocated Observations Toggle       │
│                                                         │
│  [5] PLANNED EXTENSIONS                                 │
│      ├── Satellite Sea Surface Temp (SST)               │
│      ├── Satellite Chlorophyll                          │
│      ├── INCOIS Advisories                              │
│      └── Machine Learning (ML) Anomaly Layer            │
└─────────────────────────────────────────────────────────┘
```

---

### Section 1: Field Configuration

#### What is it?
This section lets the user select the primary physical parameter displayed on the 3D depth slice and color scale.

#### Terms & Definitions:

1. **Sea-Water Temperature (`T`, measured in `°C`) [REAL]**:
   - *What it is*: How warm or cold the water is at a specific location and depth.
   - *Why it is important*: Warm surface water ($>26^\circ\text{C}$) provides the thermal engine that intensifies tropical cyclones in the Bay of Bengal and Arabian Sea. Subsurface temperature drops drastically in a zone called the *thermocline*.
   - *Why it is in the panel*: It is the most vital variable for both weather forecasters and climate researchers.

2. **Sea-Water Salinity (`S`, measured in `PSU`) [REAL]**:
   - *What it is*: The amount of dissolved salt in the water. Measured in Practical Salinity Units (roughly grams of salt per kilogram of water; typical seawater is around 32 to 36 PSU).
   - *Why it is important*: In the Bay of Bengal, massive freshwater discharge from the Ganga, Brahmaputra, and Godavari rivers creates a "freshwater cap" on the ocean surface. This prevents deep water from mixing and traps heat near the top, directly impacting monsoons.
   - *Why it is in the panel*: Forecasters must track where freshwater river plumes spread and how they interact with saltier oceanic water.

3. **Ocean Current Speed (`U, V`, measured in `m/s`) [REAL]**:
   - *What it is*: The velocity and direction of water movement. In physics, `u` is the east-west speed (zonal), and `v` is the north-south speed (meridional). OceanLens calculates total current speed as $\sqrt{u^2 + v^2}$.
   - *Why it is important*: Essential for shipping routes, maritime search-and-rescue, oil-spill tracking, and naval submarine navigation.
   - *Why it is in the panel*: Forecasters can instantly see high-velocity oceanic jets, eddies, and boundary currents.

4. **Chlorophyll (`Chl`, measured in `mg/m³`) [N/A / PLANNED]**:
   - *What it is*: The green pigment found in microscopic marine plants (phytoplankton).
   - *Why it is important*: Phytoplankton are the base of the marine food chain. High chlorophyll levels signify rich feeding grounds for fish (Potential Fishing Zones).
   - *Why it is in the panel*: Included in the interface architecture to prove readiness for biological sensors (BGC-Argo and satellites), but honestly marked **N/A** in this demo because the historical window focuses on physics.

5. **`REAL` vs `N/A` Badges**:
   - *Why they are used*: To enforce **scientific honesty**. If a variable is loaded from genuine scientific records, it shows `REAL`. If no verified data is cached for that variable, it shows `N/A` rather than fabricating fake numbers.

---

### Section 2: Visual Analytics (Layer Toggles)

#### What is it?
This section functions like layers in Photoshop or GIS: you can turn different datasets on or off in the 3D scene to see how they interact.

#### Terms & Definitions:

1. **Model Temperature / Salinity / Currents (`MODEL_VOLUME`)**:
   - *What it is*: The gridded computer simulation field produced by the numerical ocean model.
   - *Why it is used*: Provides continuous coverage across the entire sea, filling in the vast empty spaces between robotic floats.

2. **Derived Isosurface (e.g., 26 °C Isotherm)**:
   - *What it is*: An *isosurface* is a 3D contour surface that connects all points in the ocean having the exact same value—like a 3D weather isobar. The **26 °C isotherm** is the 3D boundary where ocean water is exactly 26 °C.
   - *Why it is important*: The depth of the 26 °C isotherm (called $D_{26}$) is the gold standard used by cyclone meteorologists to measure Tropical Cyclone Heat Potential (TCHP). If $D_{26}$ is deep (e.g., 80–100 m), a cyclone passing overhead will explode in strength because cold water cannot easily be churned up to extinguish it.
   - *Why it is in the panel*: Allows forecasters to view the 3D topography of cyclone fuel with a single click.

3. **Instrument Platforms (`obs.argo`, `obs.glider`, `obs.ctd`, `obs.bgc`)**:
   - *What they are*: Real sensors deployed in the ocean.
   - *Why they are used*: Toggling these on lets the user see where physical instruments were in the water at that exact moment in history, represented as interactive 3D pins.

---

### Section 3: Depth & Vertical Perception

#### What is it?
The ocean is deep, but horizontally vast. This section controls the vertical dimension ($Z$-axis) of the 3D workspace.

#### Terms & Definitions:

1. **Depth Slider (e.g., `0 m` down to `1,000 m` below sea surface)**:
   - *What it is*: An interactive slider that moves the horizontal slicing plane up and down through the ocean water column.
   - *Non-Linear Depth Stops (Surface, 50, 100, 250, 500, 1000 m)*: In the ocean, the most dramatic changes (sunlight, mixing, biology, thermocline) occur in the top 200 meters. Below 500 meters, conditions change very slowly. The slider uses non-linear steps so the user has fine, granular control where it matters most (the surface and thermocline layers).
   - *Why it is used*: Forecasters can "slice" through the ocean to inspect subsurface temperatures, discovering warm eddies or cold pockets that are completely invisible from satellite surface pictures.

2. **Vertical Exaggeration Stepper (e.g., `1x` to `30x`)**:
   - *What it is*: A scaling factor that stretches the depth axis relative to the horizontal width.
   - *Why it is critical*: In reality, the Bay of Bengal is about 1,500 kilometers wide, but only 3 to 4 kilometers deep. If drawn to exact true 1:1 scale, the entire ocean depth would be thinner than a sheet of paper on your screen!
   - *Why it is used*: By exaggerating the vertical scale (e.g., 10x to 20x), the 3D relief of ocean trenches, shallow continental shelves, and vertical float ascents becomes clearly visible and easy to analyze.

---

### Section 4: Observation Filters

#### What is it?
A control suite that filters which in-situ instrument markers appear in the 3D scene, ensuring the user is not overwhelmed by clutter and can isolate trusted data.

#### Terms & Definitions:

1. **Platform Types (`Argo Floats`, `Gliders`, `CTD Casts`, `BGC-Argo`)**:
   - *Argo Floats*: Autonomous drifting cylinders that dive to 2,000 m and surface every 10 days.
   - *Underwater Gliders*: Torpedo-like autonomous vehicles with wings that glide up and down while steering along pre-programmed patrol paths.
   - *CTD Casts*: Heavy sensor cages lowered from research ships via steel cables to measure Conductivity (salinity), Temperature, and Depth.
   - *BGC-Argo*: Advanced Argo floats equipped with biogeochemical sensors (oxygen, nitrate, pH, chlorophyll, light).
   - *Why they are in the panel*: Users can isolate a specific type of observation platform depending on their mission.

2. **Argo Data Assembly Centres (DACs)**:
   - *INCOIS (`IN`)*: Floats managed and deployed by the Indian National Argo Project.
   - *China Argo (`HZ` / CSIO)*: Floats deployed by partner international institutes in the adjacent ocean basin.
   - *Why it is in the panel*: INCOIS forecasters often want to review their own national instrument fleet first, while retaining the ability to incorporate international partner data.

3. **"Good Quality Observations Only" Toggle (QC Flag Filter)**:
   - *What it is*: In scientific oceanography, sensors can foul, drift, or experience electrical glitches. The international Argo program tags every single measurement with a **Quality Control (QC) flag**:
     - Flag `1` = Good
     - Flag `2` = Probably Good
     - Flag `3` = Suspect / Dubious
     - Flag `4` = Bad (discarded)
   - *Why it is critical*: Operational decisions cannot be based on noisy or defective sensors. Toggling this switch instantly hides suspect data, ensuring only mathematically verified readings are displayed.

4. **"Show Only Collocated Observations" Toggle**:
   - *What it is*: Automatically hides any float that does not have a corresponding model prediction close by in both space and time.
   - *Why it is used*: When performing model evaluation, forecasters do not want to click through floats that cannot be mathematically compared against the model.

---

### Section 5: Planned Extensions

#### What is it?
A dedicated section that lists the upcoming sensors and data streams scheduled for the next phase of development.

#### Terms & Definitions:

1. **Satellite SST (Sea Surface Temperature)**: Infrared and microwave satellite scans (e.g., MODIS, INSAT-3D) showing high-resolution skin temperature of the ocean surface.
2. **Satellite Chlorophyll (Ocean Colour)**: Optical satellite sensors detecting algae and plankton blooms across the ocean surface.
3. **INCOIS Operational Advisories**: Geotagged warning polygons and text alerts (Tsunami bulletins, High Wave Alerts, Swell Surge warnings).
4. **Machine Learning (ML) Anomaly Layer**: AI models trained to spot anomalous warming events (Marine Heatwaves) or unusual current eddies that deviate from 30-year historical climate baselines.
5. **Why this section is visible in the UI**:
   - It signals to evaluators, scientists, and reviewers that the software architecture was intentionally designed to be extensible (modular plugin architecture), while adhering to strict **scientific honesty** by never pretending that future layers are already loaded.

---

## Part 3: Master Glossary of Scientific & Technical Terms

| Term | Simple Everyday Explanation | How It Works in OceanLens |
|---|---|---|
| **INCOIS** | Indian National Centre for Ocean Information Services (Hyderabad). India’s premier government agency for ocean forecasting and hazard alerts. | The target agency and stakeholder for whom this entire application is architected. |
| **EEZ (Exclusive Economic Zone)** | The maritime area extending up to 200 nautical miles (~370 km) from a country’s coast, where it has exclusive rights to marine resources. | The geographic boundary India must monitor for fishing, shipping, defense, and hazards. |
| **Argo Profiling Float** | A robotic, battery-powered ocean drone that sinks to 2,000 meters and rises to the surface every 10 days, recording water properties like a vertical CT scan of the sea. | Shown as interactive 3D pins on the map; clicking one shows its full vertical measurement curve. |
| **NetCDF (`.nc`)** | "Network Common Data Form". A universal file format used by scientists to package huge grids of multi-dimensional data (lat, lon, depth, time) in one compressed file. | The primary data format produced by INCOIS models and ingested by the Python backend. |
| **HYCOM GOFS 3.1** | "Hybrid Coordinate Ocean Model - Global Ocean Forecast System". A world-class physics simulation that predicts ocean currents, heat, and salt. | The simulation source used to generate the 3D depth-slice textures. |
| **Collocation** | The process of finding the exact computer model grid cell that matches an in-situ instrument's position and timestamp. | The algorithm running in the backend that pairs an Argo float with the nearest HYCOM column. |
| **RMSE (Root Mean Square Error)** | A standard statistical formula that measures the average magnitude of error between predictions and reality. Lower is better. | Displayed in the **Comparison** tab to tell forecasters: *"On average, the model is off by X degrees."* |
| **Mean Bias** | A statistical indicator showing whether a model has a systematic tendency to over-predict (too warm/salty) or under-predict (too cold/fresh). | Tells the forecaster: *"The model consistently overestimates surface temperature by +0.35 °C."* |
| **UNESCO 1983 Formula** | A scientific equation that converts water pressure (measured in decibars by an Argo probe) into physical depth in meters, accounting for gravity and latitude. | Automatically applied by the backend data pipeline so float depths match the model's metric depth axis. |
| **Thermocline** | The invisible horizontal layer in the ocean where temperature drops dramatically faster than in the layers above or below it. | Visible in the 3D scene and the profile chart as a sharp bend in the temperature curve. |
| **Data Provenance** | The complete history, source link, file checksum (SHA-256), and processing history of a piece of data. | Displayed in the **Provenance** tab so any scientist can independently audit and reproduce the results. |
| **WebGL & Three.js** | Web Graphics Library. High-performance 3D graphics hardware acceleration running directly inside modern web browsers without plugins. | Powers the 3D interactive ocean scene, depth slice plane, and float pins in OceanLens. |
| **Zustand** | A lightweight, modern TypeScript state management library for React. | Powers the synchronized interaction state (moving the depth slider instantly updates the 3D slice, chart, and statistics simultaneously). |

---

## Part 4: How OceanLens Fulfills the Problem Statement (SIH 2026)

| Problem Statement Requirement | How OceanLens Delivers |
|---|---|
| **1. Web-based, platform-independent 3D rendering** | Pure web app running in any browser (Chrome, Firefox, Edge, Safari) on any OS (Windows, Linux, macOS) with zero plugins or desktop software. Built with React 19 and Three.js / WebGL. |
| **2. Co-display of model fields and instrument profiles** | The 3D scene simultaneously displays the continuous numerical model depth-slice texture alongside real, clickable Argo profiling float pins. |
| **3. Interactive controls for variable, depth, and time** | Left panel provides instant variable selection (T, S, U/V), a responsive depth slider with non-linear stops (0 to 1,000 m), and a bottom timeline rail with play/pause/step controls across the 11-day historical window. |
| **4. Multi-format data ingestion without re-engineering** | Python FastAPI backend utilizes `xarray`, `netcdf4`, and `numpy` to ingest NetCDF files and convert them into clean, lightweight JSON for the browser. New variables can be plugged in via standard CF conventions. |
| **5. Model–observation agreement evaluation** | Dedicated **Evidence Panel** with interactive SVG Profile Charts (model curve vs instrument curve) and automated Collocation Analytics (RMSE, Mean Bias, distance, time offset, depth-band agreement). |
| **6. Public outreach and science communication** | Includes an interactive briefing mode, intuitive plain-language tooltips, real vendored coastline topography, and a 3D depth-box frame that makes ocean depth tangible to students and non-specialists. |

---

## Part 5: Summary for Presentations & Evaluations

When demonstrating OceanLens to evaluators, judges, or INCOIS scientists, remember this core narrative:

> *"OceanLens is not just another dashboard with flat charts. It is an **Evidence Workspace** that bridges the historic gap between supercomputer ocean simulations and real robotic sensors in the sea.*
> 
> *By putting 3D volumetric fields, real Argo floats, depth-slicing, and mathematical collocation into a single web browser tab, OceanLens cuts operational analysis time from hours to seconds—empowering INCOIS forecasters to make faster, safer decisions for Indian fishermen, cyclone warnings, and maritime defense."*
