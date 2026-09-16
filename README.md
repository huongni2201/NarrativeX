# NarrativeX

NarrativeX is a desktop-first, image-first AI Story Video Studio for turning flexible-length stories into reviewed long-form videos and Short/Reel exports.

The Electron application is the only supported editor client. Spring Boot is the authoritative control plane for business state, policy, durable jobs and metadata. Project media and final rendering are local-first on Desktop.

## Repository map

| Area | Responsibility |
| --- | --- |
| `app/desktop` | Electron + React + TypeScript editor; local project storage, native capabilities and local FFmpeg execution |
| `app/backend-service` | Spring Boot modular monolith; control plane, domain metadata, policy, jobs, leases, system capacity limits and Flyway schema |
| `app/generation-service` | Domain-agnostic compute execution plane consuming Compute Protocol v1 tasks (VoiceStudio, WhisperX, ComfyUI, media validation) |
| `packages/client-contracts` | Shared Desktop/backend contracts |
| `contracts` | Compute Protocol v1 task schemas and payloads |
| `documentation` | Product, architecture, workflows, current-state maps and ADRs |

## Runtime topology

```text
Electron Desktop
  renderer -> UI / routes / query + editor draft state
      |
  preload  -> narrow typed capability bridge
      |
  main     -> native files / ProjectStorage / FFmpeg-ffprobe / local render
      |
      +------------------------------+
      |                              |
Spring Boot Backend             Local project workspace
  -> PostgreSQL (control plane)   -> images/audio/video
  |                               -> render work/cache
  v Compute Protocol v1           -> final MP4
generation-service
  -> local SQLite journal
  -> execution adapters (VoiceStudio, WhisperX, ComfyUI, validation)
```

PostgreSQL is authoritative for durable business/control state. The target execution plane receives closed compute tasks over HTTP from `backend-service`. Electron local storage owns machine-local project bytes referenced by stable backend IDs and integrity metadata. Redis and browser editors are removed.

## Single-user local-first workspace

NarrativeX opens directly into the local workspace per ADR-0030. There is no application User, Account, Authentication, Authorization, Session, or Tenant identity model. Login gates, modals, and user quotas are completely removed. External provider credentials and device execution tokens are local runtime configurations.

## Local project-media contract

```text
Generated project images        -> project-local media -> Desktop ProjectStorage
Generated narration             -> project-local media -> Desktop ProjectStorage
Imported image/audio/video      -> Desktop ProjectStorage
PROJECT voice reference         -> Desktop ProjectStorage / manifest
GLOBAL_LOCAL voice reference    -> local application voice library
Render work/cache               -> Desktop project workspace/work
Final MP4                       -> Desktop project workspace/artifacts
Business/job/artifact metadata  -> PostgreSQL
```

`project.manifest.json` maps stable backend IDs to project-relative paths, sizes and SHA-256 checksums. Absolute machine paths never become durable backend identities.

## Visual generation

Analyze Chapter keeps the visual intent explicit:

- `IMAGE` supports backend/generation-service image generation.
- `VIDEO` remains a supported analysis/editor intent for web/browser-driven video generation workflows.
- The generation service does not host a video-generation/I2V provider role.
- Final composition/rendering always uses Electron main + FFmpeg/ffprobe.

Do not reintroduce Wan or another Python video provider as an implicit fallback for the Desktop render path.

## Final render

```text
backend-authorized project render
  -> paired Desktop device assignment
  -> claim + lease
  -> local asset integrity/preflight
  -> FFmpeg/ffprobe
  -> artifacts/<jobId>/final.mp4
  -> backend final-artifact metadata only
```

There is no server/cloud final-render executor and no remote final-video storage fallback.

## Development

Start backend/generation-service dependencies, then Desktop:

```powershell
docker compose up -d --build
cd app/desktop
npm ci
npm run dev
```

Backend health:

```powershell
Invoke-WebRequest http://localhost:8080/actuator/health
```

Desktop quality gate:

```powershell
npm run check
```

Local final rendering requires FFmpeg/ffprobe and:

```text
NARRATIVEX_DESKTOP_PROJECT_RENDER_ENABLED=true
```

## Database baseline

Flyway migrations under `app/backend-service/src/main/resources/db/migration` own the PostgreSQL schema. NarrativeX is still pre-production, so the repository maintains one clean **V1–V7** baseline rather than preserving patch-only migration history. Disposable development/test databases should be recreated when the baseline changes.

At the first production deployment, freeze the accepted baseline and make future schema changes append-only from V8.

## Guardrails

- Chapter → Scene → VisualBeat remains the production hierarchy.
- Narration timing is the master clock.
- A VisualBeat may use image or video media.
- Do not assume fixed image count or fixed image duration.
- Reviewed/generated history must not be silently overwritten.
- Executors perform only backend-authorized work.
- Final project video bytes stay local.

Canonical product direction: `documentation/source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_12.md`.
Active remaining work: `documentation/product/ROADMAP.md`.
