from uuid import UUID, uuid4

import pytest

from narrativex_worker.project_rendering.repository import (
    ProjectRenderBeatAsset,
    ProjectRenderChapterAudio,
)
from narrativex_worker.project_rendering.worker import (
    _dimensions,
    _parse_operation_type,
    _validate_snapshot,
    split_render_segments,
)


def _beat(
    *,
    chapter_id: UUID,
    scene_index: int,
    beat_index: int,
    start_ms: int,
    duration_ms: int,
) -> ProjectRenderBeatAsset:
    return ProjectRenderBeatAsset(
        chapter_id=chapter_id,
        scene_index=scene_index,
        beat_index=beat_index,
        visual_beat_id=uuid4(),
        global_start_ms=start_ms,
        global_end_ms=start_ms + duration_ms,
        duration_ms=duration_ms,
        camera_movement="NONE",
        storage_key=f"images/{beat_index}.png",
        size_bytes=100,
        checksum=f"{beat_index % 10}" * 64,
    )


def _chapter(
    *, chapter_id: UUID, order_index: int, start_ms: int, duration_ms: int
) -> ProjectRenderChapterAudio:
    return ProjectRenderChapterAudio(
        chapter_id=chapter_id,
        order_index=order_index,
        global_start_ms=start_ms,
        global_end_ms=start_ms + duration_ms,
        storage_key=f"audio/{order_index}.mp3",
        size_bytes=100,
        checksum=f"{order_index % 10}" * 64,
        duration_ms=duration_ms,
    )


def test_project_render_operation_and_dimensions() -> None:
    assert _parse_operation_type("RENDER_PROJECT_1080P_MP4") == ("1080p", "mp4")
    assert _parse_operation_type("RENDER_PROJECT_720P_MP4") == ("720p", "mp4")
    assert _dimensions("1080p", "16:9") == (1920, 1080)
    assert _dimensions("720p", "9:16") == (720, 1280)


def test_segmentation_prefers_scene_boundary_after_preferred_duration() -> None:
    chapter_id = uuid4()
    beats = [
        _beat(
            chapter_id=chapter_id,
            scene_index=0,
            beat_index=index,
            start_ms=index * 60_000,
            duration_ms=60_000,
        )
        for index in range(4)
    ]
    beats.append(
        _beat(
            chapter_id=chapter_id,
            scene_index=1,
            beat_index=4,
            start_ms=240_000,
            duration_ms=60_000,
        )
    )

    segments = split_render_segments(beats)

    assert [sum(beat.duration_ms for beat in segment) for segment in segments] == [240_000, 60_000]
    assert segments[0][-1].scene_index == 0
    assert segments[1][0].scene_index == 1


def test_segmentation_enforces_hard_max_even_without_semantic_boundary() -> None:
    chapter_id = uuid4()
    beats = [
        _beat(
            chapter_id=chapter_id,
            scene_index=0,
            beat_index=index,
            start_ms=index * 120_000,
            duration_ms=120_000,
        )
        for index in range(3)
    ]

    segments = split_render_segments(beats)

    assert [sum(beat.duration_ms for beat in segment) for segment in segments] == [240_000, 120_000]
    assert all(sum(beat.duration_ms for beat in segment) <= 300_000 for segment in segments)


def test_snapshot_validation_accepts_contiguous_global_audio_clock() -> None:
    first_chapter = uuid4()
    second_chapter = uuid4()
    chapters = [
        _chapter(chapter_id=first_chapter, order_index=0, start_ms=0, duration_ms=120_000),
        _chapter(
            chapter_id=second_chapter,
            order_index=1,
            start_ms=120_000,
            duration_ms=60_000,
        ),
    ]
    beats = [
        _beat(
            chapter_id=first_chapter,
            scene_index=0,
            beat_index=0,
            start_ms=0,
            duration_ms=60_000,
        ),
        _beat(
            chapter_id=first_chapter,
            scene_index=0,
            beat_index=1,
            start_ms=60_000,
            duration_ms=60_000,
        ),
        _beat(
            chapter_id=second_chapter,
            scene_index=0,
            beat_index=0,
            start_ms=120_000,
            duration_ms=60_000,
        ),
    ]

    _validate_snapshot(chapters, beats, 180_000)


def test_snapshot_validation_rejects_visual_timeline_gap() -> None:
    chapter_id = uuid4()
    chapters = [_chapter(chapter_id=chapter_id, order_index=0, start_ms=0, duration_ms=120_000)]
    beats = [
        _beat(
            chapter_id=chapter_id,
            scene_index=0,
            beat_index=0,
            start_ms=0,
            duration_ms=50_000,
        ),
        _beat(
            chapter_id=chapter_id,
            scene_index=0,
            beat_index=1,
            start_ms=60_000,
            duration_ms=60_000,
        ),
    ]

    with pytest.raises(ValueError, match="visual beat timeline is not contiguous"):
        _validate_snapshot(chapters, beats, 120_000)
