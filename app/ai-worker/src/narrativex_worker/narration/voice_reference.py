"""Prepare user-provided VieNeu reference audio in an ephemeral job workspace."""

from pathlib import Path

MIN_REFERENCE_DURATION_MS = 3_000
MAX_REFERENCE_DURATION_MS = 8_000
SUPPORTED_REFERENCE_CONTENT_TYPES = {
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
}


class VoiceReferenceAudioError(ValueError):
    """The uploaded reference cannot satisfy VieNeu's voice-cloning contract."""


def prepare_voice_reference(
    source_path: Path,
    destination_path: Path,
    *,
    content_type: str | None,
) -> int:
    """Validate, trim, and normalize an MP3/WAV reference to mono WAV.

    The source is never modified. The normalized WAV only lives in the current
    worker job directory and is deleted with that workspace.

    Existing narration runners download the reference into a temporary path whose
    suffix is not authoritative. When no content type is supplied, let ffmpeg probe
    the actual bytes instead of trusting that workspace filename.
    """
    try:
        from pydub import AudioSegment  # type: ignore[import-not-found]
    except ImportError as exception:
        raise RuntimeError("VieNeu voice uploads require the pydub package") from exception

    normalized_content_type = (content_type or "").strip().lower()
    audio_format: str | None = None
    if normalized_content_type:
        audio_format = SUPPORTED_REFERENCE_CONTENT_TYPES.get(normalized_content_type)
        if audio_format is None:
            raise VoiceReferenceAudioError("VieNeu voice reference must be an MP3 or WAV file")

    try:
        if audio_format is None:
            sound = AudioSegment.from_file(str(source_path))
        else:
            sound = AudioSegment.from_file(str(source_path), format=audio_format)
    except Exception as exception:
        label = audio_format.upper() if audio_format else "MP3/WAV"
        raise VoiceReferenceAudioError(
            f"Uploaded voice reference is not a readable {label} file"
        ) from exception

    duration_ms = len(sound)
    if duration_ms < MIN_REFERENCE_DURATION_MS:
        raise VoiceReferenceAudioError("Voice reference must be at least 3 seconds long")

    sound_clip = sound[:MAX_REFERENCE_DURATION_MS]
    destination_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        sound_clip.set_channels(1).export(str(destination_path), format="wav")
    except Exception as exception:
        raise RuntimeError("Could not normalize the voice reference to WAV") from exception

    return min(duration_ms, MAX_REFERENCE_DURATION_MS)


def prepare_mp3_reference(source_path: Path, destination_path: Path) -> int:
    """Backward-compatible entry point that probes the actual uploaded bytes."""
    return prepare_voice_reference(
        source_path,
        destination_path,
        content_type=None,
    )
