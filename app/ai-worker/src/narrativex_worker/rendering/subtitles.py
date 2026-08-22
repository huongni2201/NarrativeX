"""Deterministic burned-subtitle generation for chapter renders."""

from __future__ import annotations

import hashlib
import json
import math
import re
import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

import asyncpg  # type: ignore[import-untyped]

_WHITESPACE = re.compile(r"\s+")


@dataclass(frozen=True)
class SubtitleAlignmentSpan:
    text_start: int
    text_end: int
    audio_start_ms: int
    audio_end_ms: int


@dataclass(frozen=True)
class SubtitleSource:
    source_text: str
    spans: tuple[SubtitleAlignmentSpan, ...]
    alignment_version: str | None


@dataclass(frozen=True)
class SubtitleCue:
    start_ms: int
    end_ms: int
    text: str


@dataclass(frozen=True)
class SubtitleTrack:
    cues: tuple[SubtitleCue, ...]
    timing_source: str
    fingerprint: str


async def load_subtitle_source(
    database_url: str,
    *,
    project_id: int,
    chapter_id: int,
    chapter_row_version: int,
    source_hash: str,
    narration_request_id: uuid.UUID | None = None,
    narration_asset_id: uuid.UUID | None = None,
    narration_alignment_id: uuid.UUID | None = None,
) -> SubtitleSource:
    """Load narration text/alignment from one pinned narration asset when provided."""
    connection = await asyncpg.connect(database_url)
    try:
        if narration_request_id is not None and narration_asset_id is not None:
            row = await connection.fetchrow(
                """
                SELECT nr.source_text,
                       alignment.alignment_version,
                       alignment.spans_json
                  FROM narration_requests nr
                  JOIN narration_assets na ON na.narration_request_id = nr.id
                  JOIN project_assets pa ON pa.id = na.project_asset_id
                  LEFT JOIN narration_alignments alignment
                    ON alignment.id = $3
                   AND alignment.narration_asset_id = na.id
                   AND alignment.source_hash = nr.source_hash
                 WHERE nr.id = $1
                   AND na.id = $2
                   AND nr.project_id = $4
                   AND nr.chapter_id = $5
                   AND nr.chapter_row_version = $6
                   AND nr.source_hash = $7
                   AND pa.status = 'ACTIVE'
                   AND pa.storage_key IS NOT NULL
                """,
                narration_request_id,
                narration_asset_id,
                narration_alignment_id,
                project_id,
                chapter_id,
                chapter_row_version,
                source_hash,
            )
        else:
            row = await connection.fetchrow(
                """
                SELECT nr.source_text,
                       alignment.alignment_version,
                       alignment.spans_json
                  FROM narration_requests nr
                  JOIN narration_assets na ON na.narration_request_id = nr.id
                  JOIN project_assets pa ON pa.id = na.project_asset_id
                  LEFT JOIN LATERAL (
                        SELECT nal.alignment_version, nal.spans_json
                          FROM narration_alignments nal
                         WHERE nal.narration_asset_id = na.id
                           AND nal.source_hash = nr.source_hash
                         ORDER BY nal.created_at DESC
                         LIMIT 1
                  ) alignment ON TRUE
                 WHERE nr.project_id = $1
                   AND nr.chapter_id = $2
                   AND nr.chapter_row_version = $3
                   AND nr.source_hash = $4
                   AND pa.status = 'ACTIVE'
                   AND pa.storage_key IS NOT NULL
                 ORDER BY nr.created_at DESC
                 LIMIT 1
                """,
                project_id,
                chapter_id,
                chapter_row_version,
                source_hash,
            )
    finally:
        await connection.close()

    if row is None:
        raise ValueError("No narration source text matches the pinned render snapshot")
    payload = row["spans_json"]
    if isinstance(payload, str):
        payload = json.loads(payload)
    spans: list[SubtitleAlignmentSpan] = []
    for item in payload or []:
        spans.append(
            SubtitleAlignmentSpan(
                text_start=int(item["textStart"]),
                text_end=int(item["textEnd"]),
                audio_start_ms=int(item["audioStartMs"]),
                audio_end_ms=int(item["audioEndMs"]),
            )
        )
    return SubtitleSource(
        source_text=str(row["source_text"]),
        spans=tuple(spans),
        alignment_version=(
            str(row["alignment_version"]) if row["alignment_version"] is not None else None
        ),
    )


def build_subtitle_track(
    source_text: str,
    spans: Sequence[SubtitleAlignmentSpan],
    audio_duration_ms: int,
    *,
    alignment_version: str | None = None,
    max_chars_per_cue: int = 84,
) -> SubtitleTrack:
    """Build readable subtitle cues from narration alignment or a deterministic fallback.

    Narration text offsets are UTF-16 code-unit offsets because that is the durable contract used
    by the narration pipeline. Generated narration therefore keeps its real segment timing. Older
    assets without alignment fall back to proportional text timing instead of dropping subtitles.
    """
    if not source_text or source_text.isspace():
        raise ValueError("Subtitle source text must not be blank")
    if audio_duration_ms <= 0:
        raise ValueError("Subtitle audio duration must be positive")
    if max_chars_per_cue < 20:
        raise ValueError("Subtitle max chars per cue must be at least 20")

    cues: list[SubtitleCue] = []
    for span in spans:
        if span.text_start < 0 or span.text_end < span.text_start:
            raise ValueError("Invalid subtitle text span")
        if span.audio_start_ms < 0 or span.audio_end_ms <= span.audio_start_ms:
            raise ValueError("Invalid subtitle audio span")
        if span.audio_start_ms >= audio_duration_ms:
            continue
        text = _normalize_text(_utf16_slice(source_text, span.text_start, span.text_end))
        if not text:
            continue
        end_ms = min(span.audio_end_ms, audio_duration_ms)
        if end_ms <= span.audio_start_ms:
            continue
        cues.extend(
            _distribute_chunks(
                _split_chunks(text, max_chars_per_cue),
                span.audio_start_ms,
                end_ms,
            )
        )

    if cues:
        timing_source = alignment_version or "narration-alignment"
    else:
        chunks = _split_chunks(_normalize_text(source_text), max_chars_per_cue)
        cues = _distribute_chunks(chunks, 0, audio_duration_ms)
        timing_source = "proportional-fallback-v1"

    if not cues:
        raise ValueError("Subtitle track did not produce any cues")
    fingerprint = _fingerprint(cues, timing_source)
    return SubtitleTrack(tuple(cues), timing_source, fingerprint)


def write_ass_subtitles(
    track: SubtitleTrack,
    path: Path,
    *,
    width: int,
    height: int,
    font_name: str = "DejaVu Sans",
) -> Path:
    """Write a UTF-8 ASS file styled for legible burned-in chapter subtitles."""
    if width <= 0 or height <= 0:
        raise ValueError("Subtitle render dimensions must be positive")
    path.parent.mkdir(parents=True, exist_ok=True)

    font_size = max(24, round(height * 0.045))
    outline = max(2, round(height * 0.0025))
    shadow = max(1, round(height * 0.0015))
    margin_v = max(24, round(height * 0.06))
    header = (
        "[Script Info]\n"
        "ScriptType: v4.00+\n"
        "WrapStyle: 2\n"
        "ScaledBorderAndShadow: yes\n"
        f"PlayResX: {width}\n"
        f"PlayResY: {height}\n"
        "YCbCr Matrix: TV.709\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, "
        "BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, "
        "BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: Default,{font_name},{font_size},&H00FFFFFF,&H000000FF,&H00000000,"
        f"&H64000000,-1,0,0,0,100,100,0,0,1,{outline},{shadow},2,48,48,{margin_v},1\n\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )
    lines = [header]
    for cue in track.cues:
        start_cs = _ass_centiseconds(cue.start_ms, round_up=False)
        end_ms = max(cue.end_ms, cue.start_ms + 10)
        end_cs = max(_ass_centiseconds(end_ms, round_up=True), start_cs + 1)
        text = _escape_ass_text(_wrap_two_lines(cue.text))
        lines.append(
            "Dialogue: 0,"
            f"{_format_ass_centiseconds(start_cs)},{_format_ass_centiseconds(end_cs)},"
            f"Default,,0,0,0,,{text}\n"
        )
    path.write_text("".join(lines), encoding="utf-8")
    return path


def _utf16_slice(value: str, start: int, end: int) -> str:
    encoded = value.encode("utf-16-le")
    if end * 2 > len(encoded):
        raise ValueError("Subtitle text span exceeds source text")
    try:
        return encoded[start * 2 : end * 2].decode("utf-16-le")
    except UnicodeDecodeError as exception:
        raise ValueError("Subtitle UTF-16 span splits a surrogate pair") from exception


def _normalize_text(value: str) -> str:
    return _WHITESPACE.sub(" ", value).strip()


def _split_chunks(value: str, max_chars: int) -> list[str]:
    if not value:
        return []
    words = value.split(" ")
    chunks: list[str] = []
    current = ""
    for word in words:
        if len(word) > max_chars:
            if current:
                chunks.append(current)
                current = ""
            chunks.extend(word[index : index + max_chars] for index in range(0, len(word), max_chars))
            continue
        candidate = word if not current else f"{current} {word}"
        if len(candidate) <= max_chars:
            current = candidate
        else:
            chunks.append(current)
            current = word
    if current:
        chunks.append(current)
    return chunks


def _distribute_chunks(chunks: Sequence[str], start_ms: int, end_ms: int) -> list[SubtitleCue]:
    if not chunks or end_ms <= start_ms:
        return []
    duration = end_ms - start_ms
    if duration < len(chunks) * 10:
        return [SubtitleCue(start_ms, end_ms, " ".join(chunks))]

    weights = [max(1, len(chunk)) for chunk in chunks]
    total_weight = sum(weights)
    boundaries = [start_ms]
    cumulative = 0
    for weight in weights[:-1]:
        cumulative += weight
        boundaries.append(start_ms + round(duration * cumulative / total_weight))
    boundaries.append(end_ms)

    cues: list[SubtitleCue] = []
    for index, chunk in enumerate(chunks):
        cue_start = boundaries[index]
        cue_end = boundaries[index + 1]
        if cue_end <= cue_start:
            cue_end = min(end_ms, cue_start + 10)
        if cue_end > cue_start:
            cues.append(SubtitleCue(cue_start, cue_end, chunk))
    return cues


def _wrap_two_lines(value: str, target_line_chars: int = 42) -> str:
    if len(value) <= target_line_chars:
        return value
    spaces = [index for index, char in enumerate(value) if char == " "]
    if not spaces:
        return value
    midpoint = len(value) / 2
    split = min(spaces, key=lambda index: abs(index - midpoint))
    left = value[:split].strip()
    right = value[split + 1 :].strip()
    return f"{left}\n{right}" if left and right else value


def _escape_ass_text(value: str) -> str:
    return (
        value.replace("\\", r"\\")
        .replace("{", r"\{")
        .replace("}", r"\}")
        .replace("\n", r"\N")
    )


def _ass_centiseconds(milliseconds: int, *, round_up: bool) -> int:
    value = max(0, milliseconds) / 10
    return math.ceil(value) if round_up else math.floor(value)


def _format_ass_centiseconds(centiseconds: int) -> str:
    centiseconds = max(0, centiseconds)
    hours, remainder = divmod(centiseconds, 360_000)
    minutes, remainder = divmod(remainder, 6_000)
    seconds, centiseconds = divmod(remainder, 100)
    return f"{hours}:{minutes:02d}:{seconds:02d}.{centiseconds:02d}"


def _fingerprint(cues: Sequence[SubtitleCue], timing_source: str) -> str:
    payload = "\n".join(
        [timing_source]
        + [f"{cue.start_ms}|{cue.end_ms}|{cue.text}" for cue in cues]
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()