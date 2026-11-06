#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# HydroPulse / DHARA One-Command Demo Launcher
# Starts backend and frontend with hydraulic matrix readiness verification
# ─────────────────────────────────────────────────────────────────────────────

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

OFFLINE_MODE="${1:-}"

# 1. Run Preflight
bash scripts/preflight.sh

# 2. Stop stale processes on 8000 and 5173
echo "Checking and clearing ports..."
bash scripts/stop.sh >/dev/null 2>&1 || true
sleep 1

# 3. Start Backend (if not in forced offline mode)
if [ "$OFFLINE_MODE" != "--offline" ]; then
  echo "Starting HydroPulse backend (FastAPI + WNTR PDD)..."
  PYTHON="${REPO_ROOT}/.venv/bin/python"
  UVICORN="${REPO_ROOT}/.venv/bin/uvicorn"
  
  HYDROPULSE_ENV="dev" \
  HYDROPULSE_PORT=8000 \
  "$UVICORN" backend.main:app --host 0.0.0.0 --port 8000 > "${REPO_ROOT}/backend.log" 2>&1 &
  BACKEND_PID=$!
  echo "Backend process launched (PID: $BACKEND_PID, logs: backend.log)"

  echo "Waiting for hydraulic digital twin readiness..."
  READY=false
  for i in $(seq 1 40); do
    if curl -s "http://localhost:8000/api/health" | grep -q '"matrix_ready":true'; then
      READY=true
      break
    fi
    sleep 0.5
  done

  if [ "$READY" = "true" ]; then
    echo "✓ Hydraulic engine & sensitivity matrix READY on port 8000!"
  else
    echo "⚠ Backend started but matrix_ready took longer than expected. Continuing..."
  fi
else
  echo "ℹ Starting in FORCED OFFLINE mode (Recorded Demo Data only)."
fi

# 4. Start Frontend
echo "Starting DHARA frontend dashboard (Vite)..."
if [ "$OFFLINE_MODE" = "--offline" ]; then
  VITE_USE_MOCK=true npm run dev --prefix frontend -- --host 0.0.0.0 --port 5173 > "${REPO_ROOT}/frontend.log" 2>&1 &
else
  npm run dev --prefix frontend -- --host 0.0.0.0 --port 5173 > "${REPO_ROOT}/frontend.log" 2>&1 &
fi
FRONTEND_PID=$!
echo "Frontend process launched (PID: $FRONTEND_PID, logs: frontend.log)"

# Wait for frontend port
for i in $(seq 1 20); do
  if curl -s "http://localhost:5173" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

# 5. Banner output
cat << "EOF"

========================================================================
   ____   _   _     _     ____     _    
  |  _ \ | | | |   / \   |  _ \   / \   
  | | | || |_| |  / _ \  | |_) | / _ \  
  | |_| ||  _  | / ___ \ |  _ < / ___ \ 
  |____/ |_| |_|/_/   \_\|_| \_\/_/   \_|

  Smart Water Leakage & Consumption Tracker
  Lakshya 2026 @ SJBIT, Kengeri · Track 02
========================================================================

  Dashboard:   http://localhost:5173
  API Docs:    http://localhost:8000/docs
  Health API:  http://localhost:8000/api/health

  Quick Demo Walkthrough:
  1. Open http://localhost:5173 in your browser.
  2. Click "Explore the demo" on the welcome screen.
  3. Click "START DHARA DEMO" on the left control panel.
  4. Watch the 5 sentinel pressure drops update in real-time.
  5. View the 2-stage localized leak junction and probability heatmap.
  6. Click "3. Shut the valves" to test simulated isolation.
  7. Click "Reset" and repeat anytime!

  To stop services: run 'make stop' or press CTRL+C
========================================================================
EOF

# If xdg-open exists and display is active, open browser
if [ -n "${DISPLAY:-}" ] && command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://localhost:5173" >/dev/null 2>&1 || true
fi

# Keep foreground alive if user wants CTRL+C handling
trap 'echo ""; echo "Shutting down demo..."; bash scripts/stop.sh; exit 0' INT TERM
wait
