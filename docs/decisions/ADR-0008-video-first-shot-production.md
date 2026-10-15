# ADR-0008: Video-first production — Shot, Take, SelectedTake and capability-gated generation

- **Status:** Accepted
- **Date:** 2026-10-15 (consolidated)
- **Replaces:** former ADR-0026 and the older shot-as-production-unit, reference-only image generation, generation-router, take/editing-director, retention-planning and LTX native-AV runtime decisions (Git history)

## Context

The former image-first pipeline (one still image per VisualBeat with Ken Burns pan and zoom) could not show real action or reaction, tied each beat to one picture and made pacing follow sentence length. Current video foundation models can produce usable moving footage, but only for the exact profiles a worker actually supports.

## Decision

### Production model

1. Production is video-first: `StoryBeat → VisualBeat (dramatic intent) → ShotSequence → Shot → Take → SelectedTake → render snapshot → Desktop render`.
2. **Shot** is the atomic unit of generation, GPU admission, retry and technical validation. It describes a change between a start state and an end state. A static hold is allowed only when it is explicitly intended.
3. Each generation attempt creates an immutable **Take** with a frozen input snapshot and fingerprint. A Take is selectable only after terminal success, a positive source duration and a technical-validation PASS.
4. **SelectedTake** binds one Take to its Shot with frozen source in/out points. The timeline consumes SelectedTakes, never raw outputs. Editing compiles them with the applicable audio clock into the immutable render snapshot (ADR-0005).
5. New projects use `production_mode = VIDEO_FIRST`. `IMAGE_MOTION` projects stay readable and exportable through legacy snapshot adapters. Ken Burns (zoompan) is not used on the active path.

### Image generation is supporting only

6. Image generation produces references and packaging only: `CHARACTER_REFERENCE`, `LOCATION_REFERENCE`, `START_FRAME`, `END_FRAME`, `KEYFRAME`, `THUMBNAIL`, `POSTER`. It never produces primary footage. Browser-based image generation is retired.

### Strategy routing and capability truth

7. The domain uses provider-neutral strategies: `TEXT_TO_VIDEO`, `IMAGE_TO_VIDEO`, `FIRST_LAST_FRAME`, `MULTI_KEYFRAME`, `VIDEO_EXTEND`, `VIDEO_RETAKE`. Model flags, tensors and quantization stay inside generation-service adapters.
8. Planning a strategy does not make it runnable. Backend admission fails closed unless the worker advertises the exact task type, schema, model revision and workflow profile. Unsupported strategies are rejected before any Take or job exists, and nothing silently falls back to another strategy.
9. Audio modes: `LTX_NATIVE_AV` (synchronized take audio) or explicit external narration (ADR-0007). `AUDIO_FIRST` stays blocked until a profile supports it.

### Retention and automation scope

10. Hook plans, retention maps and attention events may be produced by analysis and persisted for creator review. No retention engine, automatic pacing enforcement, Shot Director, Editing Director, automatic semantic QA loop or post-publish feedback loop is part of the current architecture. Each of those requires its own ADR before implementation.

## Invariants

1. Every admitted Take is reproducible from its frozen snapshot. Later edits to Shot, voice, model or prompt settings never rewrite it.
2. Video execution is serialized through a single execution slot. Queue admission (capacity) and slot claims are separate checks under the shared advisory lock.
3. The active profile list lives in [current status](../current-status.md) and [generation routing](../architecture/generation-routing.md), not in this ADR.

## Consequences

- The Compute Protocol carries `video.generate`. Desktop uses a shot board with multi-take review and trimming.
- Character and location consistency depends on reference conditioning, which stays blocked until a worker profile proves it.

## Related

- [ADR-0005](ADR-0005-local-media-and-final-render.md) · [ADR-0006](ADR-0006-story-structure-and-source-anchoring.md) · [Shot domain](../domain/shot-domain.md) · [Generation routing](../architecture/generation-routing.md)
