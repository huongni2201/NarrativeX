from pathlib import Path

from narrativex_worker.rendering.image_motion import (
    ImageMotionManifest,
    MotionBeat,
    build_ffmpeg_args,
)
from narrativex_worker.rendering.subtitles import (
    SubtitleAlignmentSpan,
    build_subtitle_track,
    write_ass_subtitles,
)


def test_build_subtitle_track_uses_utf16_alignment() -> None:
    source = "Xin chào 👋 thế giới. Đây là NarrativeX."
    first = "Xin chào 👋 thế giới. "
    first_utf16 = len(first.encode("utf-16-le")) // 2
    full_utf16 = len(source.encode("utf-16-le")) // 2

    track = build_subtitle_track(
        source,
        [
            SubtitleAlignmentSpan(0, first_utf16, 0, 2400),
            SubtitleAlignmentSpan(first_utf16, full_utf16, 2400, 5000),
        ],
        5000,
        alignment_version="segment-duration-v1",
        max_chars_per_cue=30,
    )

    assert track.timing_source == "segment-duration-v1"
    assert track.cues[0].start_ms == 0
    assert track.cues[-1].end_ms == 5000
    assert "👋" in " ".join(cue.text for cue in track.cues)


def test_build_subtitle_track_falls_back_without_alignment() -> None:
    track = build_subtitle_track(
        "Một đoạn văn đủ dài để tạo nhiều phụ đề cho video NarrativeX.",
        [],
        6000,
        max_chars_per_cue=24,
    )

    assert track.timing_source == "proportional-fallback-v1"
    assert track.cues[0].start_ms == 0
    assert track.cues[-1].end_ms == 6000
    assert all(cue.end_ms > cue.start_ms for cue in track.cues)


def test_write_ass_subtitles_escapes_override_markup(tmp_path: Path) -> None:
    track = build_subtitle_track("Xin {chào} \\ NarrativeX", [], 2000)
    path = write_ass_subtitles(track, tmp_path / "subtitles.ass", width=1920, height=1080)
    content = path.read_text(encoding="utf-8")

    assert "[V4+ Styles]" in content
    assert "DejaVu Sans" in content
    assert r"\{" in content
    assert r"\}" in content
    assert r"\\" in content


def test_ffmpeg_args_burn_ass_after_concat(tmp_path: Path) -> None:
    subtitle_path = tmp_path / "subtitle file.ass"
    manifest = ImageMotionManifest(
        beats=(
            MotionBeat(tmp_path / "one.png", 2.0),
            MotionBeat(tmp_path / "two.png", 3.0),
        ),
        audio_path=tmp_path / "audio.mp3",
        output_path=tmp_path / "out.mp4",
        width=1920,
        height=1080,
        fps=30,
        subtitle_path=subtitle_path,
    )

    args = build_ffmpeg_args(manifest)
    filter_complex = args[args.index("-filter_complex") + 1]

    assert "concat=n=2:v=1:a=0[vconcat]" in filter_complex
    assert "[vconcat]ass=filename='" in filter_complex
    assert "[vout]" in filter_complex
    assert args[args.index("-map") + 1] == "[vout]"
