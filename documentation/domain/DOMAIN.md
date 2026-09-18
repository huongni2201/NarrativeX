# NarrativeX Domain Model and Business Rules

**Status:** maintained domain contract  
**Authority:** code, migrations, tests, and active ADRs (ADR-0018, ADR-0019, ADR-0020, ADR-0021)

## Core Aggregate Structure

`	ext
Project -> StoryVersion -> Chapter
                        -> Scene -> VisualBeat

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
  -> ordered NarrationPart snapshots
  -> NarrationTimeline / NarrationSpan

MediaAsset metadata -> immutable project media identity
FinalArtifact metadata -> immutable final-video metadata; MP4 bytes in Desktop storage
`

## Business Rules and Invariants

### 1. Project as Business Root (ADR-0020)
- **BR-01**: Project is the primary business and data boundary. The application boots directly into the local workspace.
- **BR-02**: There is no synthetic application User, Account, Guest installation, Session, OAuth token, role gate, or tenant isolation model.
- **BR-03**: Project creation and Chapter edits persist source text and metadata only; they never implicitly trigger expensive AI or render operations.

### 2. Hierarchy, Identity, and Continuity
- **BR-10**: Script structure strictly follows Project -> Chapter -> Scene -> VisualBeat.
- **BR-11**: Chapter source text is authoritative once saved. Workflows pin durable source identity (chapterId, 
owVersion, sourceHash).
- **BR-12**: Character is a reusable canonical identity. Visual/outfit changes (CharacterAppearance, OutfitVersion) do not create new Character identities.
- **BR-13**: CharacterVersion is an immutable snapshot of character references and traits. Scenes link to ProjectCharacter assignments.
- **BR-14**: Re-analysis or regeneration never destructively overwrites approved historical assets; new revisions/attempts are created.

### 3. Narration and Audio as Master Clock
- **BR-20**: Narration alignment is the master clock and duration authority for the production timeline.
- **BR-21**: TTS narrates exact persisted Chapter text without rewriting source.
- **BR-22**: USER_PROVIDED_AUDIO allows single or multiple ordered audio files spanning Chapters. Part boundaries do not define Chapter boundaries; a single logical audio clock is maintained.
- **BR-23**: A USER_PROVIDED_AUDIO plan skips TTS generation. Alignment failures stop for creator review rather than silently substituting generated TTS.
- **BR-24**: Narration document and audio checksums are immutable inputs to downstream planning and final rendering.

### 4. Visual Beats and Timing
- **BR-30**: VisualBeat represents a continuous visual intent and is the primary unit of visual generation.
- **BR-31**: isual_beats stores source text anchors (	ext_start, 	ext_end), not duplicate audio timestamps. Runtime audio spans are mapped dynamically from narration alignment via NarrationTextClockMapper.
- **BR-32**: isual_direction_json is the sole structured camera and composition authority.
- **BR-33**: VisualGenerationMode supports IMAGE (implemented via ComfyUI) and VIDEO (retained for web/browser workflows; video generation runtime is currently deferred / not implemented).
- **BR-34**: Production mode is IMAGE_MOTION (keyframe plus deterministic camera motion).

### 5. Provider Durability and Safety
- **BR-40**: Persist ProviderOperation intent before initiating external network or compute I/O.
- **BR-41**: Ambiguous external responses or timeouts result in UNKNOWN state. Blind resubmission is strictly prohibited; reconciliation or manual recovery must occur first.
- **BR-42**: Provider mutations enforce optimistic locking and expected-state predicates (
owVersion, CAS). Terminal states (COMPLETED, FAILED, CANCELED) never reopen.
- **BR-43**: COMPLETED with an identical 
esult_fingerprint is idempotent. A different fingerprint for the same operation is an invariant conflict.
- **BR-44**: Capacity enforcement is non-monetary: CAPACITY and LONGFORM_EXPORT reservations limit concurrent system load. There is no monetary billing, credit ledger, or per-user quota.

### 6. Storage and Local Media Contract
- **BR-50**: Binary media is not stored in PostgreSQL.
- **BR-51**: Project media bytes live on the local workstation, managed by Electron main (ProjectStorage) and tracked in project.manifest.json.
- **BR-52**: Reusable voice references use PROJECT (project-local) or GLOBAL_LOCAL (local application voice library) scopes.
- **BR-53**: Backend coordinates metadata, IDs, checksums, and leases, but never stores, proxies, or serves media bytes.
- **BR-54**: Final render output is validated locally before FinalArtifact metadata is committed to PostgreSQL under the active lease.

### 7. Control Plane and Execution Plane Separation
- **BR-60**: Spring Boot backend is the sole authority for business domain state, admission control, durable jobs, leases, and PostgreSQL persistence.
- **BR-61**: pp/generation-service is a domain-agnostic compute execution plane. It processes closed ComputeTask payloads over HTTP, manages a local SQLite execution journal, and has zero direct access to PostgreSQL or project files.

## Active Domain Glossary

| Term | Definition |
|---|---|
| **Project** | Root business and storage boundary for a creative story-video endeavor. |
| **StoryVersion** | Active versioned narrative content within a Project. |
| **Chapter** | Major structural section of a story containing text and scenes. |
| **Scene** | Storyboard unit representing narrative continuous action, containing narration and visual beats. |
| **VisualBeat** | Granular visual segment anchored to source text with distinct visual direction; unit of media generation. |
| **Character** | Canonical, reusable character identity across projects and chapters. |
| **CharacterVersion** | Immutable snapshot of character traits and approved visual references. |
| **ProjectCharacter** | Project-scoped assignment of a Character defining role and participation. |
| **ProjectLocation** | Persistent setting or environment context assigned to scenes. |
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
| **ComputeTask** | Self-contained, domain-agnostic task specification defined by contracts/compute/v1/ dispatched to generation-service. |
