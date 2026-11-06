"""HydroPulse / DHARA RAG (Retrieval-Augmented Generation) Engine.

Provides domain-grounded retrieval over:
1. Live SCADA twin state & incident telemetry (pressures, drawdowns, cut-set valving)
2. Real benchmark report data & model calibration metrics
3. BWSSB Standard Operating Procedures & valve isolation field protocols
4. Kengeri DMA pipeline specifications & CPHEEO hydraulic standards

Used by AI Advisor (/api/ai/chat) and AI Audit (/api/ai/suggestions).
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

log = logging.getLogger("hydropulse.rag")

# ─────────────────────────────────────────────────────────────────────────────
# 1. DOMAIN KNOWLEDGE CORPUS
# ─────────────────────────────────────────────────────────────────────────────

STATIC_KNOWLEDGE_BASE: List[Dict[str, str]] = [
    {
        "id": "bwssb_valve_isolation_sop",
        "title": "Valve Isolation Field Practice [VERIFY]",
        "keywords": "valve isolate isolation cut-set sop procedure close hammer wrench dispatch crew field repair shut",
        "content": (
            "[VERIFY: no source document committed; general field practice, not a cited BWSSB or CPHEEO text] "
            "Cut-set boundary isolation is generally carried out upon leak confirmation. "
            "Step 1: Dispatch Rapid Response Unit (RRU) equipped with 2 mechanical valve keys (T-wrenches). "
            "Step 2: Turn upstream isolation valves clockwise first to depressurize the trunk main and prevent hydraulic hammer "
            "(surge transient velocity must stay < 1.5 m/s). "
            "Step 3: Turn downstream isolation valves to halt gravity backflow from consumer overhead storage tanks. "
            "Step 4: Verify zero pressure on localized section using portable mechanical gauge before excavation. "
            "Step 5: Install a repair clamp sleeve. Keep terminal "
            "pressure adequate across unaffected zones."
        ),
    },
    {
        "id": "kengeri_dma_infrastructure",
        "title": "Kengeri DMA Twin Provenance",
        "keywords": "kengeri infrastructure network nodes pipes elevation reservoir demand dma assets synthetic osm",
        "content": (
            "The twin is built from the committed EPANET file backend/bangalore_kengeri.inp (network name "
            "'kengeri_synthetic'). It is a synthetic Kengeri-style network, not the real OSM Kengeri network. "
            "Node IDs, pipe IDs, diameters, elevations and demands must be read from the live network "
            "(GET /api/network), never assumed."
        ),
    },
    {
        "id": "water_loss_tanker_metrics",
        "title": "Tanker Equivalent Metrics",
        "keywords": "loss water tanker tankers nrw lpm liters rate daily volume",
        "content": (
            "Water loss is quantified in Litres Per Minute (LPM) and 6,000-litre tanker equivalents per day. "
            "Conversion formula: Tankers/day = (Loss in LPM * 1440) / 6000 = Loss in LPM * 0.24."
        ),
    },
]

# ─────────────────────────────────────────────────────────────────────────────
# 1b. BENCHMARK FACTS (only source of accuracy numbers: backend/benchmark_report.md)
# ─────────────────────────────────────────────────────────────────────────────

BENCHMARK_REPORT_PATH = Path(__file__).resolve().parent / "benchmark_report.md"
_BENCH_STRATEGY = "betweenness_separated"
_BENCH_NOISE_PCT = 1.5


def load_benchmark_facts(path: Optional[Path] = None) -> Optional[Dict[str, Any]]:
    """Parse the betweenness_separated / 1.5% noise row of benchmark_report.md.

    Returns None when the report is missing or the row is not found, so callers
    never fall back to invented numbers.
    """
    report = path or BENCHMARK_REPORT_PATH
    try:
        text = report.read_text(encoding="utf-8")
    except OSError:
        return None

    network = re.search(r"- Network: `([^`]+)`", text)
    for line in text.splitlines():
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) < 6 or cells[0] != _BENCH_STRATEGY:
            continue
        try:
            if float(cells[2]) != _BENCH_NOISE_PCT:
                continue
            return {
                "network": network.group(1) if network else "unknown",
                "sensors": cells[1],
                "noise_pct": _BENCH_NOISE_PCT,
                "top1_pct": float(cells[3]),
                "top3_pct": float(cells[4]),
                "mean_err_m": float(cells[5]),
            }
        except ValueError:
            continue
    return None


def _benchmark_text(facts: Optional[Dict[str, Any]]) -> str:
    if not facts:
        return "Benchmark figures are unavailable (backend/benchmark_report.md missing or unparsable)."
    return (
        f"On the '{facts['network']}' network with {facts['noise_pct']}% sensor noise, sensors "
        f"{facts['sensors']}: Top-1 {facts['top1_pct']}%, Top-3 {facts['top3_pct']}%, mean localization "
        f"error {facts['mean_err_m']} m. These are simulation results on a digital twin, not field "
        "measurements, and the network is not the real OSM Kengeri network."
    )


def _benchmark_chunk() -> Dict[str, str]:
    return {
        "id": "kengeri_dma_benchmark",
        "title": "HydroPulse Benchmark (from benchmark_report.md)",
        "keywords": "benchmark accuracy error meters precision wntr pdd torricelli noise sentinels performance evaluation",
        "content": _benchmark_text(load_benchmark_facts()),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 2. DYNAMIC SCADA TWIN CHUNK BUILDER
# ─────────────────────────────────────────────────────────────────────────────

def _incident_fields(ctx: Optional[Any]) -> Tuple[Optional[str], Optional[float], List[str]]:
    """Return (junction, loss_lpm, valves) exactly as received; no defaults are invented."""
    node = getattr(ctx, "estimated_junction", None) or getattr(ctx, "target_node_id", None)
    loss = getattr(ctx, "leak_loss_lpm", None)
    valves = list(getattr(ctx, "isolated_valves", None) or [])
    return node, loss, valves


def build_dynamic_scada_chunk(engine: Any, context: Optional[Any] = None) -> Dict[str, str]:
    """Compile the incident state actually received from the client (simulated digital twin)."""
    ctx = context
    rev = getattr(ctx, "network_revision", None) or (getattr(engine, "network_revision", None) if engine else None)
    phase = getattr(ctx, "phase", None) or "idle"
    est_node, loss_lpm, valves = _incident_fields(ctx)
    sensor_ids = list(getattr(engine, "sensor_ids", []) or []) if engine else []

    parts = [f"Simulated digital twin state. Network revision: {rev or 'unknown'}. Phase: {phase.upper()}."]
    if est_node and loss_lpm is not None:
        tankers = round(loss_lpm * 0.24, 1)
        parts.append(f"Active incident junction: {est_node}. Water loss: {loss_lpm:.1f} L/min ({tankers:.1f} tankers/day).")
        parts.append(f"Isolation valves: {', '.join(valves) if valves else 'none reported'}.")
    else:
        parts.append("No active incident.")
    if sensor_ids:
        parts.append(f"Sentinel sensors: {', '.join(sensor_ids)}.")

    return {
        "id": "live_scada_incident",
        "title": "Simulated Twin State & Incident Context",
        "keywords": f"live current active telemetry incident {est_node or ''} {' '.join(valves)} sensor reading drop tankers lpm valve",
        "content": " ".join(parts),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 3. RETRIEVAL ENGINE
# ─────────────────────────────────────────────────────────────────────────────

def _tokenize(text: str) -> Set[str]:
    """Tokenize and stem simple alphanumeric terms."""
    return set(re.findall(r"\b[a-z0-9_]{2,}\b", text.lower()))


def retrieve_relevant_knowledge(
    query: str,
    engine: Any = None,
    context: Optional[Any] = None,
    top_k: int = 3,
) -> List[Dict[str, str]]:
    """Retrieve top-k relevant knowledge chunks for a query using TF-IDF style term matching."""
    query_tokens = _tokenize(query)

    # Ingest dynamic live SCADA state
    live_chunk = build_dynamic_scada_chunk(engine, context)
    all_chunks = [live_chunk, _benchmark_chunk()] + STATIC_KNOWLEDGE_BASE

    scores: List[Tuple[float, Dict[str, str]]] = []

    # Dynamic incident boost keywords
    incident_indicators = {"valve", "valves", "isolate", "isolation", "leak", "burst", "tanker", "tankers",
                           "current", "reading", "drop", "drawdown", "loss"}
    has_incident_intent = bool(query_tokens & incident_indicators)

    for chunk in all_chunks:
        chunk_text = f"{chunk['title']} {chunk['keywords']} {chunk['content']}"
        chunk_tokens = _tokenize(chunk_text)

        overlap = query_tokens & chunk_tokens
        score = float(len(overlap))

        # Dynamic state gets boosted when query discusses operational state
        if chunk["id"] == "live_scada_incident":
            if has_incident_intent:
                score += 3.5
            else:
                score += 1.0

        # Exact SOP boost
        if "sop" in query_tokens or "procedure" in query_tokens or "hammer" in query_tokens:
            if chunk["id"] == "bwssb_valve_isolation_sop":
                score += 4.0

        # Benchmark boost
        if "benchmark" in query_tokens or "accuracy" in query_tokens or "precision" in query_tokens:
            if chunk["id"] == "kengeri_dma_benchmark":
                score += 4.0

        scores.append((score, chunk))

    # Sort descending by score
    scores.sort(key=lambda s: s[0], reverse=True)

    # Return top_k unique chunks
    results = [chunk for _, chunk in scores[:top_k]]
    return results


# ─────────────────────────────────────────────────────────────────────────────
# 4. RAG PROMPT FORMATTER & DETERMINISTIC FALLBACK GENERATOR
# ─────────────────────────────────────────────────────────────────────────────

def build_rag_system_prompt(chunks: List[Dict[str, str]]) -> str:
    """Format retrieved knowledge chunks into an authoritative system prompt for LLM."""
    corpus_text = "\n\n".join(
        f"[{i+1}] {c['title']} (Source: {c['id']})\n{c['content']}"
        for i, c in enumerate(chunks)
    )

    return (
        "You are DHARA, the built-in AI of the HydroPulse leak-detection service, advising on a simulated "
        "Kengeri-style water distribution twin.\n"
        "HydroPulse is the leak-detection service; DHARA is the dashboard operators use to access it, "
        "and DHARA is also your name as its built-in AI. Never use the two names interchangeably.\n"
        "Ground every answer strictly in the knowledge below. Do NOT fabricate numbers, node IDs, or pipe "
        "connections. If the knowledge does not contain a fact, say so. Treat anything tagged [VERIFY] as unconfirmed.\n\n"
        f"=== RETRIEVED DIGITAL TWIN KNOWLEDGE (RAG) ===\n{corpus_text}\n"
        "===============================================\n\n"
        "Guidelines:\n"
        "- Format responses with clean Markdown: headers (###), bold key metrics, bullet points, and warning callouts.\n"
        "- When asked about leaks or valves, quote the exact cut-set pipe IDs and water loss rates.\n"
        "- Do not cite BWSSB or CPHEEO documents; none are available here.\n"
        "- Maintain professional, crisp, engineering tone."
    )


def generate_deterministic_rag_response(
    query: str,
    chunks: List[Dict[str, str]],
    context: Optional[Any] = None,
    engine: Any = None,
) -> str:
    """Offline reply that echoes only the fields actually received; it never invents IDs or figures."""
    q_lower = query.lower()
    est_node, loss_lpm, valves = _incident_fields(context)
    has_incident = bool(est_node) and loss_lpm is not None
    phase = getattr(context, "phase", None) or "idle"
    sensor_ids = list(getattr(engine, "sensor_ids", []) or []) if engine else []
    no_incident = (
        "### No active incident\n\n"
        "No incident context was received. Run a leak simulation first, then ask again."
    )

    if any(k in q_lower for k in ["benchmark", "accuracy", "error", "precision", "sentinel", "algorithm"]):
        return (
            "### Localization Benchmark (simulated digital twin)\n\n"
            f"{_benchmark_text(load_benchmark_facts())}\n\n"
            "Source: `backend/benchmark_report.md`."
        )

    if any(k in q_lower for k in ["why", "ranked", "candidate", "stage", "locat"]):
        if not has_incident:
            return no_incident
        return (
            f"### Two-Stage Localization · Candidate {est_node}\n\n"
            "1. **Stage 1 (size-aware fingerprint fit):** the five sentinel pressure drops are fitted against "
            "precomputed fingerprints over a grid of leak areas to shortlist candidate junctions.\n"
            "2. **Stage 2 (verification re-simulation):** WNTR re-simulates the shortlisted candidates and "
            "ranks them by how well they reproduce the observed drops.\n\n"
            f"Top candidate in this simulation: **`{est_node}`**."
        )

    if any(k in q_lower for k in ["valve", "isolate", "isolation", "close", "cut-set", "shut"]):
        if not (valves or has_incident):
            return no_incident
        rows = ["### Isolation Advisory (simulated)\n"]
        if est_node:
            rows.append(f"- **Target junction:** `{est_node}`")
        rows.append(f"- **Valves to close:** `{', '.join(valves) if valves else 'none reported'}`")
        if loss_lpm is not None:
            rows.append(f"- **Water loss:** **{loss_lpm:.1f} L/min** ({round(loss_lpm * 0.24, 1):.1f} tankers/day)")
        rows.append("\n> Simulated result from the digital twin. Confirm in the field before operating any valve.")
        return "\n".join(rows)

    if any(k in q_lower for k in ["tanker", "loss", "nrw", "waste", "liters", "litres"]):
        if loss_lpm is None:
            return no_incident
        return (
            "### Water Loss Quantification (simulated)\n\n"
            f"- **Junction:** `{est_node or 'not reported'}`\n"
            f"- **Loss rate:** **{loss_lpm:.1f} L/min**\n"
            f"- **Daily volume:** **{loss_lpm * 1440.0:,.0f} L/day**\n"
            f"- **Tanker equivalents:** **{round(loss_lpm * 0.24, 1):.1f} tankers/day** (6,000 L each)"
        )

    lines = [
        "### HydroPulse Twin Briefing (simulated)\n",
        f"- **Operating status:** `{phase.upper()}`",
    ]
    if sensor_ids:
        lines.append(f"- **Sentinel sensors:** {', '.join(f'`{s}`' for s in sensor_ids)}")
    if has_incident:
        lines.append(f"- **Active node:** `{est_node}` ({loss_lpm:.1f} L/min)")
        lines.append(f"- **Isolation valves:** {', '.join(valves) if valves else 'none reported'}")
    else:
        lines.append("- **Incident:** none active")
    return "\n".join(lines)
