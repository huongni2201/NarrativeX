from narrativex_worker.narration.models import AlignmentSpan, SynthesizedSegment


class NarrationAlignmentValidator:
    def __init__(self, duration_tolerance_ms: int = 250) -> None:
        self.duration_tolerance_ms = duration_tolerance_ms

    def validate(
        self,
        spans: list[AlignmentSpan],
        *,
        source_utf16_length: int,
        audio_duration_ms: int,
    ) -> None:
        if not spans:
            raise ValueError("alignment must contain at least one span")
        if spans[0].audio_start_ms != 0:
            raise ValueError("first alignment span must start at 0ms")

        previous: AlignmentSpan | None = None
        for span in spans:
            if span.text_start < 0 or span.text_end < span.text_start:
                raise ValueError("invalid text span")
            if span.text_end > source_utf16_length:
                raise ValueError("text span exceeds source length")
            if span.audio_start_ms < 0 or span.audio_end_ms <= span.audio_start_ms:
                raise ValueError("invalid audio span")
            if previous is not None:
                if previous.text_end > span.text_start:
                    raise ValueError("text spans overlap")
                if previous.audio_end_ms > span.audio_start_ms:
                    raise ValueError("audio spans overlap")
            previous = span

        drift = abs(spans[-1].audio_end_ms - audio_duration_ms)
        if drift > self.duration_tolerance_ms:
            raise ValueError(f"alignment duration drift {drift}ms exceeds tolerance")


def build_alignment(segments: list[SynthesizedSegment]) -> list[AlignmentSpan]:
    cursor = 0
    spans: list[AlignmentSpan] = []
    for synthesized in segments:
        duration = synthesized.duration_ms
        spans.append(
            AlignmentSpan(
                index=synthesized.segment.index,
                text_start=synthesized.segment.text_start,
                text_end=synthesized.segment.text_end,
                audio_start_ms=cursor,
                audio_end_ms=cursor + duration,
            )
        )
        cursor += duration
    return spans
