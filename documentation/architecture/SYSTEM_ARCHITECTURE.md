# NarrativeX System Architecture

**Status:** maintained architecture contract
**Authority:** code, migrations, tests, and active ADRs (ADR-0018, ADR-0019, ADR-0020, ADR-0021, ADR-0024, ADR-0025)

NarrativeX is Desktop-only at the editor boundary, single-user local-first, and project-first. Spring Boot is the durable control plane; `generation-service` is the domain-agnostic compute execution plane; Electron main owns privileged local project media and final-render execution.

## Runtime Topology

```text
Electron Desktop
  renderer -> UI / route / query / draft state
      |
  preload  -> narrow typed capabilities
      |
  main     -> native files / ProjectStorage / FFmpeg-ffprobe / local render
      |                         ^
      v HTTP / REST             | project-scoped SSE generation events
Spring Boot Backend             |
  |                             |
  +-> PostgreSQL (authoritative control/business state, Flyway V1-V8)
  +-> Vertex Gemini (Chapter Analysis adapter)
  +-> Compute Protocol v1 (HTTP)
        |
        v
  generation-service (local or remote GPU worker)
        |
        +-> SQLite execution journal + compute event outbox
        +-> signed callback -> backend idempotent receipt/finalizer
        +-> VieNeu / WhisperX / ComfyUI / media validation
```

Redis and browser-based editors are removed.

## Service Boundaries

### Desktop Renderer

Owns presentation only: screens/routes, React Query caching, editor/timeline draft states, preview interactions, and explicit typed preload calls. It never touches native filesystem/process primitives, credentials, FFmpeg, or durable business policies.

### Preload Bridge

Exposes narrow, task-specific IPC channels. Arbitrary Node.js APIs, filesystem handles, and environment variables are strictly blocked.

### Electron Main

Owns privileged Desktop operations:

- Native file selection, directory access, and SHA-256 integrity hashing;
- ProjectStorage and ProjectCatalog management, local `project.manifest.json` integrity;
- Protected provider credentials and local device identity;
- Desktop render claim, lease heartbeat, and progress reporting;
- FFmpeg and ffprobe execution, render journal and segment cache;
- Direct playback and filesystem export of final MP4 artifacts.

Google/Gemini login in local Chrome profiles is provider/browser state used by browser-driven integrations. It is not NarrativeX authentication, a NarrativeX session, or an application User identity.

### Spring Boot Backend (Control Plane)

Modular monolith structured around domain boundaries:

- `project`: Project, StoryVersion, Chapter source, authoring, and hierarchy persistence;
- `storyboard`: Scene, StoryBeat, AudioCue, VisualBeat source anchors, review states, and visual directions;
- `character`: Characters, immutable CharacterVersion snapshots, ProjectCharacter participation;
- `assets`: Stable MediaAsset identity, checksums, lineage, and project-relative metadata;
- `generation`: Admission control, GenerationJob, StageAttempt, ProviderOperation, and capacity limits;
- `compute`: ComputeTask compilation, HTTP dispatch, signed callback receipt/finalization, and reconciliation;
- `analysis`: Chapter analysis orchestration via Vertex Gemini adapter;
- `render`: Immutable project render snapshots, lease assignment, and FinalArtifact metadata;
- `catalog`: System profiles, voice-reference catalogs, and style presets;
- `runtime configuration`: Target endpoints, capability limits, and operational settings.

Per ADR-0020, caller identity is not threaded through business logic. The backend does not persist absolute machine paths or media bytes in PostgreSQL. It may issue short-lived opaque local-media capabilities for authorized Desktop transfer.

### Generation Service (`app/generation-service`)

Domain-agnostic GPU execution plane implementing hexagonal architecture (ADR-0018/ADR-0019):

- Implements `contracts/compute/v1/` task protocols over HTTP;
- Workload adapters: VieNeu TTS, WhisperX forced alignment, ComfyUI image generation, and media validation;
- Local SQLite execution journal for crash recovery and submission checkpoints (ADR-0021);
- SQLite `compute_event_outbox` records each execution state transition/observation in the same local transaction as the attempt update;
- `OutboxDeliveryService` delivers signed callbacks with retry/backoff and does not mutate terminal execution state when delivery fails;
- Zero access to the PostgreSQL business database and zero domain-entity awareness.

## Authority Boundaries

| Concern | Authority |
|---|---|
| Project -> StoryVersion -> Chapter -> Scene -> StoryBeat -> AudioCue/VisualBeat | PostgreSQL (Spring Boot backend) |
| Generation jobs / Stage attempts / Operations | PostgreSQL (Spring Boot backend) |
| System capacity limits and reservations | PostgreSQL (Spring Boot backend) |
| Production media selection | PostgreSQL (Spring Boot backend) |
| Narration and alignment metadata | PostgreSQL (Spring Boot backend) |
| Worker task state and event delivery checkpoint | generation-service SQLite journal/outbox |
| Project file locations and manifest | Desktop `project.manifest.json` |
| Render segment cache and journal | Desktop workspace `work/` |
| Final MP4 video bytes | Desktop workspace `artifacts/` |
| Final artifact metadata | PostgreSQL (Spring Boot backend) |

Per ADR-0020, application identity and account ownership models (User, Account, Session, OAuth, Tenant) do not exist.

## Event-Driven Compute Orchestration (ADR-0025)

The event path is durable at each boundary:

```text
backend short transaction: persist intent + attempt
  -> external task submission (outside DB transaction)
  -> worker SQLite transaction: update attempt + append compute_event_outbox
  -> async outbox delivery: HMAC-signed callback
  -> backend short receipt/finalization transaction: event_id idempotency + monotonic sequence
  -> project-scoped SSE: job.updated / job.completed / job.failed
```

The callback receipt/finalization transaction performs local database work only; it does not make remote provider calls. If delivery is lost or the outcome is ambiguous, `ComputeReconciliationScheduler` runs a bounded, non-blocking observation outside the transaction and passes the result through the same finalizer. Terminal states are immutable, duplicate event IDs are acknowledged without reprocessing, and stale sequence numbers are no-ops.

## Local / Remote Compute Split

Compute execution is separated from business control:

- **Control Plane**: Spring Boot evaluates admission, checks system capacity, materializes durable attempt records, and compiles self-contained `ComputeTask` payloads.
- **Execution Plane**: `generation-service` runs locally or on a remote GPU worker. It executes the workload and reports observations through signed callbacks; backend reconciliation is the fallback.
- **Arbitration**: On single-GPU targets, `GpuResidencyManager` provides logical mutual exclusion between conflicting heavy runtimes.

## Primary Data Flows

### 1. Compute Task Execution

```text
explicit generation operation
  -> backend validates policy + persists durable intent
  -> backend builds closed ComputeTask
  -> backend submits via HTTP to generation-service
  -> worker journals attempt state + outbox event in SQLite
  -> worker executes adapter and emits signed observations
  -> backend verifies receipt, idempotency, sequence, and final state
  -> scheduler reconciles only when callbacks/submit outcome are ambiguous
  -> backend broadcasts project-scoped SSE event
  -> Desktop invalidates generation, chapter, timeline, and storyboard queries
```

### 2. Chapter Analyze

```text
saved Chapter source text
  -> backend admission + immutable source identity
  -> GenerationJob / StageAttempt persistence
  -> Vertex Gemini chapter analysis adapter
  -> stale-source guard verification
  -> Character, Location, Scene, StoryBeat/AudioCue/VisualBeat materialization where supported
  -> review and compatibility handling for legacy unassigned VisualBeats
```

### 3. Narration and Alignment

```text
ordered AudioCues
  -> NarrationAssembler -> NarrationScript
  -> VieNeu synthesis (or USER_PROVIDED_AUDIO import)
  -> WhisperX forced alignment
  -> AudioCue/StoryBeat timing
  -> VisualBeat source-anchor clock mapping
  -> project-local media -> Desktop ProjectStorage
```

Narration alignment is the authoritative production clock.

### 4. Image Generation

```text
backend-authorized StoryBeat/VisualBeat image task
  -> generation-service ComfyUI adapter (RealVisXL)
  -> media validation
  -> stable MediaAsset + checksum + lineage
  -> project-local media -> Desktop ProjectStorage
```

### 5. Native Asset Import

```text
renderer requests import
  -> Electron main native picker
  -> inspect + hash file + short-lived selection token
  -> backend registers stable media identity
  -> Desktop ProjectStorage commits file to project directory
```

## Artifact Flow and Storage Contract

```text
Generated project images        -> project-local media -> Desktop ProjectStorage
Generated narration             -> project-local media -> Desktop ProjectStorage
Imported image/audio/video      -> Desktop ProjectStorage
PROJECT voice reference        -> Desktop ProjectStorage / project.manifest.json
GLOBAL_LOCAL voice reference    -> local application voice library
Render work / segment cache     -> Desktop project workspace/work
Final MP4                       -> Desktop project workspace/artifacts
Business / job metadata         -> PostgreSQL
```

Project working media stays local. PostgreSQL stores metadata, checksums, keys, leases, and artifact descriptors; backend local-media capabilities may stage or serve authorized local files.

## Final Render Ownership

```text
Backend admits project render
  -> reserve capacity limit
  -> assign paired Desktop device
  -> device claims lease
  -> preflight runtime, disk, and assets
  -> verify exact narration-aligned beat clock
  -> resolve stable IDs and checksums
  -> Electron main executes FFmpeg/ffprobe
  -> subtitle mux (local SRT)
  -> checksum-verified local MP4
  -> backend stores FinalArtifact metadata only
```

- Electron main is the sole final-render executor.
- There is no cloud/server final-render executor, server-side Chapter render path, or remote final-video store.
- Provisional/fallback timing is review-only in the editor and strictly blocked from final render admission.
