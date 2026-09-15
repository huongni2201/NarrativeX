# NarrativeX Current Codebase Map — V1.12

**Canonical baseline:** `documentation/source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_12.md`

## Runtime layout

```text
app/desktop/          Electron / React / TypeScript only editor client
                     + single-user local workspace
                     + local project storage / backup / cache
                     + native asset import
                     + local FFmpeg/ffprobe final render

app/backend-service/  Java / Spring Boot modular monolith
                     control plane, domain metadata, policy, jobs, leases
                     MyBatis + Flyway + PostgreSQL
                     final-artifact metadata only

app/generation-service/ Python domain-agnostic compute execution plane
                     Hexagonal architecture (ports and adapters)
                     Compute Protocol v1 (HTTP task submission & callback)
                     Local SQLite execution journal (submission checkpoints)
                     Adapters: VoiceStudio, WhisperX, ComfyUI, media validation

app/ai-worker/        Legacy Python worker (migration-only)
                     temporary direct-polling worker, scheduled for removal

packages/client-contracts/
                     shared typed Desktop/backend contracts

contracts/           Compute Protocol v1 schemas and task definitions
documentation/       source of truth, architecture, workflows, ADRs, roadmap
```

`app/frontend-web` and browser-based editor clients are removed.

## Desktop main/preload/renderer split

```text
renderer
  -> feature-oriented React UI
  -> React Query backend state
  -> Zustand/editor draft state
  -> timeline / preview / inspector

preload
  -> narrow allow-listed typed capabilities

main
  -> native file dialogs and inspection
  -> ProjectStorage / ProjectCatalog
  -> backup/restore/archive-copy
  -> device identity / render lease execution
  -> FFmpeg/ffprobe ProjectRenderer
```

Renderer code does not own arbitrary filesystem paths, provider secrets or FFmpeg execution.

## Backend highlights

- Spring Boot 4.1.1 / Java 25;
- MyBatis-only production application persistence;
- Single-user local-first architecture per ADR-0030 (no User/Account/Session/Tenant identity model);
- Project is the highest business boundary;
- project/chapter/storyboard/character/location domain foundations;
- saved `chapters.source_text/source_hash` are authoritative Chapter content for analysis/narration;
- durable generation jobs, stages, provider operations, plans, and system capacity limits;
- PROJECT and GLOBAL_LOCAL voice-reference scopes;
- generation SSE snapshots;
- persisted production beat media selections;
- production timeline aggregation using narration as the master clock;
- `NarrationTextClockMapper` derives VisualBeat audio ranges from source text ranges plus narration alignment;
- exact aligned timing remains required for final render readiness;
- local device capability/heartbeat/revocation/render assignment;
- render completion and FinalArtifact metadata without final-video byte storage/proxying.

## Generation service highlights (`app/generation-service`)

- Python 3.12+ FastAPI application implementing Compute Protocol v1;
- Hexagonal architecture:
  - `application/ports/`: execution, journal, executors, artifacts;
  - `application/services/`: execution orchestrator with checkpointing;
  - `adapters/inbound/http/`: REST task submission and health endpoints;
  - `adapters/persistence/`: SQLite execution journal adapter;
  - `adapters/executors/`: VoiceStudio, WhisperX, ComfyUI, media validation;
  - `adapters/artifacts/`: HTTP capability upload/download;
- Zero NarrativeX database access or business domain model knowledge;
- Durable checkpoint states (`NOT_SUBMITTED`, `SUBMITTING`, `SUBMITTED`, `UNKNOWN`) for safe crash recovery (ADR-0031).

## Legacy worker (`app/ai-worker`) — Migration only

- Direct PostgreSQL polling worker;
- Scheduled for complete removal after narration, image, and validation slices cut over to `generation-service`.

## Storage contract

```text
Generated project image/audio/video    -> project-local media
Imported project image/audio/video     -> Desktop ProjectStorage
PROJECT voice reference                -> project-local media / manifest
GLOBAL_LOCAL voice reference           -> local application voice library
Render intermediates/cache             -> local project workspace/work
Backups/snapshots                      -> Desktop-managed local storage
Final MP4                              -> local project workspace/artifacts
Durable business/job metadata          -> PostgreSQL
```

Backend state uses stable IDs/checksums and opaque project-relative keys. It does not persist absolute Desktop filesystem paths or serve final MP4 bytes.

## Visual timing contract

```text
source_anchor
  -> UTF-16 textStart/textEnd
  -> narration/subtitle alignment spans
  -> backend NarrationTextClockMapper
  -> production beat clock
```

`visual_beats` does not persist duplicate `audio_start_ms/audio_end_ms`. If exact timing cannot be established from the current narration alignment, the Editor may receive provisional timing but `readyForRender` remains false. Audio offsets remain valid in narration alignment spans and immutable derived planning/render snapshots where they are execution data rather than storyboard source state.

## Storyboard direction contract

`visual_beats.visual_direction_json` is the sole persisted camera/composition representation. Semantic `cameraMovement` values exposed by backend contracts or render code are derived from that JSON. The current schema never creates standalone VisualBeat `camera_angle` or `camera_movement` columns.

## Flyway baseline

```text
V1__project_story_and_planning.sql
V2__generation_and_media.sql
V3__narration_and_artifacts.sql
V4__catalog_generation_and_render_snapshots.sql
V5__database_logic_and_triggers.sql
V6__indexes.sql
V7__seed_catalog.sql
```

A clean pre-production database applies **V1 → V7** only. The former patch sequences have been folded into the owning baseline migrations, so new databases are created directly in the final schema shape instead of creating legacy columns/tables and later altering or dropping them. Continuity/checkpoints, regeneration, storyboard-generation snapshots, render continuity provenance and render-profile watermark policy are owned directly by the corresponding schema, logic and index migrations. Monetary image/regeneration pricing metadata and legacy credit accounting are not created by the baseline.

At the first production deployment, the accepted V1–V7 history becomes immutable and subsequent schema evolution is append-only starting at V8.

## Production mode contract

The executable backend/worker/database production mode is currently `IMAGE_MOTION`. Generic VIDEO analysis/editor intent and `IMAGE_TO_VIDEO` vocabulary remain separate concepts and do not make `HYBRID_LOCAL_I2V` an implemented production mode.

## Current gaps

```text
compute cutover to generation-service & legacy ai-worker deletion
production packaging / signing / auto-update
richer abrupt-process render recovery UX
richer timeline/review/regeneration workflows
adaptive narration-driven VisualScenePlanner
```

Completed migration plans are historical evidence; remaining work is tracked in `documentation/product/ROADMAP.md`.
