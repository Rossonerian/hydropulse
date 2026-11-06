"""Tests for the per-IP sliding-window rate limiter on the AI endpoints."""
from __future__ import annotations

import os

os.environ.setdefault("HYDROPULSE_ENV", "test")
os.environ.setdefault("HYDROPULSE_OPENROUTER_ENABLED", "false")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from backend import ai_advisor, rate_limit  # noqa: E402
from backend.main import app  # noqa: E402
from data_utils.schemas import AiSuggestionsResponse  # noqa: E402

LIMIT = 3
CHAT_BODY = {"message": "What is the pressure at J1?"}


@pytest.fixture(autouse=True)
def _isolated_limiter(monkeypatch):
    monkeypatch.setenv(rate_limit.RATE_LIMIT_ENV, str(LIMIT))
    rate_limit.reset_rate_limiter()
    yield
    rate_limit.reset_rate_limiter()


@pytest.fixture
def stub_ai(monkeypatch):
    """Replace the heavy advisor calls so only the limiter is under test."""
    monkeypatch.setattr(
        ai_advisor,
        "generate_chat_response",
        lambda **_kwargs: ("ok", "deterministic_hydraulic", "rule-based", []),
    )
    monkeypatch.setattr(
        ai_advisor,
        "get_suggestions",
        lambda *_args, **_kwargs: AiSuggestionsResponse(
            network_revision="test-rev",
            suggestions=[],
            sensor_benchmark={},
            compute_time_ms=0.0,
        ),
    )


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_chat_allows_up_to_limit_then_returns_429(client, stub_ai):
    for i in range(LIMIT):
        resp = client.post("/api/ai/chat", json=CHAT_BODY)
        assert resp.status_code == 200, f"call {i + 1} should pass"

    resp = client.post("/api/ai/chat", json=CHAT_BODY)
    assert resp.status_code == 429
    assert resp.json() == {"detail": "Rate limit exceeded"}


def test_suggestions_allows_up_to_limit_then_returns_429(client, stub_ai):
    for i in range(LIMIT):
        resp = client.get("/api/ai/suggestions")
        assert resp.status_code == 200, f"call {i + 1} should pass"

    resp = client.get("/api/ai/suggestions")
    assert resp.status_code == 429
    assert resp.json() == {"detail": "Rate limit exceeded"}


def test_rejected_requests_do_not_consume_budget(client, stub_ai):
    for _ in range(LIMIT):
        assert client.post("/api/ai/chat", json=CHAT_BODY).status_code == 200
    for _ in range(5):
        assert client.post("/api/ai/chat", json=CHAT_BODY).status_code == 429
    # Still blocked: the window is measured from the accepted hits only.
    assert client.post("/api/ai/chat", json=CHAT_BODY).status_code == 429


def test_reset_clears_limiter_state(client, stub_ai):
    for _ in range(LIMIT):
        assert client.post("/api/ai/chat", json=CHAT_BODY).status_code == 200
    assert client.post("/api/ai/chat", json=CHAT_BODY).status_code == 429

    rate_limit.reset_rate_limiter()

    assert client.post("/api/ai/chat", json=CHAT_BODY).status_code == 200


def test_window_expiry_frees_budget(client, stub_ai, monkeypatch):
    clock = {"now": 1000.0}
    monkeypatch.setattr(rate_limit.time, "monotonic", lambda: clock["now"])

    for _ in range(LIMIT):
        assert client.post("/api/ai/chat", json=CHAT_BODY).status_code == 200
    assert client.post("/api/ai/chat", json=CHAT_BODY).status_code == 429

    clock["now"] += rate_limit.WINDOW_SECONDS + 0.1

    assert client.post("/api/ai/chat", json=CHAT_BODY).status_code == 200


def test_limit_is_read_from_env(monkeypatch):
    monkeypatch.delenv(rate_limit.RATE_LIMIT_ENV, raising=False)
    assert rate_limit.get_limit_per_min() == rate_limit.DEFAULT_LIMIT_PER_MIN == 20

    monkeypatch.setenv(rate_limit.RATE_LIMIT_ENV, "7")
    assert rate_limit.get_limit_per_min() == 7

    monkeypatch.setenv(rate_limit.RATE_LIMIT_ENV, "not-a-number")
    assert rate_limit.get_limit_per_min() == 20

    monkeypatch.setenv(rate_limit.RATE_LIMIT_ENV, "0")
    assert rate_limit.get_limit_per_min() == 20
