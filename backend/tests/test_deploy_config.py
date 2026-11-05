"""Deployment configuration guards for the EC2 + Quick Tunnel + Vercel staging path.

Covers:
- the committed deploy template's placeholder admin token is refused in prod;
- HYDROPULSE_CORS_ORIGIN_REGEX validation (anchoring, https, not over-broad);
- the regex is actually wired into CORSMiddleware (preview origin allowed, others refused).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import backend.main as main_mod
from backend.config import load_config

PROD_BASE = {
    "HYDROPULSE_ENV": "prod",
    "HYDROPULSE_RELOAD": "false",
    "HYDROPULSE_CORS_ORIGINS": "https://hydropulse.vercel.app",
    "HYDROPULSE_REQUIRE_ADMIN_AUTH": "true",
    "HYDROPULSE_ADMIN_TOKEN": "a-real-secret-0123456789",
}
PREVIEW_REGEX = r"^https://hydropulse-[a-z0-9-]+-teamhp[.]vercel[.]app$"


def test_prod_refuses_template_placeholder_admin_token() -> None:
    with pytest.raises(ValueError, match="placeholder"):
        load_config({**PROD_BASE, "HYDROPULSE_ADMIN_TOKEN": "REPLACE_WITH_STRONG_SECRET_MIN_8_CHARS"})
    # dev/test keep their existing behaviour
    load_config({"HYDROPULSE_ENV": "dev", "HYDROPULSE_ADMIN_TOKEN": "replace-me-123"})


def test_prod_accepts_real_admin_token() -> None:
    cfg = load_config(PROD_BASE)
    assert cfg.require_admin_auth is True
    assert cfg.cors_origin_regex is None


@pytest.mark.parametrize(
    "pattern",
    [
        r"https://hydropulse-[a-z0-9-]+-teamhp[.]vercel[.]app",  # not anchored
        r"^http://hydropulse-[a-z0-9-]+-teamhp[.]vercel[.]app$",  # not https in prod
        r"^https://.*$",  # wildcard in disguise
        r"^https://[a-z0-9-]+[.]vercel[.]app$",  # any Vercel project
        r"^https://[a-z0-9-]+[.]trycloudflare[.]com$",  # any tunnel
        r"^https://(unclosed$",  # invalid regex
    ],
)
def test_prod_rejects_unsafe_cors_regex(pattern: str) -> None:
    with pytest.raises(ValueError, match="HYDROPULSE_CORS_ORIGIN_REGEX"):
        load_config({**PROD_BASE, "HYDROPULSE_CORS_ORIGIN_REGEX": pattern})


def test_prod_accepts_pinned_preview_regex() -> None:
    cfg = load_config({**PROD_BASE, "HYDROPULSE_CORS_ORIGIN_REGEX": PREVIEW_REGEX})
    assert cfg.cors_origin_regex == PREVIEW_REGEX
    assert cfg.safe_summary()["cors_origin_regex"] == PREVIEW_REGEX


def test_cors_regex_is_wired_into_middleware(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HYDROPULSE_ENV", "test")
    monkeypatch.setenv("HYDROPULSE_CORS_ORIGINS", "https://hydropulse.vercel.app")
    monkeypatch.setenv("HYDROPULSE_CORS_ORIGIN_REGEX", PREVIEW_REGEX)
    with TestClient(main_mod.app) as c:

        def preflight(origin: str):
            return c.options(
                "/api/simulate-leak",
                headers={"Origin": origin, "Access-Control-Request-Method": "POST"},
            )

        exact = preflight("https://hydropulse.vercel.app")
        assert exact.status_code == 200
        assert exact.headers["access-control-allow-origin"] == "https://hydropulse.vercel.app"

        preview = preflight("https://hydropulse-git-feat-x-teamhp.vercel.app")
        assert preview.status_code == 200
        assert preview.headers["access-control-allow-origin"] == "https://hydropulse-git-feat-x-teamhp.vercel.app"

        other = preflight("https://hydropulse-git-feat-x-otherteam.vercel.app")
        assert other.status_code == 400
        assert "access-control-allow-origin" not in other.headers
