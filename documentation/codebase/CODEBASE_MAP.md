# NarrativeX Current Codebase Map — V1.12

**Canonical baseline:** `documentation/source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`

## Runtime layout

```text
app/desktop/          Electron / React / TypeScript only editor client
                     + stable guest bootstrap
                     + local project storage / backup / cache
                     + native asset import
                     + local FFmpeg/ffprobe final render

app/backend-service/  Java / Spring Boot modular monolith
                     auth/ownership/domain/policy/control plane
                     MyBatis + Flyway + PostgreSQL
                     final-artifact metadata only

app/ai-worker/        Python async AI/media/provider worker
                     analysis / image / narration / validation

packages/client-contracts/
                     shared typed Desktop/backend contracts

contracts/            backend <-> worker contracts
documentation/        source of truth, architecture, workflows, ADRs, roadmap
```

`app/frontend-web` and the Caddy frontend ingress layer are removed.

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
  -> backend session transport
  -> guest installation credential
  -> system-browser/deep-link auth
  -> native file dialogs and inspection
  -> ProjectStorage / ProjectCatalog
  -> backup/restore/archive-copy
  -> device identity/execution
  -> FFmpeg/ffprobe ProjectRenderer
  -> Gemini Web Chrome/CDP automation and protected clipboard
```

Renderer code does not own arbitrary filesystem paths, session cookies, provider secrets or FFmpeg execution.

## Backend highlights

- Spring Boot 4.1.0 / Java 25;
- MyBatis-only production application persistence;
- stable Desktop guest installation identities and guest ownership transfer;
- project/chapter/storyboard/character/location domain foundations;
- saved `chapters.source_text/source_hash` are authoritative Chapter content for analysis/narration;
- durable generation jobs, stages, provider operations, plans, outbox and quota foundations;
- PROJECT/ACCOUNT voice-reference scope with explicit storage validation;
- owner-scoped generation SSE snapshots and voice-preview jobs;
- persisted production beat media selections;
- production timeline aggregation using narration as the master clock;
- `NarrationTextClockMapper` derives VisualBeat audio ranges from source text ranges plus narration alignment when exact persisted timing is unavailable;
- exact aligned timing remains required for final render readiness;
- local device capability/heartbeat/revocation/render assignment;
- render completion and FinalArtifact metadata without final-video byte storage/proxying.

## Worker highlights

- Python 3.12+ async worker roles;
- provider submission/reconciliation with bounded retry foundations;
- runtime-file handling and deterministic retry policy;
- analysis, narration, image generation and media validation;
- deterministic VisualBeat source-anchor → UTF-16 text-range resolution;
- PROJECT voice-reference resolution through `project.manifest.json` with size/SHA-256 validation;
- ACCOUNT voice-reference download through the authorized R2 voice path;
- no production Python visual text-to-audio mapper and no legacy duration-weighted visual timing module.

Workers execute backend-authorized plans. They do not translate chapter content, execute final project renders, own Desktop paths or user authorization policy.

## Storage contract

```text
Generated project image/audio/video    -> project-local media
Imported project image/audio/video     -> Desktop ProjectStorage
PROJECT voice reference                -> project-local media / manifest
ACCOUNT voice reference/custom voice   -> Cloudflare R2
Render intermediates/cache             -> local project workspace/work
Backups/snapshots                      -> Desktop-managed local storage
Final MP4                              -> local project workspace/artifacts
Durable business/job metadata          -> PostgreSQL
```

R2 is not generated-project-media transport, fallback or dual write. Backend state uses stable IDs/checksums and opaque project-relative keys. It does not persist absolute Desktop filesystem paths or serve final MP4 bytes.

## Visual timing contract

```text
source_anchor
  -> UTF-16 textStart/textEnd
  -> narration/subtitle alignment spans
  -> backend NarrationTextClockMapper
  -> production beat clock
```

Complete existing persisted `audio_start_ms/audio_end_ms` may remain compatibility input. If exact timing cannot be established, the Editor may receive provisional timing but `readyForRender` remains false.

## Flyway baseline

```text
V1__identity_and_access.sql
V2__project_story_and_planning.sql
V3__generation_billing_and_media.sql
V4__narration_notifications_and_artifacts.sql
V5__catalog_generation_and_render_snapshots.sql
V6__database_logic_and_triggers.sql
V7__indexes.sql
V8__seed_catalog.sql
```

This is the clean pre-production baseline. There is no active V9 patch migration. Applied migrations become immutable at the first production deployment; subsequent evolution is append-only.

## Current gaps

```text
production packaging / signing / auto-update
  -> packaged protocol/OAuth/OS integration coverage
  -> richer abrupt-process render recovery UX
  -> richer timeline/review/regeneration workflows
  -> adaptive narration-driven VisualScenePlanner
  -> complete billing/actual-usage reconciliation
```

Completed Desktop/backend/persistence/storage/timing migration plans are historical evidence; remaining work is tracked in `documentation/product/ROADMAP.md`.
