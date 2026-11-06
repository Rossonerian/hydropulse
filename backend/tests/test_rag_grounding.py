"""Regression tests for the AI copilot's grounding and the CORS preflight."""

from __future__ import annotations

import re

from fastapi.testclient import TestClient

from backend import rag_engine
from backend.main import app
from data_utils.schemas import AiChatContext

REPORT = rag_engine.BENCHMARK_REPORT_PATH.read_text(encoding="utf-8")


def _ask(query: str, ctx: AiChatContext | None = None) -> str:
    chunks = rag_engine.retrieve_relevant_knowledge(query, context=ctx)
    return rag_engine.generate_deterministic_rag_response(query, chunks, ctx)


def test_benchmark_numbers_come_from_report():
    facts = rag_engine.load_benchmark_facts()
    assert facts is not None
    reply = _ask("what is the benchmark accuracy")
    for pct in re.findall(r"\d+(?:\.\d+)?%", reply):
        assert pct.rstrip("%") in REPORT or pct.rstrip("%").rstrip("0") in REPORT, pct
    for banned in ("88.5", "94.2", "96.2", "OpenStreetMap"):
        assert banned not in reply
        assert banned not in str(rag_engine.STATIC_KNOWLEDGE_BASE)


def test_no_context_means_no_invented_incident():
    for q in ("which valves should I close?", "how many tankers are lost?", "why was it ranked first"):
        reply = _ask(q)
        assert "No active incident" in reply
        assert not re.search(r"\bP\d+\b|\bJ\d+\b|L/min", reply)


def test_context_valves_are_echoed_exactly():
    ctx = AiChatContext(estimated_junction="J7", leak_loss_lpm=100.0, isolated_valves=["P7"])
    reply = _ask("which valves should I close?", ctx)
    assert "P7" in reply and "J7" in reply
    assert "P32" not in reply and "98.7" not in reply


def test_zero_loss_is_not_replaced_by_default():
    ctx = AiChatContext(estimated_junction="J7", leak_loss_lpm=0.0)
    assert "0.0 L/min" in _ask("how much water is lost?", ctx)


def test_cors_preflight_allows_openrouter_key_header():
    client = TestClient(app)
    res = client.options(
        "/api/ai/chat",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,x-openrouter-key",
        },
    )
    assert res.status_code == 200
    assert "x-openrouter-key" in res.headers["access-control-allow-headers"].lower()
