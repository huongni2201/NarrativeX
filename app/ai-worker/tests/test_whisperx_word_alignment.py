from __future__ import annotations

from pathlib import Path
from typing import Any

from narrativex_worker.narration.word_alignment import WhisperXWordAligner


class _FakeWhisperX:
    def __init__(self) -> None:
        self.align_calls: list[dict[str, Any]] = []
        self.model_loads = 0

    def load_audio(self, path: str) -> list[float]:
        assert Path(path).is_file()
        return [0.0] * 16_000

    def load_align_model(
        self,
        *,
        language_code: str,
        device: str,
        model_name: str | None,
    ) -> tuple[object, dict[str, str]]:
        self.model_loads += 1
        assert language_code == "vi"
        assert device == "cpu"
        assert model_name is None
        return object(), {"language": language_code}

    def align(
        self,
        transcript: list[dict[str, object]],
        model: object,
        metadata: dict[str, str],
        audio: list[float],
        device: str,
        *,
        return_char_alignments: bool,
        print_progress: bool,
    ) -> dict[str, object]:
        del model, metadata, audio, device, return_char_alignments, print_progress
        self.align_calls.append({"transcript": transcript})
        return {
            "word_segments": [
                {"word": "Xin", "start": 0.05, "end": 0.3, "score": 0.99},
                {"word": "chào", "start": 0.32, "end": 0.8, "score": 0.98},
            ]
        }


def test_whisperx_force_aligns_the_known_script_and_reuses_language_model(
    tmp_path: Path,
) -> None:
    audio_path = tmp_path / "chapter.wav"
    audio_path.write_bytes(b"test fixture")
    fake = _FakeWhisperX()
    aligner = WhisperXWordAligner(device="cpu", minimum_exact_coverage=1.0)
    aligner._load_whisperx = lambda: fake  # type: ignore[method-assign]

    first = aligner.align(audio_path, "Xin chào", "vi-VN")
    second = aligner.align(audio_path, "Xin chào", "vi-VN")

    assert fake.align_calls[0]["transcript"] == [
        {"text": "Xin chào", "start": 0.0, "end": 1.0}
    ]
    assert [(word.audio_start_ms, word.audio_end_ms) for word in first] == [
        (50, 300),
        (320, 800),
    ]
    assert second == first
    assert fake.model_loads == 1
