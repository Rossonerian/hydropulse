# HydroPulse: Comprehensive Technical Report & Presentation Guide
**Event:** Lakshya 2026 · SJBIT, Bengaluru | **Track 02:** Smart and Sustainable Future  
**Project:** HydroPulse — Software-Only Hydraulic Digital Twin & Autonomous Leak Triangulation Engine  
**Team:** Hardhik (Backend & Hydraulics Lead), Gangu (Data Pipeline & Schemas), Badri (Frontend & SCADA Design), Jasmine (Product Story & Financial ROI)

---

## 1. Executive Summary

Indian municipal water supply boards face an invisible crisis: **35% to 40% of potable water is lost before reaching consumers** as Non-Revenue Water (NRW). In cities like Bengaluru (BWSSB), thousands of kilometers of distribution pipes lie buried 1.5 to 2.5 meters beneath concrete roadways. Underground pipe bursts and joint cracks frequently remain undetected for 10 to 20 days until sinkholes collapse roads, basements flood, or drinking water is contaminated by sewage back-siphonage during intermittent supply cycles.

Existing industrial detection methods rely on:
1. **Acoustic listening surveys:** Slow, labor-intensive road sweeps requiring nocturnal silence.
2. **Bulk acoustic/flowmeter deployments:** Multi-crore hardware capital expenditures (CapEx) with fragile batteries and high maintenance overhead.
3. **Reactive dig-and-check:** Damaging urban road infrastructure to search blindly for leaks.

**HydroPulse solves this with a software-only digital twin.** By converting real municipal OpenStreetMap street graphs into an EPA-standard hydraulic network model (WNTR), HydroPulse uses graph betweenness centrality to position just **5 sentinel pressure sensors** across a district. When a burst occurs, the resulting 5-sensor pressure-drop vector is matched against a precomputed sensitivity matrix using **scale-invariant cosine similarity**, triangulating the leak location in **under 300 milliseconds**. HydroPulse then produces an **optimal valve-isolation plan** that halts water loss while maximizing the percentage of surrounding households kept supplied.

---

## 2. Problem Statement & Socio-Economic Impact

### 2.1 The Municipal NRW Crisis
- **35%–40% Water Loss:** Bengaluru's water utility (BWSSB) pumps treated Cauvery river water over 100 km uphill with an elevation lift exceeding 450 m. Nearly 40% of this high-energy potable water is lost underground through aging cast-iron and ductile-iron pipe mains.
- **₹45 / kL Production Cost:** Producing and pumping treated municipal water costs ~₹45 per kilolitre. Losses directly translate to crore-level deficits on municipal budgets and massive wasted carbon emissions.
- **The Water Tanker Paradox:** While piped water leaks into the soil, citizens in outer wards pay private tanker cartels ₹800 to ₹1,500 per 6,000-litre tanker. Every day an undetected main rupture leaks 1,000+ tankers worth of clean water.
- **Public Safety & Health Hazards:** Underground leaks wash away road sub-base soil, creating catastrophic road cave-ins and sinkholes. Intermittent supply causes negative pressure transients that suck pathogen-heavy groundwater into the pipes.

---

## 3. Core Hydraulic Physics & Algorithmic Engine

### 3.1 Digital Twin Simulation (EPA WNTR)
Unlike basic static graphs, HydroPulse runs full physics-based hydraulic network simulation using the United States Environmental Protection Agency’s **WNTR (Water Network Tool for Resilience)** library.
- **Pressure-Driven Demand (PDD):** Traditional EPANET models use Demand-Driven Analysis (DDA), assuming customers consume fixed flow regardless of pressure. In a burst scenario, DDA predicts impossible negative pressures. HydroPulse implements **PDD** using the Wagner formulation:
  $$d = \begin{cases} 
  0 & \text{if } P \le P_{min} \\
  d_{req} \cdot \left(\frac{P - P_{min}}{P_{req} - P_{min}}\right)^{\alpha} & \text{if } P_{min} < P < P_{req} \\
  d_{req} & \text{if } P \ge P_{req}
  \end{cases}$$
  *(With $P_{min} = 2.0\text{ m}$, $P_{req} = 15.0\text{ m}$, $\alpha = 0.5$)*.

### 3.2 Torricelli Orifice Leak Physics
Pipe bursts are modeled as dynamic pressure-dependent orifice emitters following Torricelli’s Law:
$$Q_{leak} = C_d \cdot A \cdot \sqrt{2 g h}$$
Where:
- $Q_{leak}$: Volumetric leakage rate ($\text{m}^3/\text{s}$, converted to Litres/Minute).
- $C_d$: Orifice discharge coefficient (standardized to $0.75$).
- $A$: Rupture orifice cross-sectional area ($\text{m}^2$, exposed via UI in $\text{cm}^2$).
- $g$: Acceleration due to gravity ($9.81\text{ m}/\text{s}^2$).
- $h$: Available pressure head at the ruptured junction ($\text{m}$).

### 3.3 Sensor Placement via Graph Betweenness Centrality
Instead of costly flowmeters on all 203 pipes, HydroPulse selects exactly **5 sentinel junctions** using network topological betweenness centrality with **minimum topological hop separation**:
1. Converts the water network to an undirected graph $G = (V, E)$, weighting edges by physical pipe length.
2. Computes betweenness centrality $C_B(v) = \sum_{s \ne v \ne t} \frac{\sigma_{st}(v)}{\sigma_{st}}$.
3. Iteratively selects nodes with maximum centrality that are separated by at least $\ge 3$ topological hops, ensuring sensors cover independent arterial trunk flows rather than clustering near the reservoir.

### 3.4 Scale-Invariant Cosine Fingerprint Triangulation
When a burst occurs at unknown junction $j$, each sensor $s_i$ observes a pressure drop $\Delta P_i = P_{baseline, i} - P_{observed, i}$.
- **The Observation Vector:** $\Delta \mathbf{P}_{obs} = [\Delta P_1, \Delta P_2, \Delta P_3, \Delta P_4, \Delta P_5]^T$.
- **The Precomputed Sensitivity Matrix:** $\mathbf{S} \in \mathbb{R}^{N \times 5}$, where row $j$ represents the reference pressure-drop vector $\mathbf{s}_j$ caused by a nominal burst at junction $j$.
- **Scale-Invariant Cosine Similarity:**
  $$\cos(\theta_j) = \frac{\Delta \mathbf{P}_{obs} \cdot \mathbf{s}_j}{\|\Delta \mathbf{P}_{obs}\|_2 \cdot \|\mathbf{s}_j\|_2}$$
  **Why Cosine Similarity Beats Euclidean Distance:** Headloss across pipes scales roughly with $Q^{1.852}$ (Hazen-Williams). As leak orifice area varies from $1\text{ cm}^2$ to $50\text{ cm}^2$, absolute pressure drops grow exponentially, but the **relative spatial attenuation ratio across the 5 sensors remains almost invariant**. The directional vector points straight at the leaking junction.
- **Two-Stage Verification:** The engine ranks top candidates via cosine similarity, then re-simulates the top candidate in WNTR to refine the estimated leak area and eliminate false positives.

### 3.5 Automated Valve Isolation Plan
Once candidate node $C$ is localized, HydroPulse identifies the minimum set of valves to close:
1. Identifies all pipes directly incident to candidate node $C$.
2. Removes incident pipes and executes Breadth-First Search (BFS) from all supply sources (reservoirs and tanks).
3. If closing incident pipes disconnects healthy downstream junctions, the algorithm walks outward along branches until it identifies boundary valves that isolate the damaged section while keeping downstream loops energized.
4. Outputs:
   - Sorted list of pipe IDs to close.
   - Isolated junction IDs.
   - Affected household count ($\sim 80\text{ households/junction}$ based on demand density).
   - Ward supply preservation percentage ($\ge 75\%$).

---

## 4. Full Platform Offerings: What Is on the Website

The HydroPulse frontend is a modern, responsive, dark-mode SCADA Control Room application styled in deep control-room claymorphism (`#050912` canvas, cyan pipe arterials, emerald sensor telemetry, crimson burst alerts, and amber valve indicators).

```
+---------------------------------------------------------------------------------------+
|  HYDROPULSE  |  BWSSB Kengeri DMA Digital Twin  |  Status: ONLINE  |  [N] Network Studio |
+---------------------------------------------------------------------------------------+
| [ Control Panel ]        | [ Interactive Hydraulic GIS Map ]    | [ Incident Telemetry ]|
| - Quick Presets:         | - Scaled pipe diameters (110-400mm)  | - Ranked Candidates   |
|   * Mainline Rupture     | - 5 Pulsing Emerald Sentinels (S1-S5)| - Loss in LPM         |
|   * Residential Seep     | - Blue Reservoir R1 (Elev 875.4m)    | - Tankers Lost/Day    |
|   * Joint Crack          | - Dynamic Crimson Burst Heatmap      | - Recommended Valves  |
| - Leak Sliders: Node/Area| - Ground-truth reveal ring           | - Ward Supplied: 82%  |
| - Blind Judge Mode Toggle| - Offline dark-grid vector fallback  | - Affected Homes: 240 |
+--------------------------+--------------------------------------+-----------------------+
| [ Pressure Fingerprints ]| [ Municipal ROI Financial Panel ]    | [ AI Advisory / IoT ] |
| - Recharts Sensor Drops  | - Daily Supply (MLD) & NRW % Sliders | - Auto-Valve Confirm  |
| - Baseline vs Observed   | - Litres Saved: 1.4 MLD | 233 Tankers| - Pipe RUL & Health   |
| - Delta P Signature      | - Annual Savings: ₹2.30 Crore / year | - AI Network Upgrades |
+---------------------------------------------------------------------------------------+
```

### 4.1 SCADA Dashboard & Control Room
1. **Interactive Hydraulic GIS Map (MapCanvas):**
   - High-contrast Carto Dark basemap with an automatic fallback to an offline dark vector grid if internet is unavailable.
   - Real Kengeri street network rendering: 129 junctions, 203 pipes, and 1 terminal distribution reservoir (R1).
   - Dynamic pipe styling: Primary arterials (400 mm), secondary mains (250 mm), and residential reticulation lines (110 mm) rendered with proportional line weights and flow direction indicators.
   - Five Emerald Sentinel Sensors ($S_1$ to $S_5$: `J72`, `J29`, `J64`, `J95`, `J47`) with glowing radar-pulse rings.
   - Dynamic Crimson Leak Heatmap: Smooth $0.0 \to 1.0$ gradient overlay projecting probability densities across all network nodes.
2. **Three Instant Presets:**
   - **Kengeri Mainline Rupture:** Severe burst on a primary trunk main (`J1`, $45.0\text{ cm}^2$ area, $4,198\text{ LPM}$ loss, $1,007\text{ tankers/day}$).
   - **Residential Lane Seep:** Small underground fissure in a secondary residential branch (`J124`, $5.0\text{ cm}^2$ area, $1,111\text{ LPM}$ loss, $266\text{ tankers/day}$).
   - **Joint Crack Junction:** High-pressure branch intersection failure (`J68`, $20.0\text{ cm}^2$ area, $2,831\text{ LPM}$ loss, $679\text{ tankers/day}$).
3. **Interactive Simulation Sliders:**
   - Target Junction picker (choose any of the 129 nodes).
   - Leak Area slider ($0.1\text{ cm}^2$ to $50.0\text{ cm}^2$).
   - Sensor Noise slider ($0.0\%$ to $10.0\%$, default $1.5\%$ Gaussian SCADA noise).
4. **Blind "Judge Mode" & Truth Reveal:**
   - Designed for live hackathon evaluation: enables judges to click an unknown location, runs the triangulation engine blind (showing only the sensor pressure drops and candidate ranking), and reveals the ground-truth ring on demand while calculating the exact localization error in meters.
5. **Real-time Pressure Fingerprint Charts (PressureCharts):**
   - Built with Recharts: side-by-side grouped bar charts showing baseline pressure vs observed pressure for sensors $S_1$ to $S_5$.
   - Pressure drop signature ($\Delta P_i$) highlighting the spatial attenuation gradient.
6. **Incident Telemetry & Valve Isolation Panel (IncidentPanel):**
   - Candidate ranking table with confidence percentages and individual flow loss estimates.
   - **Loss Metrics:** Real-time loss in Litres Per Minute (LPM) and equivalent **BWSSB 6,000-Litre Water Tankers lost per day**.
   - **Isolation Plan:** Displays recommended valve closures (pipes to shut), isolated nodes, affected households, and percentage of ward water supply preserved.
7. **Municipal ₹ Water-Loss ROI Calculator (RoiPanel):**
   - Live interactive financial modeling tool for utility engineers and municipal commissioners:
     * Sliders: District supply in MLD ($10\text{--}500$), NRW % ($10\text{--}60\%$), Recoverable leakage share ($5\text{--}50\%$), Municipal cost/kL ($₹20\text{--}₹100$).
     * Real-time outputs: Litres saved/day, Tankers saved/day, and Annual Municipal Savings formatted in Lakhs and Crores (₹).
8. **Resilient Offline Architecture:**
   - Client automatically detects backend availability. If the backend is unreachable, it seamlessly falls back to cached mock fixtures without crashing or showing blank screens.

---

### 4.2 Network Studio 2D Schematic Editor
Accessed via header toggle or by pressing the **`N`** keyboard shortcut.
1. **Interactive Schematic Canvas:**
   - Built with React Flow (`@xyflow/react`) adhering to dark claymorphism design tokens.
   - Schematic nodes retain intuitive 2D grid coordinates separate from geographic lat/long.
2. **Component Palette & Creation:**
   - Click-to-add Junctions, Reservoirs, and Storage Tanks.
   - 2-click pipe routing connecting any two components with automatic orthogonal or smooth bezier edges.
3. **Properties Inspector Panel:**
   - Inspect and edit node elevation ($m$), base demand ($LPM$), pipe diameter ($mm$), pipe length ($m$), and Hazen-Williams roughness coefficient ($C$).
4. **Topology Validation Engine:**
   - Instant in-browser undirected BFS topology audit.
   - Warns against disconnected subgraphs, floating orphan nodes, missing supply sources, or zero-demand dead ends before exporting to EPANET format.
5. **Draft & Version Management:**
   - Undo/Redo history stack, cascade deletion with confirmation modals, localStorage draft persistence, and JSON / EPANET `.inp` import/export.

---

### 4.3 Advanced Backend Additions (v1.1 API)
1. **What-If Scenario Sandbox (`POST /api/what-if`):**
   - Allows operators to simulate operational perturbations (e.g., closing a trunk pipe, boosting customer demand by $1.5\times$, or simulating reservoir head drop by $10\text{ m}$) without mutating the baseline network.
2. **AI Engineering Advisor (`GET /api/ai/suggestions`):**
   - **Loop Completion:** Discovers vulnerable dead-end pipe branches and recommends cross-connects to eliminate stagnant water zones.
   - **Pipe Upsizing:** Identifies undersized lines with severe headloss ($> 15\text{ m/km}$) and velocities ($> 2.5\text{ m/s}$).
   - **Sensor Placement Benchmark:** Compares the 5-sensor betweenness centrality layout against alternative placement topologies.
   - **OpenRouter AI Gateway:** Enriches technical recommendations with natural language executive summaries using free LLaMA 3.3 70B models, with a 100% deterministic physics fallback.
3. **IoT Telemetry & Auto-Valve Safety Workflow (`POST /api/iot/*`):**
   - Ingests streaming pressure packets into a bounded rolling memory buffer.
   - Computes pipe Remaining Useful Life (RUL) and condition indices based on age, material, and pressure cycle stress.
   - **Two-Phase Human-in-the-Loop Auto-Valve Isolation:** Generates automated isolation proposals, mandates explicit operator confirmation (`confirm_close: true`), and features a one-click Emergency Stop override.

---

## 5. Measured Performance Benchmarks & Empirical Proof

All numbers are measured on the Kengeri water network model (129 junctions, 203 pipes, 1 reservoir, $8.69\text{ km}$ total pipe length).

### 5.1 Benchmark Accuracy Table (80 Blind Injections)
*Extracted directly from `backend/benchmark_report.md` (Seed: 2026).*

| Sensor Strategy | Sentinel Sensors | Noise Level | Top-1 Accuracy | Top-3 Accuracy | Median Error | Mean Error | P90 Error |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Betweenness Separated** *(Ours)* | **J72, J29, J64, J95, J47** | **0.0%** | **86.2%** | **100.0%** | **0.0 m** | **13.6 m** | **70.3 m** |
| **Betweenness Separated** *(Ours)* | **J72, J29, J64, J95, J47** | **1.5%** *(SCADA)* | **51.2%** | **85.0%** | **0.0 m** | **79.7 m** | **226.5 m** |
| **Betweenness Separated** *(Ours)* | **J72, J29, J64, J95, J47** | **3.0%** | **37.5%** | **67.5%** | **105.6 m** | **123.7 m** | **293.0 m** |
| **Betweenness Separated** *(Ours)* | **J72, J29, J64, J95, J47** | **5.0%** | **27.5%** | **48.8%** | **127.2 m** | **156.3 m** | **378.0 m** |
| Naive Betweenness Top | J72, J71, J83, J62, J73 | 1.5% | 20.0% | 42.5% | 187.2 m | 223.2 m | 475.5 m |

### 5.2 Key Takeaways for Presentation
1. **Zero-Noise Precision:** At 0% noise, the true burst node is ranked #1 in **86.2%** of cases and within the top 3 in **100.0%** of cases, with an average distance error of only **13.6 meters**.
2. **Real-World Resilience (1.5% SCADA Noise):** Under realistic industrial pressure sensor noise ($1.5\%$), the system identifies the exact leaking node in **51.2%** of cases, and places the leak within the top 3 candidates in **85.0%** of cases, with a **median error of 0.0 meters**.
3. **Hop Separation Superiority:** Enforcing a $\ge 3$ hop separation between sensors more than doubles the top-1 accuracy ($51.2\%$ vs $20.0\%$) compared to naive top-betweenness clustering.

### 5.3 System Latency & Operational Metrics
- **Engine Warm Boot Time:** **371 ms** (instantaneous cold boot: $10.5\text{ s}$).
- **Leak Triangulation Latency:** **P50 = 246 ms | P95 = 303 ms** (well below the $1,000\text{ ms}$ threshold).
- **What-If Simulation Latency:** **P50 = 135 ms | P95 = 263 ms**.
- **Memory Footprint:** Peak RSS = **611 MiB** (easily deployable on municipal edge gateways or budget cloud instances).
- **Test Suite Verification:** **73/73 tests passing**, 11/11 live smoke test gates passing.

---

## 6. PPT Presentation Master Blueprint (12-Slide Deck)

Use this complete blueprint to construct your slide deck in PowerPoint, Google Slides, or Canva.

```
SLIDE FLOW:
[01: Title] -> [02: Hook] -> [03: The Problem] -> [04: Current Failures] 
  -> [05: The Core Insight] -> [06: System Architecture] -> [07: Mathematical Proof] 
  -> [08: LIVE DEMO] -> [09: Real Benchmark Proof] -> [10: Municipal ROI] 
  -> [11: Roadmap & Rollout] -> [12: Team & Q&A]
```

### Slide 01: Title Slide (Dark, Cinematic)
- **Headline:** **HydroPulse**
- **Subtitle:** Autonomous Hydraulic Digital Twin & Leak Triangulation Engine
- **Event Tag:** Lakshya 2026 · SJBIT, Bengaluru | Track 02: Smart & Sustainable Future
- **Visual:** Dark background (`#050912`), cyan glowing pipe network schematic, glowing emerald sensor icons.
- **Presenter Spoken Cue (0:00–0:15):**  
  *"Good morning judges. In Bengaluru, 40% of treated drinking water never reaches a tap. It vanishes into the ground. We built HydroPulse: a software-only hydraulic digital twin that pinpoints underground pipe bursts using just 5 pressure sensors in under 300 milliseconds."*

---

### Slide 02: The Hook (Stark Reality)
- **Big Stat Callout:** **1,450 Million Litres / Day** pumped into Bengaluru.
- **The Loss:** **500+ Million Litres / Day** lost underground as Non-Revenue Water (NRW).
- **Tagline:** *"Not a water shortage. A pipe visibility problem."*
- **Visual:** Contrasting graphic: A parched citizen waiting for a ₹1,200 water tanker next to an underground pipe leaking clean drinking water beneath a road.
- **Presenter Spoken Cue (0:15–0:30):**  
  *"Bengaluru doesn't just have a water deficit; it has an underground visibility deficit. BWSSB spends crores pumping water uphill from the Cauvery. Yet 40% leaks through pipes buried two meters under asphalt, going unnoticed for weeks until roads collapse into sinkholes."*

---

### Slide 03: The Problem Anatomy
- **Three Core Pillars:**
  1. **Invisible Ruptures:** Buried 1.5–2.5 m deep; surface signs appear only after 10–20 days.
  2. **Economic Hemorrhage:** ₹45/kL production cost wasted; citizens forced to buy private tankers.
  3. **Urban Infrastructure Collapse:** Soil erosion creates road cave-ins; negative pressure during supply shutdowns sucks sewage into clean drinking lines.
- **Visual:** Cross-section diagram of an asphalt road showing soil erosion beneath the roadbed and clean water escaping an underground pipe fissure.

---

### Slide 04: Why Existing Methods Fail
- **Comparison Matrix:**

| Method | Detection Speed | Capital Cost | Urban Disruption | Scalability |
|:---|:---:|:---:|:---:|:---:|
| **Manual Acoustic Sweeps** | 7–14 days | High Labor | Road closures | Very Low |
| **Flowmeters on Every Pipe** | Real-time | Extremely High (₹₹₹) | High Maintenance | Poor |
| **Reactive Citizen Complaints** | 10–20 days | Zero initial / Massive repair | Sinkholes / Damage | None |
| **HydroPulse Digital Twin** | **< 300 ms** | **Ultra-Low (5 sensors / DMA)** | **Zero Disruption** | **Immediate (Software)** |

- **Presenter Spoken Cue (0:45–1:05):**  
  *"Utilities today have two bad options: send manual acoustic teams to listen to roads in the dead of night, or spend tens of crores putting flowmeters on every pipe. HydroPulse provides real-time visibility with zero road digging and minimal sensor hardware."*

---

### Slide 05: The Core Insight (Physics Meets Graph Theory)
- **Headline:** *"A water distribution network is a graph. A burst leaves an unmistakable pressure fingerprint."*
- **Key Concepts:**
  - **Graph Topology:** 129 nodes connected by 203 pipe edges.
  - **The 5 Sentinels:** Selected via betweenness centrality with hop separation to cover independent arterial trunk flows.
  - **The Drop Vector:** When a pipe bursts, pressures across all 5 sensors drop in a unique, mathematically distinct spatial ratio: $[\Delta P_1, \Delta P_2, \Delta P_3, \Delta P_4, \Delta P_5]$.
- **Visual:** Clean diagram showing 5 emerald sensors lighting up across a district and the pressure drop wave radiating from a burst.

---

### Slide 06: How HydroPulse Works (5-Step Pipeline)
- **Horizontal Pipeline Graphic:**
  1. **MAP:** Ingest OpenStreetMap street graph of Kengeri via OSMnx.
  2. **TWIN:** Build EPA WNTR hydraulic model with Pressure-Driven Demand (PDD).
  3. **SENSE:** Monitor 5 strategic sentinel pressure sensors.
  4. **TRIANGULATE:** Scale-invariant cosine similarity matching in $< 300\text{ ms}$.
  5. **ISOLATE:** Compute minimal boundary valve closure plan to save the ward.
- **Presenter Spoken Cue (1:20–1:40):**  
  *"Our pipeline is 100% automated: we convert open street data into an EPA WNTR hydraulic twin, monitor 5 pressure points, compute the cosine fingerprint match against our precomputed sensitivity matrix, and immediately tell the control room which valves to turn."*

---

### Slide 07: The Science & Mathematics
- **Three Formula Cards:**
  1. **Torricelli Orifice Burst:**
     $$Q = C_d \cdot A \cdot \sqrt{2 g h}$$
     *(Pressure-dependent volumetric loss).*
  2. **Scale-Invariant Fingerprint Matching:**
     $$\cos(\theta_j) = \frac{\Delta \mathbf{P}_{obs} \cdot \mathbf{s}_j}{\|\Delta \mathbf{P}_{obs}\| \cdot \|\mathbf{s}_j\|}$$
     *(Directional angle in 5D pressure space is invariant to leak magnitude).*
  3. **Sensor Placement (Betweenness Centrality):**
     $$C_B(v) = \sum_{s \ne v \ne t} \frac{\sigma_{st}(v)}{\sigma_{st}} \quad \text{s.t. } \text{dist}(u, v) \ge 3 \text{ hops}$$

---

### Slide 08: LIVE DEMO SCREEN (Control Room Transition)
- **Callout:** **[ LIVE DEMO HANDOFF ]**
- **Demo Script (60–90 seconds):**
  1. *Action 1:* Click preset **"Kengeri Mainline Rupture"** $\to$ Watch the crimson heatmap converge instantly on node `J1`.
  2. *Action 2:* Point to Incident Panel $\to$ Show $4,198\text{ LPM}$ loss and **$1,007$ tankers/day** equivalent.
  3. *Action 3:* Click **"Isolate Valve"** $\to$ Highlight pipes `P18` & `P19` flashing amber, showing $82\%$ ward supply maintained.
  4. *Action 4 (Judge Mode):* Turn on **"Judge Mode"**, select a mystery node, run simulation blind, ask judges to inspect the sensor drops, then click **"Reveal Truth"** showing ground-truth circle and Haversine error ($0.0\text{ m}$).
  5. *Action 5 (Network Studio):* Press **`N`** $\to$ Switch into 2D Network Studio schematic editor to show drag-and-drop network topology editing.

---

### Slide 09: Empirical Results & Benchmark Proof
- **Headline:** Real Benchmark Data (Kengeri DMA: 129 Junctions, 80 Blind Trials)
- **Key Metrics:**
  - **Top-1 Accuracy:** **86.2%** (Zero Noise) | **51.2%** (1.5% SCADA Noise).
  - **Top-3 Accuracy:** **100.0%** (Zero Noise) | **85.0%** (1.5% SCADA Noise).
  - **Median Localization Error:** **0.0 meters** across 80 blind trials.
  - **Triangulation Speed:** **246 ms (P50) / 303 ms (P95)**.
- **Footnote:** *"Benchmarked using US EPA WNTR pressure-driven demand engine. Code & reproducible benchmark suite committed in repository."*

---

### Slide 10: Municipal Economic Impact & ROI
- **Interactive Calculator Numbers (Standard 100 MLD Ward):**
  - **Daily Pumping:** 100 Million Litres / Day.
  - **Current NRW (Water Loss):** 35% (35 MLD lost).
  - **Physical Leakage Share:** 50% (17.5 MLD).
  - **Recoverable by HydroPulse:** 20% faster detection $\to$ **3.5 MLD saved daily**.
  - **Daily Tankers Saved:** **583 Water Tankers / Day**.
  - **Annual Municipal Cost Savings:** **₹5.74 Crore / year** (at ₹45/kL cost).
  - **Payback Period:** **Under 45 days** against sensor hardware installation.

---

### Slide 11: Technology Architecture & Production Readiness
- **Full Stack Tech Chips:**
  - *Hydraulics & Math:* Python 3.11, US EPA WNTR, NetworkX, NumPy, SciPy.
  - *Backend Services:* FastAPI, Uvicorn, Pydantic v2, OpenRouter AI Gateway (LLaMA 3.3 70B).
  - *Frontend SCADA:* React 18, Vite, Leaflet, React Flow, Recharts, Tailwind CSS.
  - *DevOps & Security:* Docker non-root container, GitHub Actions CI, constant-time token auth, 10MB payload guards.
- **Roadmap:**
  - *Phase 1 (Current):* Hackathon prototype with real OSM Kengeri DMA network.
  - *Phase 2 (Next 3 Months):* Hardware pilot with 5 physical IoT pressure loggers in one BWSSB Kengeri sub-division.
  - *Phase 3 (6–12 Months):* Direct SCADA API integration across all 8 zones of Bengaluru.

---

### Slide 12: Team & Conclusion
- **Team Roles:**
  - **Hardhik:** Lead Backend Developer & Hydraulic Physics Architect.
  - **Gangu:** Backend Assistant, Data Schemas, GeoMapper & Automated Testing.
  - **Badri:** Lead Frontend Engineer, SCADA Dashboard & Network Studio.
  - **Jasmine:** Product Storyteller, Presentation Motion Design & Municipal Economics.
- **Closing Punchline:** *"Every drop lost underground is a household without water. HydroPulse makes the invisible visible."*
- **Q&A Prompt:** *Open for Questions & Live Judge Challenges.*

---

## 7. Judge Q&A Defense Sheet (15 Anticipated Questions)

### Q1: How can just 5 sensors cover 129+ junctions and 8.6 km of pipes?
**Answer:** A water network is not a disconnected set of points; it is a continuous, highly coupled pressure manifold. An orifice leak at any junction drops hydraulic head across the entire zone. Because our 5 sensors are placed using betweenness centrality with minimum hop separation, they sit on all primary hydraulic flow corridors. The relative ratio of pressure drops across these 5 points uniquely identifies which branch of the network is leaking.

### Q2: What happens if there is sensor noise or calibration drift in the field?
**Answer:** We specifically designed and benchmarked HydroPulse against realistic Gaussian sensor noise. At $1.5\%$ noise, our median error remains **0.0 meters** and top-3 accuracy is **85.0%**. Because cosine similarity evaluates the directional angle of the vector rather than absolute pressure values, uniform sensor drift or barometric pressure shifts cancel out naturally.

### Q3: Why use Cosine Similarity instead of training a Deep Learning model?
**Answer:** Three reasons:
1. **Zero Training Data Requirement:** Deep neural networks require thousands of real-world leak events with ground truth, which municipal utilities do not possess.
2. **Physics Explainability:** Cosine similarity compares real observations against an EPA WNTR digital twin governed by Torricelli and Hazen-Williams equations. Municipal engineers will not trust a black-box model.
3. **Sub-second Execution:** Calculating cosine similarity takes $< 1\text{ ms}$, enabling sub-300 ms end-to-end triangulation on edge servers.

### Q4: How do you obtain pipe diameters and network data if the municipality's records are outdated?
**Answer:** This is a major real-world strength of our pipeline. Using OSMnx, we extract urban street geometry and automatically infer pipe classes based on highway classifications: primary/trunk roads receive $400\text{ mm}$ mains, secondary streets receive $250\text{ mm}$ pipes, and residential lanes receive $110\text{ mm}$ lines. Utilities can also upload existing EPANET `.inp` or GIS shapefiles directly via our Network Studio.

### Q5: How does HydroPulse account for elevation differences across Bengaluru?
**Answer:** Elevation is explicitly modeled. Our digital twin incorporates nodal elevation head ($z$), computing total hydraulic head $H = z + \frac{P}{\gamma}$. In the Kengeri model, elevations range from $815\text{ m}$ to $830\text{ m}$ above sea level, correctly factoring static head loss into the baseline simulation.

### Q6: Can the system detect multiple simultaneous leaks?
**Answer:** In municipal networks, simultaneous catastrophic double-bursts in the same district are rare; one burst typically causes an immediate pressure slump that masks smaller fissures. However, our v1.1 What-If sandbox and two-stage verification can iteratively isolate the primary rupture and re-evaluate residual pressure deficits to identify secondary joint leaks.

### Q7: What is the hardware cost to deploy HydroPulse in a real municipal ward?
**Answer:** Approximately ₹2.5 to ₹4 Lakhs total per DMA. We only require **5 commercial cellular IoT pressure transducers** (costing ~₹40,000 to ₹60,000 each) installed at existing fire hydrants or consumer meter manifolds. Compare this to installing electromagnetic flowmeters on every pipe, which costs upwards of ₹50 Lakhs to ₹1 Crore per ward.

### Q8: What if a valve is closed during normal maintenance? Doesn't that break your model?
**Answer:** Our v1.1 API supports dynamic network revisions (`rev-N-hash`). When maintenance crews close a valve, they log it via our Network Studio or SCADA API. The digital twin instantly updates the graph topology, recalculates the baseline in under 100 ms, and updates the sensitivity matrix.

### Q9: What happens if a consumer turns on a high-flow commercial pump?
**Answer:** Pumping spikes cause localized transient drawdowns. To eliminate false alarms, HydroPulse uses a rolling telemetry buffer with time-window smoothing. Single-instant spikes are filtered out; a true pipe burst creates a sustained step-drop in pressure that persists across consecutive sampling frames.

### Q10: How do you guarantee the valve isolation recommendation won't cut off water to hospitals or entire wards?
**Answer:** Our valve isolation algorithm incorporates a graph connectivity check. It identifies the minimal cut set of incident valves and immediately calculates the percentage of ward households preserved. If an isolation cuts off critical loops, the algorithm suggests boundary throttling or alerts the operator before closing. Furthermore, our v1.1 API enforces a two-phase human-in-the-loop safety confirmation before any automated valve action.

### Q11: What is the difference between Demand-Driven (DDA) and Pressure-Driven Demand (PDD)?
**Answer:** Standard EPANET software assumes consumers draw their full required flow even if pressure drops to zero or goes negative. In a severe pipe rupture, this produces mathematically invalid negative pressures. HydroPulse implements Pressure-Driven Demand (PDD) using the Wagner formulation, where customer consumption dynamically drops as line pressure falls, providing physically accurate leak demands.

### Q12: How scalable is this across all of Bengaluru (800+ sq km)?
**Answer:** Indian water boards structure distribution into **District Metered Areas (DMAs)**—isolated zones serving 1,000 to 3,000 connections. HydroPulse is designed to deploy DMA by DMA. Because each DMA twin runs independently in $< 650\text{ MiB}$ of RAM and takes $< 300\text{ ms}$ to solve, a modest server can easily monitor hundreds of DMAs concurrently.

### Q13: Is the software tested and ready for production deployment?
**Answer:** Yes. The backend is packaged into an automated Docker container running as a non-root user with automated healthcheck probes. It has an automated test suite with **73 passing unit and integration tests**, an 11-step end-to-end smoke test suite, and automated GitHub Actions CI verifying every commit.

### Q14: How does HydroPulse integrate with existing utility SCADA systems?
**Answer:** HydroPulse provides clean, versioned REST APIs (`/api/iot/ingest`, `/api/health`, `/api/simulate-leak`, `/api/what-if`). Existing SCADA systems (e.g., Wonderware, Siemens, or custom MQTT/HTTP loggers) push sensor readings via JSON payloads directly to our ingestion endpoint.

### Q15: What is the carbon and environmental benefit of HydroPulse?
**Answer:** Water pumping is one of Bengaluru's largest electrical energy expenditures. BWSSB consumes approximately 100 MW of continuous power to lift water from Shiva Balancing Reservoir over 450 meters up to Bengaluru. Saving 3.5 MLD of wasted leakage in a single sub-division prevents megawatt-hours of wasted pumping electricity and reduces diesel emissions from hundreds of water tankers daily.

---

## 8. Summary of Project Files & Repositories

| File Path | Description |
|:---|:---|
| `backend/main.py` | FastAPI application exposing all v1.0 and v1.1 endpoints, CORS, admin auth, and middleware. |
| `backend/hydraulic_engine.py` | EPA WNTR digital twin, PDD simulation, Torricelli leak modeling, cosine triangulation, and valve isolation. |
| `backend/scenario_engine.py` | What-If simulation sandbox evaluating operational scenarios without mutating the baseline network. |
| `backend/network_builder.py` | Graph building, topology preview/commit, and network revision management. |
| `backend/ai_advisor.py` | AI recommendations for loop completion, pipe upsizing, sensor optimization, and OpenRouter narrative integration. |
| `backend/iot_manager.py` | Telemetry ingestion buffer, pipe RUL estimation, and two-phase human-in-the-loop auto-valve safety workflows. |
| `backend/config.py` | Centralized environment configuration (`dev`/`prod`/`test`), path resolution, and security validation. |
| `backend/security.py` | Constant-time token authentication, request size guards, NaN/Infinity validation, and security headers. |
| `backend/benchmark_report.md` | Authoritative empirical benchmark report recording real accuracy across 80 blind injection trials. |
| `frontend/src/App.jsx` | Main SCADA Dashboard application with tab navigation and keyboard shortcuts (`N` for Studio). |
| `frontend/src/components/MapCanvas.jsx` | High-contrast Leaflet GIS map with scaled pipes, emerald sensors, crimson heatmaps, and offline grid. |
| `frontend/src/components/ControlPanel.jsx` | Quick presets, manual leak sliders, and blind Judge Mode toggles. |
| `frontend/src/components/IncidentPanel.jsx` | Candidate rankings, LPM / tanker loss counters, and valve isolation plan. |
| `frontend/src/components/PressureCharts.jsx` | Recharts grouped baseline vs observed pressure drop graphs. |
| `frontend/src/components/RoiPanel.jsx` | Municipal ₹ water-loss savings and tanker recovery financial calculator. |
| `frontend/src/pages/NetworkStudio.jsx` | React Flow 2D schematic editor with drag-and-drop component palette and topology validation. |
| `Dockerfile` & `.dockerignore` | Production container image configuration (`python:3.11-slim`, non-root user UID 10001). |
| `.github/workflows/backend-ci.yml` | Automated GitHub Actions CI workflow running all tests, smoke scripts, and Docker builds. |
| `scripts/smoke_test.sh` | 11-step end-to-end automated verification script covering all platform capabilities. |
