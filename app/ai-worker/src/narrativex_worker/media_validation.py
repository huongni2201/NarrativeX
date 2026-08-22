"""Bounded, content-sniffing validation for uploaded media."""

import hashlib
import json
import re
import struct
import subprocess
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, UnidentifiedImageError

from narrativex_worker.schema import ImageAspectRatio, ModerationDecision


class MediaValidationError(ValueError):
    pass


class MediaProbeTimeout(MediaValidationError):
    pass


@dataclass(frozen=True)
class ValidatedImage:
    mime_type: str
    width: int
    height: int
    size_bytes: int
    sha256: str
    moderation: ModerationDecision


@dataclass(frozen=True)
class ValidatedMedia:
    detected_content_type: str
    detected_container: str
    detected_codec: str | None
    width: int | None
    height: int | None
    duration_ms: int | None


IMAGE_LIMITS = {
    "max_pixels": 50_000_000,
    "max_gif_frames": 120,
}
AUDIO_CODECS = {"aac", "mp3", "opus", "vorbis", "pcm_s16le", "pcm_s24le", "pcm_s32le"}
VIDEO_CODECS = {"av1", "h264", "hevc", "vp8", "vp9"}


def validate_image_bytes(
    content: bytes,
    *,
    declared_mime_type: str | None = None,
    aspect_ratio: ImageAspectRatio = ImageAspectRatio.RATIO_16_9,
    max_bytes: int = 15_000_000,
    moderation: ModerationDecision = ModerationDecision.SAFE,
) -> ValidatedImage:
    if not content:
        raise MediaValidationError("image is empty")
    if len(content) > max_bytes:
        raise MediaValidationError("image exceeds the configured byte limit")
    detected, width, height = _inspect(content)
    if declared_mime_type is not None and declared_mime_type != detected:
        raise MediaValidationError("declared image MIME does not match content")
    if width <= 0 or height <= 0:
        raise MediaValidationError("image dimensions must be positive")
    expected = _ratio(aspect_ratio.value)
    actual = width / height
    if abs(actual - expected) / expected > 0.08:
        raise MediaValidationError("image aspect ratio is outside the authorized policy")
    return ValidatedImage(
        detected, width, height, len(content), hashlib.sha256(content).hexdigest(), moderation
    )


def validate_media_file(
    path: Path,
    declared_type: str,
    declared_content_type: str,
    *,
    ffprobe_binary: str = "ffprobe",
    ffmpeg_binary: str = "ffmpeg",
    probe_timeout_seconds: float = 30.0,
) -> ValidatedMedia:
    """Validate decoded content; browser metadata and extensions are never trusted."""
    if not path.is_file() or path.stat().st_size <= 0:
        raise MediaValidationError("EMPTY_FILE")
    normalized_type = declared_type.strip().upper()
    if normalized_type == "IMAGE":
        return _validate_image_file(path)
    if normalized_type not in {"AUDIO", "VIDEO"}:
        raise MediaValidationError("UNSUPPORTED_DECLARED_TYPE")
    probe = _run_ffprobe(path, ffprobe_binary, probe_timeout_seconds)
    streams = probe.get("streams")
    format_info = probe.get("format")
    if not isinstance(streams, list) or not isinstance(format_info, dict):
        raise MediaValidationError("PROBE_INVALID")
    if len(streams) > 4:
        raise MediaValidationError("TOO_MANY_STREAMS")
    container = _first_container(str(format_info.get("format_name", "")))
    duration_ms = _duration_ms(format_info.get("duration"))
    if duration_ms <= 0:
        raise MediaValidationError("INVALID_DURATION")
    audio_streams = [stream for stream in streams if stream.get("codec_type") == "audio"]
    video_streams = [stream for stream in streams if stream.get("codec_type") == "video"]
    if normalized_type == "AUDIO":
        if len(audio_streams) != 1 or video_streams:
            raise MediaValidationError("AUDIO_STREAM_REQUIRED")
        stream = audio_streams[0]
        codec = str(stream.get("codec_name", "")).lower()
        if codec not in AUDIO_CODECS:
            raise MediaValidationError("AUDIO_CODEC_NOT_ALLOWED")
        sample_rate = _positive_int(stream.get("sample_rate"))
        channels = _positive_int(stream.get("channels"))
        if sample_rate < 8_000 or sample_rate > 192_000:
            raise MediaValidationError("AUDIO_SAMPLE_RATE_NOT_ALLOWED")
        if channels < 1 or channels > 2:
            raise MediaValidationError("AUDIO_CHANNELS_NOT_ALLOWED")
        if duration_ms < 250 or duration_ms > 300_000:
            raise MediaValidationError("AUDIO_DURATION_NOT_ALLOWED")
        _decode_with_ffmpeg(path, ffmpeg_binary, probe_timeout_seconds)
        _reject_silence(path, ffmpeg_binary, probe_timeout_seconds)
        return ValidatedMedia(
            _content_type_for_container(container, declared_content_type),
            container,
            codec,
            None,
            None,
            duration_ms,
        )
    if len(video_streams) != 1:
        raise MediaValidationError("VIDEO_STREAM_REQUIRED")
    stream = video_streams[0]
    codec = str(stream.get("codec_name", "")).lower()
    if codec not in VIDEO_CODECS:
        raise MediaValidationError("VIDEO_CODEC_NOT_ALLOWED")
    width = _positive_int(stream.get("width"))
    height = _positive_int(stream.get("height"))
    fps = _frame_rate(stream.get("avg_frame_rate") or stream.get("r_frame_rate"))
    if width <= 0 or height <= 0 or width > 7680 or height > 4320 or width * height > 33_000_000:
        raise MediaValidationError("VIDEO_DIMENSIONS_NOT_ALLOWED")
    if fps <= 0 or fps > 120:
        raise MediaValidationError("VIDEO_FRAME_RATE_NOT_ALLOWED")
    if duration_ms > 600_000:
        raise MediaValidationError("VIDEO_DURATION_NOT_ALLOWED")
    _decode_with_ffmpeg(path, ffmpeg_binary, probe_timeout_seconds)
    return ValidatedMedia(
        _content_type_for_container(container, declared_content_type),
        container,
        codec,
        width,
        height,
        duration_ms,
    )


def _validate_image_file(path: Path) -> ValidatedMedia:
    try:
        with Image.open(path) as image:
            image.verify()
        with Image.open(path) as image:
            width, height = image.size
            if width <= 0 or height <= 0 or width * height > IMAGE_LIMITS["max_pixels"]:
                raise MediaValidationError("IMAGE_DIMENSIONS_NOT_ALLOWED")
            frames = 0
            while True:
                image.seek(frames)
                image.load()
                frames += 1
                if frames > IMAGE_LIMITS["max_gif_frames"]:
                    raise MediaValidationError("IMAGE_FRAME_COUNT_NOT_ALLOWED")
                try:
                    image.seek(frames)
                except EOFError:
                    break
            mime = str(image.format or "").upper()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exception:
        raise MediaValidationError("IMAGE_DECODE_FAILED") from exception
    mime_type = {
        "JPEG": "image/jpeg",
        "PNG": "image/png",
        "WEBP": "image/webp",
        "GIF": "image/gif",
    }.get(mime)
    if mime_type is None:
        raise MediaValidationError("IMAGE_FORMAT_NOT_ALLOWED")
    return ValidatedMedia(mime_type, mime.lower(), None, width, height, None)


def _run_ffprobe(path: Path, binary: str, timeout: float) -> dict[str, object]:
    try:
        result = subprocess.run(
            [binary, "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)],
            check=True,
            capture_output=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as exception:
        raise MediaProbeTimeout("FFPROBE_TIMEOUT") from exception
    except (OSError, subprocess.CalledProcessError) as exception:
        raise MediaValidationError("FFPROBE_FAILED") from exception
    try:
        value = json.loads(result.stdout.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exception:
        raise MediaValidationError("FFPROBE_INVALID_JSON") from exception
    if not isinstance(value, dict):
        raise MediaValidationError("FFPROBE_INVALID_JSON")
    return value


def _decode_with_ffmpeg(path: Path, binary: str, timeout: float) -> None:
    try:
        subprocess.run(
            [binary, "-v", "error", "-i", str(path), "-map", "0", "-f", "null", "-"],
            check=True,
            capture_output=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as exception:
        raise MediaProbeTimeout("FFMPEG_TIMEOUT") from exception
    except (OSError, subprocess.CalledProcessError) as exception:
        raise MediaValidationError("MEDIA_DECODE_FAILED") from exception


def _reject_silence(path: Path, binary: str, timeout: float) -> None:
    try:
        result = subprocess.run(
            [binary, "-v", "info", "-i", str(path), "-af", "volumedetect", "-f", "null", "-"],
            check=True,
            capture_output=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as exception:
        raise MediaProbeTimeout("FFMPEG_TIMEOUT") from exception
    except (OSError, subprocess.CalledProcessError) as exception:
        raise MediaValidationError("AUDIO_ANALYSIS_FAILED") from exception
    diagnostic = (result.stderr or b"").decode("utf-8", errors="replace")
    match = re.search(r"mean_volume:\s*(-?\d+(?:\.\d+)?) dB", diagnostic)
    if match is not None and float(match.group(1)) <= -90:
        raise MediaValidationError("AUDIO_SILENT")


def _first_container(format_name: str) -> str:
    return format_name.split(",", 1)[0].strip().lower() or "unknown"


def _content_type_for_container(container: str, declared: str) -> str:
    if container in {"mp3", "mpeg"}:
        return "audio/mpeg"
    if container in {"wav", "wave"}:
        return "audio/wav"
    if container in {"ogg", "oga"}:
        return "audio/ogg"
    if container in {"mov", "mp4", "m4a"}:
        return "video/mp4" if declared.startswith("video/") else "audio/mp4"
    if container in {"webm", "matroska"}:
        return "video/webm" if declared.startswith("video/") else "audio/webm"
    return declared.split(";", 1)[0].strip().lower()


def _duration_ms(value: object) -> int:
    try:
        return round(float(str(value)) * 1000)
    except (TypeError, ValueError):
        return 0


def _positive_int(value: object) -> int:
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return 0


def _frame_rate(value: object) -> float:
    try:
        numerator, denominator = str(value).split("/", 1)
        return float(numerator) / float(denominator)
    except (TypeError, ValueError, ZeroDivisionError):
        return 0.0


def normalize_moderation(value: object) -> ModerationDecision:
    if isinstance(value, ModerationDecision):
        return value
    if not isinstance(value, str):
        return ModerationDecision.REVIEW
    normalized = value.upper().strip()
    if normalized in {"SAFE", "PASS", "OK"}:
        return ModerationDecision.SAFE
    if normalized in {"BLOCK", "BLOCKED", "UNSAFE"}:
        return ModerationDecision.BLOCK
    return ModerationDecision.REVIEW


def _inspect(content: bytes) -> tuple[str, int, int]:
    if content.startswith(b"\x89PNG\r\n\x1a\n") and len(content) >= 24:
        width, height = struct.unpack(">II", content[16:24])
        return "image/png", width, height
    if content.startswith(b"\xff\xd8"):
        width, height = _jpeg_dimensions(content)
        return "image/jpeg", width, height
    if (
        content.startswith(b"RIFF")
        and content[8:12] == b"WEBP"
        and content[12:16] == b"VP8X"
        and len(content) >= 30
    ):
        width = 1 + int.from_bytes(content[24:27], "little")
        height = 1 + int.from_bytes(content[27:30], "little")
        return "image/webp", width, height
    raise MediaValidationError("unsupported or corrupt image format")


def _jpeg_dimensions(content: bytes) -> tuple[int, int]:
    offset = 2
    while offset + 9 < len(content):
        if content[offset] != 0xFF:
            offset += 1
            continue
        marker = content[offset + 1]
        offset += 2
        if marker in {0xD8, 0xD9}:
            continue
        if offset + 2 > len(content):
            break
        length = int.from_bytes(content[offset : offset + 2], "big")
        if (
            marker in range(0xC0, 0xC4)
            or marker in range(0xC5, 0xC8)
            or marker in range(0xC9, 0xCC)
            or marker in range(0xCD, 0xD0)
        ):
            if length >= 7 and offset + length <= len(content):
                height = int.from_bytes(content[offset + 3 : offset + 5], "big")
                width = int.from_bytes(content[offset + 5 : offset + 7], "big")
                return width, height
        offset += length
    raise MediaValidationError("JPEG dimensions are missing")


def _ratio(value: str) -> float:
    left, right = value.split(":", 1)
    return int(left) / int(right)
