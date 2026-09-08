# NarrativeX V1.11 — Domain Model

**Canonical source:** `../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`

## Aggregate / authority model

```text
Project -> StoryVersion -> Chapter
                        -> Scene -> VisualBeat

Character -> CharacterVersion
Project -> ProjectCharacter -> Character
Project -> ProjectLocation
Scene -> ProjectCharacter / Location relations

OperationPlan / MediaPlan
  -> GenerationJob
      -> StageAttempt
          -> ProviderOperation

NarrationDocument
  -> selected Chapter revision/source manifest
NarrationPlan
  -> NarrationStrategy
  -> NarrationSet / ordered NarrationPart snapshots
  -> NarrationTimeline / NarrationSpan

MediaAsset metadata -> immutable remote/local project media identity
FinalArtifact metadata -> immutable local final-video object; bytes remain in Desktop project storage
```

## Narration semantics

Code-aligned strategy vocabulary:

```text
NarrationStrategy
  TTS
  USER_PROVIDED_AUDIO
```

`USER_PROVIDED_AUDIO` supports an ordered variable number of immutable parts. Part boundaries do not imply Chapter boundaries. The system builds one global audio clock and alignment spans map source text positions to global audio time. The user-audio execution plan does not contain a TTS stage.

## Media planning semantics

`ProductionMode` is product policy; `MotionStrategy` is the authorized execution decision. The backend resolves/persists the exact immutable MediaPlan revision and the worker executes it.

```text
ProductionMode: IMAGE_MOTION
MotionStrategy: BASIC_IMAGE_MOTION | IMAGE_TO_VIDEO
```

The current executable production policy is `IMAGE_MOTION`, which cannot authorize `IMAGE_TO_VIDEO`. `IMAGE_TO_VIDEO` remains provider-neutral motion vocabulary for deferred/browser workflows; it does not imply that a second production mode is currently implemented.

## Snapshot / immutability rules

- Chapter workflows pin `chapterId + rowVersion + sourceHash`.
- Narration fingerprints include ordered immutable audio-part identities; document fingerprints include selected Chapter revision/source identities.
- Completed ProviderOperation results are immutable except for idempotent same-fingerprint replay.
- MediaAsset bytes may use R2 during provider/worker transport and are materialized into Desktop ProjectStorage when needed; local worker files are not durable identity.
- FinalArtifact is backend metadata only; Electron main owns the local MP4 bytes and direct playback/export.
- Approved/locked historical state is not destructively overwritten.

## Persistence direction

Repository/application ports stay technology-neutral. Infrastructure persistence uses MyBatis + explicit SQL + PostgreSQL across the current backend boundaries, with PostgreSQL contract/concurrency evidence for schema-specific behavior.
