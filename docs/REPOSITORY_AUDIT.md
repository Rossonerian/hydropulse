# HydroPulse / DHARA — Full Repository Engineering Audit

Date: 2026-11-06  
Environment: Arch Linux (x86_64), Python 3.11/3.12, Node.js 24/npm, Linux 6.18 kernel  
Target: Lakshya 2026 @ SJBIT, Track 02 (Smart & Sustainable Future)

## 1. Subsystem Health Matrix

| Subsystem | Folder | Key Artifacts | Health Status | Findings & Actions |
|---|---|---|---|---|
| **Hydraulic Engine** | `backend/` | `hydraulic_engine.py`, `wntr`, `sensitivity_matrix.npy` | Healthy (100% test pass) | PDD steady-state (`duration=0`), Torricelli orifice equations, 5-sentinel hop-separated betweenness selection, 2-stage verification active. Cache invalidation on network SHA256 verified. |
| **API & Server** | `backend/` | `main.py`, `config.py`, `basemap.py` | Healthy (22 routes) | Single-worker Uvicorn configuration enforced for thread-safe in-memory state. CORS security and admin-token mutations protected. |
| **Data Utilities** | `data_utils/` | `schemas.py`, `presets.json`, `snapshot_fixtures.py` | Healthy | Pydantic v2 schemas mirror API contract. Presets aligned with committed `bangalore_kengeri.inp`. |
| **Frontend Dashboard** | `frontend/` | React 18, Vite, React-Leaflet, Recharts | Healthy (`npm run build` 3.82s) | Dark SCADA control-room theme (#070B14). Operations 4-phase stepper and Studio 2D/GIS/3D mode verified. |
| **Mock Fixtures** | `frontend/public/mock/` | `health.json`, `network.json`, `simulate_leak_*.json` | Healthy | All fixtures conform to `data_utils/schemas.py`. Recorded demo fallback verified. |
| **Scripts & Tooling** | `scripts/` | `setup.sh`, `smoke_test.sh`, `run_backend.sh` | Needs demo launchers | Added `demo.sh`, `preflight.sh`, `stop.sh`, `demo_reset.sh` for one-command hackathon startup. |
| **Presentation & ROI** | `pitch_and_roi/` | `deck/`, `pitch_script.md`, `qa_defense.md` | Verified | Honest metrics matching `backend/benchmark_report.md` (no fake 94.2% accuracy claim; clear distinction between model confidence and measured benchmark error). |

## 2. Invariants & Safety Verification

1. **Hydraulic Solver**:
   - Simulator: `WNTRSimulator` (never `EpanetSimulator` for leak injection).
   - Leak formula: $A_{\text{m2}} = A_{\text{cm2}} / 10000$, $C_d = 0.75$, $P_{\text{exp}} = 0.5$.
   - Steady-state: `duration = 0` confirmed across all engine instances.
2. **Sentinel Selection**:
   - 5 junctions, minimum 3-hop separation, highest betweenness centrality.
   - Sentinel IDs on Kengeri: `J72`, `J29`, `J64`, `J95`, `J47`.
   - Sentinel IDs on Indiranagar: `J90`, `J43`, `J41`, `J25`, `J45`.
3. **Data Integrity**:
   - Conversion formulas: $\text{tankers} = \text{round}(\text{lpm} \times 1440 / 6000, 1)$.
   - All junction IDs are treated strictly as strings.
   - Coordinates: lat/lng never inverted (WNTR $x=\text{lng}, y=\text{lat}$; Leaflet $[\text{lat}, \text{lng}]$).
