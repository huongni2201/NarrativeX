# NarrativeX

NarrativeX is a desktop-first, image-first AI Story Video Studio for turning flexible-length stories into reviewed long-form videos and Short/Reel exports.

The Electron application is the only supported editor client. Spring Boot remains the authoritative control plane for durable business metadata, ownership, policy and execution state. Project media and final rendering use a local-first Desktop boundary.

## Documentation authority

Start with [`documentation/README.md`](documentation/README.md). The maintained product/architecture baseline is [`documentation/source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`](documentation/source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md), and verified implementation status is recorded in [`documentation/TRACEABILITY.md`](documentation/TRACEABILITY.md).

Lifecycle matters:

- `documentation/` describes current state except ADR bodies;
- `documentation/decisions/ADR-*.md` is historical decision evidence; consult the ADR ledger before relying on old scope;
- `docs/superpowers/plans/` contains non-authoritative implementation plans with explicit ACTIVE/COMPLETED/SUPERSEDED status;
- current code, Flyway migrations and automated tests win when executable behavior conflicts with derived docs.

## Repository map

| Area | Responsibility |
| --- | --- |
| `app/desktop` | Electron + React + TypeScript editor; guest bootstrap, local project storage, native capabilities, Gemini Web Chrome/CDP and local FFmpeg execution through Electron main |
| `app/backend-service` | Spring Boot modular monolith; auth/ownership, domain metadata, policy, jobs, leases, quotas and durable state |
| `app/ai-worker` | Python AI/media worker; Chapter analysis, image generation, narration and media validation; no final-render worker role |
| `packages/client-contracts` | Shared typed Desktop/backend contracts |
| `contracts` | Versioned backend ↔ worker payload contracts |
| `documentation` | Current product/domain/architecture/workflows/codebase maps plus ADR ledger |
| `docs/superpowers/plans` | Non-authoritative active/completed/superseded implementation plans |
| `docker-compose.yml` | Backend/PostgreSQL/configured AI-worker runtime |

## Primary runtime topology

```text
Electron Desktop
  renderer: editor UI / routing / query state
        |
        v
  preload: narrow typed capability bridge
        |
        v
  main: guest credential, OAuth deep link, native filesystem,
        backend session transport, ProjectStorage, FFmpeg/ffprobe,
        Gemini Web visible Chrome/CDP automation
        |
        +------------------------+
        |                        |
        v                        v
Spring Boot Backend         Local project workspace
  -> PostgreSQL               -> images/audio/video
     domain/jobs/session      -> render work/cache
     OAuth handoffs           -> final MP4 artifacts
  -> Python AI workers
     analysis/narration/image/media validation
```

PostgreSQL is authoritative for users, projects, source versions, ownership, entitlement/policy, server sessions, one-time Desktop OAuth handoffs, render assignment, leases and durable job/artifact metadata. Python workers claim durable jobs directly from PostgreSQL. Electron local storage is authoritative for machine-local project bytes referenced by stable backend IDs and integrity metadata. Redis is not required by the MVP runtime.

## Guest-first authentication

NarrativeX Desktop opens into a stable installation-scoped guest workspace. The guest principal exists for ownership continuity and is **not** a second account login provider.

Google is the only end-user sign-in provider. Account-bound or provider-consuming actions are backend-gated to `ROLE_USER`; when a guest reaches one of those actions, Desktop opens the LoginModal over the current route.

```text
Desktop start
  -> current session or POST /api/v1/auth/desktop/guest
  -> stable ROLE_GUEST session
  -> free project/chapter/local-workspace editing

Gated action
  -> 403 AUTHENTICATION_REQUIRED
  -> LoginModal
  -> system-browser Google OIDC
  -> narrativex:// one-time handoff
  -> backend exchange + eligible guest ownership transfer
  -> ROLE_USER session, same editor context
```

Google access/refresh tokens never enter Electron. Installation guest secret, signed-in user session and local-execution device credential are separate credentials. See [`documentation/workflows/AUTHENTICATION.md`](documentation/workflows/AUTHENTICATION.md).

## Desktop local-first media contract

```text
Generated/imported project images   -> local project workspace
Project narration/audio             -> local project workspace
Imported project media              -> local project workspace
Render intermediates/cache          -> local project workspace/work
Final rendered MP4                  -> local project workspace/artifacts
Metadata / ownership / job state    -> PostgreSQL
```

Workspace layout:

```text
<userData>/projects/<projectId>/
  project.manifest.json
  assets/{images,audio,video}/
  artifacts/<jobId>/final.mp4
  work/
```

`project.manifest.json` maps stable IDs to project-relative paths, sizes and SHA-256 checksums. Absolute local filesystem paths do not become durable backend identifiers.

Cloudflare R2 is generated-media transport/durability only when remote provider/worker execution needs it. Final MP4 bytes are not stored or proxied by backend/worker services; playback/export reads the local artifact directly.

## Current creator/editor foundations

Current code includes:

- Project/Chapter authoring and project catalog state;
- guest-first session bootstrap and in-context Google sign-in;
- durable Chapter analysis with richer Character profile/appearance materialization;
- Scene/VisualBeat semantic state plus beat-specific visible Character roles;
- API image generation/review and verified local materialization;
- Gemini Web per-beat/Generate All via Desktop main, locked series style, locked Character references, protected prompt clipboard and CDP network-body output capture with Download fallback;
- generated narration/voice preview, local audio import foundations and persisted narration alignment spans;
- authenticated generation SSE with reconnect/watchdog recovery;
- native local asset registration and durable beat media selection;
- production timeline with immutable planned timing plus generic fallback geometry;
- duration/camera/fit draft state, Auto Edit planning and undo/redo;
- local render preflight, lease-controlled FFmpeg execution and FinalArtifact metadata registration;
- immutable narration subtitle snapshots and local UTF-8 SRT generation;
- render journal discovery, segment caching, project storage verification/cleanup and backup/restore/archive-copy foundations.

Chapter generation consumes saved Chapter source directly. NarrativeX does not maintain a translation/content-variant workflow in the current baseline.

## Visual Beat timing: current vs target

Do not infer exact timing from nullable schema columns.

```text
implemented foundation
  semantic VisualBeat analysis/materialization
  narration alignment persistence (text span <-> audio milliseconds)
  current immutable MediaPlan timing
  generic production-timeline fallback geometry

active target
  deterministic VisualBeat UTF-16 text_start/text_end
  source-compatible VisualBeat -> narration reconciliation
  exact draft audio_start_ms/audio_end_ms before MediaPlan
  fully verified narration-clock-authoritative draft preview
```

AI must not count character offsets or invent audio timestamps. Generic fallback geometry is useful for navigation but is **not** exact narration alignment. A current valid MediaPlan timing snapshot wins for production/render planning.

The active timing plan is indexed in [`docs/superpowers/plans/README.md`](docs/superpowers/plans/README.md). It remains non-authoritative until implementation/tests update Traceability.

## Run Desktop in development

```powershell
docker compose up -d --build
cd app/desktop
npm ci
npm run dev
```

The default Compose topology requires PostgreSQL but no Redis service.

Verify backend health:

```powershell
Invoke-WebRequest http://localhost:8080/actuator/health
```

Desktop module check:

```powershell
npm run check
```

Repository merge gate:

```powershell
cd ../..
pwsh -File scripts/verify-local.ps1
```

The repository gate includes documentation-governance tests, current-doc drift scanning and checkpoint freshness validation before backend/worker/Desktop checks.

## Persistence

Flyway migrations under `app/backend-service/src/main/resources/db/migration` are authoritative for PostgreSQL schema evolution. The current clean pre-release baseline is V1 through V8. Until the first production deployment, disposable development/test databases are recreated when the baseline is intentionally rewritten; after the first production deployment, applied migrations become immutable and future changes are append-only from V9+.

Production application persistence uses MyBatis + explicit SQL. JPA and direct `JdbcTemplate` domain persistence are not production persistence paths. Spring Session JDBC and Desktop OAuth handoff state share PostgreSQL without becoming domain entities.

## Product guardrails

NarrativeX is not a fixed-duration or fixed-image-count generator. Compatible real narration alignment is the intended visual master clock, while exact VisualBeat alignment must remain distinguishable from provisional/fallback timing. Expensive work pins source identity and does not silently overwrite reviewed/versioned history. Workers and Desktop executors perform backend-authorized work; they do not invent paid operations.

Remaining product work is tracked in [`documentation/product/ROADMAP.md`](documentation/product/ROADMAP.md), not in completed migration plans or historical ADR prose.
