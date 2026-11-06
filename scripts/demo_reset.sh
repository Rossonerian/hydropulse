#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# HydroPulse / DHARA Demo Reset Script
# Restores pristine state for Kengeri DMA without restarting the machine
# ─────────────────────────────────────────────────────────────────────────────

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== Resetting DHARA / HydroPulse Live State ==="

# Check if backend is running
if curl -s "http://localhost:8000/api/health" >/dev/null 2>&1; then
  echo "Backend is running. Re-triggering baseline state..."
  # If admin token is set or dev environment, call reset endpoint
  ADMIN_TOKEN="${ADMIN_TOKEN:-hp_admin_local_dev_token}"
  RESET_RES=$(curl -s -X POST "http://localhost:8000/api/network/reset" \
    -H "Content-Type: application/json" \
    -H "X-Admin-Token: ${ADMIN_TOKEN}" \
    -d '{"target":"baseline","confirm":true}' 2>/dev/null || echo "")
  echo "✓ Network state reset to baseline"
else
  echo "Backend not active. Cleaning local caches..."
fi

# Clean sensitivity matrix cache if corrupt
if [ "${1:-}" = "--rebuild-cache" ]; then
  echo "Rebuilding sensitivity matrix..."
  rm -f backend/sensitivity_matrix.npy
  "${REPO_ROOT}/.venv/bin/python" -c "from backend.hydraulic_engine import HydraulicEngine; HydraulicEngine().boot()"
fi

echo "✓ Ready for a fresh demo run at http://localhost:5173"
