#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# HydroPulse / DHARA Process Shutdown Helper
# Idempotently stops services running on ports 8000, 8100, and 5173
# ─────────────────────────────────────────────────────────────────────────────

echo "Stopping HydroPulse / DHARA services..."

stop_port() {
  local port="$1"
  local pids
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" 2>/dev/null || true
  elif command -v lsof >/dev/null 2>&1; then
    pids=$(lsof -ti:"${port}" 2>/dev/null || true)
    if [ -n "$pids" ]; then
      kill -TERM $pids 2>/dev/null || true
      sleep 0.5
      kill -9 $pids 2>/dev/null || true
    fi
  fi
}

stop_port 8000
stop_port 8100
stop_port 5173

# Clean up stale uvicorn and vite processes launched from hydropulse folder
pkill -f "uvicorn backend.main:app" 2>/dev/null || true
pkill -f "vite --host" 2>/dev/null || true

echo "✓ HydroPulse services stopped cleanly."
