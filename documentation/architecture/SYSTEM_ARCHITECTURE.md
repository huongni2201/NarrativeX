# NarrativeX System Architecture

**Status:** maintained architecture contract
**Authority:** code, migrations, tests, and active ADRs (ADR-0028, ADR-0029, ADR-0030, ADR-0031)


NarrativeX is Desktop-only at the editor boundary, single-user local-first, and project-first. Spring Boot is the durable control plane; `generation-service` is the domain-agnostic compute execution plane; Electron main owns privileged local project-media and final-render execution.

## Runtime Topology

```text
Electron Desktop
  renderer -> UI / route / query / draft state
      |
  preload  -> narrow typed capabilities
      |
  main     -> native files / ProjectStorage / FFmpeg-ffprobe / local render
      |
      v HTTP / REST + SSE
Spring Boot Backend
  |  \
  |   \-> PostgreSQL (authoritative control/business state, Flyway V1-V7)
  |   \-> Vertex Gemini (Chapter Analysis adapter)
  |
  +-> Compute Protocol v1 (HTTP)
        |
        v
  generation-service (local or remote GPU worker)
        |
        +-> VieNeu (TTS)
        +-> WhisperX (forced alignment)
        +-> ComfyUI (RealVisXL image generation)
        +-> media validation
        +-> SQLite execution journal (local crash recovery, ADR-0031)
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

### Spring Boot Backend (Control Plane)
Modular monolith structured around domain boundaries:
- `project`: Project, Chapter source, authoring, and hierarchy persistence.
- `storyboard`: Scene and VisualBeat source anchors, review states, visual directions.
- `character`: Characters, immutable CharacterVersion snapshots, ProjectCharacter participation.
- `assets`: Stable MediaAsset identity, checksums, lineage, and project-relative metadata.
- `generation`: Admission control, GenerationJob, StageAttempt, ProviderOperation, capacity limits.
- `compute`: ComputeTask compilation, HTTP dispatch to generation-service, callback reconciliation.
- `analysis`: Chapter analysis orchestration via Vertex Gemini adapter.
- `render`: Immutable project render snapshots, lease assignment, FinalArtifact metadata.
- `catalog`: System profiles, voice reference catalogs, style presets.
- `runtime configuration`: Target endpoints, capability limits, operational settings.

Per ADR-0030, caller identity is not threaded through business logic; the backend never persists absolute machine paths and never proxies final MP4 video bytes.

### Generation Service (`app/generation-service`)
Domain-agnostic GPU execution plane implementing hexagonal architecture (ADR-0028/ADR-0029):
- Implements `contracts/compute/v1/` task protocols over HTTP;
- Workload adapters: VieNeu TTS, WhisperX forced alignment, ComfyUI image generation, media validation;
- Local SQLite execution journal (`.runtime/execution_journal.sqlite3`) for crash recovery checkpoints (`NOT_SUBMITTED`, `SUBMITTING`, `SUBMITTED`, `UNKNOWN`, ADR-0031);
- Artifact capability transport with SHA-256 verification;
- Zero access to the PostgreSQL business database and zero domain entity awareness.

## Authority Boundaries

| Concern | Authority |
|---|---|
| Project / Chapter / Storyboard / Continuity | PostgreSQL (Spring Boot backend) |
| Generation jobs / Stage attempts / Operations | PostgreSQL (Spring Boot backend) |
| System capacity limits & reservations | PostgreSQL (Spring Boot backend) |
| Production media selection | PostgreSQL (Spring Boot backend) |
| Narration & alignment metadata | PostgreSQL (Spring Boot backend) |
| Task submission & crash recovery | generation-service SQLite journal |
| Project file locations & manifest | Desktop `project.manifest.json` |
| Render segment cache & journal | Desktop workspace `work/` |
| Final MP4 video bytes | Desktop workspace `artifacts/` |
| Final artifact metadata | PostgreSQL (Spring Boot backend) |

Per ADR-0030, application identity and account ownership models (User, Account, Session, OAuth, Tenant) do not exist.

## Local / Remote Compute Split

Compute execution is separated from business control:
- **Control Plane**: Spring Boot backend evaluates admission, checks capacity limits, materializes durable attempt records, and compiles self-contained `ComputeTask` payloads.
- **Execution Plane**: `generation-service` runs either locally or on a remote GPU worker (e.g. ephemeral Windows RTX 3090). It executes the workload and reports completion/failure via callback or polling endpoint.
- **Arbitration**: On single-GPU targets, `GpuResidencyManager` provides logical mutual exclusion between conflicting heavy runtimes.

## Primary Data Flows

### 1. Compute Task Execution
```text
User action / scheduled generation
  -> backend validates policy & persists durable intent (PostgreSQL)
  -> backend builds closed ComputeTask (contracts/compute/v1/)
  -> backend submits ComputeTask via HTTP to generation-service
  -> generation-service records submission state (SQLite journal, ADR-0031)
  -> generation-service executes task via adapter (VieNeu, WhisperX, ComfyUI, validation)
  -> generation-service notifies backend callback / backend reconciles
  -> backend applies domain state transition in PostgreSQL
  -> Desktop receives SSE event & updates editor state
```

### 2. Chapter Analyze
```text
Saved Chapter source text
  -> backend admission + immutable source identity
  -> GenerationJob / StageAttempt persistence
  -> Vertex Gemini chapter analysis adapter
  -> stale-source guard verification
  -> Character, Location, Scene, VisualBeat materialization in PostgreSQL
```

### 3. Narration & Alignment
```text
TTS:
  generation-service VieNeu synthesis -> WAV audio
  -> WhisperX forced alignment -> timestamp spans
  -> project-local media -> Desktop ProjectStorage materialization

USER_PROVIDED_AUDIO:
  native audio import -> logical master clock
  -> WhisperX forced alignment -> timestamp spans
```
Narration alignment is the authoritative production clock.

### 4. Image Generation
```text
Backend-authorized image task
  -> generation-service ComfyUI adapter (RealVisXL)
  -> media validation
  -> stable MediaAsset + checksum + lineage
  -> project-local media -> Desktop ProjectStorage materialization
```

### 5. Native Asset Import
```text
Renderer requests import
  -> Electron main native picker
  -> inspect & hash file + short-lived selection token
  -> backend registers stable media identity
  -> Desktop ProjectStorage commits file to project directory
```

## Artifact Flow & Storage Contract

```text
Generated project images        -> project-local media -> Desktop ProjectStorage
Generated narration             -> project-local media -> Desktop ProjectStorage
Imported image/audio/video      -> Desktop ProjectStorage
PROJECT voice reference         -> Desktop ProjectStorage / project.manifest.json
GLOBAL_LOCAL voice reference    -> local application voice library
Render work / segment cache     -> Desktop project workspace/work
Final MP4                       -> Desktop project workspace/artifacts
Business / job metadata         -> PostgreSQL
```

Project working media stays local. The backend coordinates metadata and leases but never stores, proxies, or serves video/audio bytes.

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
