from narrativex_worker.schema import ChapterAnalysisResult
from narrativex_worker.visual_prompt.sequence_planner import plan_chapter_shots


def _direction(shot_size: str = "WIDE", *, action_phase: str = "AFTER") -> dict[str, object]:
    return {
        "shot_size": shot_size,
        "camera_angle": "EYE_LEVEL",
        "lens_mm": 50,
        "focus_target": "primary subject",
        "action_phase": action_phase,
        "subject_placement": "center third",
        "foreground": None,
        "background": "room",
        "motivated_light": "window light",
        "palette": "neutral",
        "camera_movement": "NONE",
        "movement_direction": None,
        "movement_intensity": "SUBTLE",
        "crop_safe_area": "all sides",
    }


def _chapter(beats: list[dict[str, object]], *, location_key: str | None = "room") -> ChapterAnalysisResult:
    return ChapterAnalysisResult.model_validate(
        {
            "locations": ([{"key": "room", "name": "Room"}] if location_key else []),
            "scenes": [
                {
                    "title": "Scene",
                    "narration": "source",
                    "location_key": location_key,
                    "characters": [],
                    "visual_beats": beats,
                }
            ],
        }
    )


def _beat(index: int, shot_size: str = "WIDE", *, title: str | None = None) -> dict[str, object]:
    return {
        "title": title or f"Beat {index}",
        "visual_intent": f"Visible moment {index}",
        "source_anchor": f"anchor {index}",
        "visual_direction": _direction(shot_size),
        "characters": [],
    }


def test_planner_prevents_three_identical_shot_sizes_in_a_row() -> None:
    result = _chapter([_beat(1), _beat(2), _beat(3)], location_key=None)

    planned = plan_chapter_shots(result)
    shots = [beat.visual_direction.shot_size.value for beat in planned.scenes[0].visual_beats]

    assert shots[:2] == ["WIDE", "WIDE"]
    assert shots[2] != "WIDE"


def test_planner_is_deterministic() -> None:
    result = _chapter([_beat(1), _beat(2), _beat(3), _beat(4)])

    first = plan_chapter_shots(result).model_dump(mode="json")
    second = plan_chapter_shots(result).model_dump(mode="json")

    assert first == second


def test_planner_preserves_authored_non_repetitive_sequence() -> None:
    result = _chapter(
        [_beat(1, "ESTABLISHING"), _beat(2, "MEDIUM"), _beat(3, "CLOSE_UP")]
    )

    planned = plan_chapter_shots(result)

    assert [beat.visual_direction.shot_size.value for beat in planned.scenes[0].visual_beats] == [
        "ESTABLISHING",
        "MEDIUM",
        "CLOSE_UP",
    ]
