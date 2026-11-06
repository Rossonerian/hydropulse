# DHARA 💧⚡ · Smart Water Leakage & Consumption Tracker
### Powered by HydroPulse Municipal Hydraulic Digital Twin
*Lakshya 2026 @ SJB Institute of Technology (SJBIT), Bengaluru · Track 02: Smart & Sustainable Future*

---

## 1. Executive Summary & Problem Statement

In municipal water distribution networks across Indian cities like Bengaluru, distribution mains and feeder lines are buried **1.5 to 2.5 meters underground**. When underground pipes develop fractures or burst:
- Treated water escapes unseen into the subsurface soil.
- Surface symptoms (damp asphalt, low household water pressure) only become visible hours or days later, often hundreds of meters away from the subterranean breach point.
- Municipal utilities lose up to **35–45% Non-Revenue Water (NRW)** while repair crews manually inspect street corridors.

### The Solution: DHARA
**DHARA** is an AI-enhanced hydraulic digital twin for Bengaluru's Kengeri ward (adjacent to SJBIT). Operating without costly field sensor grids, DHARA monitors pressure differentials across just **5 strategically placed sentinel junction sensors** using the **US EPA WNTR** engine.

```
+---------------------------------------------------------------------------------------+
|                                    DHARA WORKFLOW                                     |
+---------------------------------------------------------------------------------------+
|  1. Ingest OSM Street Topology -> Kengeri Ward EPANET Hydraulic Network (130 nodes)   |
|  2. Select 5 Sentinel Sensors via Betweenness Centrality & Hop Separation             |
|  3. Pressure-Driven Demand (PDD) + Torricelli Orifice Burst Simulation                |
|  4. Two-Stage Triangulation:                                                          |
|     - Stage 1: Fast Scale-Invariant Cosine Screening -> Top 5 Candidate Nodes         |
|     - Stage 2: EPA WNTR Physics Re-simulation Verification -> True Leak Junction      |
|  5. Quantify Water Loss in L/min & Equivalent BWSSB 6,000-L Tankers per Day           |
|  6. Graph-Theoretic Valve Isolation Cut-Set (Minimal Supply Disruption)               |
+---------------------------------------------------------------------------------------+
```

**Zero additional hardware required.**

---

## 2. System Architecture

```
                 OpenStreetMap (OSM) Road Network [Kengeri, Bengaluru]
                                          │
                                          ▼
                         backend/generate_bangalore_dma.py
                                          │
                                          ▼
                      EPANET Network (.inp) + network_meta.json
                                          │
                                          ▼
                            WNTR Hydraulic Engine (PDD)
             ┌────────────────────────────┴───────────────────────────┐
             ▼                                                        ▼
    5 Sentinel Sensors                                      Sensitivity Matrix
(Betweenness + Hop Sep)                                  (N junctions × 5 sensors)
             │                                                        │
             └────────────────────────────┬───────────────────────────┘
                                          ▼
                               Two-Stage Triangulation
                       1. Cosine screening → Top 5 candidates
                       2. Re-simulation verification & re-ranking
                                          │
                                          ▼
                             FastAPI Service (Port 8000)
             /api/health · /api/network · /api/presets · /api/simulate-leak
                                          │
                                          ▼
                              Vite + React SCADA UI (Port 5173)
             Leaflet GIS Map · Pressure Gauges · Heatmap · Isolation Plan
```

---

## 3. Team Ownership Matrix

Per `SOURCE_OF_TRUTH.md`:

| Directory / File | Owner | Responsibility |
| :--- | :--- | :--- |
| `backend/**` | **Hardhik** | WNTR physics engine, triangulation, FastAPI server, benchmarks |
| `data_utils/**`, `scripts/**`, `tests/**`, `Makefile` | **Gangu** | Pydantic schemas, geo-mapper, mock fixtures, smoke tests, presets, repo setup |
| `frontend/**` (except `public/mock/`) | **Badri** | SCADA control-room UI, React-Leaflet map, Recharts telemetry |
| `pitch_and_roi/**` | **Jasmine** | Pitch deck, financial ROI calculator, presentation script, Q&A defense |

---

## 4. Quickstart & Hackathon Demo Commands

### Prerequisites
- Linux (Arch Linux / Ubuntu 24.04 tested) or macOS / Windows WSL2
- Python 3.10 – 3.12 (Python 3.11 virtual environment at `.venv/`)
- Node.js 20 LTS & npm

### One-Command Live Demonstration
To launch the complete demo environment with backend preflight, sensitivity cache warmup, and frontend SCADA:

```bash
# Verify environment and dependencies
make preflight

# Launch full live demo (Backend on :8000, Frontend on :5173)
make demo

# Stop all background services cleanly
make stop
```

### Demonstration Modes & Targets

| Make Target | Description | Port / URL |
| :--- | :--- | :--- |
| `make demo` | **Primary Live Demo**: launches FastAPI, waits for `matrix_ready: true`, launches Vite SCADA UI, opens browser | http://localhost:5173 |
| `make demo-offline` | **Venue Insurance Mode**: launches Vite UI pre-configured to use recorded API snapshots (zero backend required) | http://localhost:5173 |
| `make demo-reset` | Resets the live twin state back to normal unburst baseline | http://localhost:8000 |
| `make preflight` | Audits Python, venv, Node, EPANET inp, sensitivity matrix, and mock fixtures | CLI stdout |
| `make stop` | Gracefully terminates background uvicorn and vite processes on ports 8000, 8100, 5173 | CLI stdout |
| `make test` | Executes full backend unit, utility, and contract test suites | CLI stdout |
| `make smoke` | Runs 11-step comprehensive API smoke test against the live backend | CLI stdout |

---

## 5. SCADA Control Room Walkthrough

When you click **START DHARA DEMO** in the SCADA UI:
1. **Deterministic Incident Injection:** Injects a calibrated $45\text{ cm}^2$ mainline pipe rupture at junction `J1` (`seed: 7`).
2. **Sentinel Telemetry:** The 5 sentinel sensors ($S_1 \dots S_5$) register simultaneous pressure drawdowns across Kengeri.
3. **Triangulation & Heatmap:** Cosine similarity and WNTR re-simulation pinpoint candidate nodes, generating a GIS probability heatmap.
4. **Water Loss Quantification:** Displays real-time volumetric rate ($4,676.2\text{ L/min}$) and societal impact ($1,122.3$ BWSSB $6,000\text{-L}$ water tankers lost per day).
5. **Valve Isolation:** BFS topological traversal recommends closing 3 specific isolation valves (`P18`, `P20`, `P21`), preserving water supply to $99.3\%$ of the ward.
6. **Reset:** One-click `Reset` restores normal baseline operations instantly for consecutive repeated presentations.

---

## 6. API Endpoints (Contract v1.0 & Additive v1.1)

### Core v1.0 Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health check, sensor list, matrix readiness, active `network_revision` |
| `GET` | `/api/ready` | Production readiness probe (HTTP 200 when baseline + sensitivity matrix ready) |
| `GET` | `/api/network` | Nodes, pipes, coordinates, base pressures, demands, and `revision_meta` |
| `GET` | `/api/presets` | 3 curated demo leak presets |
| `POST` | `/api/simulate-leak` | Inject leak, triangulate location, calculate loss & valve isolation |
| `POST` | `/api/isolate` | Compute remaining pressure after closing valves |

### Additive v1.1 Endpoints (What-If, Studio, AI Advisor, IoT & Condition)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/what-if` | Stateless counterfactual scenario simulation (pipe closures, demand scaling, reservoir head) |
| `GET` | `/api/network/presets` | Built-in ward network topology presets |
| `POST` | `/api/network/import/preview` | Safe EPANET `.inp` & GeoJSON preview validation |
| `POST` | `/api/network/import/commit` | Commit validated import preview to active twin (`confirm=True` required) |
| `POST` | `/api/network/build/preview` | Preview custom junctions & pipes before committing |
| `POST` | `/api/network/build/commit` | Commit previewed network build (`confirm=True` required) |
| `POST` | `/api/network/intellisense` | Real-time Hazen-Williams diameter, roughness, and elevation IntelliSense |
| `POST` | `/api/network/reset` | Roll back active network to `"previous"` or `"baseline"` (`confirm=True` required) |
| `GET` | `/api/ai/suggestions` | Physics-backed engineering recommendations + optional OpenRouter `:free` narrative enrichment |
| `POST` | `/api/ai/apply-suggestion` | Apply an AI structural or sensor recommendation (`confirm=True` required) |
| `POST` | `/api/iot/ingest` | Ingest simulated/live sensor telemetry packets with deduplication & staleness checks |
| `GET` | `/api/iot/state` | Current telemetry state, anomaly flags, and human-in-the-loop auto-valve proposals |
| `GET` | `/api/pipes/condition` | Honest hydraulic load index & material/age-conditioned RUL assessment |
| `POST` | `/api/iot/auto-valve` | Two-phase human-in-the-loop isolation valve control (`propose`, `confirm_close`, `emergency_stop`, `reset_valves`) |

---

## 7. Key Documentation Links

- **[Demo Script & Pitch Guide](docs/DEMO_SCRIPT.md):** 5-minute judge walkthrough with exact voice track and click order.
- **[Run of Show & Checklist](docs/RUN_OF_SHOW.md):** Hackathon morning checklist, offline contingencies, and presentation workflow.
- **[Release Verification Checklist](docs/RELEASE_CHECKLIST.md):** 20-point rigorous verification matrix with pass/fail evidence.
- **[Known Technical Limitations](docs/KNOWN_LIMITATIONS.md):** Honest engineering disclosure of model boundaries, PDD assumptions, and spatial resolution.
- **[Troubleshooting & Recovery](docs/TROUBLESHOOTING.md):** Port conflict resolution, Vite proxy reset, and offline fallback procedures.
- **[API Audit & Architecture](docs/API_AUDIT.md):** Complete 22-endpoint contract and schema audit.
- **[Refactor Plan & Log](docs/REFACTOR_PLAN.md):** Architecture triage and execution record.
