"""OpenAPI contract snapshot (SOURCE_OF_TRUTH.md section 7 / 11).

Fails when any path, status code, request/response schema name, admin
protection or component model shape changes. Regenerate deliberately with:

    UPDATE_SNAPSHOT=1 pytest backend/tests/test_openapi_snapshot.py
"""
from __future__ import annotations

import json
import os
from pathlib import Path

os.environ.setdefault("HYDROPULSE_ENV", "test")
os.environ.setdefault("HYDROPULSE_OPENROUTER_ENABLED", "false")

from backend.main import app, require_admin  # noqa: E402

SNAPSHOT = Path(__file__).parent / "snapshots" / "openapi_contract.json"
METHODS = {"get", "post", "put", "patch", "delete"}


def _ref_name(schema: dict | None) -> str | None:
    if not schema:
        return None
    if "$ref" in schema:
        return schema["$ref"].rsplit("/", 1)[-1]
    if schema.get("type") == "array" and "items" in schema:
        inner = _ref_name(schema["items"]) or schema["items"].get("type")
        return f"array[{inner}]"
    for key in ("anyOf", "oneOf", "allOf"):
        if key in schema:
            return "|".join(sorted(str(_ref_name(s) or s.get("type")) for s in schema[key]))
    return schema.get("type")


def _content_ref(content: dict | None) -> str | None:
    if not content:
        return None
    return ",".join(f"{m}:{_ref_name(content[m].get('schema'))}" for m in sorted(content))


def _admin_routes() -> set[tuple[str, str]]:
    found = set()
    for route in getattr(app, "routes", []):
        deps = getattr(route, "dependencies", None) or []
        if any(getattr(d, "dependency", None) is require_admin for d in deps):
            for m in getattr(route, "methods", None) or []:
                found.add((route.path, m.lower()))
    return found


def _prop_type(prop: dict) -> str:
    if "$ref" in prop:
        return "$" + str(_ref_name(prop))
    if "anyOf" in prop or "oneOf" in prop or "allOf" in prop:
        return _ref_name(prop) or "union"
    if prop.get("type") == "array":
        return _ref_name(prop) or "array"
    if "enum" in prop:
        return "enum"
    return str(prop.get("type", "any"))


def build_contract_view() -> dict:
    spec = app.openapi()
    admin = _admin_routes()
    paths: dict = {}
    for path in sorted(spec["paths"]):
        ops = {}
        for method in sorted(spec["paths"][path]):
            if method not in METHODS:
                continue
            op = spec["paths"][path][method]
            ops[method] = {
                "admin": (path, method) in admin or bool(op.get("security")),
                "request_body": _content_ref((op.get("requestBody") or {}).get("content")),
                "responses": {
                    code: _content_ref(resp.get("content"))
                    for code, resp in sorted(op.get("responses", {}).items())
                },
                "query_params": sorted(
                    p["name"] for p in op.get("parameters", []) if p.get("in") == "query"
                ),
            }
        paths[path] = ops
    models = {}
    schemas = spec.get("components", {}).get("schemas", {})
    for name in sorted(schemas):
        props = schemas[name].get("properties", {})
        models[name] = {
            "properties": {k: _prop_type(props[k]) for k in sorted(props)},
            "required": sorted(schemas[name].get("required", [])),
        }
    return {"paths": paths, "schemas": models}


def test_no_trailing_slash_paths():
    bad = [p for p in app.openapi()["paths"] if p != "/" and p.endswith("/")]
    assert not bad, f"Trailing-slash paths are forbidden: {bad}"


def test_openapi_contract_snapshot():
    rendered = json.dumps(build_contract_view(), indent=2, sort_keys=True) + "\n"
    if os.environ.get("UPDATE_SNAPSHOT") == "1":
        SNAPSHOT.parent.mkdir(parents=True, exist_ok=True)
        SNAPSHOT.write_text(rendered)
    assert SNAPSHOT.exists(), (
        "Snapshot missing; run UPDATE_SNAPSHOT=1 pytest backend/tests/test_openapi_snapshot.py"
    )
    assert json.loads(rendered) == json.loads(SNAPSHOT.read_text()), (
        "API contract differs from backend/tests/snapshots/openapi_contract.json.\n"
        "If this change is intentional, regenerate with:\n"
        "  UPDATE_SNAPSHOT=1 pytest backend/tests/test_openapi_snapshot.py\n"
        "Changing the contract requires the SOURCE_OF_TRUTH.md section 11 protocol "
        "(HANDOFF.md request, Hardhik approval, SOURCE_OF_TRUTH.md bump) first."
    )
