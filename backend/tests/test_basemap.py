"""CARTO basemap proxy: key stays server-side, bounded cache, strict validation."""
from __future__ import annotations

import logging
import os
from dataclasses import replace

os.environ.setdefault("HYDROPULSE_ENV", "test")
os.environ.setdefault("HYDROPULSE_OPENROUTER_ENABLED", "false")

import httpx  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from backend import basemap as basemap_mod  # noqa: E402
from backend import main as main_mod  # noqa: E402
from backend.config import load_config  # noqa: E402

FAKE_KEY = "fake-carto-key-DO-NOT-LEAK-123"
PNG = b"\x89PNG\r\n\x1a\nfaketile"


@pytest.fixture(scope="module")
def client():
    with TestClient(main_mod.app) as c:
        yield c


def _install(monkeypatch, handler, **cfg_kw):
    cfg = replace(main_mod.config, carto_api_key=FAKE_KEY, **cfg_kw)
    calls: list[httpx.Request] = []

    def wrapped(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return handler(request)

    svc = basemap_mod.BasemapService(cfg, transport=httpx.MockTransport(wrapped))
    monkeypatch.setattr(main_mod, "config", cfg)
    monkeypatch.setattr(main_mod, "_basemap_service", svc)
    monkeypatch.setattr(main_mod, "_basemap_cfg_id", id(cfg))
    return svc, calls


def _ok(request: httpx.Request) -> httpx.Response:
    return httpx.Response(200, content=PNG, headers={"content-type": "image/png"})


def _assert_no_key(resp) -> None:
    assert FAKE_KEY not in resp.text
    assert FAKE_KEY not in str(dict(resp.headers))
    assert FAKE_KEY.encode() not in resp.content


def test_tile_proxied_with_key_server_side_and_cached(client, monkeypatch):
    svc, calls = _install(monkeypatch, _ok)
    r1 = client.get("/api/basemap/dark/3/4/2")
    r2 = client.get("/api/basemap/dark/3/4/2")
    assert r1.status_code == r2.status_code == 200
    assert r1.content == PNG and r1.headers["content-type"] == "image/png"
    assert "public" in r1.headers["cache-control"] and "max-age=" in r1.headers["cache-control"]
    _assert_no_key(r1)
    assert len(calls) == 1  # second hit served from cache
    assert "dark_all/3/4/2.png" in str(calls[0].url)
    assert calls[0].url.params["key"] == FAKE_KEY
    assert calls[0].url.host == "basemaps.cartocdn.com"
    client.get("/api/basemap/light/3/4/2")
    assert "light_all" in str(calls[1].url)


def test_bearer_mode_uses_header(client, monkeypatch):
    _, calls = _install(monkeypatch, _ok, carto_auth_mode="bearer")
    assert client.get("/api/basemap/dark/1/0/0").status_code == 200
    assert calls[0].headers["authorization"] == f"Bearer {FAKE_KEY}"
    assert "key" not in calls[0].url.params


def test_cache_bounded_and_ttl(client, monkeypatch):
    svc, calls = _install(monkeypatch, _ok, basemap_cache_max_tiles=2)
    for x in range(4):
        client.get(f"/api/basemap/dark/4/{x}/0")
    assert len(svc._cache) == 2
    n = len(calls)
    client.get("/api/basemap/dark/4/0/0")  # evicted -> refetch
    assert len(calls) == n + 1
    for k, (_, d, c) in list(svc._cache.items()):
        svc._cache[k] = (0.0, d, c)  # expire
    client.get("/api/basemap/dark/4/3/0")
    assert len(calls) == n + 2


@pytest.mark.parametrize(
    "path,code",
    [
        ("/api/basemap/neon/1/0/0", 404),
        ("/api/basemap/dark/20/0/0", 422),
        ("/api/basemap/dark/-1/0/0", 422),
        ("/api/basemap/dark/2/4/0", 404),
        ("/api/basemap/dark/2/0/4", 404),
        ("/api/basemap/dark/2/-1/0", 404),
        ("/api/basemap/dark/a/0/0", 422),
    ],
)
def test_bad_coordinates_rejected(client, monkeypatch, path, code):
    _, calls = _install(monkeypatch, _ok)
    r = client.get(path)
    assert r.status_code == code
    assert calls == []
    _assert_no_key(r)


def test_disabled_without_key(client, monkeypatch):
    cfg = replace(main_mod.config, carto_api_key=None)
    monkeypatch.setattr(main_mod, "config", cfg)
    monkeypatch.setattr(main_mod, "_basemap_service", None)
    r = client.get("/api/basemap/dark/1/0/0")
    assert r.status_code == 404
    assert client.get("/api/health").json()["basemap_proxy"] is False


def test_health_reports_proxy_flag(client, monkeypatch):
    _install(monkeypatch, _ok)
    body = client.get("/api/health").json()
    assert body["basemap_proxy"] is True
    assert FAKE_KEY not in str(body)


def test_upstream_failures_are_sanitized(client, monkeypatch, caplog):
    def boom(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError(f"cannot reach {request.url}")

    _install(monkeypatch, boom)
    with caplog.at_level(logging.DEBUG):
        r = client.get("/api/basemap/dark/2/1/1")
    assert r.status_code == 502
    _assert_no_key(r)
    assert FAKE_KEY not in caplog.text

    _install(monkeypatch, lambda req: httpx.Response(403, text=f"denied {req.url}"))
    r = client.get("/api/basemap/dark/2/1/1")
    assert r.status_code == 502
    _assert_no_key(r)

    _install(monkeypatch, lambda req: httpx.Response(302, headers={"location": "https://evil.example/x"}))
    r = client.get("/api/basemap/dark/2/1/1")
    assert r.status_code == 502

    _install(monkeypatch, lambda req: httpx.Response(200, content=b"<html>", headers={"content-type": "text/html"}))
    assert client.get("/api/basemap/dark/2/1/1").status_code == 502


def test_config_hides_key():
    base = {"HYDROPULSE_ENV": "test", "HYDROPULSE_OPENROUTER_ENABLED": "false"}
    cfg = load_config({**base, "CARTO_API_KEY": FAKE_KEY})
    assert cfg.carto_api_key == FAKE_KEY and cfg.basemap_proxy_enabled
    summary = cfg.safe_summary()
    assert summary["carto_api_key_configured"] is True
    assert FAKE_KEY not in str(summary) and FAKE_KEY not in repr(cfg)
    cfg2 = load_config({**base, "HYDROPULSE_CARTO_API_KEY": FAKE_KEY, "HYDROPULSE_CARTO_AUTH_MODE": "none"})
    assert not cfg2.basemap_proxy_enabled
    assert load_config(base).carto_api_key is None
    with pytest.raises(ValueError):
        load_config({**base, "HYDROPULSE_CARTO_AUTH_MODE": "weird"})
