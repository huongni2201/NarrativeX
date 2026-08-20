from dataclasses import dataclass


@dataclass(frozen=True)
class UploadedNarrationPart:
    media_asset_id: str
    sequence: int
    duration_ms: int
    sha256: str

    def __post_init__(self) -> None:
        if self.sequence < 0:
            raise ValueError("sequence must not be negative")
        if self.duration_ms <= 0:
            raise ValueError("duration_ms must be positive")
        if len(self.sha256) != 64 or any(char not in "0123456789abcdef" for char in self.sha256):
            raise ValueError("sha256 must be lowercase sha256 hex")


@dataclass(frozen=True)
class UploadedPartTimeline:
    media_asset_id: str
    sequence: int
    global_start_ms: int
    global_end_ms: int


@dataclass(frozen=True)
class LocalAlignmentSpan:
    """A sentence/paragraph span produced while processing one uploaded part."""

    part_sequence: int
    global_text_start: int
    global_text_end: int
    local_audio_start_ms: int
    local_audio_end_ms: int
    confidence: float


def build_uploaded_part_timeline(
    parts: list[UploadedNarrationPart],
) -> list[UploadedPartTimeline]:
    """Build a logical concatenation; no physical audio concatenation is required for alignment."""

    cursor = 0
    timeline: list[UploadedPartTimeline] = []
    for expected_sequence, part in enumerate(parts):
        if part.sequence != expected_sequence:
            raise ValueError("part sequences must be contiguous from zero")
        end = cursor + part.duration_ms
        timeline.append(
            UploadedPartTimeline(
                media_asset_id=part.media_asset_id,
                sequence=part.sequence,
                global_start_ms=cursor,
                global_end_ms=end,
            )
        )
        cursor = end
    if not timeline:
        raise ValueError("at least one uploaded narration part is required")
    return timeline


def translate_to_global_audio(
    part_timeline: list[UploadedPartTimeline],
    spans: list[LocalAlignmentSpan],
) -> list[LocalAlignmentSpan]:
    """Translate per-file timestamps into one continuous audio clock."""

    by_sequence = {part.sequence: part for part in part_timeline}
    translated: list[LocalAlignmentSpan] = []
    for span in spans:
        part = by_sequence.get(span.part_sequence)
        if part is None:
            raise ValueError(f"alignment references unknown part {span.part_sequence}")
        if span.local_audio_start_ms < 0 or span.local_audio_end_ms <= span.local_audio_start_ms:
            raise ValueError("invalid local audio span")
        if span.local_audio_end_ms > part.global_end_ms - part.global_start_ms:
            raise ValueError("local audio span exceeds part duration")
        translated.append(
            LocalAlignmentSpan(
                part_sequence=span.part_sequence,
                global_text_start=span.global_text_start,
                global_text_end=span.global_text_end,
                local_audio_start_ms=part.global_start_ms + span.local_audio_start_ms,
                local_audio_end_ms=part.global_start_ms + span.local_audio_end_ms,
                confidence=span.confidence,
            )
        )
    translated.sort(key=lambda span: (span.global_text_start, span.local_audio_start_ms))
    return translated
