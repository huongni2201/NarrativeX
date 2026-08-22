from narrativex_worker.rendering.repository import RenderBeatAsset
from narrativex_worker.rendering.worker import (
    _dimensions,
    _normalize_durations,
    _parse_operation_type,
)


def _beat(duration_ms: int | None) -> RenderBeatAsset:
    return RenderBeatAsset(
        scene_index=0,
        beat_index=0,
        visual_beat_id=1,
        duration_ms=duration_ms,
        camera_movement="NONE",
        storage_key="image.png",
        size_bytes=10,
        checksum="a" * 64,
    )


def test_parse_render_operation_type() -> None:
    assert _parse_operation_type("CHAPTER_RENDER_1080P_MP4") == ("1080p", "mp4")
    assert _parse_operation_type("CHAPTER_RENDER_720P_MP4") == ("720p", "mp4")


def test_render_dimensions_follow_aspect_ratio() -> None:
    assert _dimensions("1080p", "16:9") == (1920, 1080)
    assert _dimensions("720p", "9:16") == (720, 1280)
    assert _dimensions("720p", "1:1") == (720, 720)


def test_duration_normalization_matches_audio_duration() -> None:
    durations = _normalize_durations([_beat(1000), _beat(2000), _beat(1000)], 8000)
    assert sum(durations) == 8000
    assert durations == [2000, 4000, 2000]


def test_duration_normalization_falls_back_when_plan_has_no_timing() -> None:
    durations = _normalize_durations([_beat(None), _beat(None), _beat(None)], 3001)
    assert sum(durations) == 3001
    assert all(value > 0 for value in durations)
