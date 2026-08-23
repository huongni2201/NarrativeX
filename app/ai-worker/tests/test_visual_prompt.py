from narrativex_worker.visual_prompt.director import (
    VISUAL_DIRECTION_INSTRUCTIONS,
    choose_ffmpeg_camera_movement,
)


def test_visual_direction_instructions_target_still_images() -> None:
    assert "still-image" in VISUAL_DIRECTION_INSTRUCTIONS
    assert "continuity" in VISUAL_DIRECTION_INSTRUCTIONS
    assert "FFmpeg" in VISUAL_DIRECTION_INSTRUCTIONS
    assert "Seedance" not in VISUAL_DIRECTION_INSTRUCTIONS


def test_reveal_prefers_push_in() -> None:
    assert choose_ffmpeg_camera_movement("Phát hiện", "Cô ấy nhận ra bí mật trong lá thư") == "PUSH_IN"


def test_establishing_environment_prefers_pan() -> None:
    assert choose_ffmpeg_camera_movement("Toàn cảnh", "Khung cảnh ngôi làng vào buổi sáng") == "PAN"


def test_isolation_prefers_pull_out() -> None:
    assert choose_ffmpeg_camera_movement("Rời đi", "Nhân vật một mình bước khỏi căn phòng") == "PULL_OUT"


def test_portrait_prefers_parallax() -> None:
    assert choose_ffmpeg_camera_movement("Chân dung", "Cận cảnh biểu cảm dè dặt trên khuôn mặt") == "PARALLAX"


def test_vertical_subject_prefers_tilt() -> None:
    assert choose_ffmpeg_camera_movement("Look up", "The character looks up toward the tower") == "TILT"


def test_ambiguous_beat_stays_static() -> None:
    assert choose_ffmpeg_camera_movement("Conversation", "Two characters sit across a table") == "NONE"
