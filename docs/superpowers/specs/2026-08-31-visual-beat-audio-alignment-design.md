# Visual Beat Audio Alignment Design

## Problem

Narration timing is normalized against the real encoded audio clock, but image timing can still fall back to duration weighting. The database already contains `visual_beats.text_start`, `text_end`, `audio_start_ms`, and `audio_end_ms`; current AI materialization did not populate source ranges, so production could not know which spoken passage a visual beat represents.

## Goal

Derive visual transitions from source semantics and the authoritative narration clock:

`visual beat source anchor -> UTF-16 text offsets -> narration alignment -> gap-free image clock`

AI never invents timestamps or numeric character offsets.

## Final timing responsibilities

| Layer | Timing responsibility |
| --- | --- |
| AI worker | Resolve verbatim `source_anchor` to UTF-16 `text_start/text_end` |
| Narration worker | Build and normalize narration alignment to encoded audio duration |
| Backend Production Timeline | Map visual text starts through narration alignment into a contiguous image clock |
| Media plan compatibility | Preserve existing persisted beat audio fields while they still have consumers |

## Existing schema reused

No migration is required. `visual_beats` already owns `text_start`, `text_end`, `audio_start_ms`, and `audio_end_ms`.

The durable semantic contract is `text_start/text_end`. Persisted audio offsets remain supported for existing/manual exact timing, but new source-anchored timing does not require a worker to write them back.

## Analysis contract

`VisualBeatAnalysis` exposes `source_anchor`. The chapter-analysis prompt requires each new visual beat to return a contiguous excerpt copied verbatim from `UNTRUSTED_CHAPTER`.

Anchors must:

- be copied verbatim from source;
- appear in visual-beat/source order;
- be non-overlapping;
- identify the source passage represented by the beat;
- never contain guessed timestamps or numeric offsets.

`source_anchor` remains nullable in the Python model for compatibility with legacy/test payload parsing. The new prompt produces it, and materialization only writes source ranges when a complete ordered anchor set is available.

## Source-anchor resolution

The worker resolves ordered anchors deterministically against the immutable chapter source snapshot:

1. Search each anchor starting at the previous anchor end.
2. Require an exact substring match; no fuzzy semantic binding.
3. Convert Python code-point positions to UTF-16 offsets with the existing narration helper.
4. Persist resulting `text_start/text_end` on the visual beat.

This uses the same UTF-16 coordinate system as narration alignment spans. The AI worker stops at source-range resolution; it does not own the production visual audio clock.

## Mapping text offsets to audio

The production timeline loads `text_start/text_end` together with the latest matching narration `spans_json`. If exact persisted beat audio timing is already complete, it is preserved. Otherwise, the backend derives a visual clock on read through `NarrationTextClockMapper`.

For each transition after the first beat, the beat's `text_start` is mapped into the containing narration span:

`audio = span.audio_start_ms + ratio * (span.audio_end_ms - span.audio_start_ms)`

where `ratio` is the relative UTF-16 text position inside that span.

Image timing is constructed from transition starts:

- first visual beat starts at `0`;
- each later beat starts at its mapped semantic source position;
- each beat ends exactly at the next beat start;
- final beat ends exactly at authoritative narration duration.

Mapped starts must be strictly increasing and remain inside the narration duration. Invalid mapping returns no exact clock, preserving the existing preview fallback and render lock rather than fabricating timing.

## Why derive on read

Chapter analysis and narration can finish in either order. Deriving timing in `GetProductionTimelineUseCase` removes completion-order coupling:

- storyboard first: source ranges exist; once narration exists the next timeline read becomes exact;
- narration first: alignment exists; once storyboard ranges exist the next timeline read becomes exact;
- neither worker needs to revisit or mutate the other subsystem's rows.

This also avoids duplicating an audio timing authority inside storyboard persistence.

## Production timeline projection

`ProductionTimelineMapper.xml` now loads `vb.text_start/text_end`. `ProductionTimelineBeatRow` and `ProductionTimelineSourceRepository.BeatSource` carry those values. `GetProductionTimelineUseCase` attempts source-range alignment before deciding whether timing is exact.

Existing persisted `audio_start_ms/audio_end_ms` remain the first choice. Source-range mapping is only used when the persisted clock is incomplete.

## Failure and fallback behavior

- Invalid/out-of-order source anchors are never converted to guessed offsets.
- Narration not ready: text ranges remain useful but exact image timing is unavailable yet.
- Missing text ranges or malformed alignment: existing inspectable fallback remains available, but render stays locked.
- Non-monotonic mapped transitions: no exact timing is claimed.
- Final encoded-audio drift: narration normalization remains authoritative, and the final visual beat ends exactly at chapter audio duration.

## Accuracy and limitation

This removes chapter-wide/equal-duration semantic guessing and makes image changes follow the source passage being spoken. Inside one narration segment, the exact spoken position is currently estimated by linear interpolation across UTF-16 text width. This is more semantically accurate than global duration weighting but is not word-level forced alignment.

A future word/phoneme aligner can improve the inside-segment mapping without changing the durable `text_start/text_end` contract.

## Retired timing path

The former `visual_timing.py` duration-weighted expansion policy and the Python visual text-to-audio mapper were removed after the source-anchored/on-read backend path became authoritative. They must not be reintroduced as fallback timing because they can produce a valid-looking clock without source provenance.

## Non-goals

- No external forced-alignment model in this change.
- No AI-generated milliseconds or numeric text offsets.
- No new migration.
- No weaker render admission.
- No worker-to-worker reconciliation hook.
- No removal of media-plan audio timing fields that still have consumers.

## Verification

Required regression coverage:

1. prompt requests verbatim `source_anchor` and forbids guessed timestamps/offsets;
2. anchors resolve to ordered UTF-16 ranges, including non-BMP text;
3. unresolved/out-of-order/blank anchors fail deterministic resolution;
4. backend text starts map deterministically through narration spans;
5. derived image ranges are gap-free from `0` to exact narration duration;
6. existing exact persisted audio timing remains preferred;
7. missing source/alignment timing remains render-blocking;
8. existing subtitle/tail drift regressions remain green.
