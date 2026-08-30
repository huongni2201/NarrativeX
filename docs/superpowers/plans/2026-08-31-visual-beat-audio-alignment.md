# Visual Beat Audio Alignment Implementation Plan

**Goal:** Make image transitions follow the spoken source passage instead of duration weighting, while keeping narration audio as the single authoritative clock.

**Spec:** `docs/superpowers/specs/2026-08-31-visual-beat-audio-alignment-design.md`

## Architecture

1. Chapter analysis returns a verbatim `source_anchor` for each new visual beat.
2. AI worker resolves ordered anchors against immutable `source_text` and stores UTF-16 `text_start/text_end` on `visual_beats`.
3. Narration alignment continues to own `textStart/textEnd -> audioStartMs/audioEndMs` spans and is normalized to the final encoded MP3 duration.
4. Production Timeline loads beat text ranges plus narration `spans_json`.
5. If a complete persisted beat audio clock already exists, preserve it. Otherwise derive semantic transition times on read from beat text starts and narration spans through backend `NarrationTextClockMapper`.
6. Build a gap-free image clock: first beat starts at `0`, each later beat starts at its mapped semantic position, and the final beat ends exactly at narration duration.
7. If source ranges or alignment are missing/invalid, keep the current inspectable fallback but do not claim exact timing or unlock render.

This avoids worker-to-worker reconciliation and is naturally independent of whether storyboard analysis or narration finishes first. The AI worker does not own production visual audio mapping.

## Constraints

- No AI-generated timestamps or numeric character offsets.
- Exact source-anchor matching only; no fuzzy binding to a potentially wrong sentence.
- UTF-16 offsets must match narration alignment coordinates.
- No database migration: required beat columns already exist.
- Do not weaken existing render admission or bounded tail-drift validation.
- Existing/legacy beats without source ranges remain supported as non-exact timeline input.
- Keep media-plan/persisted beat audio timing fields while they still have consumers.

## Implemented work

- [x] Add `source_anchor` to visual beat analysis contract and prompt.
- [x] Add deterministic ordered source-anchor resolver with UTF-16 conversion.
- [x] Persist resolved `text_start/text_end` for complete anchored storyboard output.
- [x] Project `text_start/text_end` through Production Timeline MyBatis rows and repository contract.
- [x] Add backend narration text-clock mapper using Jackson 3 / Spring Boot 4 packages.
- [x] Add deterministic backend source-range-to-audio mapping through `NarrationTextClockMapper`.
- [x] Derive an exact visual clock in `GetProductionTimelineUseCase` when persisted audio timing is incomplete.
- [x] Preserve existing persisted exact audio timing as higher priority.
- [x] Keep fallback/render-lock behavior for missing or malformed semantic timing.
- [x] Add Java regression coverage for `0/40/70/100` text transitions mapping to `0/4000/7000/10000 ms`.
- [x] Retain previous subtitle/audio cumulative PCM precision and final MP3-duration normalization fixes.
- [x] Remove the superseded duration-weighted `visual_timing.py` path.
- [x] Remove the superseded Python visual text-to-audio mapper after backend on-read mapping became authoritative.

## Verification checklist

- [x] Python narration regressions cover cumulative PCM timing and encoded-duration normalization.
- [x] Visual source-anchor resolver coverage includes repeated text, Unicode/non-BMP UTF-16 offsets, out-of-order failure, and blank-anchor rejection.
- [x] Backend regression owns semantic text-to-audio mapping coverage.
- [ ] Exact post-cleanup head: AI worker tests, Ruff, and Mypy pass.
- [ ] Exact post-cleanup head: Backend verify passes Java 25 compile, unit/integration tests, formatting, and coverage gates.
- [ ] Exact post-cleanup head: Desktop check passes.
- [ ] Exact post-cleanup head: Repository gates pass.

The verification boxes above remain intentionally unchecked until GitHub Actions has run against the exact final cleanup SHA. Earlier code-equivalent CI runs are not final proof.

## Retired timing path

The old `visual_timing.py` duration-weighted expansion policy and the Python visual text-to-audio mapper have been removed. Neither should be restored as a fallback because both duplicate or bypass the final source-provenance/backend-clock authority split.

## Remaining precision limit

Within one narration segment, the semantic source position is mapped by linear interpolation over the segment's UTF-16 text width. This is substantially better than chapter-wide duration weighting but is not word-level forced alignment. A future word/phoneme alignment implementation can replace this interpolation without changing the durable `text_start/text_end` contract.
