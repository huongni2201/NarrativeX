"""Strict chapter-continuity contracts shared by planning, validation and materialization."""

from __future__ import annotations

from enum import StrEnum
from typing import Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from narrativex_worker.schema import ENTITY_KEY_PATTERN


class ContinuityPredicate(StrEnum):
    APPEARANCE = "appearance"
    LOCATION = "location"
    TIME_OF_DAY = "time_of_day"
    PROP_OWNER = "prop_owner"
    PROP_POSITION = "prop_position"
    SCREEN_DIRECTION = "screen_direction"
    LIGHTING = "lighting"


class ContinuityProvenance(StrEnum):
    SOURCE = "SOURCE"
    APPROVED_CANON = "APPROVED_CANON"
    UNKNOWN = "UNKNOWN"


class ContinuityIssueSeverity(StrEnum):
    BLOCKING = "BLOCKING"
    WARNING = "WARNING"


class ContinuityIssueOrigin(StrEnum):
    DETERMINISTIC = "DETERMINISTIC"
    SEMANTIC = "SEMANTIC"
    HUMAN = "HUMAN"


class ContinuityReportStatus(StrEnum):
    PASS = "PASS"
    NEEDS_REVIEW = "NEEDS_REVIEW"


class _ContinuityModel(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class ContinuityFact(_ContinuityModel):
    subject_key: str = Field(alias="subjectKey", pattern=ENTITY_KEY_PATTERN)
    predicate: ContinuityPredicate
    value: str | int | bool | None = Field(default=None)
    provenance: ContinuityProvenance
    evidence_anchor: str | None = Field(default=None, alias="evidenceAnchor", min_length=1, max_length=2000)
    canon_version_id: UUID | None = Field(default=None, alias="canonVersionId")

    @model_validator(mode="after")
    def validate_provenance(self) -> Self:
        if self.provenance is ContinuityProvenance.UNKNOWN:
            if self.value is not None:
                raise ValueError("UNKNOWN continuity facts must have value=null")
            if self.evidence_anchor is not None or self.canon_version_id is not None:
                raise ValueError("UNKNOWN continuity facts cannot claim source/canon evidence")
        elif self.provenance is ContinuityProvenance.SOURCE:
            if self.value is None or self.evidence_anchor is None:
                raise ValueError("SOURCE continuity facts require value and evidenceAnchor")
            if self.canon_version_id is not None:
                raise ValueError("SOURCE continuity facts cannot claim canonVersionId")
        elif self.provenance is ContinuityProvenance.APPROVED_CANON:
            if self.value is None or self.canon_version_id is None:
                raise ValueError("APPROVED_CANON facts require value and canonVersionId")
        return self


class ContinuityEvent(_ContinuityModel):
    key: str = Field(pattern=ENTITY_KEY_PATTERN)
    source_anchor: str = Field(alias="sourceAnchor", min_length=1, max_length=2000)
    timeline_key: str = Field(alias="timelineKey", pattern=ENTITY_KEY_PATTERN)
    changes: list[ContinuityFact] = Field(min_length=1, max_length=50)


class SceneContinuityState(_ContinuityModel):
    scene_key: str = Field(alias="sceneKey", pattern=ENTITY_KEY_PATTERN)
    timeline_key: str = Field(alias="timelineKey", pattern=ENTITY_KEY_PATTERN)
    entry_facts: list[ContinuityFact] = Field(default_factory=list, alias="entryFacts", max_length=200)
    exit_facts: list[ContinuityFact] = Field(default_factory=list, alias="exitFacts", max_length=200)
    event_keys: list[str] = Field(default_factory=list, alias="eventKeys", max_length=200)


class ChapterContinuityPlan(_ContinuityModel):
    schema_version: int = Field(default=1, alias="schemaVersion", ge=1, le=1)
    source_hash: str = Field(alias="sourceHash", pattern=r"^[0-9a-f]{64}$")
    summary: str = Field(default="", max_length=8000)
    events: list[ContinuityEvent] = Field(default_factory=list, max_length=500)
    scene_states: list[SceneContinuityState] = Field(alias="sceneStates", min_length=1, max_length=500)
    visual_style_constraints: list[str] = Field(
        default_factory=list, alias="visualStyleConstraints", max_length=100
    )

    @model_validator(mode="after")
    def validate_unique_keys(self) -> Self:
        event_keys = [event.key for event in self.events]
        scene_keys = [scene.scene_key for scene in self.scene_states]
        if len(event_keys) != len(set(event_keys)):
            raise ValueError("continuity event keys must be unique")
        if len(scene_keys) != len(set(scene_keys)):
            raise ValueError("scene continuity keys must be unique")
        known_events = set(event_keys)
        for scene in self.scene_states:
            unknown = set(scene.event_keys) - known_events
            if unknown:
                raise ValueError(f"scene continuity references unknown event keys: {sorted(unknown)!r}")
        return self


class ShardContinuityContext(_ContinuityModel):
    plan_id: UUID | None = Field(default=None, alias="planId")
    scene_key: str = Field(alias="sceneKey", pattern=ENTITY_KEY_PATTERN)
    timeline_key: str = Field(alias="timelineKey", pattern=ENTITY_KEY_PATTERN)
    entry_facts: list[ContinuityFact] = Field(default_factory=list, alias="entryFacts", max_length=200)
    expected_exit_facts: list[ContinuityFact] = Field(
        default_factory=list, alias="expectedExitFacts", max_length=200
    )
    neighbor_source: str = Field(default="", alias="neighborSource", max_length=8000)
    allowed_character_keys: list[str] = Field(
        default_factory=list, alias="allowedCharacterKeys", max_length=100
    )


class BeatContinuityState(_ContinuityModel):
    beat_key: str = Field(alias="beatKey", pattern=ENTITY_KEY_PATTERN)
    entry_facts: list[ContinuityFact] = Field(default_factory=list, alias="entryFacts", max_length=200)
    visible_facts: list[ContinuityFact] = Field(default_factory=list, alias="visibleFacts", max_length=200)
    exit_facts: list[ContinuityFact] = Field(default_factory=list, alias="exitFacts", max_length=200)
    event_keys: list[str] = Field(default_factory=list, alias="eventKeys", max_length=100)


class ContinuityIssue(_ContinuityModel):
    code: str = Field(pattern=r"^[A-Z0-9_]{3,64}$")
    severity: ContinuityIssueSeverity
    scope_keys: list[str] = Field(default_factory=list, alias="scopeKeys", max_length=100)
    evidence_anchors: list[str] = Field(default_factory=list, alias="evidenceAnchors", max_length=100)
    message: str = Field(min_length=1, max_length=2000)
    origin: ContinuityIssueOrigin


class ContinuityReport(_ContinuityModel):
    plan_id: UUID | None = Field(default=None, alias="planId")
    revision: int = Field(default=1, ge=1)
    status: ContinuityReportStatus
    issues: list[ContinuityIssue] = Field(default_factory=list, max_length=500)
