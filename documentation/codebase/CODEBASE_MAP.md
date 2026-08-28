# NarrativeX Current Codebase Map — V1.11

**Canonical baseline:** `documentation/source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`  
**Audited code checkpoint:** `2c965b2e95ddcc1e03dc5527340c6adb18cdd05e` (2026-08-28)

## Runtime layout

```text
app/desktop/          Electron / React / TypeScript only editor client
                     + stable guest bootstrap
                     + local project storage / backup / cache
                     + native asset import
                     + local FFmpeg/ffprobe final render
                     + Gemini Web Chrome/CDP automation

app/backend-service/  Java / Spring Boot modular monolith
                     auth/ownership/domain/policy/control plane
                     MyBatis + Flyway + PostgreSQL
                     final-artifact metadata only

app/ai-worker/        Python async AI/media/provider worker
                     analysis / image / narration / validation

packages/client-contracts/
                     shared typed Desktop/backend contracts

contracts/            backend <-> worker contracts
documentation/        current source of truth, architecture, workflows, roadmap
```

`app/frontend-web` and the Caddy frontend ingress layer are removed. PostgreSQL is the required MVP durable state service; Redis is not a required runtime dependency.

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

## Current Desktop highlights

- guest-first bootstrap uses a stable installation credential and backend guest session;
- account/provider-consuming actions can trigger in-context Google sign-in without losing the active route;
- project/chapter CRUD is backed by real backend contracts and row-version behavior;
- native import is two-phase: inspect/hash in main -> backend stable asset registration -> commit into ProjectStorage;
- API image-generation and narration flows include verified local materialization foundations;
- Gemini Web Storyboard generation supports single-beat and serial Generate All flows through visible Chrome/CDP automation with a main-owned style wrapper;
- Gemini Web accepts beat-scoped locked Character reference context, and accepted output is validated/checksummed before local registration;
- prompt copy uses a typed preload-to-main clipboard capability;
- generation jobs stream owner-scoped snapshots over authenticated SSE, with Desktop reconnect and a slow GET watchdog fallback;
- production timeline reads support immutable planned timing plus generic fallback timing and explicit beat media selection; fallback geometry is not proof of exact storyboard narration alignment;
- imported audio/video duration is probed in Electron main and carried into asset/timeline state;
- duration/camera/fit draft edits use typed undo/redo command history and Auto Edit can derive supported fit/motion overrides;
- local export performs capability/disk/integrity preflight before render submission;
- final rendering is backend-assigned, lease-controlled and executed only by Electron main;
- render state is journaled and unfinished work is discoverable after restart;
- immutable segment cache avoids redundant segment FFmpeg work;
- final MP4 playback/export reads the local artifact directly;
- local rendering captures immutable narration subtitle text/alignment and writes a UTF-8 SRT track when cues are available;
- Settings exposes storage accounting, project verification/cleanup and backup/restore/archive-copy foundations;
- renderer UI is organized into production-oriented feature/component boundaries with Tailwind/source-owned primitives.

## Backend highlights

- Spring Boot 4.1.0 / Java 25;
- MyBatis-only production application persistence;
- stable Desktop guest installation identities and guest ownership transfer;
- project/chapter/storyboard/character/location domain foundations;
- saved `chapters.source_text/source_hash` are the authoritative Chapter content for analysis/narration;
- durable generation jobs, stages, provider operations, plans, outbox and quota foundations;
- owner-scoped generation SSE snapshots, current Chapter media-head recovery and voice-preview jobs;
- persisted production beat media selections in the project/story/planning baseline;
- production timeline aggregation with current MediaPlan timing and incomplete-scope fallback behavior;
- atomic Auto Edit override application during render admission;
- immutable render subtitle snapshots (`subtitle_text`, `subtitle_spans_json`) defined directly in the render-snapshot baseline;
- narration requests persist `speaking_rate`; enabled VieNeu catalog rows advertise `supportsSpeakingRate=true`;
- local device capability/heartbeat/revocation/render assignment;
- render completion and FinalArtifact metadata without final-video byte storage/proxying.

## Worker highlights

- Python 3.12+ async worker roles;
- provider submission/reconciliation with bounded retry foundations;
- runtime-file handling and deterministic retry policy;
- Chapter analysis now extracts richer source-grounded Character profiles and beat-specific Character participation/roles;
- Character profile materialization creates/pins AI-derived versions only when an explicit pinned version is absent and records Chapter appearance state when source-grounded appearance data exists;
- storyboard materialization persists Scene/VisualBeat semantic data and `visual_beat_characters` mappings;
- narration generation persists source-hash-bound alignment spans carrying text and audio boundaries;
- image generation and generated-media validation/materialization foundations;
- R2 transport for AI-generated media before Desktop materialization when remote durability is required.

Workers execute backend-authorized plans. They do not translate Chapter content, execute final project renders, own Desktop paths or user authorization policy.

## Visual Beat timing — current implementation boundary

Current code has the database columns and narration alignment needed for exact draft timing, but the bridge is not complete:

```text
implemented
  semantic VisualBeat analysis/materialization
  beat-specific Character mappings
  narration alignment persistence
  production timeline immutable planned timing
  generic timeline fallback timing

not yet implemented/verified
  deterministic VisualBeat text_start/text_end for every analyzed beat
  VisualBeat source-span -> narration audio reconciliation
  exact storyboard audio_start_ms/audio_end_ms before MediaPlan
  fully verified narration-clock-authoritative draft preview
```

Do not describe generic fallback timing as exact narration alignment. The active implementation plan is indexed under `docs/superpowers/plans/README.md`.

## Storage contract

```text
AI-generated remote media        -> Cloudflare R2 until Desktop materialization when needed
Project media                    -> local project workspace
Render intermediates/cache       -> local project workspace/work
Backups/snapshots                -> Desktop-managed local storage
Final MP4                        -> local project workspace/artifacts
Durable business/job metadata    -> PostgreSQL
```

Backend state uses stable IDs/checksums and opaque/project-relative keys. It does not persist absolute Desktop filesystem paths or serve final MP4 bytes.

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

This is a clean pre-production baseline rather than frozen upgrade history. Translation/content-variant tables and columns are absent. Disposable development/test databases are recreated after baseline rewrites. Applied migrations become immutable at the first production deployment; subsequent evolution is append-only from V9+.

## Current gaps

```text
exact VisualBeat source/audio timing and draft audio-clock preview
  -> production packaging / signing / auto-update
  -> packaged protocol/OAuth/OS integration coverage
  -> richer abrupt-process render recovery UX
  -> richer timeline/review/regeneration/reuse workflows
  -> adaptive narration-driven VisualScenePlanner
  -> arbitrary multi-part audio production completion
  -> complete billing/actual-usage reconciliation
```

Completed Desktop/backend/persistence migration plans are retired from current documentation. Active implementation plans have explicit lifecycle status in `docs/superpowers/plans/README.md`; remaining product work is tracked in `documentation/product/ROADMAP.md`.
