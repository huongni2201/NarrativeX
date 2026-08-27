# NarrativeX Current Codebase Map — V1.11

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
```

Renderer code does not own arbitrary filesystem paths, session cookies, provider secrets or FFmpeg execution.

## Current Desktop highlights

- guest-first bootstrap uses a stable installation credential and backend guest session;
- account/provider-consuming actions can trigger in-context Google sign-in without losing the active route;
- project/chapter CRUD is backed by real backend contracts and row-version behavior;
- native import is two-phase: inspect/hash in main → backend stable asset registration → commit into ProjectStorage;
- image generation and narration flows include local materialization foundations;
- generation jobs stream owner-scoped snapshots over authenticated SSE, with Desktop reconnect and a slow watchdog fallback;
- production timeline reads are narration-aligned and support explicit beat media selection;
- imported audio/video duration is probed in Electron main and carried into asset/timeline state;
- duration/camera draft edits use typed undo/redo command history and Auto Edit can derive fit/motion overrides;
- local export performs capability/disk/integrity preflight before render submission;
- final rendering is backend-assigned, lease-controlled and executed only by Electron main;
- render state is journaled and unfinished work is discoverable after restart;
- immutable segment cache avoids redundant segment FFmpeg work;
- final MP4 playback/export reads the local artifact directly;
- local rendering captures immutable narration subtitle text/alignment and writes a UTF-8 SRT track when cues are available;
- Settings exposes storage accounting, project verification/cleanup and backup/restore/archive-copy foundations;
- renderer UI has been reorganized into production-oriented feature/component boundaries with Tailwind/source-owned primitives.

## Backend highlights

- Spring Boot 4.1.0 / Java 25;
- MyBatis-only production application persistence;
- stable Desktop guest installation identities and guest ownership transfer;
- project/chapter/storyboard/character/location domain foundations;
- saved `chapters.source_text/source_hash` are the authoritative chapter content for analysis/narration;
- durable generation jobs, stages, provider operations, plans, outbox and quota foundations;
- owner-scoped generation SSE snapshots, current chapter media-head recovery and voice-preview jobs;
- persisted production beat media selections consolidated into V1;
- production timeline aggregation/alignment and local render input snapshots;
- atomic Auto Edit override application during render admission;
- immutable render subtitle snapshots (`subtitle_text`, `subtitle_spans_json`);
- local device capability/heartbeat/revocation/render assignment;
- render completion and FinalArtifact metadata without final-video byte storage/proxying.

## Worker highlights

- Python 3.12+ async worker roles;
- provider submission/reconciliation with bounded retry foundations;
- runtime-file handling and deterministic retry policy;
- analysis, narration, image generation and generated-media validation;
- R2 transport for AI-generated media before Desktop materialization;
- visual timing helpers aligned with narration-driven production timing.

Workers execute backend-authorized plans. They do not translate chapter content, execute final project renders, own Desktop paths or user authorization policy.

## Storage contract

```text
AI-generated remote media        -> Cloudflare R2 until Desktop materialization
Project media                    -> local project workspace
Render intermediates/cache       -> local project workspace/work
Backups/snapshots                -> Desktop-managed local storage
Final MP4                        -> local project workspace/artifacts
Durable business/job metadata    -> PostgreSQL
```

Backend state uses stable IDs/checksums and opaque project-relative artifact keys. It does not persist absolute Desktop filesystem paths or serve final MP4 bytes.

## Flyway baseline

```text
V1__create_tables.sql            # final consolidated schema/runtime state
V2__init_indexes.sql             # final consolidated indexes/invariants
V3__seed_data.sql                # deterministic seeds
V4__project_render_subtitles.sql # immutable narration subtitle snapshot fields
V5__chapter_workspace_generation_lookup.sql # Chapter Workspace lookup index
```

V1-V3 remain the frozen consolidated baseline. Spring Session, Desktop OAuth handoffs, Desktop guest identity and beat media selections are already folded into V1/V2. V4 adds render subtitle snapshot fields and V5 adds a Chapter Workspace generation lookup index. Translation/content-variant tables and columns are absent. Future schema changes begin with append-only `V6__*.sql`.

## Current gaps

```text
production packaging / signing / auto-update
  -> packaged protocol/OAuth/OS integration coverage
  -> richer abrupt-process render recovery UX
  -> richer timeline/review/regeneration/reuse workflows
  -> adaptive narration-driven VisualScenePlanner
  -> complete billing/actual-usage reconciliation
```

Completed Desktop/backend/persistence migration plans have been retired; remaining work is tracked in `documentation/product/ROADMAP.md`.
