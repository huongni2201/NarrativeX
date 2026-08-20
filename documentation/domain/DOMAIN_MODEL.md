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

MediaAsset / FinalArtifact metadata -> immutable R2 object
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
ProductionMode: IMAGE_MOTION | HYBRID_LOCAL_I2V
MotionStrategy: BASIC_IMAGE_MOTION | IMAGE_TO_VIDEO
```

`IMAGE_MOTION` can never authorize `IMAGE_TO_VIDEO`.

## Snapshot / immutability rules

- Chapter workflows pin `chapterId + rowVersion + sourceHash`.
- Narration fingerprints include ordered immutable audio-part identities; document fingerprints include selected Chapter revision/source identities.
- Completed ProviderOperation results are immutable except for idempotent same-fingerprint replay.
- MediaAsset/FinalArtifact bytes are immutable R2 objects; local files are not durable identity.
- Approved/locked historical state is not destructively overwritten.

## Persistence direction

Repository/application ports stay technology-neutral. Infrastructure persistence converges on MyBatis + explicit SQL + PostgreSQL. ProviderOperation, Chapter and Project are already MyBatis-backed; remaining boundaries migrate incrementally with PostgreSQL contract/concurrency evidence.
