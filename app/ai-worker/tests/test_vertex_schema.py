from typing import Literal

from pydantic import BaseModel, Field

from narrativex_worker.continuity.pipeline_contracts import ChapterStructureWithContinuityResult
from narrativex_worker.providers.vertex_schema import response_json_schema, safe_error_diagnostic


class _Nested(BaseModel):
    name: str = Field(min_length=1, max_length=20, pattern=r"^[a-z]+$")


class _StructuredResult(BaseModel):
    kind: Literal["scene"]
    nested: _Nested
    count: int = Field(default=1, ge=0, le=5)


def _walk(value: object):
    if isinstance(value, dict):
        yield value
        for item in value.values():
            yield from _walk(item)
    elif isinstance(value, list):
        for item in value:
            yield from _walk(item)


def test_response_schema_keeps_only_provider_shape_constraints() -> None:
    schema = response_json_schema(_StructuredResult)

    provider_unnecessary = {
        "default",
        "pattern",
        "minLength",
        "maxLength",
        "exclusiveMinimum",
        "minimum",
        "maximum",
        "minItems",
        "maxItems",
        "format",
        "title",
        "description",
        "const",
    }
    for node in _walk(schema):
        assert provider_unnecessary.isdisjoint(node)

    assert schema["type"] == "object"
    assert set(schema["required"]) == {"kind", "nested"}
    assert schema["properties"]["kind"]["enum"] == ["scene"]
    assert "$defs" in schema
    assert schema["properties"]["nested"] == {"$ref": "#/$defs/_Nested"}


def test_real_continuity_structure_schema_drops_uuid_and_complexity_constraints() -> None:
    schema = response_json_schema(ChapterStructureWithContinuityResult)

    provider_unnecessary = {
        "default",
        "pattern",
        "minLength",
        "maxLength",
        "minimum",
        "maximum",
        "minItems",
        "maxItems",
        "format",
        "title",
        "description",
    }
    for node in _walk(schema):
        assert provider_unnecessary.isdisjoint(node)

    assert schema["type"] == "object"
    assert "continuityPlan" in schema["properties"]
    assert "scenes" in schema["properties"]
    assert "$defs" in schema


def test_safe_error_diagnostic_never_returns_provider_description() -> None:
    status, fields = safe_error_diagnostic(
        {
            "error": {
                "status": "INVALID_ARGUMENT",
                "message": "SECRET_STORY_FRAGMENT",
                "details": [
                    {
                        "fieldViolations": [
                            {
                                "field": "generation_config.response_json_schema.properties.name",
                                "description": "SECRET_STORY_FRAGMENT",
                            }
                        ]
                    }
                ],
            }
        }
    )

    assert status == "INVALID_ARGUMENT"
    assert fields == ("generation_config.response_json_schema.properties.name",)
    assert "SECRET_STORY_FRAGMENT" not in repr((status, fields))
