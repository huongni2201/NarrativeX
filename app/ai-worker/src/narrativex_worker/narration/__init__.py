"""Full-chapter narration primitives."""

from narrativex_worker.narration.alignment import NarrationAlignmentValidator
from narrativex_worker.narration.models import (
    MaterializedAudioSegment,
    NarrationSegment,
    SynthesizedSegment,
    WordAlignment,
)
from narrativex_worker.narration.providers import FakeTtsProvider, TtsProvider, TtsRequest
from narrativex_worker.narration.segmenter import NarrationSegmenter, utf16_length
from narrativex_worker.narration.service import FullChapterNarrationService, NarrationResult
from narrativex_worker.narration.storage import (
    MediaAssetConflictError,
    MediaStorage,
    StoredMediaAsset,
)
from narrativex_worker.narration.word_alignment import WhisperWordAligner, WordAlignmentError

__all__ = [
    "FakeTtsProvider",
    "FullChapterNarrationService",
    "MediaAssetConflictError",
    "MediaStorage",
    "MaterializedAudioSegment",
    "NarrationAlignmentValidator",
    "NarrationResult",
    "NarrationSegment",
    "NarrationSegmenter",
    "StoredMediaAsset",
    "SynthesizedSegment",
    "TtsProvider",
    "TtsRequest",
    "WhisperWordAligner",
    "WordAlignment",
    "WordAlignmentError",
    "utf16_length",
]
