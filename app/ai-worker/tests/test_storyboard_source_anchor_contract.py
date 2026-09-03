"""Regression coverage for generated storyboard source-anchor requirements."""

import pytest
from pydantic import ValidationError

from narrativex_worker.schema import ChapterAnalysisResult
from tests.visual_direction_fixture import visual_direction_json


def test_analysis_contract_rejects_when_all_source_anchors_are_missing() -> None:
    with pytest.raises(ValidationError, match="source_anchor"):
        ChapterAnalysisResult.model_validate(
            {
                "scenes": [
                    {
                        "title": "Arrival",
                        "visual_beats": [
                            {
                                "title": "Door",
                                "visual_intent": "Hero opens the door.",
                                "visual_direction": visual_direction_json(),
                            },
                            {
                                "title": "Rain",
                                "visual_intent": "Rain falls outside.",
                                "visual_direction": visual_direction_json(),
                            },
                        ],
                    }
                ]
            }
        )
