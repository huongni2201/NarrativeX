from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class NarrationSegment:
    index: int
    text_start: int
    text_end: int
    text: str


@dataclass(frozen=True)
class WordAlignment:
    """One spoken source word mapped to its measured audio interval."""

    index: int
    text_start: int
    text_end: int
    audio_start_ms: int
    audio_end_ms: int
    confidence: float = 1.0

    def __post_init__(self) -> None:
        if self.index < 0:
            raise ValueError("index must not be negative")
        if self.text_start < 0 or self.text_end <= self.text_start:
            raise ValueError("invalid text range")
        if self.audio_start_ms < 0 or self.audio_end_ms <= self.audio_start_ms:
            raise ValueError("invalid audio range")
        if not 0.0 <= self.confidence <= 1.0:
            raise ValueError("confidence must be between 0 and 1")


# Internal source-compatibility only: this no longer represents segment-duration timing.
AlignmentSpan = WordAlignment


@dataclass(frozen=True)
class SynthesizedSegment:
    segment: NarrationSegment
    pcm_bytes: bytes
    sample_rate_hz: int
    channels: int

    @property
    def frame_count(self) -> int:
        bytes_per_frame = 2 * self.channels
        return len(self.pcm_bytes) // bytes_per_frame

    @property
    def duration_ms(self) -> int:
        return round(self.frame_count * 1000 / self.sample_rate_hz)


@dataclass(frozen=True)
class MaterializedAudioSegment:
    """Segment metadata backed by an ephemeral scratch file, never aggregate PCM bytes."""

    segment: NarrationSegment
    file_path: Path
    sample_rate_hz: int
    channels: int
    duration_ms: int
    checksum: str
    frame_count: int | None = None
