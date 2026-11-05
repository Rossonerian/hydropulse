#!/usr/bin/env bash
# Print the public URL of the running HydroPulse Cloudflare Quick Tunnel and check it end-to-end.
# Usage (on the EC2 host): sudo bash scripts/tunnel-url.sh
set -euo pipefail

readonly UNIT="hydropulse-tunnel.service"

systemctl is-active --quiet "${UNIT}" || { echo "error: ${UNIT} is not running (sudo systemctl start ${UNIT})" >&2; exit 1; }

# Only consider log lines since the unit last started: an older URL from a previous run is dead.
since="$(systemctl show -p ActiveEnterTimestamp --value "${UNIT}")"
url="$(journalctl -u "${UNIT}" --since "${since}" --no-pager -o cat \
    | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -n 1 || true)"

[[ -n "${url}" ]] || { echo "error: no trycloudflare URL in the log yet; wait a few seconds and retry" >&2; exit 1; }

echo "Tunnel URL: ${url}"
if curl -fsS --max-time 10 "${url}/api/ready" >/dev/null; then
    echo "Check:      ${url}/api/ready -> 200"
else
    echo "warning: ${url}/api/ready did not return 200 yet (DNS for a new tunnel can take ~30 s)" >&2
fi
echo
echo "Next: set Vercel env VITE_API_BASE=${url} (no trailing slash) and redeploy the frontend."
