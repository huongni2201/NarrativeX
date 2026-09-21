# NarrativeX Domain Model and Business Rules

**Status:** maintained domain contract  
**Authority:** code, migrations, tests, and active ADRs (ADR-0018, ADR-0019, ADR-0020, ADR-0021, ADR-0025)

## Core Aggregate Structure

```text
Project -> StoryVersion -> Chapter -> Scene -> StoryBeat
                                            -> AudioCue[]
                                            -> VisualBeat[]

Character -> CharacterVersion (immutable snapshot)
Project -> ProjectCharacter -> Character
Project -> ProjectLocation
Scene -> ProjectCharacter / ProjectLocation relations

OperationPlan / MediaPlan
  -> GenerationJob
      -> StageAttempt
          -> ProviderOperation

NarrationDocument
  -> selected Chapter source manifest
NarrationPlan
  -> NarrationStrategy (TTS | USER_PROVIDED_AUDIO)
  -> ordered AudioCue materialization
  -> NarrationScript -> VieNeu -> WhisperX alignment

MediaAsset metadata -> immutable project media identity
FinalArtifact metadata -> immutable final-video metadata; MP4 bytes in Desktop storage
```

`StoryBeat` is the shared semantic unit for narration and visual planning. `AudioCue` is required to belong to a StoryBeat. The schema still permits legacy/manual `VisualBeat` rows without a `story_beat_id`; the read model exposes those rows through a compatibility container. New canonical authoring and planning should attach VisualBeats to StoryBeats.

## Business Rules and Invariants

### 1. Project as Business Root (ADR-0020)

- **BR-01**: Project is the primary business and data boundary. The application boots directly into the local workspace.
- **BR-02**: There is no synthetic application User, Account, Guest installation, Session, OAuth token, role gate, or tenant isolation model.
- **BR-03**: Project creation and Chapter edits persist source text and metadata only; they never implicitly trigger expensive AI or render operations.

### 2. Hierarchy, Identity, and Continuity

- **BR-10**: Script structure follows `Project -> StoryVersion -> Chapter -> Scene -> StoryBeat -> {AudioCue[], VisualBeat[]}`.
- **BR-11**: Chapter source text is authoritative once saved. Workflows pin durable source identity (`chapterId`, `storyVersion`, `sourceHash`).
- **BR-12**: Character is a reusable canonical identity. Visual/outfit changes do not create new Character identities.
- **BR-13**: CharacterVersion is an immutable snapshot of character references and traits. Scenes link to ProjectCharacter assignments.
- **BR-14**: Re-analysis or regeneration never destructively overwrites approved historical assets; new revisions and attempts are created.
- **BR-15**: A StoryBeat is the shared semantic parent for narration and visual intent. Legacy unassigned VisualBeats are compatibility data, not the canonical hierarchy.

### 3. Narration and Audio as Master Clock

- **BR-20**: Narration alignment is the master clock and duration authority for the production timeline.
- **BR-21**: TTS narrates exact persisted Chapter text without rewriting source.
- **BR-22**: USER_PROVIDED_AUDIO allows single or multiple ordered audio files spanning Chapters. Part boundaries do not define Chapter boundaries; a single logical audio clock is maintained.
- **BR-23**: A USER_PROVIDED_AUDIO plan skips TTS generation. Alignment failures stop for creator review rather than silently substituting generated TTS.
- **BR-24**: Narration documents and audio checksums are immutable inputs to downstream planning and final rendering.
- **BR-25**: NarrationAssembler orders AudioCues into a NarrationScript before provider execution; implementation-level provider segmentation does not change the StoryBeat/AudioCue semantic model.

### 4. Visual Beats and Timing

- **BR-30**: VisualBeat represents a continuous visual intent and is the primary unit of visual generation within its StoryBeat.
- **BR-31**: `visual_beats` stores source-text anchors (`text_start`, `text_end`), not duplicate audio timestamps. Runtime audio spans are mapped dynamically from narration alignment via NarrationTextClockMapper.
- **BR-32**: `visual_direction_json` is the sole structured camera and composition authority.
- **BR-33**: VisualGenerationMode defaults to VIDEO through native video foundation models (LTX-2.5) via provider-neutral `video.generate` compute protocol. IMAGE is retained in a supporting role (reference conditioning, character portraits, keyframes, thumbnails).
- **BR-34**: Production mode is VIDEO_FIRST (Shot sequence generation with Takes, multi-take review, and selectedTake persistence). Legacy IMAGE_MOTION is retained for backward-compatible project inspection.

### 5. Provider Durability and Safety

- **BR-40**: Persist ProviderOperation intent before initiating external network or compute I/O.
- **BR-41**: Ambiguous external responses or timeouts result in UNKNOWN state. Blind resubmission is prohibited; reconciliation or manual recovery must occur first.
- **BR-42**: Provider mutations enforce optimistic locking and expected-state predicates. Terminal states (COMPLETED, FAILED, CANCELED) never reopen.
- **BR-43**: COMPLETED with an identical result fingerprint is idempotent. A different fingerprint for the same operation is an invariant conflict.
- **BR-44**: Capacity enforcement is non-monetary: CAPACITY and LONGFORM_EXPORT reservations limit concurrent system load. There is no monetary billing, credit ledger, or per-user quota.

### 6. Storage and Local Media Contract

- **BR-50**: Binary media is not stored in PostgreSQL.
- **BR-51**: Project media bytes live on the local workstation, managed by Electron main (ProjectStorage) and tracked in `project.manifest.json`.
- **BR-52**: Reusable voice references use PROJECT (project-local) or GLOBAL_LOCAL (local application voice library) scopes.
- **BR-53**: Backend coordinates metadata, IDs, checksums, leases, and short-lived opaque local-media capabilities; durable project media bytes remain in Electron-owned storage.
- **BR-54**: Final render output is validated locally before FinalArtifact metadata is committed to PostgreSQL under the active lease.

### 7. Control Plane and Execution Plane Separation

- **BR-60**: Spring Boot backend is the sole authority for business domain state, admission control, durable jobs, leases, and PostgreSQL persistence.
- **BR-61**: `app/generation-service` is a domain-agnostic compute execution plane. It processes closed ComputeTask payloads over HTTP, manages a local SQLite execution journal and event outbox, and has zero direct access to PostgreSQL or project files.
- **BR-62**: Compute events are signed, receipt-idempotent, and finalized monotonically. Scheduled reconciliation is a non-blocking fallback for ambiguous external task state.

## Active Domain Glossary

| Term | Definition |
|---|---|
| **Project** | Root business and storage boundary for a creative story-video endeavor. |
| **StoryVersion** | Versioned narrative content within a Project. |
| **Chapter** | Major structural section of a story containing text and Scenes. |
| **Scene** | Storyboard unit representing a continuous narrative action and containing StoryBeats. |
| **StoryBeat** | Shared semantic planning unit within a Scene for narration and visual intent. |
| **AudioCue** | Ordered narration cue belonging to a StoryBeat; contributes to the NarrationScript and master clock. |
| **VisualBeat** | Granular visual segment belonging to a StoryBeat when canonically authored, anchored to source text with distinct visual direction. |
| **Character** | Canonical, reusable character identity across projects and chapters. |
| **CharacterVersion** | Immutable snapshot of character traits and approved visual references. |
| **ProjectCharacter** | Project-scoped assignment of a Character defining role and participation. |
| **ProjectLocation** | Persistent setting or environment context assigned to Scenes. |
| **NarrationScript** | Coherent Chapter narration assembled from ordered AudioCues and sent to the narration execution path. |
| **NarrationPlan** | Authoritative audio execution plan specifying strategy (TTS or USER_PROVIDED_AUDIO) and timeline. |
| **NarrationTimeline** | Timestamped word and phoneme alignment derived from WhisperX, serving as the production master clock. |
| **MediaAsset** | Tracked image, audio, or video asset with stable identity, SHA-256 checksum, and project lineage. |
| **Approved Asset** | Creator-selected definitive MediaAsset assigned to a VisualBeat for production rendering. |
| **GenerationJob** | Durable business-level job tracking end-to-end progress of analysis, narration, image, or render workflows. |
| **StageAttempt** | Specific execution attempt of a pipeline stage within a GenerationJob. |
| **ProviderOperation** | Durable record of an external or GPU compute invocation, tracking submission state and fingerprints. |
| **UNKNOWN** | Status indicating an external operation outcome is ambiguous; requires reconciliation before resubmission. |
| **FinalArtifact** | Validated metadata record of the final rendered MP4 video; file bytes reside in Desktop project storage. |
| **ProjectStorage** | Electron main component managing local project directory layout, file registration, and manifest integrity. |
| **ComputeTask** | Self-contained, domain-agnostic task specification defined by `contracts/compute/v1/` and dispatched to generation-service. |
