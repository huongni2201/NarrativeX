"""Prepare user-provided VieNeu reference audio in an ephemeral job workspace."""

from pathlib import Path

MIN_REFERENCE_DURATION_MS = 3_000
MAX_REFERENCE_DURATION_MS = 8_000


class VoiceReferenceAudioError(ValueError):
    """The uploaded reference cannot satisfy VieNeu's voice-cloning contract."""


def prepare_mp3_reference(source_path: Path, destination_path: Path) -> int:
    """Validate, trim, and convert an MP3 reference to mono WAV.

    The source is never modified. The generated WAV is intended to live only in the
    current worker job directory and is deleted with that directory.
    """
    try:
        from pydub import AudioSegment  # type: ignore[import-untyped]
    except ImportError as exception:
        raise RuntimeError("VieNeu voice uploads require the pydub package") from exception

    if source_path.suffix.lower() != ".mp3":
        raise VoiceReferenceAudioError("VieNeu voice reference must be an .mp3 file")

    try:
        sound = AudioSegment.from_mp3(str(source_path))
    except Exception as exception:
        raise VoiceReferenceAudioError(
            "Uploaded voice reference is not a readable MP3"
        ) from exception

    duration_ms = len(sound)
    if duration_ms < MIN_REFERENCE_DURATION_MS:
        raise VoiceReferenceAudioError("Voice reference must be at least 3 seconds long")

    sound_clip = sound[:MAX_REFERENCE_DURATION_MS]
    destination_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        sound_clip.set_channels(1).export(str(destination_path), format="wav")
    except Exception as exception:
        raise RuntimeError("Could not convert the voice reference to WAV") from exception

    return min(duration_ms, MAX_REFERENCE_DURATION_MS)
