#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# HydroPulse / DHARA Preflight Verification
# Checks environment, dependencies, ports, and hydraulic assets
# ─────────────────────────────────────────────────────────────────────────────

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== DHARA / HydroPulse Preflight System Check ==="

# 1. Check Python
PYTHON="${REPO_ROOT}/.venv/bin/python"
if [ ! -x "$PYTHON" ]; then
  if command -v python3 >/dev/null 2>&1; then
    PYTHON="$(command -v python3)"
    echo "⚠ .venv/bin/python not found; using system $(python3 --version)"
  else
    echo "✖ Python 3 not found. Please run 'make setup' first."
    exit 1
  fi
else
  echo "✓ Python: $($PYTHON --version) (.venv)"
fi

# 2. Check Node & npm
if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
  echo "✓ Node.js: $(node --version), npm: $(npm --version)"
else
  echo "✖ Node.js or npm missing. Please install Node.js 18+."
  exit 1
fi

# 3. Check Hydraulic Model Assets
if [ -f "backend/bangalore_kengeri.inp" ] && [ -f "backend/network_meta.json" ]; then
  echo "✓ Kengeri DMA hydraulic assets: bangalore_kengeri.inp & network_meta.json present"
else
  echo "✖ Missing Kengeri DMA model files in backend/."
  exit 1
fi

# 4. Check Sensitivity Matrix Cache
if [ -f "backend/sensitivity_matrix.npy" ]; then
  echo "✓ Sensitivity matrix cache: warm (backend/sensitivity_matrix.npy)"
else
  echo "ℹ Sensitivity matrix cache not pre-built; engine will build on boot (~4s)"
fi

# 5. Check Presets and Mock Fixtures
if [ -f "data_utils/presets.json" ] && [ -f "frontend/public/mock/network.json" ]; then
  echo "✓ Demo presets and recorded mock fixtures verified"
else
  echo "✖ Missing data_utils/presets.json or frontend/public/mock/ fixtures."
  exit 1
fi

# 6. Check Frontend Node Modules
if [ -d "frontend/node_modules" ]; then
  echo "✓ Frontend dependencies installed"
else
  echo "⚠ frontend/node_modules missing. Running npm install..."
  npm install --prefix frontend
fi

echo "=== Preflight check PASSED cleanly! ==="
