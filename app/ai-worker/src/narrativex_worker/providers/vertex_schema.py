"""Vertex-compatible JSON Schema projection and safe error diagnostics."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel

# Vertex responseJsonSchema accepts JSON Schema with a documented subset of keywords. Local
# Pydantic validation remains authoritative for constraints that are intentionally removed here.
_VERTEX_JSON_SCHEMA_KEYS = frozenset(
    {
        "$id",
        "$defs",
        "$ref",
        "$anchor",
        "type",
        "format",
        "title",
        "description",
        "enum",
        "items",
        "prefixItems",
        "minItems",
        "maxItems",
        "minimum",
        "maximum",
        "anyOf",
        "oneOf",
        "properties",
        "additionalProperties",
        "required",
        "propertyOrdering",
    }
)


def response_json_schema(model: type[BaseModel]) -> dict[str, Any]:
    """Project a Pydantic schema onto Vertex's supported responseJsonSchema subset."""
    normalized = _normalize_schema_node(model.model_json_schema())
    if not isinstance(normalized, dict):
        raise TypeError("root response schema must be an object")
    return normalized


def safe_error_diagnostic(raw: dict[str, object]) -> tuple[str | None, tuple[str, ...]]:
    """Extract only provider status and field paths; never log error descriptions or prompt text."""
    error = raw.get("error")
    if not isinstance(error, dict):
        return None, ()

    status_value = error.get("status")
    status = status_value if isinstance(status_value, str) and status_value else None
    fields: list[str] = []
    details = error.get("details")
    if isinstance(details, list):
        for detail in details:
            if not isinstance(detail, dict):
                continue
            violations = detail.get("fieldViolations")
            if not isinstance(violations, list):
                continue
            for violation in violations:
                if not isinstance(violation, dict):
                    continue
                field = violation.get("field")
                if isinstance(field, str) and field and field not in fields:
                    fields.append(field)
                if len(fields) >= 8:
                    return status, tuple(fields)
    return status, tuple(fields)


def _normalize_schema_node(value: object) -> object:
    if isinstance(value, list):
        return [_normalize_schema_node(item) for item in value]
    if not isinstance(value, dict):
        return value

    result: dict[str, Any] = {}
    for key, item in value.items():
        if key == "const":
            # Pydantic can emit const for literals, while Vertex's documented subset does not.
            # Preserve primitive string/number literals as a one-value enum when possible.
            if isinstance(item, (str, int, float)) and not isinstance(item, bool):
                result.setdefault("enum", [item])
            continue
        if key not in _VERTEX_JSON_SCHEMA_KEYS:
            continue
        if key in {"properties", "$defs"} and isinstance(item, dict):
            result[key] = {
                str(name): _normalize_schema_node(schema) for name, schema in item.items()
            }
        else:
            result[key] = _normalize_schema_node(item)

    # Vertex requires a $ref node to stand alone except for other $-prefixed metadata.
    if "$ref" in result:
        return {key: item for key, item in result.items() if key.startswith("$")}
    return result
