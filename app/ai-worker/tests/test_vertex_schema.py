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


def _walk_schema_nodes(value: object):
    """Yield actual schema nodes without treating property/$defs name maps as schemas."""
    if isinstance(value, dict):
        yield value
        for key, item in value.items():
            if key in {"properties", "$defs"} and isinstance(item, dict):
                for child_schema in item.values():
                    yield from _walk_schema_nodes(child_schema)
            else:
                yield from _walk_schema_nodes(item)
    elif isinstance(value, list):
        for item in value:
            yield from _walk_schema_nodes(item)


def _property_names(value: object) -> set[str]:
    names: set[str] = set()
    if isinstance(value, dict):
        properties = value.get("properties")
        if isinstance(properties, dict):
            names.update(str(name) for name in properties)
        for item in value.values():
            names.update(_property_names(item))
    elif isinstance(value, list):
        for item in value:
            names.update(_property_names(item))
    return names


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
    for node in _walk_schema_nodes(schema):
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
    for node in _walk_schema_nodes(schema):
        assert provider_unnecessary.isdisjoint(node)

    assert schema["type"] == "object"
    assert "continuityPlan" in schema["properties"]
    assert "scenes" in schema["properties"]
    assert "$defs" in schema


def test_business_field_named_description_is_not_treated_as_schema_metadata() -> None:
    schema = response_json_schema(ChapterStructureWithContinuityResult)

    assert "description" in _property_names(schema)
    for node in _walk_schema_nodes(schema):
        assert "description" not in {
            key for key in node if key not in {"properties", "$defs"}
        }


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
