# Shot Domain

Owned by [ADR-0008](../decisions/ADR-0008-video-first-shot-production.md); execution safety by [ADR-0003](../decisions/ADR-0003-durable-compute-execution.md). Which profiles actually run is in [generation routing](../architecture/generation-routing.md) and [current status](../current-status.md).

## Shot

`Shot` (storyboard feature) is the atomic unit of generation, GPU admission, retry and technical validation. It belongs to a `ShotSequence` under one VisualBeat and describes a change between a start state and an end state; a static hold is allowed only when explicitly intended.

| Group | Fields |
|---|---|
| Identity and order | `sequenceId`, `orderIndex`, `narrativePurpose`, `retentionRole` |
| Subject and place | `subjectsJson`, `locationRef` (free-text fallback; the Scene's `ProjectLocation` wins) |
| Kinetic spec | `startStateJson`, `actionJson`, `endStateJson` |
| Camera and motion | `compositionJson`, `cameraJson`, `subjectMotionJson`, `cameraMotionJson`, `environmentMotionJson` |
| Production | `targetDurationMs`, `generationStrategy`, `qualityProfile`, `continuityFromShotId`, `continuityToShotId`, `status` |

`ShotStatus`: `PLANNED`, `REFERENCE_PREPARING`, `READY`, `QUEUED`, `GENERATING`, `GENERATED`, `VALIDATING`, `PASSED`, `FAILED`, `RETRY_READY`, `MANUAL_REVIEW`, `SELECTED`.

## Take

Each attempt creates an immutable `Take`: attempt number, provider, model, generation mode, a frozen input snapshot and a request fingerprint. Later edits to the Shot, voice, model or prompt settings never rewrite an admitted Take.

- **Admission** is durable: the operation intent is persisted before any external I/O. Queue capacity and execution-slot claims are separate checks under one advisory lock, and video execution is serialized through a single slot.
- **UNKNOWN** attempts must be reconciled before regeneration; the backend never blind-resubmits.
- **Idempotency:** the request fingerprint excludes prompt settings, so replay is stable; the input fingerprint includes them.
- A Take becomes selectable only after terminal success, a positive source duration and a technical PASS. Automatic QC (see [generation domain](generation-domain.md)) is advisory and never changes that.

## SelectedTake

Binds one Take to its Shot with `sourceInMs`/`sourceOutMs` (strictly increasing), an optimistic `rowVersion` and the human content-review checklist plus fingerprint. Selection is an explicit, versioned action: a stale version fails with a conflict. Legacy selections without a review fingerprint need review again before they can be reselected.

## Audio ownership (native AV)

With several Shots in one VisualBeat, every complete AudioCue has exactly one playback owner in its ShotSequence (`shot_audio_cue_allocations`, pinned to the cue row version). A cue is kept whole in one Shot because the native profile cannot preserve a sentence split across independently generated Takes. The native profile admits `DIALOGUE` cues only; `NARRATOR`, `INNER_MONOLOGUE` and `SYSTEM` are rejected before a Take or job exists.

## Related

[Domain model](domain-model.md) · [Generation domain](generation-domain.md) · [Editing pipeline](../architecture/editing-pipeline.md)
