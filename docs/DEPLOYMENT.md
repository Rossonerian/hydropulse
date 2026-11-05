# HydroPulse Backend — AWS EC2 Host Deployment Guide

This document covers production deployment on AWS EC2 (Ubuntu 24.04 LTS or 22.04 LTS x86_64, Python 3.12 from the distro, or 3.11 if installed) using systemd service management, native virtual environment, and Git-based rollback. The backend runs as a single-worker Uvicorn process bound to loopback only, with secrets stored in `/etc/hydropulse/hydropulse.env` (mode 0600) and persistence in `/var/lib/hydropulse`.

---

## 1. Prerequisites

### EC2 Instance Requirements

- **OS**: Ubuntu 24.04 LTS or 22.04 LTS x86_64 (the deploy script requires Ubuntu 22.04 or 24.04 x86_64)
- **Instance type**: `t3.small` (2 vCPU, 2 GiB) is free-tier eligible on AWS accounts created on or after
  15 July 2025 and is the recommended size. `t3.micro` (1 GiB) works for the API (~270 MB RSS measured
  on the Kengeri network) but add 2 GiB of swap before `pip install`. Confirm what *your* account allows:
  `aws ec2 describe-instance-types --filters Name=free-tier-eligible,Values=true --query "InstanceTypes[*].InstanceType" --output text`
- **Python**: Ubuntu 24.04 ships **3.12** (`python3.11` is not in the 24.04 archive). The deploy script
  uses `python3.11` if present, otherwise `python3.12`. CI runs the full suite on both.
- **Security group**: inbound **SSH (22) from your own IP only**. Do **not** open 8000: Uvicorn binds to
  127.0.0.1 and the Cloudflare tunnel is an *outbound* connection, so no other inbound rule is needed.
- **Storage**: 10–20 GB gp3 for repository, venv, sensitivity-matrix cache and persisted state.
- **Cost caution**: AWS bills public IPv4 addresses hourly (on the Free account plan this draws down your
  credits). Stop the instance when no one is testing. Do not add a NAT gateway or load balancer for
  staging; both cost far more than the instance.

### System Packages

```bash
sudo apt update
sudo apt install -y python3.12 python3.12-venv git curl  # or python3.11 python3.11-venv on Ubuntu 22.04
# t3.micro only: add swap so pip/scipy installs and the cold matrix build do not OOM
# sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
# echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Service User

Create a dedicated non-root service user for running the HydroPulse backend:

```bash
sudo useradd --system --shell /usr/sbin/nologin --home /var/lib/hydropulse hydropulse
sudo mkdir -p /var/lib/hydropulse
sudo chown hydropulse:hydropulse /var/lib/hydropulse
sudo chmod 750 /var/lib/hydropulse
```

---

## 2. Repository Checkout and Virtual Environment

Clone the repository to `/opt/hydropulse` (replace with your Git source):

```bash
sudo mkdir -p /opt/hydropulse
sudo chown hydropulse:hydropulse /opt/hydropulse
sudo -u hydropulse git clone <repository-url> /opt/hydropulse
cd /opt/hydropulse

# Run the deployment script (creates .venv, sets up service, validates configuration)
sudo bash scripts/deploy-hydropulse-host.sh
```

---

## 3. Secret Configuration

### Secret File Location

All secrets must be stored in `/etc/hydropulse/hydropulse.env` with restrictive permissions:

```bash
sudo mkdir -p /etc/hydropulse
sudo touch /etc/hydropulse/hydropulse.env
sudo chmod 600 /etc/hydropulse/hydropulse.env
sudo chown root:root /etc/hydropulse/hydropulse.env
```

### Required Environment Variables

Edit `/etc/hydropulse/hydropulse.env` with production values:

```bash
# Runtime environment
HYDROPULSE_ENV=prod

# Uvicorn bind address (loopback only - no public binding)
HYDROPULSE_HOST=127.0.0.1
HYDROPULSE_PORT=8000
HYDROPULSE_LOG_LEVEL=INFO

# Auto-reload MUST be false in production
HYDROPULSE_RELOAD=false

# CORS origins: REPLACE with exact deployed frontend origin before starting
# Wildcard (*) is forbidden in prod. Fail-closed if misconfigured.
HYDROPULSE_CORS_ORIGINS=https://frontend.example.invalid

# Admin authentication for mutating endpoints
HYDROPULSE_REQUIRE_ADMIN_AUTH=true
HYDROPULSE_ADMIN_TOKEN=<generate-strong-random-token-at-least-8-chars>

# Persistence directories (durable storage in /var/lib/hydropulse)
HYDROPULSE_STATE_DIR=/var/lib/hydropulse
HYDROPULSE_CACHE_DIR=/var/lib/hydropulse
HYDROPULSE_PERSIST_ACTIVE_STATE=true

# Network data paths (relative to repo root)
HYDROPULSE_INP=backend/bangalore_kengeri.inp
HYDROPULSE_META=backend/network_meta.json
HYDROPULSE_PRESETS=data_utils/presets.json

# Optional OpenRouter API key (leave unset to disable AI enrichment)
OPENROUTER_API_KEY=
```

**Critical**: Replace `https://frontend.example.invalid` with the exact deployed frontend origin (e.g., `https://app.yourdomain.com`) before starting the service. Incorrect CORS configuration will block all frontend requests.

### Non-Secret Template

A root-owned, non-secret template is available at `deploy/hydropulse.env.example` for reference. Do not store secrets in this file.

---

## 4. Systemd Service Installation

Install the systemd service unit from `deploy/systemd/hydropulse.service`:

The deployment script automatically installs the systemd service. If installing manually without the script:

```bash
sudo cp /opt/hydropulse/deploy/systemd/hydropulse.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable hydropulse.service
```

The service unit configures:
- **User**: `hydropulse` (non-root system user)
- **WorkingDirectory**: `/opt/hydropulse`
- **EnvironmentFile**: `/etc/hydropulse/hydropulse.env`
- **ExecStart**: python -m uvicorn with `--workers 1 --host 127.0.0.1 --port 8000 --no-access-log`
- **Restart**: `on-failure` with 5-second delay
- **RestartSec**: 5 seconds
- **StandardOutput/StandardError**: journal

---

## 5. Deployment Script

Use the provided deployment script `scripts/deploy-hydropulse-host.sh` to automate checkout, venv setup, and service installation:

```bash
cd /opt/hydropulse
sudo bash scripts/deploy-hydropulse-host.sh
```

The script performs:
1. Validates Ubuntu 22.04 or 24.04 x86_64, Python 3.11/3.12 with venv support, curl, and systemd
2. Creates the `hydropulse` service user and `/var/lib/hydropulse` persistent directory
3. Creates `/etc/hydropulse/hydropulse.env` from template on first run (exits for operator to add secrets)
4. Validates base configuration including rejection of CORS placeholder values
5. Creates or updates the virtual environment (`.venv` in repository root)
6. Installs dependencies from `requirements.txt`
7. Validates the full env file with the backend's own `load_config()` (fails before restarting the service)
8. Installs, enables and restarts the systemd service unit
9. Waits up to 180 s for `GET /api/ready` to return 200 and prints recent logs if it does not

All operations are idempotent; the script can be rerun safely after updating the repository or configuration.


---

## 6. Service Management

### Start the Service

```bash
sudo systemctl start hydropulse.service
```

### Check Service Status

```bash
sudo systemctl status hydropulse.service
```

### View Service Logs

```bash
sudo journalctl -u hydropulse.service -f
```

### Stop the Service

```bash
sudo systemctl stop hydropulse.service
```

### Restart the Service

```bash
sudo systemctl restart hydropulse.service
```

---

## 7. Health and Readiness Verification

### Liveness Check

The service listens on loopback only (127.0.0.1:8000). Verify from the host:

```bash
curl -sSf http://127.0.0.1:8000/api/health | python3 -m json.tool
```

Expected response includes:
- `status: "ok"`
- `network_name`
- `num_junctions`
- `num_pipes`
- `sensor_ids`
- `matrix_ready`
- `network_revision`
- `source`
- `can_rollback`

### Readiness Check

```bash
curl -sSf http://127.0.0.1:8000/api/ready | python3 -m json.tool
```

Returns HTTP `200` with `status: "ready"` when the hydraulic baseline and sensitivity matrix are fully computed. Returns HTTP `503` during initialization.

---

## 8. Public Staging URL (Cloudflare Quick Tunnel) and Vercel Wiring

For manual testing without a domain, expose the loopback-only API through a Cloudflare Quick Tunnel.
The tunnel dials **out** from the instance, so no inbound security-group rule is needed.

### 8.1 Install cloudflared and the tunnel unit

Install `cloudflared` from Cloudflare's official package repository or `.deb` release (see Cloudflare's
docs), confirm `/usr/bin/cloudflared --version` works, then:

```bash
sudo install -o root -g root -m 0644 /opt/hydropulse/deploy/systemd/hydropulse-tunnel.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now hydropulse-tunnel.service
sudo bash /opt/hydropulse/scripts/tunnel-url.sh     # prints https://<words>.trycloudflare.com and checks /api/ready
```

The unit uses `Wants=` (not `Requires=`) on `hydropulse.service`, so redeploying the backend does **not**
restart the tunnel. The URL changes only when the tunnel unit restarts or the instance reboots.

### 8.2 Point the Vercel frontend at the tunnel

1. Vercel → Project → Settings → Environment Variables: set `VITE_API_BASE` to the tunnel URL
   **without a trailing slash** (a trailing slash produces `//api/...` → 404). Scope it to the
   environment you are testing (Preview is safer than Production for first runs).
2. Redeploy: Vite inlines `VITE_*` at build time, so the change has no effect until a new build.
3. Put the exact frontend origin(s) in `/etc/hydropulse/hydropulse.env`:
   `HYDROPULSE_CORS_ORIGINS=https://<your-project>.vercel.app` (comma-separate several). For rotating
   Preview URLs, also set an anchored, team-pinned regex, written **without backslashes** so systemd,
   bash and Python all read it identically:
   `HYDROPULSE_CORS_ORIGIN_REGEX=^https://<project>-[a-z0-9-]+-<team>[.]vercel[.]app$`
   Over-broad patterns (any `*.vercel.app`, any tunnel, `.*`) are rejected at boot.
4. Rerun `sudo bash scripts/deploy-hydropulse-host.sh` (validates and restarts; the tunnel URL is kept).

### 8.3 Verify through the public URL

```bash
URL=https://<words>.trycloudflare.com
curl -fsS "$URL/api/ready"
# CORS preflight as the browser will send it
curl -si -X OPTIONS "$URL/api/simulate-leak" -H "Origin: https://<your-project>.vercel.app" \
     -H "Access-Control-Request-Method: POST" | grep -i access-control-allow-origin
# Full smoke test (ADMIN_TOKEN is required in prod for the IoT demo tick and auto-valve steps)
BASE="$URL" ADMIN_TOKEN='<value from /etc/hydropulse/hydropulse.env>' bash scripts/smoke_test.sh
```

**What testers can and cannot do through the UI.** The deployed frontend calls only the v1.0 endpoints
(`/api/health`, `/api/network`, `/api/presets`, `/api/simulate-leak`, `/api/isolate`), none of which
need the admin token. The v1.1 endpoints are not wired into the UI yet; test them with `curl`, or set
`HYDROPULSE_DOCS_ENABLED=true` on a short-lived staging host to use `/docs`. Never put the admin token
in a `VITE_*` variable — anything in the bundle is public.

**Limitations**: random URL with no uptime guarantee, no access control in front of the public read and
simulation endpoints, and no rate limiting. Stop the tunnel (`sudo systemctl stop hydropulse-tunnel`)
when testing ends. For anything longer-lived, use a named Cloudflare Tunnel on a domain you own.

---

## 9. Rollback and Recovery

### Git-Based Rollback

To rollback to a previous Git revision:

```bash
cd /opt/hydropulse
sudo -u hydropulse git log --oneline -10
sudo -u hydropulse git checkout <revision-hash>
sudo bash scripts/deploy-hydropulse-host.sh   # reinstalls deps for that revision and waits for /api/ready
```

To return to the latest code: `sudo -u hydropulse git checkout main && sudo -u hydropulse git pull --ff-only`
then rerun the deploy script.

The persisted state in `/var/lib/hydropulse` survives across restarts. If you need to reset the active network to baseline:

```bash
curl -X POST http://127.0.0.1:8000/api/network/reset \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: <HYDROPULSE_ADMIN_TOKEN>" \
  -d '{"target": "baseline", "confirm": true}'
```

### Recovery from Corrupted State

If the persisted state is corrupted:

```bash
sudo systemctl stop hydropulse.service
sudo rm -rf /var/lib/hydropulse/*
sudo systemctl start hydropulse.service
```

The service will boot with the baseline Kengeri DMA network.

### Restore from Backup

If you have a backup of `/var/lib/hydropulse`:

```bash
sudo systemctl stop hydropulse.service
sudo tar xzf /path/to/hydropulse-backup.tar.gz -C /
sudo systemctl start hydropulse.service
```

---

## 10. Diagnostics

### Check Service Logs for Errors

```bash
sudo journalctl -u hydropulse.service --since "1 hour ago" | grep -i error
```

### Validate Configuration

`load_config()` reads the process environment, so load the env file into it first (as root, because the
file is mode 0600):

```bash
cd /opt/hydropulse
sudo bash -c 'set -a; . /etc/hydropulse/hydropulse.env; set +a; .venv/bin/python -c "from backend.config import load_config; print(load_config().safe_summary())"'
```

### Verify File Permissions

```bash
ls -la /etc/hydropulse/hydropulse.env  # Should be mode 600, root:root
ls -la /var/lib/hydropulse             # Should be mode 750, hydropulse:hydropulse
```

### Check Sensitivity Matrix Cache

```bash
ls -la /var/lib/hydropulse/
```

---

## 11. Security Boundaries

### Network Exposure

- **Uvicorn binds to 127.0.0.1:8000 only** — no public interface binding
- Frontend access requires a reverse proxy (nginx, Apache) or ALB terminating TLS and forwarding to loopback
- Quick Tunnel is temporary and must not be used for production

### Secret Management

- All secrets in `/etc/hydropulse/hydropulse.env` (mode 0600, root:root)
- Never store secrets in the repository or in `.env` files
- `HYDROPULSE_ADMIN_TOKEN` and `OPENROUTER_API_KEY` are never exposed to the browser or logs

### Service Isolation

- Service runs as non-root user `hydropulse`
- Home directory is `/var/lib/hydropulse` (no shell access)
- Systemd provides process isolation and resource limits

### CORS Enforcement

- `HYDROPULSE_CORS_ORIGINS` must be exact; wildcard `*` is rejected in `prod`
- Fail-closed: incorrect CORS origin blocks all frontend requests
- Replace placeholder `https://frontend.example.invalid` before starting

### Admin Authentication

- Mutating endpoints require `HYDROPULSE_REQUIRE_ADMIN_AUTH=true`
- Admin token sent via `Authorization: Bearer <token>` or `X-Admin-Token: <token>`
- Constant-time comparison prevents timing attacks

---

## 12. Persistence and Cache Locations

### Directories

- **Active State**: `/var/lib/hydropulse/` — `active_network.inp`, `active_state.json`
- **Sensitivity Matrix Cache**: `/var/lib/hydropulse/` — `sensitivity_matrix.npy`, `.x.npy` sidecars
- **Repository**: `/opt/hydropulse/` — source code, network data files

### Atomic Writes

State files are written atomically via temporary file + `os.replace` to prevent corruption during crashes.

### Backup Strategy

Schedule regular backups of `/var/lib/hydropulse` and `/etc/hydropulse/hydropulse.env`:

```bash
sudo tar czf /backup/hydropulse-$(date +%Y%m%d).tar.gz \
  /var/lib/hydropulse /etc/hydropulse/hydropulse.env
```

---

## 13. Runtime Configuration Reference

For a complete environment variable reference, see `.env.example` in the repository root. Key production variables:

| Variable | Production Value | Description |
| :--- | :--- | :--- |
| `HYDROPULSE_ENV` | `prod` | Runtime environment |
| `HYDROPULSE_HOST` | `127.0.0.1` | Loopback-only binding |
| `HYDROPULSE_PORT` | `8000` | TCP port |
| `HYDROPULSE_RELOAD` | `false` | Auto-reload forbidden |
| `HYDROPULSE_CORS_ORIGINS` | **exact frontend origin** | No wildcard in prod |
| `HYDROPULSE_CORS_ORIGIN_REGEX` | *(optional)* anchored, team-pinned | For rotating Vercel Preview URLs; §8.2 |
| `HYDROPULSE_DOCS_ENABLED` | `false` (staging: optional `true`) | Swagger UI at `/docs` |
| `HYDROPULSE_REQUIRE_ADMIN_AUTH` | `true` | Admin token required |
| `HYDROPULSE_ADMIN_TOKEN` | **secret** | >= 8 characters |
| `HYDROPULSE_PERSIST_ACTIVE_STATE` | `true` | Persist across restarts |
| `HYDROPULSE_STATE_DIR` | `/var/lib/hydropulse` | Durable state |
| `HYDROPULSE_CACHE_DIR` | `/var/lib/hydropulse` | Sensitivity matrix |
| `OPENROUTER_API_KEY` | *(optional)* | AI enrichment |

---

## 14. Troubleshooting

### Service Fails to Start

1. Check logs: `sudo journalctl -u hydropulse.service -n 50`
2. Validate configuration: rerun `sudo bash scripts/deploy-hydropulse-host.sh` — it validates `/etc/hydropulse/hydropulse.env` with `load_config()` and prints the error. (Running `load_config()` by hand as the `hydropulse` user does *not* read the env file, so it validates dev defaults instead.)
3. Verify environment file permissions: `ls -la /etc/hydropulse/hydropulse.env`
4. Ensure the venv exists at `/opt/hydropulse/.venv` and dependencies are installed (the deploy script does both)

### CORS Errors in Frontend

1. Verify `HYDROPULSE_CORS_ORIGINS` matches the exact frontend origin
2. Check that the placeholder `https://frontend.example.invalid` has been replaced
3. Restart the service after updating `/etc/hydropulse/hydropulse.env`

### Health Check Returns 503

1. Wait for sensitivity matrix initialization (may take up to 60 seconds on cold start)
2. Check logs for WNTR simulation errors
3. Verify `backend/bangalore_kengeri.inp` exists and is readable

### Permission Denied Errors

1. Verify `/var/lib/hydropulse` is owned by `hydropulse:hydropulse` with mode 750
2. Verify `/etc/hydropulse/hydropulse.env` is owned by `root:root` with mode 600
3. Check that the service user has read access to repository files

---

## 15. OpenRouter Integration (Optional)

When `OPENROUTER_API_KEY` is set, the backend enriches AI suggestions via OpenRouter. If unset or rate-limited, the API returns deterministic engineering rationale without errors. OpenRouter is the sole external AI integration; direct provider URLs are blocked at startup.

OpenRouter configuration in `/etc/hydropulse/hydropulse.env`:

```bash
OPENROUTER_API_KEY=sk-or-v1-...
HYDROPULSE_OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free
HYDROPULSE_OPENROUTER_TIMEOUT_S=4.0
HYDROPULSE_OPENROUTER_CONNECT_TIMEOUT_S=2.0
HYDROPULSE_OPENROUTER_MAX_RETRIES=1
```

---

## 16. Performance Notes

- **Single-worker process** required due to in-memory hydraulic state and telemetry ring buffers
- **Warm startup** (cached sensitivity matrix): ~371 ms
- **Cold startup** (matrix build): ~10.5 seconds
- **Peak memory**: ~611 MB RSS
- **Latency targets**: Health/ready < 50 ms, network fetch < 100 ms, simulations < 1,000 ms

These metrics are based on the Kengeri DMA network (129 junctions, 168 pipes, 5 sensors).

---

## 17. Migration from Container Deployment

If migrating from a previous container-based deployment:

1. Export container state: `docker cp hydropulse-backend:/app/backend/.state /tmp/hydropulse-state-backup`
2. Stop and remove containers: `docker stop hydropulse-backend && docker rm hydropulse-backend`
3. Follow this guide to deploy the systemd service
4. Restore state: `sudo cp -r /tmp/hydropulse-state-backup/* /var/lib/hydropulse/`
5. Verify ownership: `sudo chown -R hydropulse:hydropulse /var/lib/hydropulse`
6. Start the service: `sudo systemctl start hydropulse.service`
---

This guide covers the complete deployment lifecycle for HydroPulse on AWS EC2 with systemd management. For questions or issues, consult the repository README or open an issue in the project tracker.
