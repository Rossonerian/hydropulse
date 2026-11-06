# HydroPulse / DHARA — Refactor Plan & Priority Classification

## Priority Triage

### P0 (Critical / Data Integrity / State Safety)
- [x] **In-Memory State Isolation**: Guard single-worker execution with `RLock` in `HydraulicEngine`. Guarantee that leak simulations and what-if scenarios never mutate active baseline network state.
- [x] **Simulation Cooldown & Idempotency**: Guard consecutive leak simulations against rapid duplicate submissions and solver divergence.
- [x] **Deterministic Seed Support**: Support explicit integer seeds (`seed=7` for demo) across `backend/main.py` and `App.jsx` to ensure repeatable presentation runs.

### P1 (Integration / Demo Flow / Contract Adherence)
- [x] **1-Click Live Demo Launcher (`START DHARA DEMO`)**: Dedicated primary trigger on the Operations panel executing deterministic Kengeri mainline rupture test.
- [x] **4-Phase Incident Flow Alignment**: Stepper & contextual button progression (`pick` → `ready` → `running` → `located` → `isolated`).
- [x] **Explicit Data Source Badging**: Prominent `LIVE API` vs `RECORDED DEMO DATA` status in top bar and instant fallback handling.
- [x] **Dual Branding Alignment**: Public-facing brand `DHARA — Smart Water Leakage & Consumption Tracker`, preserving `hydropulse` package and contract namespace.
- [x] **One-Command Arch Linux Startup**: `make demo`, `make demo-offline`, `make demo-reset`, `make preflight`, `make stop`.

### P2 (Performance, Layout Responsiveness & Multi-Mode Studio)
- [x] **Multi-Mode Workspace Parity**: 2D Schematic, GIS Map (with CARTO tile proxy), and 3D Terrain in Network Editor.
- [x] **Responsive Breakpoints**: Seamless docking into a 44px mobile bottom sheet (<768px) and tab switching on tablet (768px-1024px).
- [x] **Sensitivity Matrix Caching**: Validated cache hit on SHA256 hash digest, booting engine in <0.5s when warm.
- [x] **Multi-Ward Support**: Real OpenStreetMap Indiranagar network asset with SRTM 30m digital elevation model.

### P3 (Cosmetic Polish & Hackathon Presentation Docs)
- [x] **Telemetry & Drop Badges**: Explicit $S_1 \dots S_5$ pressure drop display and one-click clipboard report export.
- [x] **Presentation & Run of Show Docs**: `RUN_OF_SHOW.md`, `DEMO_SCRIPT.md`, `TROUBLESHOOTING.md`, `KNOWN_LIMITATIONS.md`, `RELEASE_CHECKLIST.md`.
