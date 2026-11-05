# HydroPulse — Backend Deployment & Audit Plan (v2)

Status: proposed · Supersedes the deployment parts of the 2026-11-05 chat prompts (OCI plan cancelled;
AWS EC2 + Cloudflare Quick Tunnel + existing Vercel frontend) · Audited against `main` @ `68284d3`.

This plan replaces "resume and figure out where we are" with a fixed, gated sequence. Every gate names
the exact command and the expected result, so whoever runs it (OMP agent on the Arch PC, the AWS account
owner, or a human) can tell pass from fail without interpretation.

---

## 1. Where the backend actually stands (verified in this audit)

| Check | Result | How verified |
|---|---|---|
| Full pytest suite, Python 3.11 (baseline, unchanged `main`) | **55 passed** | `pytest -q backend/tests tests/test_data_utils.py tests/test_mock_fixtures.py` |
| Suite after this audit's changes, Python 3.11 and 3.12 | **65 passed** on each (55 existing + 10 new) | same command in a 3.11 and a 3.12 venv |
| Live HTTP contract tests | **9 passed** | `BASE_URL=http://127.0.0.1:8000 pytest -q tests/test_contract.py` |
| Smoke against prod-mode server after the fix | **11/11 passed** with `ADMIN_TOKEN`, `PYTHON=python3` | `scripts/smoke_test.sh` |
| Prod-mode boot (`HYDROPULSE_ENV=prod`, admin auth on, persisted state dir) | boots; `/api/ready` 200; ~270 MB RSS | uvicorn on 127.0.0.1:8000 |
| `scripts/smoke_test.sh` against that prod-mode server | **failed at step 9/11 on `main`** | demo tick and auto-valve need the admin token in prod; script had no way to send it |
| CORS preflight from the exact configured origin | 200 + `access-control-allow-origin` | `curl -X OPTIONS ...` |
| CORS preflight from a Vercel Preview URL | **400** on `main` | exact-match list only; preview URLs rotate |

Historical claims from the chat ("73 passing tests", "41 + 9", "6/6 smoke") were not reproduced as
such; the numbers above are the current, reproduced ones.

## 2. Audit findings

Severity: **B** = blocks the planned deployment, **S** = security, **M** = misleading/incorrect, **G** = gap.

| # | Sev | Finding | Status |
|---|---|---|---|
| 1 | B | `deploy-hydropulse-host.sh` hard-required `python3.11`, which is not in the Ubuntu 24.04 archive (24.04 ships 3.12). Fresh EC2 deploy stopped at the prerequisite check. | **Fixed**: uses 3.11 if present, else 3.12; CI now runs 3.11 + 3.12 |
| 2 | B | Smoke test could not run against prod: no admin-token support (steps 9–10 fail) and it calls `python`, which Ubuntu 24.04 does not provide. | **Fixed**: `ADMIN_TOKEN=...` env, `python3`/venv fallback |
| 3 | S | `deploy/hydropulse.env.example` ships `HYDROPULSE_ADMIN_TOKEN=REPLACE_WITH_STRONG_SECRET_MIN_8_CHARS` (≥ 8 chars), so `config.validate()` accepted it. Any path that skips the deploy script (manual systemd, Docker) booted with a publicly known admin token. | **Fixed**: prod refuses tokens containing the placeholder |
| 4 | B | The chat plan recommends testing on a Vercel **Preview** deployment, but CORS was exact-match only and Preview URLs change per deploy → every preview blocked. | **Fixed**: optional `HYDROPULSE_CORS_ORIGIN_REGEX`, must be anchored, `https`, and is rejected if it matches unrelated origins |
| 5 | B | Quick Tunnel URL is random per `cloudflared` start; nothing kept it running or reported it, and a `Requires=` coupling would rotate the URL on every backend redeploy (forcing a Vercel rebuild each time). | **Fixed**: `deploy/systemd/hydropulse-tunnel.service` (`Wants=`), `scripts/tunnel-url.sh` |
| 6 | M | DEPLOYMENT.md: rollback used `/opt/hydropulse/repo`, troubleshooting used `/opt/hydropulse/venv` (both wrong); "validate config" command ignored the env file; cost advice suggested a NAT gateway (far more expensive than the instance) and misdescribed the public-IP charge. | **Fixed** |
| 7 | B | Deploy script restarted the service and printed "completed" without checking it came up. | **Fixed**: validates env with `load_config()` before restart; waits for `/api/ready` |
| 8 | M | **Contract drift**: SOURCE_OF_TRUTH.md §7.1 names `/api/advisor/suggestions`, `/api/advisor/apply`, `/api/builder/intellisense`, `/api/builder/preview`, `/api/builder/commit`, `/api/valves/auto`; the code serves `/api/ai/suggestions`, `/api/ai/apply-suggestion`, `/api/network/intellisense`, `/api/network/build/preview`, `/api/network/build/commit`, `/api/iot/auto-valve`. | **Not changed** — contract decision for Hardhik (§11). Either amend §7.1 to the served paths (frontend has not integrated v1.1 yet, so this is cheapest) or add the §7.1 paths as aliases. |
| 9 | G | The deployed frontend calls only v1.0 endpoints. v1.1 features cannot be manually tested through the UI. | Documented: test v1.1 via curl or `/docs` on staging (`HYDROPULSE_DOCS_ENABLED=true`) |
| 10 | G | `confidence_pct` does not discriminate. It is `100 × cosine(dp_obs, dp_sim)` (`hydraulic_engine.py:720`); with 5 co-moving sensors every nearby candidate scores ≈ 0.999 → **100.0 % for all top-3 candidates** in every preset run. With the smoke seed (42) all 3 demo presets were localised to the wrong junction (116–227 m error) at 100.0 %; with `noise_pct=0` all 3 are exact. Testers and judges will read "100 %" as certainty. | Open — owner Hardhik. Suggested: derive the score from the stage-2 residuals across the verified candidates (e.g. softmax of −residual/σ), then calibrate per §5. Changing the value's meaning needs a SOT §6 note. |
| 11 | G | `requirements.txt` mixes runtime and dev/tooling deps (`osmnx` is only used by the network generator; `pytest` in prod). Adds install time and attack surface on the host. | Open — owner Gangu; suggest `requirements-dev.txt` split |
| 12 | M | `kengeri_synthetic` is not the real OSM network; `benchmark_report.md` says so. Any tester-facing claim must say "synthetic street grid". | Open (unchanged) |
| 13 | S | Public read/simulation endpoints have no rate limit; a Quick Tunnel URL is effectively public. | Accepted for short-lived staging; stop the tunnel after sessions |

## 3. Deployment sequence to first manual test

Roles: **Owner** = teammate who owns the new AWS account (billing, root MFA). **Operator** = person or
OMP agent on the Arch PC. Never use root credentials or long-lived root keys; never paste secrets into
chat, GitHub, or `VITE_*`.

### Gate 0 — Code ready (Operator, Arch PC)
```bash
git switch main && git pull --ff-only
python3.11 -m venv .venv && .venv/bin/pip install -r requirements.txt   # or python3.12
HYDROPULSE_ENV=test HYDROPULSE_OPENROUTER_ENABLED=false .venv/bin/pytest -q backend/tests tests/test_data_utils.py tests/test_mock_fixtures.py
```
Pass: all tests green, the PR from this audit merged.

### Gate 1 — AWS account safe to use (Owner)
1. Free account plan (not Paid); root MFA on; **not** joined to AWS Organizations.
2. Billing → Budgets: a zero-spend/credits alert to the owner's email.
3. IAM: create a deploy user/role for the Operator with EC2 permissions only, MFA, short-lived keys if possible.
4. Operator: `aws sts get-caller-identity --profile hydropulse-staging` returns the deploy identity, not root.

Pass: identity confirmed; budget alert exists.

### Gate 2 — Instance (Operator, with Owner's approval of type/region)
- Region `ap-south-1` (Mumbai); Ubuntu 24.04 LTS x86_64; **t3.small** (check eligibility with
  `aws ec2 describe-instance-types --filters Name=free-tier-eligible,Values=true ...`); 20 GB gp3.
- Security group: inbound **22 from the Operator's IP only**. Nothing else.
- t3.micro instead → add 2 GB swap first (DEPLOYMENT.md §1).

Pass: `ssh ubuntu@<ip> 'lsb_release -ds; nproc; free -m'` shows 24.04 and the expected size.

### Gate 3 — Backend service (on the instance)
```bash
sudo apt update && sudo apt install -y python3.12 python3.12-venv git curl
sudo useradd --system --user-group --home-dir /var/lib/hydropulse --shell /usr/sbin/nologin hydropulse
sudo install -d -o hydropulse -g hydropulse -m 0750 /var/lib/hydropulse /opt/hydropulse
sudo -u hydropulse git clone https://github.com/Rossonerian/hydropulse.git /opt/hydropulse
cd /opt/hydropulse
sudo bash scripts/deploy-hydropulse-host.sh   # first run creates /etc/hydropulse/hydropulse.env and stops
sudo nano /etc/hydropulse/hydropulse.env        # CORS origin(s), token from `openssl rand -hex 32`, optional OPENROUTER_API_KEY
sudo bash scripts/deploy-hydropulse-host.sh   # validates, installs, restarts, waits for /api/ready
BASE=http://127.0.0.1:8000 ADMIN_TOKEN='<token>' bash scripts/smoke_test.sh
```
Pass: script ends with "`/api/ready` is 200"; smoke prints "ALL SMOKE TESTS PASSED".

### Gate 4 — Public URL (on the instance)
Install `cloudflared` from Cloudflare's official repository, then follow DEPLOYMENT.md §8.1.
Pass: `sudo bash scripts/tunnel-url.sh` prints the URL and "`/api/ready -> 200`".

### Gate 5 — Frontend wiring (Vercel)
DEPLOYMENT.md §8.2: `VITE_API_BASE=<tunnel URL, no trailing slash>` on the **Preview** environment,
redeploy; CORS origin/regex in the env file; rerun the deploy script.
Pass: the Vercel app's header shows the live network (not mock mode), and the browser console has no CORS errors.

### Gate 6 — Manual test session
Run against the public URL first: `BASE=<tunnel URL> ADMIN_TOKEN=... bash scripts/smoke_test.sh`.
Then the UI checklist: dashboard + network load; each of the 3 presets; custom leak via sliders;
404/422 handling (unknown node, area 500); isolation plan; mobile width. v1.1 endpoints via curl/`/docs`.
Record for each: expected, actual, request ID (`X-Request-ID` header), pass/fail.

Teardown after each session: `sudo systemctl stop hydropulse-tunnel`; stop the instance from the console.
Restarting the tunnel later produces a **new** URL → repeat Gate 5.

## 4. Redeploying a change

```bash
cd /opt/hydropulse && sudo -u hydropulse git pull --ff-only && sudo bash scripts/deploy-hydropulse-host.sh
```
The tunnel keeps its URL; no Vercel change needed. Rollback: DEPLOYMENT.md §9.

## 5. The building-water audit plan, re-grounded in the code

`hydropulse_problem_statement_test_and_audit_plan.md` audits a **building** product (inlet flow meter,
tank level, leak-vs-legitimate-use classification, maintenance incidents). The code is a **district
network** pressure twin (5 pressure sentinels on a 129-junction DMA, burst localisation by
fingerprint). Its own §2 gate applies: building flow and tank monitoring must be marked
NOT IMPLEMENTED rather than inferred from the network features.

| Requirement (audit plan) | Code evidence | Status |
|---|---|---|
| Building inlet flow telemetry (L/min, sensor ID, quality) | `TelemetryPacket.measurement_type ∈ {pressure_m, flow_m3h, demand_lps}`; flow is per **network link** in m³/h; quality flags exist but source is `simulator`/`external_adapter` | PARTIAL (network link flow only; no building meter, no L/min, no cumulative-counter handling) |
| Tank level telemetry | No `tank_level` measurement type; tanks are only network nodes | NOT IMPLEMENTED |
| Continuous low-rate leak detection | Leak model is a Torricelli orifice of 0.5–100 cm² (≈ hundreds–thousands L/min); no persistence/baseline-floor detector | NOT IMPLEMENTED |
| Burst detection & localisation | `simulate_and_triangulate`; benchmark: top-1 51 %, top-3 85 % at 1.5 % noise (synthetic) | PASS (simulated, network scale) |
| Legitimate high use vs leak | No activity/schedule input; demand multiplier only in What-If | NOT IMPLEMENTED |
| Classes (`NORMAL_USAGE`, `LEGITIMATE_HIGH_USAGE`, `SENSOR_FAULT`, `INSUFFICIENT_DATA`, …) | None | NOT IMPLEMENTED |
| Confidence with defined meaning | `confidence_pct` = shape cosine; saturates at 100 % for all top-3, including wrong picks (finding 10) | FAIL — call it "match score" in UI copy until it is residual-based and calibrated |
| Sensor/telemetry health | Range checks, duplicate-sequence dedup, >24 h future/stale rejection | PARTIAL (no stuck-value, dropout, or clock-drift detection) |
| Evidence on alerts | Sensor readings, heatmap, candidates, compute time | PARTIAL (no activity context, data-quality block, detector/config version) |
| Maintenance workflow (ack/assign/resolve/label) | Two-phase auto-valve proposal/confirm, simulation only | NOT IMPLEMENTED (no incidents, no notifications) |
| Water-loss impact | `actual_loss_lpm`, tankers/day (simulated) | PARTIAL (no detection-delay or avoided-loss measurement) |
| Measured vs simulated data separated | `quality: SIMULATED`, `source_type`, `rul_available: false` | PASS |

### Recommended order if the team commits to the building scope
Each step is an additive contract change → SOURCE_OF_TRUTH.md §11 first (Hardhik approves), then
schemas (Gangu), backend (Hardhik), tests.

1. **Contract**: `BuildingReading` (site_id, sensor_id, sensor_type `flow_meter|tank_level`,
   observed_at with TZ, value, unit `L/min|percent|m`, quality, source) and `UsageAssessment`
   (classification enum from audit §3, `risk_score` 0–1 — *not* "probability" until calibrated —
   severity, data_quality, evidence[], detector_version, configuration_version).
2. **Deterministic detector v0** (pure functions, no ML): rolling baseline per site/time-of-week,
   persistence window for continuous leaks, finite-event detection with return-to-baseline, tank
   overflow rule (level ≥ high limit AND inflow continuing), sensor-fault rules first so bad data can
   never yield a high leak score.
3. **Scenario harness**: the audit plan's L/H/T/S/C tables as seeded generators labelled `SIMULATED`,
   one pytest per scenario ID, report JSON per run. H-01…H-10 must produce zero confirmed leaks; L-03 must alert.
4. **Incident workflow**: create / acknowledge / assign / resolve / label, in-memory + persisted like
   network state; notifications out of scope until a channel is chosen.
5. **UI** (Badri): flow + tank charts with SIMULATED badge, classification and evidence panel.

Do not start this inside the deployment PR. Ship the deployment (§3), then decide scope.

## 6. Decisions needed from owners

| Decision | Owner | Options |
|---|---|---|
| Route drift (finding 8) | Hardhik | Amend SOT §7.1 to served paths **or** add §7.1 aliases |
| Building scope (§5) | Team | Pivot/extend to building monitoring, or present as network-only with the gaps stated |
| `requirements.txt` split | Gangu | Keep, or add `requirements-dev.txt` and slim the host install |
| Staging `/docs` | Hardhik | Enable on the tunnel host for v1.1 manual tests, or curl only |
