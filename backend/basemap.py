"""CARTO basemap tile proxy service.

The CARTO API key lives only in the backend environment. The browser asks this
service for tiles; the service adds the key to the upstream request, caches the
bytes (bounded LRU + TTL) and returns plain image bytes. The key, the upstream
query string and upstream error bodies are never returned or logged.

CARTO docs (https://docs.carto.com/faqs/carto-basemaps) pass the key as the
``key`` query parameter on ``https://basemaps.cartocdn.com/rastertiles/<style>/{z}/{x}/{y}.png``.
The URL template, auth mode (none|bearer|query) and parameter name are
configurable (see backend/config.py).
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections import OrderedDict
from typing import Literal

import httpx

from backend.config import BackendConfig

log = logging.getLogger("hydropulse.basemap")

Style = Literal["dark", "light"]
STYLE_MAP: dict[str, str] = {"dark": "dark_all", "light": "light_all"}
MAX_ZOOM = 19
MAX_TILE_BYTES = 1_048_576
CONCURRENCY = 8


class BasemapError(Exception):
    """Raised with an HTTP status and a plain, key-free detail string."""

    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


class BasemapService:
    def __init__(self, cfg: BackendConfig, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._cfg = cfg
        self._transport = transport
        self._cache: OrderedDict[tuple[str, int, int, int], tuple[float, bytes, str]] = OrderedDict()
        self._sem = asyncio.Semaphore(CONCURRENCY)
        self.upstream_calls = 0

    @property
    def enabled(self) -> bool:
        return self._cfg.basemap_proxy_enabled

    @staticmethod
    def validate(style: str, z: int, x: int, y: int) -> None:
        if style not in STYLE_MAP:
            raise BasemapError(404, "Unknown basemap style")
        if not (0 <= z <= MAX_ZOOM):
            raise BasemapError(422, "Zoom out of range")
        if not (0 <= x < 2**z and 0 <= y < 2**z):
            raise BasemapError(404, "Tile coordinates out of range")

    def _cache_get(self, key: tuple[str, int, int, int]) -> tuple[bytes, str] | None:
        hit = self._cache.get(key)
        if hit is None:
            return None
        expires, data, ctype = hit
        if expires < time.monotonic():
            self._cache.pop(key, None)
            return None
        self._cache.move_to_end(key)
        return data, ctype

    def _cache_put(self, key: tuple[str, int, int, int], data: bytes, ctype: str) -> None:
        self._cache[key] = (time.monotonic() + self._cfg.basemap_cache_ttl_s, data, ctype)
        self._cache.move_to_end(key)
        while len(self._cache) > self._cfg.basemap_cache_max_tiles:
            self._cache.popitem(last=False)

    async def get_tile(self, style: str, z: int, x: int, y: int) -> tuple[bytes, str]:
        self.validate(style, z, x, y)
        if not self.enabled:
            raise BasemapError(404, "Basemap proxy not configured")
        key = (style, z, x, y)
        cached = self._cache_get(key)
        if cached:
            return cached
        cfg = self._cfg
        try:
            url = cfg.carto_tile_url.format(style=STYLE_MAP[style], z=z, x=x, y=y)
        except (KeyError, IndexError, ValueError):
            raise BasemapError(502, "Basemap upstream misconfigured") from None
        params: dict[str, str] = {}
        headers: dict[str, str] = {}
        if cfg.carto_auth_mode == "query":
            params[cfg.carto_auth_param] = cfg.carto_api_key or ""
        elif cfg.carto_auth_mode == "bearer":
            headers["Authorization"] = f"Bearer {cfg.carto_api_key}"
        async with self._sem:
            try:
                async with httpx.AsyncClient(
                    transport=self._transport,
                    timeout=httpx.Timeout(6.0, connect=3.0),
                    follow_redirects=False,
                ) as client:
                    self.upstream_calls += 1
                    resp = await client.get(url, params=params, headers=headers)
            except Exception as exc:  # never include str(exc): it can contain the URL and key
                log.warning("basemap upstream request failed: %s", type(exc).__name__)
                raise BasemapError(502, "Basemap upstream unavailable") from None
        if resp.status_code == 404:
            raise BasemapError(404, "Tile not found")
        ctype = resp.headers.get("content-type", "")
        if resp.status_code != 200 or not ctype.startswith("image/") or len(resp.content) > MAX_TILE_BYTES:
            log.warning("basemap upstream rejected tile: status=%s", resp.status_code)
            raise BasemapError(502, "Basemap upstream unavailable")
        self._cache_put(key, resp.content, ctype)
        return resp.content, ctype
