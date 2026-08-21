from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class NarrationSegment:
    index: int
    text_start: int
    text_end: int
    text: str


@dataclass(frozen=True)
class AlignmentSpan:
    index: int
    text_start: int
    text_end: int
    audio_start_ms: int
    audio_end_ms: int


@dataclass(frozen=True)
class SynthesizedSegment:
    segment: NarrationSegment
    pcm_bytes: bytes
    sample_rate_hz: int
    channels: int

    @property
    def duration_ms(self) -> int:
        bytes_per_sample = 2 * self.channels
        sample_count = len(self.pcm_bytes) // bytes_per_sample
        return round(sample_count * 1000 / self.sample_rate_hz)


@dataclass(frozen=True)
class MaterializedAudioSegment:
    """Segment metadata backed by an ephemeral scratch file, never aggregate PCM bytes."""

    segment: NarrationSegment
    file_path: Path
    sample_rate_hz: int
    channels: int
    duration_ms: int
    checksum: str
