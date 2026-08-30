# Visual Timing Migration Cleanup Design

## Context

NarrativeX has migrated visual timing away from duration-weighted expansion toward source-anchored timing:

`source_anchor -> UTF-16 text_start/text_end -> narration alignment -> production image clock`

The migration is implemented across the AI worker and backend, but several legacy helpers and tests still describe or exercise the old timing model. This cleanup removes code that no longer has a production consumer while preserving compatibility contracts still used by media planning and existing persisted timing.

## Goal

Leave one clear responsibility per layer:

- AI worker: resolve visual beat source anchors to deterministic UTF-16 source ranges.
- Narration worker: own authoritative narration alignment and encoded-audio clock normalization.
- Backend production timeline: map visual source ranges through narration alignment into the image clock.
- Media planning: keep existing persisted audio timing fields until their consumers are migrated separately.

The cleanup must not alter user-visible timing behavior or weaken render-readiness validation.

## Confirmed dead code

### `app/ai-worker/src/narrativex_worker/visual_timing.py`

This module implements the pre-migration duration-weighted model:

- `VisualTimingPolicy`
- `SemanticBeat`
- `TimedVisualBeat`
- `normalize_visual_timing()`
- deterministic beat expansion and equal-duration allocation
- `reuse_group` propagation

Repository search shows no production consumer. Its only remaining consumer is `app/ai-worker/tests/test_visual_timing.py`.

The module conflicts conceptually with the new semantic timing authority because it can generate a valid-looking image clock without source provenance. It and its dedicated test file should be deleted.

### Python visual text-to-audio mapping

`app/ai-worker/src/narrativex_worker/visual_alignment.py` currently contains two responsibilities:

1. `source_anchor -> UTF-16 text range`, used by storyboard materialization.
2. `text range -> audio range`, represented by `VisualAudioRange`, `_map_text_offset_to_audio()`, and `map_visual_ranges_to_audio()`.

The second responsibility became redundant when the migration moved runtime visual audio mapping into backend `NarrationTextClockMapper` during Production Timeline construction. Production AI-worker code does not use the Python audio-mapping path.

The Python audio-mapping types/functions and their dedicated tests should be removed. `visual_alignment.py` should remain as the deterministic source-anchor resolver only.

## Compatibility code to keep

### `MediaPlanningSource.BeatSnapshot.audioStartMs/audioEndMs`

These fields are not dead. `CreateMediaPlanUseCase` still copies them into `MediaBeatPlan` and derives `audioDurationMs` when both are present.

Removing them would widen this cleanup into the media-plan persistence/execution contract. That is a separate migration and is explicitly out of scope.

### Persisted `visual_beats.audio_start_ms/audio_end_ms`

Existing exact persisted timing remains supported by Production Timeline and is preferred when complete. The source-range mapper is a fallback for beats whose persisted exact audio clock is incomplete.

The database columns and related projection logic stay intact.

### Legacy source-anchor compatibility

`VisualBeatAnalysis.source_anchor` remains nullable in the Python schema so existing/test payloads can still parse. New prompting requires it, and materialization writes ranges only when anchors are complete. Tightening this to a hard schema requirement is not part of cleanup because it would be a compatibility change rather than dead-code removal.

## Documentation cleanup

Update the existing visual-beat timing design and implementation plan so they describe only the final architecture:

- AI worker owns anchor resolution, not audio timing.
- Backend owns source-range-to-audio mapping on read.
- Remove references that imply Python visual audio mapping remains part of the implementation.
- Update verification status from stale intermediate CI state to the final post-cleanup CI result.
- Update PR #406 summary/body to call out removal of duration-weighted legacy timing and the final single-authority model.

## Deletion criteria

Code is removed only when all of the following are true:

1. Repository search finds no production consumer.
2. The behavior is superseded by the source-anchored timing architecture.
3. Its removal does not require changing a still-consumed public/domain contract.
4. Focused tests for the replacement path exist.
5. Full CI confirms no hidden consumer.

If CI reveals a real consumer, restore or adapt the minimum required compatibility path instead of forcing deletion.

## Files expected to change

Delete:

- `app/ai-worker/src/narrativex_worker/visual_timing.py`
- `app/ai-worker/tests/test_visual_timing.py`

Simplify:

- `app/ai-worker/src/narrativex_worker/visual_alignment.py`
- `app/ai-worker/tests/test_visual_alignment.py`

Update documentation:

- `docs/superpowers/specs/2026-08-31-visual-beat-audio-alignment-design.md`
- `docs/superpowers/plans/2026-08-31-visual-beat-audio-alignment.md`
- PR #406 body

No database migration is expected.

## Verification

After cleanup:

1. Repository search must show no remaining production references to `visual_timing`, `normalize_visual_timing`, `VisualAudioRange`, or `map_visual_ranges_to_audio`.
2. Anchor resolver tests must still cover ordered exact matching, repeated anchors, out-of-order failure, and UTF-16/non-BMP offsets.
3. Backend `NarrationTextClockMapper` tests remain the authoritative text-to-audio mapping regression.
4. Narration precision tests remain green.
5. Desktop subtitle/render timing tests remain green.
6. Full CI must pass Repository gates, Desktop check, Backend verify, AI worker tests, Ruff, and Mypy before the cleanup is considered complete.

## Non-goals

- No removal of media-plan audio fields.
- No database column removal.
- No forced word/phoneme alignment.
- No redesign of media planning or rendering contracts.
- No fallback relaxation.
- No unrelated repository-wide refactor.
