# DHARA / HydroPulse: 20-Point Release Verification Checklist

**Event:** Lakshya 2026 @ SJBIT (Track 02: Smart & Sustainable Future)  
**System Under Test:** DHARA (UI/SCADA) / HydroPulse (Hydraulic Engine & API Contract)  
**Verification Date:** 2026-11-06  
**Auditor:** Coordinated Engineering Team (Backend, Hydraulics, Frontend, QA, DevOps)  
**Overall Status:** **PASSED (20/20) — READY FOR LIVE DEMO**

---

## Verification Matrix

| # | Verification Check | Requirement & Acceptance Criteria | Evidence / Command | Status |
| :--- | :--- | :--- | :--- | :--- |
| **01** | **Host Environment & Tooling** | Linux (Arch / Ubuntu 24.04), Python 3.11 venv at `.venv/`, Node 20 LTS, npm package manager | `bash scripts/preflight.sh` exits 0 | **PASS** |
| **02** | **Dependency Lockdown** | Pydantic v2, WNTR 1.2+, NetworkX, SciPy, NumPy, FastAPI, Uvicorn in `.venv/`; clean lockfiles | `.venv/bin/pip check` reports 0 broken dependencies | **PASS** |
| **03** | **EPANET Network Model** | `backend/bangalore_kengeri.inp` valid topology with 129 junctions, 203 pipes, reservoir feeder `R1` | `GET /api/network` returns valid geometry & metadata | **PASS** |
| **04** | **Sensitivity Matrix Cache** | `backend/sensitivity_matrix.npy` present and valid; loaded in <0.5s without rebuild | Matrix loaded in 12ms from disk cache | **PASS** |
| **05** | **Sentinel Sensor Layout** | 5 sentinel pressure sensors ($S_1 \dots S_5$) placed via betweenness centrality & $\ge 2$-hop separation | Verified sensor IDs: `['J14', 'J35', 'J62', 'J89', 'J115']` | **PASS** |
| **06** | **Backend Readiness Probe** | `GET /api/ready` returns HTTP 200 with `matrix_ready: true` and `status: "ready"` | `curl -s http://localhost:8000/api/ready` passes | **PASS** |
| **07** | **API Contract Adherence** | All 22 v1.0 and v1.1 endpoints conform to `SOURCE_OF_TRUTH.md` without field renaming | `pytest tests/test_contract.py` passes 9/9 | **PASS** |
| **08** | **Deterministic Demo Seed** | `seed: 7` on preset `kengeri_mainline_rupture` ($45\text{ cm}^2$ at `J1`) produces identical pressure drops | Verified: $S_1 \dots S_5$ drop -2.8m, -1.9m, -1.2m, -0.8m, -0.5m | **PASS** |
| **09** | **Two-Stage Triangulation** | Stage 1 Cosine screening filters to Top 5; Stage 2 WNTR re-simulation ranks by physics residual | Top candidate matches injected cluster (`J1`/`J13`) | **PASS** |
| **10** | **Water Loss Quantification** | Loss computed in LPM, $m^3/h$, and equivalent 6,000-L BWSSB water tankers/day | 4,676.1 LPM = 280.6 $m^3/h$ = 1,122 tankers/day | **PASS** |
| **11** | **Valve Isolation Cut-Set** | BFS graph traversal identifies minimal pipe valves to cut off leak (`P18`, `P20`, `P21`) | 3 valves close segment, preserving supply to 90 households | **PASS** |
| **12** | **SCADA Dual Branding** | TopBar displays `DHARA · Smart Water Leakage & Consumption Tracker`, engine cites HydroPulse | Verified in `frontend/index.html` & `TopBar.jsx` | **PASS** |
| **13** | **One-Click Demo Button** | Primary `.btn--start-demo` button (`START DHARA DEMO`) visibly anchored in SCADA panel | Verified in `ControlPanel.jsx` & CSS styles | **PASS** |
| **14** | **Guided 4-Step Stepper** | Visual stepper indicates `Pick Preset` $\rightarrow$ `Simulate` $\rightarrow$ `Triangulate` $\rightarrow$ `Isolate` | Verified by Playwright test `verify_dhara_demo.mjs` | **PASS** |
| **15** | **One-Click Reset** | `RESET DEMO` button resets live backend and SCADA UI to normal baseline | Verified: cleans heatmaps, telemetry, and candidate badges | **PASS** |
| **16** | **Repeatability** | Demo cycle can be executed $\ge 5$ times sequentially without memory leaks or crash | Playwright script verifies clean repeatable execution | **PASS** |
| **17** | **Honest Offline Fallback** | Instant fallback to recorded snapshots (`frontend/public/mock/`) with yellow `RECORDED` badge | Verified: loads offline without backend running | **PASS** |
| **18** | **One-Command Automation** | `make demo`, `make demo-offline`, `make demo-reset`, `make preflight`, `make stop` | All targets defined in Makefile and verified | **PASS** |
| **19** | **Automated Test Suites** | 82 backend/utility tests, 9 contract tests, and 11 smoke tests pass 100% | Pytest & smoke tests exit with 0 errors | **PASS** |
| **20** | **Visual E2E Verification** | Headless browser execution passes and saves 5 visual artifacts in `docs/demo-screenshots/` | All 5 PNG screenshots generated and visually confirmed | **PASS** |

---

## Certification

The HydroPulse / DHARA software repository has successfully satisfied all twenty (20) acceptance criteria. The codebase is frozen and verified ready for live jury demonstration at Lakshya 2026.
