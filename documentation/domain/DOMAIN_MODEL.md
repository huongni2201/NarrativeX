# NarrativeX V1.11 — Domain Model

**Canonical source:** `../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`  
**Implementation evidence:** `../TRACEABILITY.md`

## Aggregate / authority model

```text
Project -> StoryVersion -> Chapter
                        -> StoryboardRevision
                            -> Scene
                                -> VisualBeat

Character -> CharacterVersion
          -> CharacterAppearance
Project -> ProjectCharacter -> Character
Project -> ProjectLocation
Scene -> SceneCharacter -> ProjectCharacter
VisualBeat -> VisualBeatCharacter -> ProjectCharacter

OperationPlan / MediaPlan
  -> GenerationJob
      -> StageAttempt
          -> ProviderOperation

NarrationRequest
  -> NarrationAsset
      -> NarrationAlignment

NarrationDocument / NarrationSet / NarrationPart / AlignmentRun
  -> broader logical multi-part narration foundations

MediaAsset metadata -> immutable generated/imported media identity
ProductionBeatMediaSelection -> selected media for a VisualBeat
FinalArtifact metadata -> local final-video identity; bytes remain in Desktop project storage
```

PostgreSQL is authoritative for durable domain/control metadata. Electron main owns machine-local project bytes referenced by stable IDs/checksums and project-relative manifest paths.

## Project, StoryVersion and Chapter

`Chapter` is the authoritative saved source unit consumed by current analysis and generated narration flows.

Key source identity:

```text
chapterId
rowVersion
sourceHash
sourceText
```

Expensive work pins source identity. A later source edit must not silently mutate historical analyzed/generated state for the older source snapshot.

The current product baseline does not maintain a translation/content-variant generation layer.

## Storyboard model

```text
Chapter
  -> current_storyboard_revision_id
  -> StoryboardRevision
      -> Scene(order_index)
          -> VisualBeat(order_index)
```

Scene/VisualBeat are durable semantic production structures, not disposable UI-only decomposition.

Current VisualBeat semantic fields include title, visual intent, review state, motion/camera metadata and nullable source/audio timing/override columns.

Important distinction: nullable database timing columns are schema capability, not proof that every current analysis flow populates them.

## Character and continuity model

```text
Character
  reusable owner/workspace identity

ProjectCharacter
  assignment of Character to Project
  role / importance / aliases / groups / story metadata
  optional pinned CharacterVersion

CharacterVersion
  versioned bible + visual_prompt

CharacterAppearance
  project/timeline appearance state
  age / hairstyle / injury / wardrobe / appearance prompt
```

Current Chapter analysis can extract source-grounded Character profile fields and materialize them without replacing an explicitly pinned CharacterVersion. If a ProjectCharacter has no pinned version, analysis may create/pin an AI-derived version from source-grounded data. Chapter-scoped appearance information is stored as `CharacterAppearance` when supported by the source.

Display name is never a relational identity key.

## Scene and VisualBeat Character participation

Participation is explicit at both levels:

```text
SceneCharacter
  Scene -> ProjectCharacter

VisualBeatCharacter
  VisualBeat -> ProjectCharacter
  role = PRIMARY | SECONDARY | BACKGROUND
```

A VisualBeat Character reference must identify a Character already present in its parent Scene. Analysis should include only Characters actually visible in the beat rather than copying the whole Scene cast into every beat.

## Visual Beat timing coordinate systems

Three coordinate systems must remain distinct:

```text
Chapter source position
  visual_beats.text_start / text_end
        |
        v
Chapter narration position
  visual_beats.audio_start_ms / audio_end_ms
        |
        v
Project production timeline
  chapter global start + local beat timing
  -> ProductionTimeline Beat.startMs/endMs
```

### Current AS-IS

- semantic VisualBeat materialization exists;
- narration alignment persistence exists with text/audio spans;
- immutable MediaPlan timing and generic timeline fallback logic exist;
- exact deterministic VisualBeat `text_start/text_end` are not yet materialized for every analyzed beat;
- current narration completion does not yet reconcile every storyboard beat into exact `audio_start_ms/audio_end_ms`;
- generic fallback timeline geometry must not be described as exact narration alignment.

### Approved target

```text
semantic source-segment selection
  -> worker-owned UTF-16 half-open text_start/text_end
  -> compatible narration alignment
  -> deterministic source-to-audio reconciliation
  -> audio_start_ms/audio_end_ms
  -> global production timeline timing
```

AI does not calculate numeric character offsets or timestamps.

## Narration semantics

Code-aligned strategy vocabulary:

```text
NarrationStrategy
  TTS
  USER_PROVIDED_AUDIO
```

Generated narration persists a `NarrationRequest`, immutable `NarrationAsset` metadata and a source-hash-bound `NarrationAlignment` containing text/audio spans.

Broader `NarrationSet` / ordered `NarrationPart` / document/alignment-run tables provide foundations for multi-part user audio and one logical global audio clock. Part boundaries do not imply Chapter boundaries. `USER_PROVIDED_AUDIO` must bypass TTS for its covered scope.

Arbitrary multi-part production coverage/correction remains PARTIAL and should not be inferred merely from schema presence.

## Media planning semantics

`ProductionMode` is product policy; `MotionStrategy` is the authorized execution decision. The backend resolves/persists the exact immutable MediaPlan revision and workers/Desktop execute authorized policy.

```text
ProductionMode: IMAGE_MOTION | HYBRID_LOCAL_I2V
MotionStrategy: BASIC_IMAGE_MOTION | IMAGE_TO_VIDEO
```

`IMAGE_MOTION` cannot authorize `IMAGE_TO_VIDEO`.

A current valid MediaPlan supersedes storyboard draft/fallback timing for production/render planning.

## Beat media selection

`production_beat_media_selections` is durable non-destructive editor state mapping a Project + VisualBeat to a selected MediaAsset plus supported fit/trim settings.

A VisualBeat may select image or video media. Image-only camera/motion controls must not be assumed to have identical semantics for video-selected beats.

## Override semantics

VisualBeat fields such as:

```text
aspect_ratio_override
quality_tier_override
```

are nullable overrides. `NULL` means inherit project/default policy; it does not mean AI analysis failed to return a required field.

## Snapshot / immutability rules

- Chapter workflows pin `chapterId + rowVersion + sourceHash`.
- Storyboard revisions preserve source/version identity.
- Completed ProviderOperation results are immutable except idempotent same-fingerprint replay.
- Narration alignment is bound to source identity/hash.
- MediaAsset bytes may use R2 during generated provider/worker transport and are materialized into Desktop ProjectStorage when needed; worker scratch is not durable identity.
- FinalArtifact is backend metadata only; Electron main owns local MP4 bytes and direct playback/export.
- Approved/locked historical state is not destructively overwritten.
- Explicitly pinned CharacterVersion state is not silently replaced by later AI analysis.

## Persistence direction

Repository/application ports stay technology-neutral. Production infrastructure persistence uses MyBatis + explicit PostgreSQL SQL across backend boundaries, with PostgreSQL contract/concurrency tests for schema-specific behavior.

Flyway V1-V8 form the clean pre-release baseline. After the first production deployment, applied migrations become immutable and later changes are append-only.
