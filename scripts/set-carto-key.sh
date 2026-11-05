#!/usr/bin/env bash
# Store the CARTO API key in /etc/hydropulse/hydropulse.env and finish the deployment.
# Run ON THE HOST from the repo root:   sudo bash scripts/set-carto-key.sh
# The key is typed at a hidden prompt (or piped via stdin); it is never echoed, logged, put on a
# command line, or written anywhere except the root-only env file (mode 0600).
set -euo pipefail
umask 077

readonly ENV_FILE="/etc/hydropulse/hydropulse.env"
readonly REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly VAR="HYDROPULSE_CARTO_API_KEY"

fail() { printf 'error: %s\n' "$*" >&2; exit 1; }

[[ "${EUID}" -eq 0 ]] || fail "run with sudo: sudo bash scripts/set-carto-key.sh"
[[ -f "${ENV_FILE}" ]] || fail "${ENV_FILE} not found; run scripts/deploy-hydropulse-host.sh once first"

# Read the key without echo. A pipe also works:  printf '%s' "$KEY" | sudo bash scripts/set-carto-key.sh
if [[ -t 0 ]]; then
    read -r -s -p "Paste CARTO API key (input hidden): " KEY; echo
    read -r -s -p "Paste it again to confirm:          " KEY2; echo
    [[ "${KEY}" == "${KEY2}" ]] || fail "the two entries do not match; nothing was changed"
    unset KEY2
else
    IFS= read -r KEY || true
fi

KEY="${KEY%$'\r'}"
[[ -n "${KEY}" ]]                  || fail "empty key; nothing was changed"
[[ "${#KEY}" -ge 8 ]]              || fail "key looks too short; nothing was changed"
[[ "${KEY}" != *[[:space:]]* ]]    || fail "key must not contain whitespace; nothing was changed"
[[ "${KEY}" != *[\"\'\\\$\`]* ]]   || fail "key must not contain quotes, backslashes, \$ or backticks (systemd EnvironmentFile); nothing was changed"

# Rewrite the env file atomically: replace an existing (or commented) line, else append.
TMP="$(mktemp "${ENV_FILE}.XXXXXX")"
trap 'rm -f -- "${TMP}"' EXIT
export CARTO_NEW_VALUE="${KEY}"
awk -v var="${VAR}" '
    BEGIN { done = 0; line = var "=" ENVIRON["CARTO_NEW_VALUE"] }
    $0 ~ "^" var "=" || $0 ~ "^#[[:space:]]*" var "=" {
        if (!done) { print line; done = 1 }
        next
    }
    { print }
    END { if (!done) print line }
' "${ENV_FILE}" > "${TMP}"
unset CARTO_NEW_VALUE KEY
chown root:root "${TMP}"
chmod 0600 "${TMP}"
mv -f -- "${TMP}" "${ENV_FILE}"
trap - EXIT
echo "ok: ${VAR} stored in ${ENV_FILE} (mode $(stat -c '%a' "${ENV_FILE}"), value not shown)"

# Finish the deployment: validates the config, restarts, waits for /api/ready.
cd "${REPO_ROOT}"
bash scripts/deploy-hydropulse-host.sh

# Confirm the backend sees the key (health reports only a boolean, never the value).
health="$(curl -fsS --max-time 10 http://127.0.0.1:8000/api/health || true)"
if grep -q '"basemap_proxy": *true' <<<"${health}"; then
    echo "ok: basemap proxy is enabled (health.basemap_proxy=true)"
elif grep -q 'basemap_proxy' <<<"${health}"; then
    echo "warning: the backend started but basemap_proxy is false; check the key and HYDROPULSE_CARTO_* settings" >&2
else
    echo "note: this backend build has no basemap proxy yet (CARTO proxy PR not deployed); the key is stored and will be used once it is" >&2
fi
echo "Done."
