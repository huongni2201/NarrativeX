# Visual Beat Audio Alignment Design

## Problem

Narration timing is now normalized against the real encoded audio clock, but image timing still loses semantic precision. The database schema already contains `visual_beats.text_start`, `text_end`, `audio_start_ms`, and `audio_end_ms`; the current chapter-analysis materializer does not populate the text offsets, the narration completion path does not derive audio offsets, and the backend storyboard mapping drops those fields. As a result, production timing can fall back to duration weighting even when the chapter source and narration alignment contain enough information to place transitions more accurately.

## Goal

Make visual transitions derive from source-text semantics and the authoritative narration clock:

`visual beat source anchor -> UTF-16 text offsets -> narration alignment -> gap-free audio beat clock`

The result must remain deterministic, must work whether chapter analysis or narration finishes first, and must not ask the AI model to invent millisecond timestamps.

## Existing schema reused

No database migration is required. `visual_beats` already owns:

- `text_start INTEGER`
- `text_end INTEGER`
- `audio_start_ms BIGINT`
- `audio_end_ms BIGINT`

These columns become the durable bridge between semantic storyboard planning and the narration clock.

## Analysis contract

`VisualBeatAnalysis` gains a required `source_anchor` string. The model must copy a contiguous excerpt verbatim from `UNTRUSTED_CHAPTER` that identifies the source range represented by that beat. Anchors are semantic provenance only; they are never interpreted as instructions.

The prompt requires anchors to:

- be copied verbatim from the source text;
- appear in the same order as the visual beats;
- be non-overlapping;
- be long enough to identify the intended source passage without inventing text;
- never contain guessed character offsets or timestamps.

The worker, not the model, computes offsets.

## Source-anchor resolution

A pure timing module resolves ordered source anchors against the immutable chapter source snapshot.

Resolution rules:

1. Search each anchor starting at the end of the previous resolved anchor.
2. Require an exact substring match. Do not use semantic or fuzzy matching that could silently bind a beat to the wrong sentence.
3. Convert Python code-point positions to UTF-16 offsets using the existing narration offset helpers, because narration alignment spans also use UTF-16 offsets.
4. If an anchor cannot be resolved in order, fail storyboard materialization with a clear error instead of persisting guessed timing.

This produces durable `text_start` and `text_end` for every AI-generated visual beat.

## Mapping text offsets to audio

Narration alignment spans remain the audio authority. A text offset inside one alignment span is mapped linearly within that span:

`audio = span.audio_start_ms + ratio * (span.audio_end_ms - span.audio_start_ms)`

where `ratio` is the relative UTF-16 text position inside the span. Fractional arithmetic is used before final millisecond rounding so the mapping is deterministic.

Image timing is constructed from beat *starts*, not by independently mapping every beat end. This guarantees a gap-free render clock:

- first visual beat starts at `0`;
- each later visual beat starts at the mapped `text_start` of that beat;
- each beat ends exactly where the next beat starts;
- the final beat ends at the authoritative narration duration.

If mapped transition points are not strictly increasing or exceed the narration duration, timing reconciliation fails rather than fabricating a clock.

## Order-independent reconciliation

Chapter analysis and narration may run in parallel, so either may finish first.

### Storyboard finishes first

The materializer persists `text_start/text_end`. If no current narration alignment exists yet, `audio_start_ms/audio_end_ms` remain null. When narration completion later persists the alignment, it reconciles the current storyboard and fills the audio clock.

### Narration finishes first

Narration persists its alignment. When storyboard materialization later activates the new storyboard revision, it loads the latest matching narration alignment for the same chapter row version and source hash and immediately reconciles the newly inserted beats.

Both paths use the same pure mapping function, so job completion order cannot change the resulting timeline.

## Backend projection

The storyboard persistence layer must stop dropping existing timing fields:

- `VisualBeatRow` maps text and audio offsets.
- `VisualBeat` rehydrates and exposes them.
- `StoryboardMapper.xml` selects/inserts/updates them.
- `MediaPlanningSourceService` passes stored `audioStartMs/audioEndMs` into `BeatSnapshot` instead of hard-coded nulls.

The existing production timeline query already consumes `vb.audio_start_ms` and `vb.audio_end_ms`, so no alternate timeline authority is introduced.

## Failure and fallback behavior

- Missing or invalid AI source anchor: chapter analysis materialization fails clearly; no guessed text range is written.
- Narration alignment not ready: text offsets persist, audio offsets stay null until reconciliation.
- Manual/legacy beat with missing text offsets: reconciliation leaves audio offsets null; current render-readiness rules continue to prevent falsely claiming exact timing.
- Invalid/non-monotonic mapped transition: reconciliation fails rather than silently equal-splitting.
- Final encoded-audio drift: the existing narration normalization remains the authority, so the final visual beat ends at the exact chapter audio duration.

## Accuracy target and limitation

This change removes equal-duration semantic guessing and ties image transitions to the actual source passage. Within a narration segment, the current system still estimates the exact spoken instant by linear interpolation over the segment text. That is materially more accurate than global beat weighting but is not true word-level forced alignment.

A future word/phoneme aligner can replace the inside-span interpolation without changing the durable `text_start/text_end -> audio_start_ms/audio_end_ms` contract introduced here.

## Non-goals

- Do not add an external forced-alignment model in this change.
- Do not ask the AI provider for millisecond timing or numeric source offsets.
- Do not weaken render-readiness checks.
- Do not add a new database migration for columns that already exist.
- Do not make preview/render compute a second independent timing model.

## Verification

Required regression coverage:

1. prompt requires `source_anchor` and forbids guessed timestamps;
2. ordered anchors resolve to correct UTF-16 offsets, including non-ASCII text;
3. unresolved/out-of-order anchors fail;
4. text offsets map deterministically into narration spans;
5. visual audio ranges are contiguous from `0` to exact narration duration;
6. narration-last and storyboard-last completion orders converge to the same audio timing;
7. backend persistence retains timing fields and `MediaPlanningSourceService` exposes them;
8. existing render strictness and bounded final-tail normalization remain green.
