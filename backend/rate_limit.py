"""In-memory, per-client-IP sliding-window rate limiter for AI endpoints.

Used as a FastAPI dependency on ``POST /api/ai/chat`` and ``GET /api/ai/suggestions``.

- Window: 60 seconds (sliding, measured with ``time.monotonic``).
- Limit: ``HYDROPULSE_AI_RATE_LIMIT_PER_MIN`` (default 20). Read on every request so
  tests and operators can change it without re-importing the app. Non-integer or
  non-positive values fall back to the default.
- State is process-local. Multiple workers each keep their own counters.
- Over the limit: HTTP 429 with ``{"detail": "Rate limit exceeded"}``.
"""

from __future__ import annotations

import logging
import os
import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

log = logging.getLogger("hydropulse.rate_limit")

RATE_LIMIT_ENV = "HYDROPULSE_AI_RATE_LIMIT_PER_MIN"
DEFAULT_LIMIT_PER_MIN = 20
WINDOW_SECONDS = 60.0

_lock = threading.Lock()
_hits: dict[str, deque[float]] = defaultdict(deque)


def get_limit_per_min() -> int:
    """Return the configured requests-per-minute limit for each client IP."""
    raw = os.environ.get(RATE_LIMIT_ENV, "").strip()
    if not raw:
        return DEFAULT_LIMIT_PER_MIN
    try:
        value = int(raw)
    except ValueError:
        log.warning("Invalid %s=%r; using default %d", RATE_LIMIT_ENV, raw, DEFAULT_LIMIT_PER_MIN)
        return DEFAULT_LIMIT_PER_MIN
    if value < 1:
        log.warning("Non-positive %s=%r; using default %d", RATE_LIMIT_ENV, raw, DEFAULT_LIMIT_PER_MIN)
        return DEFAULT_LIMIT_PER_MIN
    return value


def reset_rate_limiter() -> None:
    """Clear all recorded hits. Intended for tests."""
    with _lock:
        _hits.clear()


def enforce_ai_rate_limit(request: Request) -> None:
    """FastAPI dependency: record this request for the client IP or raise 429."""
    limit = get_limit_per_min()
    client_ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    cutoff = now - WINDOW_SECONDS

    with _lock:
        hits = _hits[client_ip]
        while hits and hits[0] <= cutoff:
            hits.popleft()
        if len(hits) >= limit:
            raise HTTPException(status_code=429, detail="Rate limit exceeded")
        hits.append(now)
