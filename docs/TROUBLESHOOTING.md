# DHARA / HydroPulse — Troubleshooting & Failure Recovery Guide

## 1. Port Conflict (8000 or 5173 Already in Use)

**Symptom**: `Address already in use` or backend/frontend fails to start.  
**Fix**: Run the stop script to clear lingering HydroPulse processes:
```bash
make stop
# Or manually:
bash scripts/stop.sh
```

## 2. Hydraulic Sensitivity Matrix Rebuild

**Symptom**: `sensitivity_matrix.npy` missing or corrupt.  
**Fix**: Force an engine boot to rebuild and cache the matrix:
```bash
make warm
# Or clean reset:
bash scripts/demo_reset.sh --rebuild-cache
```
The rebuild takes $\approx 4\text{ seconds}$ on Kengeri and caches the result for sub-second subsequent reboots.

## 3. Browser Shows Empty Screen or Stale Bundle

**Symptom**: Blank white screen or old assets cached in browser.  
**Fix**:
1. Hard refresh: `Ctrl + Shift + R` (or `Cmd + Shift + R`).
2. Run clean build:
   ```bash
   make build
   ```

## 4. Live API Unreachable (Offline Venue Fallback)

**Symptom**: Red indicator or `Backend offline` notice.  
**Fix**:
The frontend automatically falls back to committed snapshots in `frontend/public/mock/`.
To force offline mode from the command line:
```bash
make demo-offline
```
The dashboard will run with full map, telemetry, and metrics marked honestly with the **`RECORDED DEMO DATA`** badge.

## 5. Overpass / OSM Network Regeneration Issue

**Symptom**: Running `backend/generate_bangalore_dma.py` fails due to external Overpass rate limits.  
**Fix**:
`backend/generate_bangalore_dma.py` automatically falls back to local cached Overpass JSON files. Do **not** run `make network` during the hackathon code freeze unless agreed by the entire team, as it modifies node IDs. Use the committed `backend/bangalore_kengeri.inp` and `backend/networks/indiranagar.inp`.
