# NarrativeX AI coding context

NarrativeX is a desktop-first, image-first AI Story Video Studio. It turns flexible-length stories into reviewed storyboard/media state, narration, generated/imported visuals and FFmpeg-rendered long-form or Short/Reel artifacts.

## Current repository shape

- `app/desktop`: only Electron + React + TypeScript editor; guest bootstrap, local project storage/catalog, native capabilities and local FFmpeg execution through Electron main.
- `app/backend-service`: Spring Boot modular monolith; authoritative auth/ownership, domain metadata, policy, job admission, durable orchestration and Flyway schema ownership.
- `app/ai-worker`: Python AI/media worker; provider adapters and retained server execution paths for analysis, image generation, narration/alignment and fallback rendering/storage.
- `packages/client-contracts`: shared Desktop-facing backend contracts.
- `contracts`: backend ↔ worker payload contracts.
- `documentation`: source of truth, product/domain/architecture/workflows, ADRs and current-state implementation maps.

Current documentation checkpoint: `main` at `0aca94e6eef07158e161cd67c648671e74055473` (2026-08-26).

## Authority model

```text
PostgreSQL
  -> authoritative durable auth/ownership/domain/job/policy metadata

Electron main
  -> guest installation credential
  -> backend session transport
  -> local project bytes / project.manifest.json
  -> native filesystem/dialogs
  -> local device credentials/execution
  -> FFmpeg/ffprobe, render journal/cache, backup/restore

Electron renderer
  -> UI/routing/query/editor draft state only

Python workers
  -> asynchronous provider/media execution according to backend-authorized plans
```

The renderer is never a second domain authority and never receives unrestricted Node.js access.

## Guest-first authentication

Desktop opens into a stable installation-scoped guest workspace. The internal guest principal is used for ownership/session continuity; it is not a second account login provider.

```text
startup
  -> reuse current session or POST /api/v1/auth/desktop/guest
  -> ROLE_GUEST
  -> free authoring/local-workspace mutations

gated provider/account action
  -> AUTHENTICATION_REQUIRED
  -> LoginModal over current route
  -> Google OIDC in system browser
  -> narrativex:// one-time handoff
  -> backend exchange + eligible guest ownership transfer
  -> ROLE_USER, same editor context
```

Google is the only end-user account sign-in provider. Never reintroduce password login/register/forgot-password flows.

The guest installation secret, signed-in user session and local-execution device token are separate credentials. Google provider tokens never enter Electron.

## Desktop local-first media contract

```text
Generated/imported project images   -> local project workspace
Project narration/audio             -> local project workspace
Imported project media              -> local project workspace
Render intermediates/cache          -> local project workspace/work
Final rendered MP4                  -> local project workspace/artifacts
Metadata / ownership / job state    -> PostgreSQL
```

`project.manifest.json` maps stable backend IDs to project-relative paths, sizes and SHA-256. Absolute filesystem paths must never be persisted as backend identities.

Cloudflare R2 + Google Drive remain valid for retained server-worker/fallback paths where remote durability is required. Do not describe that topology as mandatory Desktop storage.

## Implemented Desktop foundations

- secure Electron main/preload/renderer boundary;
- feature-oriented React renderer using Tailwind 4 and source-owned shadcn/Radix primitives;
- stable guest installation identity and guest session bootstrap;
- in-context Google-only account sign-in and guest ownership transfer;
- project/chapter CRUD through typed backend APIs;
- ProjectStorage/ProjectCatalog with atomic schema-versioned manifests and integrity checks;
- native two-phase local import/registration without renderer path exposure;
- image-generation and narration local materialization foundations;
- production timeline with narration-aligned timing and explicit beat media selection;
- duration/camera draft command history with undo/redo;
- device identity/heartbeat and backend-assigned local render claim;
- local render preflight, FFmpeg/ffprobe execution, progress/failure/completion and artifact registration;
- atomic render journals, unfinished-work discovery and immutable segment cache;
- storage accounting/verification/cleanup and backup/restore/archive-copy foundations.

Do not describe these implemented foundations as future migration work.

## Persistence and migrations

Production backend application persistence is MyBatis + explicit PostgreSQL SQL. JPA and direct `JdbcTemplate` persistence are not production application persistence paths.

Current Flyway order:

```text
V1__create_tables.sql
V2__init_indexes.sql
V3__seed_data.sql
V4__desktop_guest_installations.sql
V5__production_beat_media_selections.sql
```

V1-V3 are frozen. V4+ are append-only feature migrations.

## Rendering rules

- narration timing is the master clock;
- FFmpeg/ffprobe execution belongs to Electron main for `LOCAL_DEVICE` renders;
- local render inputs resolve stable asset IDs/checksums through the project manifest;
- Desktop preflight validates runtime, executor, disk and local asset integrity before submission/execution;
- local render is backend-assigned and lease-controlled;
- render journals/cache are local execution aids, not a second durable business-state database;
- lease loss prevents successful finalization;
- retained cloud rendering/storage is fallback, not the Desktop default.

## Product/editor rules

- Chapter → Scene → VisualBeat hierarchy remains semantically meaningful; do not flatten the product into a chapter-only timeline model.
- A beat may use generated/imported image or video media; image-only camera/motion controls must not be forced onto video beats.
- Do not encode fixed duration or fixed image-count assumptions.
- Do not silently replace approved/versioned state.
- Workers/Desktop executors may not invent paid work outside backend-authorized plans.
- Use backend `ApiResponse`/pagination/client contracts rather than ad-hoc response shapes.

## Character model

- Character = reusable User/Workspace-owned identity.
- ProjectCharacter = Character assignment within one Project.
- CharacterVersion = immutable identity snapshot.
- CharacterAppearance = story/timeline visual state.
- Scene/VisualBeat generation resolves only participating ProjectCharacters.
- Never duplicate Character solely for outfit/age/hairstyle/injury changes.
- Never use character name as a relational identity key.

## Remaining work

Use `documentation/product/ROADMAP.md` for active remaining work. Completed migration plans are intentionally retired; use ADRs and Git history when historical rationale is needed.
