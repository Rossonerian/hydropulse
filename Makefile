.PHONY: help setup network network-synthetic backend frontend dev lint fmt-check typecheck test test-live warm benchmark smoke fixtures snapshot presets clean demo demo-offline demo-reset preflight stop build

VENV ?= .venv
PYTHON ?= $(VENV)/bin/python
UVICORN ?= $(VENV)/bin/uvicorn
PYTEST ?= $(VENV)/bin/pytest
BASE_URL ?= http://127.0.0.1:8000

ifeq ($(OS),Windows_NT)
    PYTHON = $(VENV)/Scripts/python.exe
    UVICORN = $(VENV)/Scripts/uvicorn.exe
    PYTEST = $(VENV)/Scripts/pytest.exe
endif

help:
	@echo "HydroPulse make targets:"
	@echo "  setup              create .venv, install requirements-dev.txt, npm install"
	@echo "  network            regenerate Bangalore DMA network from OSM (needs osmnx)"
	@echo "  network-synthetic  regenerate network offline"
	@echo "  backend            run backend (scripts/run_backend.sh)"
	@echo "  frontend           run Vite dev server"
	@echo "  dev                backend with reload (run 'make frontend' in another terminal)"
	@echo "  lint               ruff check backend data_utils tests"
	@echo "  fmt-check          ruff format --check (informational)"
	@echo "  typecheck          mypy, lenient (informational)"
	@echo "  test               pytest, same file set as CI (see pyproject.toml)"
	@echo "  test-live          tests/test_contract.py against BASE_URL ($(BASE_URL))"
	@echo "  warm               build the sensitivity matrix cache"
	@echo "  smoke              smoke test against a running server"
	@echo "  fixtures presets snapshot benchmark clean"

setup:
	@bash scripts/setup.sh || powershell -ExecutionPolicy Bypass -File scripts/setup.ps1

network:
	$(PYTHON) backend/generate_bangalore_dma.py

network-synthetic:
	$(PYTHON) backend/generate_bangalore_dma.py --source synthetic

backend:
	@bash scripts/run_backend.sh || powershell -ExecutionPolicy Bypass -File scripts/run_backend.ps1
frontend:
	cd frontend && npm run dev -- --host

dev:
	@echo "Frontend: run 'make frontend' in a second terminal."
	@$(MAKE) backend

lint:
	$(PYTHON) -m ruff check backend data_utils tests

fmt-check:
	-$(PYTHON) -m ruff format --check backend data_utils tests

typecheck:
	-$(PYTHON) -m mypy backend data_utils

# Same file set as CI / pyproject testpaths. tests/test_contract.py needs a live server: see test-live.
test:
	$(PYTEST)

test-live:
	BASE_URL=$(BASE_URL) $(PYTEST) tests/test_contract.py

warm:
	$(PYTHON) -c "from backend.hydraulic_engine import HydraulicEngine; HydraulicEngine().boot()"

benchmark:
	$(PYTHON) backend/benchmark.py

smoke:
	@bash scripts/smoke_test.sh || powershell -ExecutionPolicy Bypass -File scripts/smoke_test.ps1

fixtures:
	$(PYTHON) data_utils/make_mock_fixtures.py

presets:
	$(PYTHON) data_utils/build_presets.py

snapshot:
	$(PYTHON) data_utils/snapshot_fixtures.py

clean:
	 rm -rf __pycache__ data_utils/__pycache__ backend/__pycache__ tests/__pycache__ .pytest_cache

preflight:
	@bash scripts/preflight.sh

demo:
	@bash scripts/demo.sh

demo-offline:
	@bash scripts/demo.sh --offline

demo-reset:
	@bash scripts/demo_reset.sh

stop:
	@bash scripts/stop.sh

build:
	npm run build --prefix frontend


