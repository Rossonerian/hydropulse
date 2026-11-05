#!/usr/bin/env bash
# Install or update HydroPulse for the native Ubuntu systemd deployment.
# Run from a checked-out repository as root (for example: sudo ./scripts/deploy-hydropulse-host.sh).
set -euo pipefail

readonly SERVICE_USER="hydropulse"
readonly SERVICE_NAME="hydropulse.service"
readonly ENV_DIR="/etc/hydropulse"
readonly ENV_FILE="${ENV_DIR}/hydropulse.env"
readonly STATE_DIR="/var/lib/hydropulse"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd -P)"
readonly SERVICE_TEMPLATE="${REPO_ROOT}/deploy/systemd/hydropulse.service"
readonly ENV_TEMPLATE="${REPO_ROOT}/deploy/hydropulse.env.example"
readonly SERVICE_DESTINATION="/etc/systemd/system/${SERVICE_NAME}"
readonly VENV_DIR="${REPO_ROOT}/.venv"
readonly VENV_PYTHON="${VENV_DIR}/bin/python"

fail() {
    printf '%s\n' "error: $*" >&2
    exit 1
}

require_file() {
    local file="$1"
    [[ -f "${file}" ]] || fail "required file is missing: ${file}"
    [[ -r "${file}" ]] || fail "required file is not readable: ${file}"
}

env_value() {
    local name="$1"
    local line
    line="$(grep -E "^${name}=" "${ENV_FILE}" | tail -n 1 || true)"
    printf '%s' "${line#*=}" | tr -d '\r'
}

validate_base_configuration() {
    local environment host port reload cors cache_dir state_dir admin_auth admin_token

    environment="$(env_value HYDROPULSE_ENV)"
    host="$(env_value HYDROPULSE_HOST)"
    port="$(env_value HYDROPULSE_PORT)"
    reload="$(env_value HYDROPULSE_RELOAD)"
    cors="$(env_value HYDROPULSE_CORS_ORIGINS)"
    cache_dir="$(env_value HYDROPULSE_CACHE_DIR)"
    state_dir="$(env_value HYDROPULSE_STATE_DIR)"
    admin_auth="$(env_value HYDROPULSE_REQUIRE_ADMIN_AUTH)"
    admin_token="$(env_value HYDROPULSE_ADMIN_TOKEN)"

    [[ "${environment}" == "prod" ]] || fail "${ENV_FILE} must set HYDROPULSE_ENV=prod"
    [[ "${host}" == "127.0.0.1" ]] || fail "${ENV_FILE} must set HYDROPULSE_HOST=127.0.0.1"
    [[ "${port}" == "8000" ]] || fail "${ENV_FILE} must set HYDROPULSE_PORT=8000"
    [[ "${reload,,}" == "false" || "${reload}" == "0" ]] || fail "${ENV_FILE} must disable HYDROPULSE_RELOAD"
    [[ -n "${cors}" && "${cors}" != *"*"* ]] || fail "${ENV_FILE} must set explicit non-wildcard HYDROPULSE_CORS_ORIGINS"
    [[ "${cors}" != *"<"* && "${cors}" != *">"* && "${cors,,}" != *"replace"* ]] || fail "${ENV_FILE} still has a CORS placeholder"
    [[ "${cache_dir}" == "${STATE_DIR}" ]] || fail "${ENV_FILE} must set HYDROPULSE_CACHE_DIR=${STATE_DIR}"
    [[ "${state_dir}" == "${STATE_DIR}" ]] || fail "${ENV_FILE} must set HYDROPULSE_STATE_DIR=${STATE_DIR}"
    [[ "${admin_auth,,}" == "true" || "${admin_auth}" == "1" ]] || fail "${ENV_FILE} must enable HYDROPULSE_REQUIRE_ADMIN_AUTH"
    [[ ${#admin_token} -ge 8 && "${admin_token}" != *"REPLACE"* && "${admin_token}" != *"replace"* ]] || fail "${ENV_FILE} must contain an HYDROPULSE_ADMIN_TOKEN of at least 8 characters (not a placeholder)"
}

# System and prerequisite checks
[[ "${EUID}" -eq 0 ]] || fail "run this script as root"
[[ "$(uname -m)" == "x86_64" ]] || fail "this deployment supports x86_64 hosts only"
[[ -r /etc/os-release ]] || fail "cannot identify the host operating system"
# shellcheck disable=SC1091
. /etc/os-release
[[ "${ID:-}" == "ubuntu" && ( "${VERSION_ID:-}" == "22.04" || "${VERSION_ID:-}" == "24.04" ) ]] || fail "this deployment requires Ubuntu 22.04 or 24.04"

command -v systemctl >/dev/null 2>&1 || fail "systemd is required"
command -v curl >/dev/null 2>&1 || fail "curl is required (apt install -y curl)"

# Ubuntu 24.04 ships Python 3.12 (python3.11 needs a third-party PPA). SOURCE_OF_TRUTH.md §3
# allows 3.10-3.12, so prefer 3.11 when present and otherwise use the distro's 3.12.
PYTHON_BIN=""
for candidate in python3.11 python3.12; do
    if command -v "${candidate}" >/dev/null 2>&1; then
        PYTHON_BIN="${candidate}"
        break
    fi
done
[[ -n "${PYTHON_BIN}" ]] || fail "python3.11 or python3.12 is required (apt install -y python3.12 python3.12-venv)"
"${PYTHON_BIN}" -c 'import ensurepip, venv' 2>/dev/null || fail "${PYTHON_BIN} venv support missing (apt install -y ${PYTHON_BIN}-venv)"
readonly PYTHON_BIN

# Repository file checks
require_file "${REPO_ROOT}/requirements.txt"
require_file "${REPO_ROOT}/backend/main.py"
require_file "${SERVICE_TEMPLATE}"
require_file "${ENV_TEMPLATE}"

# Create service user if missing (idempotent)
if ! id -u "${SERVICE_USER}" >/dev/null 2>&1; then
    useradd --system --user-group --home-dir "${STATE_DIR}" --shell /usr/sbin/nologin "${SERVICE_USER}"
fi

# Create persistent state directory (idempotent)
install -d -o "${SERVICE_USER}" -g "${SERVICE_USER}" -m 0750 "${STATE_DIR}"

# Create environment directory (idempotent)
install -d -o root -g root -m 0755 "${ENV_DIR}"

# Create env file from template on first run (idempotent)
if [[ ! -e "${ENV_FILE}" ]]; then
    install -o root -g root -m 0600 "${ENV_TEMPLATE}" "${ENV_FILE}"
    fail "created ${ENV_FILE} from template; set HYDROPULSE_CORS_ORIGINS and HYDROPULSE_ADMIN_TOKEN to real values and rerun"
fi

# Ensure env file is properly owned and secured (idempotent)
[[ -f "${ENV_FILE}" ]] || fail "${ENV_FILE} exists but is not a regular file"
chown root:root "${ENV_FILE}"
chmod 0600 "${ENV_FILE}"

# Validate base non-secret configuration
validate_base_configuration

# Create or update venv (idempotent)
if [[ ! -x "${VENV_PYTHON}" ]]; then
    rm -rf -- "${VENV_DIR}"
    "${PYTHON_BIN}" -m venv "${VENV_DIR}"
fi
chown -R "${SERVICE_USER}:${SERVICE_USER}" "${VENV_DIR}"
runuser -u "${SERVICE_USER}" -- "${VENV_PYTHON}" -m pip install --upgrade pip
runuser -u "${SERVICE_USER}" -- "${VENV_PYTHON}" -m pip install --requirement "${REPO_ROOT}/requirements.txt"

# Validate the full configuration with the backend's own loader before touching the running
# service, so a bad value (e.g. an over-broad CORS regex) fails here instead of in a restart loop.
(cd "${REPO_ROOT}" && "${VENV_PYTHON}" - "${ENV_FILE}" <<'PY'
import sys
from backend.config import load_config

env = {}
with open(sys.argv[1], encoding="utf-8") as fh:
    for raw in fh:
        line = raw.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "'\"":
                value = value[1:-1]  # systemd EnvironmentFile strips matching quotes too
            env[key.strip()] = value
summary = load_config(env).safe_summary()
print("config OK:", {k: summary[k] for k in ("env", "cors_origins", "cors_origin_regex", "require_admin_auth", "docs_enabled", "openrouter_api_key_configured")})
PY
) || fail "backend configuration validation failed; fix ${ENV_FILE} and rerun"

# Install systemd service template (idempotent)
install -o root -g root -m 0644 "${SERVICE_TEMPLATE}" "${SERVICE_DESTINATION}"
systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"

# Wait for the hydraulic twin to finish booting (cold matrix build takes ~10-60 s).
printf '%s' "waiting for /api/ready "
for _ in $(seq 1 90); do
    if curl -fsS --max-time 3 http://127.0.0.1:8000/api/ready >/dev/null 2>&1; then
        printf '\n%s\n' "HydroPulse deployment completed: /api/ready is 200."
        exit 0
    fi
    systemctl is-active --quiet "${SERVICE_NAME}" || { journalctl -u "${SERVICE_NAME}" -n 40 --no-pager >&2; fail "${SERVICE_NAME} exited during boot"; }
    printf '.'
    sleep 2
done
journalctl -u "${SERVICE_NAME}" -n 40 --no-pager >&2
fail "service is running but /api/ready did not return 200 within 180 s"
