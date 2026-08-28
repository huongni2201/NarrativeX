# NarrativeX AI coding context

NarrativeX is a desktop-first, image-first AI Story Video Studio. It turns flexible-length stories into reviewed storyboard/media state, narration, generated/imported visuals and FFmpeg-rendered long-form or Short/Reel artifacts.

## Documentation and authority

For factual AS-IS behavior, prefer current code, Flyway migrations and automated tests. The maintained product/architecture baseline is `documentation/source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`, implementation evidence is in `documentation/TRACEABILITY.md`, and accepted ADRs refine cross-cutting boundaries only within their declared scope.

Documentation lifecycle:

- `documentation/` is current except ADR bodies;
- `documentation/decisions/ADR-*.md` is historical decision evidence and may contain explicitly superseded scope;
- `docs/superpowers/plans/` is non-authoritative implementation planning; consult its README for ACTIVE/COMPLETED/SUPERSEDED status;
- completed migration reports and obsolete architecture notes belong in Git history, not current docs.

Never infer that a feature is implemented solely because a plan, schema column or ADR describes it.

## Current repository shape

- `app/desktop`: only Electron + React + TypeScript editor; guest bootstrap, local project storage/catalog, native capabilities, Gemini Web automation and local FFmpeg execution through Electron main.
- `app/backend-service`: Spring Boot modular monolith; authoritative auth/ownership, domain metadata, policy, job admission, durable orchestration and Flyway schema ownership.
- `app/ai-worker`: Python AI/media worker; provider adapters and asynchronous execution for chapter analysis, image generation, narration and generated-media validation.
- `packages/client-contracts`: shared Desktop-facing backend contracts.
- `contracts`: backend <-> worker payload contracts.
- `documentation`: current product/domain/architecture/workflows, source-of-truth, traceability and ADR decision ledger.

## Authority model

```text
PostgreSQL
  -> authoritative durable auth/ownership/domain/job/policy/lease/artifact metadata
  -> Spring Session JDBC
  -> one-time Desktop OAuth handoffs
  -> durable queue/outbox state

Electron main
  -> guest installation credential
  -> backend session transport
  -> local project bytes / project.manifest.json
  -> native filesystem/dialogs
  -> Gemini Web Chrome/CDP automation
  -> local device credentials/execution
  -> FFmpeg/ffprobe, render journal/cache, final MP4, backup/restore

Electron renderer
  -> UI/routing/query/editor draft state only

Python workers
  -> asynchronous provider/media execution according to backend-authorized plans
  -> durable work claimed from PostgreSQL
```

Redis is not required by the MVP runtime. The renderer is never a second domain authority and never receives unrestricted Node.js access.

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

Google is the only end-user account sign-in provider. Never reintroduce password login/register/forgot-password flows without an explicit product/architecture decision.

The guest installation secret, signed-in user session and local-execution device token are separate credentials. Google provider tokens never enter Electron.

## Chapter source contract

`chapters.source_text`, `chapters.source_hash` and Chapter row version are the authoritative saved Chapter source identity. Analyze and narration consume that saved Chapter directly.

Do not reintroduce translation gating, language-detection confirmation, translated content variants, `contentVariantId`, `sourceVariantId` or `targetLanguage` generation lineage unless product direction explicitly changes.

## Visual Beat and timing contract

Current implemented foundations:

- AI analysis persists Scene/VisualBeat semantic state such as title, visual intent, camera angle and participating Character references;
- narration generation persists source-hash-bound alignment spans containing text and audio boundaries;
- backend production timeline supports immutable planned timing and generic fallback timing;
- explicit beat media selection is durable backend state.

Current non-claims:

- `visual_beats.text_start/text_end` are **not yet** deterministically materialized for every analyzed beat;
- narration completion does **not yet** reconcile Visual Beat source spans into `visual_beats.audio_start_ms/audio_end_ms`;
- fallback timeline geometry must not be described as exact narration alignment;
- narration-clock-authoritative draft preview remains TARGET/PARTIAL until the active timing plan is implemented and verified.

Approved target coordinate flow:

```text
Chapter source
  -> deterministic source segments
  -> AI semantic source-span references
  -> worker-owned UTF-16 text_start/text_end
  -> compatible narration alignment
  -> deterministic VisualBeatTimingReconciler
  -> audio_start_ms/audio_end_ms
  -> project timeline startMs/endMs
```

AI must never count characters or invent audio timestamps. Nullable `aspect_ratio_override` and `quality_tier_override` mean inherited policy, not missing AI output.

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

Cloudflare R2 is limited to generated AI-media transport/durability when remote provider/worker execution requires it. Final render bytes remain local and are never uploaded to or streamed through the backend as the final-video storage path.

## Implemented Desktop foundations

- secure Electron main/preload/renderer capability boundary;
- feature-oriented React renderer using Tailwind 4 and source-owned shadcn/Radix primitives;
- stable guest installation identity and guest session bootstrap;
- in-context Google-only account sign-in and guest ownership transfer;
- project/chapter CRUD through typed backend APIs;
- ProjectStorage/ProjectCatalog with atomic schema-versioned manifests and integrity checks;
- native two-phase local import/registration without renderer path exposure;
- API image-generation and narration local materialization foundations;
- Gemini Web Storyboard generation through a visible Chrome/CDP session, with main-owned style locking and checksum-verified local commit;
- production timeline with planned/fallback timing and explicit beat media selection;
- duration/camera/fit draft command history with undo/redo/reset;
- Auto Edit planning with backend-authorized render snapshot application;
- device identity/heartbeat and backend-assigned local render claim;
- local render preflight, FFmpeg/ffprobe execution, progress/failure/completion and artifact metadata registration;
- immutable narration subtitle snapshot and local UTF-8 SRT generation;
- atomic render journals, unfinished-work discovery and immutable segment cache;
- storage accounting/verification/cleanup and backup/restore/archive-copy foundations.

Do not describe these implemented foundations as future migration work. Conversely, do not upgrade TARGET/PARTIAL timing work merely because nullable database columns already exist.

## Persistence and migrations

Production backend application persistence is MyBatis + explicit PostgreSQL SQL. JPA and direct `JdbcTemplate` persistence are not production application persistence paths.

Current pre-release Flyway baseline:

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

NarrativeX has not reached its first production deployment. Until that point, the clean baseline may be reorganized and disposable development/test databases should be recreated after checksum/version changes. At the first production deployment, freeze the accepted baseline; after that, never rewrite applied migrations and add only new append-only versions.

## Rendering rules

- real compatible narration alignment is the visual timing authority;
- immutable MediaPlan timing supersedes storyboard draft/fallback timing for production planning;
- FFmpeg/ffprobe final render execution belongs to Electron main;
- render inputs resolve stable asset IDs/checksums through the project manifest;
- Desktop preflight validates runtime, executor, disk and local asset integrity before execution;
- final render is backend-assigned and lease-controlled but executed locally;
- render journals/cache are local execution aids, not a second durable business-state database;
- lease loss prevents successful finalization;
- final MP4 playback/export reads the local artifact directly; backend stores only durable metadata/state.

## Product/editor rules

- Chapter -> Scene -> VisualBeat hierarchy remains semantically meaningful; do not flatten the product into a Chapter-only timeline model.
- A beat may use generated/imported image or video media; image-only camera/motion controls must not be forced onto video beats.
- Do not encode fixed duration or fixed image-count assumptions.
- Do not silently replace approved/versioned state.
- Workers/Desktop executors may not invent paid work outside backend-authorized plans.
- Use backend `ApiResponse`/pagination/client contracts rather than ad-hoc response shapes.

## Character model

- Character = reusable User/Workspace-owned identity.
- ProjectCharacter = Character assignment within one Project.
- CharacterVersion = versioned identity snapshot.
- CharacterAppearance = story/timeline visual state.
- Scene/VisualBeat generation resolves participating ProjectCharacters only.
- Never duplicate Character solely for outfit/age/hairstyle/injury changes.
- Never use Character name as a relational identity key.

## Remaining work

Use `documentation/product/ROADMAP.md` for active remaining product/reliability work. The active Visual Beat timing plan is indexed under `docs/superpowers/plans/README.md`. Completed/superseded plans are historical execution aids, not AS-IS architecture documentation.
