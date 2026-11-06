# HydroPulse / DHARA — API Inventory & Contract Audit

This document records every registered HTTP endpoint on the FastAPI backend, its request/response schemas, state mutability, authentication requirements, test coverage, and verification status.

## Registered Endpoint Inventory

| # | Method | Path | Request Schema | Response Schema | State Mutability | Auth Required | Test Coverage | Status |
|---|--------|------|----------------|-----------------|------------------|---------------|---------------|--------|
| 1 | `GET` | `/api/health` | None | `HealthResponse` | Read-only | None | `test_contract.py`, `test_backend.py`, smoke | Verified |
| 2 | `GET` | `/api/ready` | None | `{status: "ok", matrix_ready: bool}` | Read-only | None | `test_deploy_config.py`, smoke | Verified |
| 3 | `GET` | `/api/basemap/{style}/{z}/{x}/{y}` | Path params: `style`, `z`, `x`, `y` | Binary `image/png` | Read-only | None (server-side CARTO key) | `test_basemap.py` | Verified |
| 4 | `GET` | `/api/network` | None | `NetworkResponse` | Read-only | None | `test_contract.py`, `test_backend.py`, smoke | Verified |
| 5 | `GET` | `/api/presets` | None | `PresetsResponse` | Read-only | None | `test_contract.py`, `test_backend.py`, smoke | Verified |
| 6 | `POST` | `/api/simulate-leak` | `LeakSimulationRequest` | `LeakSimulationResponse` | Ephemeral solve (under lock) | None | `test_contract.py`, `test_backend.py`, smoke | Verified |
| 7 | `POST` | `/api/isolate` | `IsolationRequest` | `IsolationResponse` | Ephemeral solve | None | `test_backend.py` | Verified |
| 8 | `POST` | `/api/what-if` | `WhatIfRequest` | `WhatIfResponse` | Ephemeral cloned model | None | `test_contract.py`, `test_what_if.py`, smoke | Verified |
| 9 | `GET` | `/api/ai/suggestions` | None (optional header `X-OpenRouter-Key`) | `AiSuggestionsResponse` | Read-only advisory | None | `test_ai_advisor.py`, smoke | Verified |
| 10 | `POST` | `/api/ai/apply-suggestion` | `ApplySuggestionRequest` | `ApplySuggestionResponse` | Mutates network revision | `X-Admin-Token` | `test_ai_advisor.py` | Verified |
| 11 | `GET` | `/api/network/presets` | None | `NetworkPresetsListResponse` | Read-only | None | `test_contract.py`, smoke | Verified |
| 12 | `POST` | `/api/network/import/preview` | `NetworkImportPreviewRequest` | `NetworkImportPreviewResponse` | Memory preview token | None | `test_network_builder.py` | Verified |
| 13 | `POST` | `/api/network/import/commit` | `NetworkImportCommitRequest` | `NetworkRevisionCommitResponse` | Mutates network revision | `X-Admin-Token` | `test_network_builder.py` | Verified |
| 14 | `POST` | `/api/network/import` | `NetworkImportPreviewRequest` | `NetworkImportPreviewResponse` | Direct upload alias | `X-Admin-Token` | `test_network_builder.py` | Verified |
| 15 | `POST` | `/api/network/intellisense` | `IntelliSenseRequest` | `IntelliSenseResponse` | Read-only physics sizing | None | `test_contract.py`, smoke | Verified |
| 16 | `POST` | `/api/network/build/preview` | `NetworkBuildPreviewRequest` | `NetworkBuildPreviewResponse` | Memory preview token | None | `test_network_builder.py` | Verified |
| 17 | `POST` | `/api/network/build/commit` | `NetworkBuildCommitRequest` | `NetworkRevisionCommitResponse` | Mutates network revision | `X-Admin-Token` | `test_network_builder.py` | Verified |
| 18 | `POST` | `/api/network/reset` | `NetworkResetRequest` | `NetworkRevisionCommitResponse` | Restores prior/baseline snapshot | `X-Admin-Token` | `test_network_builder.py` | Verified |
| 19 | `GET` | `/api/iot/state` | None | `IoTStateResponse` | Read-only ring buffer | None | `test_contract.py`, `test_iot_manager.py`, smoke | Verified |
| 20 | `POST` | `/api/iot/ingest` | `TelemetryIngestRequest` | `TelemetryIngestResponse` | Appends telemetry packets | `X-Admin-Token` | `test_contract.py`, `test_iot_manager.py` | Verified |
| 21 | `GET` | `/api/pipes/condition` | None | `PipeConditionResponse` | Read-only physical stress | None | `test_contract.py`, `test_iot_manager.py`, smoke | Verified |
| 22 | `POST` | `/api/iot/auto-valve` | `AutoValveRequest` | `AutoValveResponse` | Propose/Confirm/Emergency Stop | `X-Admin-Token` (except emergency_stop) | `test_contract.py`, `test_iot_manager.py`, smoke | Verified |

## Invariants & Security Boundaries
- **CORS**: Enforced in `backend/config.py`. Wildcard forbidden in production; regex allowed only when strictly anchored.
- **Admin Boundary**: Mutating endpoints (`apply-suggestion`, `import/commit`, `build/commit`, `reset`, `ingest`, `auto-valve confirm`) require `X-Admin-Token` header.
- **Simulation Isolation**: `simulate-leak`, `isolate`, and `what-if` execute under thread locks with reset models to prevent state corruption across requests.
