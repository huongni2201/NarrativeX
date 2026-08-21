"""Bounded validation for provider-produced image bytes."""

import hashlib
import struct
from dataclasses import dataclass

from narrativex_worker.schema import ImageAspectRatio, ModerationDecision


class MediaValidationError(ValueError):
    pass


@dataclass(frozen=True)
class ValidatedImage:
    mime_type: str
    width: int
    height: int
    size_bytes: int
    sha256: str
    moderation: ModerationDecision


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
