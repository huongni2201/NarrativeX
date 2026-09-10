# ADR-0023: Source-anchored visual timing derived from narration alignment

**Status:** Accepted  
**Date:** 2026-08-31

## Context

NarrativeX previously carried duration-weighted visual timing helpers and persisted VisualBeat audio timing that could appear authoritative without deterministic source provenance. The current implementation has migrated to source-anchored timing.

The final responsibility chain is:

```text
VisualBeat source_anchor
  -> deterministic UTF-16 textStart/textEnd
  -> narration/subtitle alignment spans
  -> backend NarrationTextClockMapper
  -> production audio start/end/duration
```

Narration remains the master clock.

## Decision

### AI worker responsibility

The analysis/materialization side resolves a VisualBeat source anchor into deterministic UTF-16 source-text ranges. It does not own the production text-to-audio mapping.

`VisualBeatAnalysis.source_anchor` remains nullable at the Python model boundary for legacy/test payload compatibility, but current generated storyboard output is stricter: every visual beat must carry a source anchor. Storyboard materialization rejects partial or all-missing anchor sets before activating the revision.

### Narration responsibility

Narration owns authoritative encoded-audio duration and source/alignment spans. Subtitle/alignment data must stay tied to the same persisted source identity used for production.

### Backend production timeline responsibility

The backend maps VisualBeat text ranges through narration alignment when constructing the production timeline. This is the authoritative runtime text-to-audio mapping location.

Persisted `visual_beats.audio_start_ms/audio_end_ms` are not Production Timeline inputs. Production timing is derived at runtime from deterministic VisualBeat text ranges and the current narration alignment. Any persisted timing fields that remain for separate compatibility/planning consumers must not flow into render admission.

### Review fallback versus render readiness

When exact aligned timing is unavailable on legacy/manual data, the Editor may receive provisional fallback timing so the storyboard remains inspectable. Provisional timing does not make a Chapter ready for final render.

Final render readiness requires an exact contiguous aligned clock that covers the narration timeline, together with READY narration and READY effective media.

### Legacy duration-weighted timing

The removed duration-weighted visual timing module is not part of the production architecture and must not be reintroduced as a fallback that can bypass narration/source alignment.

## Consequences

- Documentation must describe source anchors/text ranges as the durable semantic bridge from story text to the audio clock.
- Current AI-generated storyboards cannot silently persist without deterministic source provenance.
- `audio_start_ms/audio_end_ms` must not be consumed by the Production Timeline or render-admission path.
- Python worker code should not duplicate backend text-to-audio mapping.
- Render readiness remains fail-closed when exact aligned timing cannot be established.
- Compatibility media-plan timing fields may remain until their consumers are migrated separately.

## Verification evidence

Current implementation evidence includes:

- `visual_alignment.py`: deterministic source-anchor range resolution;
- `materialization/storyboard.py`: complete-anchor admission gate for generated storyboards;
- `NarrationTextClockMapper`: backend text-range to narration-clock mapping;
- `GetProductionTimelineUseCase`: derive aligned beat timing on read and gate render readiness on exact timing;
- narration precision and production-timeline tests covering alignment and fail-closed fallback behavior.
