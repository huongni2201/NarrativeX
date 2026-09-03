"""Deterministic chapter-level shot coordination for still-image storyboards."""

from __future__ import annotations

from narrativex_worker.schema import (
    ActionPhase,
    CameraAngle,
    ChapterAnalysisResult,
    LensMm,
    SceneAnalysis,
    ShotSize,
    VisualBeatAnalysis,
    VisualDirectionV3,
)


_REPETITION_FALLBACK: dict[ShotSize, ShotSize] = {
    ShotSize.ESTABLISHING: ShotSize.MEDIUM,
    ShotSize.WIDE: ShotSize.MEDIUM_CLOSE_UP,
    ShotSize.MEDIUM: ShotSize.CLOSE_UP,
    ShotSize.MEDIUM_CLOSE_UP: ShotSize.WIDE,
    ShotSize.CLOSE_UP: ShotSize.MEDIUM,
    ShotSize.EXTREME_CLOSE_UP: ShotSize.WIDE,
}

_LENS_FOR_SHOT: dict[ShotSize, LensMm] = {
    ShotSize.ESTABLISHING: LensMm.MM_24,
    ShotSize.WIDE: LensMm.MM_35,
    ShotSize.MEDIUM: LensMm.MM_50,
    ShotSize.MEDIUM_CLOSE_UP: LensMm.MM_50,
    ShotSize.CLOSE_UP: LensMm.MM_85,
    ShotSize.EXTREME_CLOSE_UP: LensMm.MM_85,
}


def plan_chapter_shots(result: ChapterAnalysisResult) -> ChapterAnalysisResult:
    """Coordinate authored directions without introducing random camera decisions.

    AI analysis remains the primary author. This pass only resolves chapter-level conflicts that a
    single-beat prompt cannot see: location-establishing coverage, reaction readability, and runs
    of more than two identical shot sizes. The same input always produces the same output.
    """

    planned_scenes: list[SceneAnalysis] = []
    previous_location: str | None = None
    for scene in result.scenes:
        beats = list(scene.visual_beats)
        planned: list[VisualBeatAnalysis] = []
        location_changed = scene.location_key is not None and scene.location_key != previous_location

        for index, beat in enumerate(beats):
            direction = beat.visual_direction

            if index == 0 and location_changed and direction.shot_size != ShotSize.ESTABLISHING:
                direction = _with_shot(direction, ShotSize.ESTABLISHING)
            elif (
                direction.action_phase == ActionPhase.REACTION
                and direction.shot_size in {ShotSize.ESTABLISHING, ShotSize.WIDE}
            ):
                direction = _with_shot(direction, ShotSize.CLOSE_UP)

            if len(planned) >= 2:
                previous = planned[-1].visual_direction.shot_size
                before_previous = planned[-2].visual_direction.shot_size
                if direction.shot_size == previous == before_previous:
                    direction = _with_shot(direction, _REPETITION_FALLBACK[direction.shot_size])

            planned.append(beat.model_copy(update={"visual_direction": direction}))

        planned_scenes.append(scene.model_copy(update={"visual_beats": planned}))
        if scene.location_key is not None:
            previous_location = scene.location_key

    return result.model_copy(update={"scenes": planned_scenes})


def _with_shot(direction: VisualDirectionV3, shot_size: ShotSize) -> VisualDirectionV3:
    updates: dict[str, object] = {
        "shot_size": shot_size,
        "lens_mm": _LENS_FOR_SHOT[shot_size],
    }
    if shot_size == ShotSize.ESTABLISHING and direction.camera_angle not in {
        CameraAngle.HIGH,
        CameraAngle.OVERHEAD,
    }:
        updates["camera_angle"] = CameraAngle.EYE_LEVEL
    return direction.model_copy(update=updates)
