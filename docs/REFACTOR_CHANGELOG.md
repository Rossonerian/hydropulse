# HydroPulse / DHARA — Refactor Changelog

### Entry 1: Dual Branding & Title Alignment
- **Problem**: Inconsistent brand titles across header and HTML document.
- **Root Cause**: Hardcoded "HydroPulse · Kengeri DMA" in `index.html` and `TopBar.jsx`.
- **Files Changed**: `frontend/index.html`, `frontend/src/components/TopBar.jsx`.
- **Resolution**: Updated to `DHARA — Smart Water Leakage & Consumption Tracker · Kengeri DMA` while preserving `hydropulse` internal packages and contracts.
- **Validation**: Visual inspection and Playwright test assertions in `verify_dhara_demo.mjs`.

### Entry 2: Prominent "START DHARA DEMO" Action
- **Problem**: Live demo required manually selecting presets and finding the contextual button in the footer.
- **Root Cause**: Missing dedicated 1-click hackathon demo launcher at top of control panel.
- **Files Changed**: `frontend/src/components/ControlPanel.jsx`, `frontend/src/styles/ops/control.css`, `frontend/src/App.jsx`.
- **Resolution**: Added `.btn--start-demo` at the top of the left control panel, wired to `handleStartDemo` running Kengeri Mainline Rupture (`J1`, 45 cm², 1.5% noise, deterministic `seed: 7`).
- **Validation**: `node frontend/scripts/verify_dhara_demo.mjs` clicks button and validates end-to-end flow.

### Entry 3: Explicit Data Source Badging & Fallback
- **Problem**: Ambiguous status badge ("Connected", "Demo data") lacked explicit hackathon clarity.
- **Root Cause**: `DataSourceBadge.jsx` used generic status strings.
- **Files Changed**: `frontend/src/ui/DataSourceBadge.jsx`, `frontend/src/components/TopBar.jsx`, `frontend/src/styles/ops/topbar.css`.
- **Resolution**: Updated badge text to explicitly show `LIVE API` or `RECORDED DEMO DATA`, added 5-sentinel / node counts summary in top bar.
- **Validation**: Verified in live and offline browser modes.

### Entry 4: One-Command Arch Linux Startup & Process Lifecycle
- **Problem**: Running the demo required starting backend and frontend in separate terminals with manual health polling.
- **Root Cause**: Missing consolidated launcher scripts and Makefile targets.
- **Files Changed**: `scripts/preflight.sh`, `scripts/demo.sh`, `scripts/demo_reset.sh`, `scripts/stop.sh`, `Makefile`.
- **Resolution**: Created `make demo`, `make demo-offline`, `make demo-reset`, `make preflight`, `make stop` with matrix-ready polling and clean process termination.
- **Validation**: Executed `make preflight`, `bash scripts/smoke_test.sh`, and `scripts/stop.sh`.

### Entry 5: Real OSM & SRTM 30m Elevation Network for Indiranagar
- **Problem**: Multi-ward demos lacked real elevation and street geometry.
- **Root Cause**: Only synthetic elevation proxy was supported previously.
- **Files Changed**: `backend/generate_bangalore_dma.py`, `backend/benchmark.py`, `backend/networks/indiranagar.inp`, `backend/networks/indiranagar_meta.json`, `backend/networks/indiranagar_dem.json`, `backend/networks/benchmark_indiranagar.md`.
- **Resolution**: Downloaded OSM geometry, sampled SRTM 30m DEM from OpenTopoData, generated 137-junction EPANET network, and benchmarked genuine accuracy on port 8100.
- **Validation**: Benchmark report generated with 64.0% top-1 accuracy at 0% noise and 114.9ms simulation time.
