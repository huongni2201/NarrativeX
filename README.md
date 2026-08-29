# NarrativeX

NarrativeX is a desktop-first, image-first AI Story Video Studio for turning flexible-length stories into reviewed long-form videos and Short/Reel exports.

The Electron application is the only supported editor client. Spring Boot is the authoritative control plane for ownership, policy, durable jobs and metadata. Project media and final rendering are local-first on Desktop.

## Repository map

| Area | Responsibility |
| --- | --- |
| `app/desktop` | Electron + React + TypeScript editor; guest bootstrap, local project storage, Gemini Web automation, native capabilities and local FFmpeg execution |
| `app/backend-service` | Spring Boot modular monolith; auth/ownership, domain metadata, policy, jobs, leases, quotas and Flyway schema |
| `app/ai-worker` | Python worker; chapter analysis, image generation, narration and media validation |
| `packages/client-contracts` | Shared Desktop/backend contracts |
| `contracts` | Backend ↔ worker payload contracts |
| `documentation` | Product, architecture, workflows, current-state maps and ADRs |

## Runtime topology

```text
Electron Desktop
  renderer -> UI / routes / query + editor draft state
      |
  preload  -> narrow typed capability bridge
      |
  main     -> auth transport / native files / ProjectStorage /
              Gemini Web Chrome-CDP / FFmpeg-ffprobe / local render
      |
      +------------------------------+
      |                              |
Spring Boot Backend             Local project workspace
  -> PostgreSQL                   -> images/audio/video
  -> Python workers               -> render work/cache
                                  -> final MP4
```

PostgreSQL is authoritative for durable business/control state. Workers claim durable work from PostgreSQL. Electron local storage owns machine-local project bytes referenced by stable backend IDs and integrity metadata. Redis is not required by the MVP runtime.

## Guest-first authentication

NarrativeX opens into a stable installation-scoped guest workspace. Google is the only end-user account sign-in provider. Account/provider-consuming actions are backend-gated; Desktop can open the Google login flow without discarding the active editor context.

Google tokens never enter the renderer. Guest installation credentials, user sessions and local-render device credentials remain separate.

See `documentation/workflows/AUTHENTICATION.md`.

## Local project-media contract

```text
Generated project images        -> shared/local project media -> Desktop ProjectStorage
Generated narration             -> shared/local project media -> Desktop ProjectStorage
Imported image/audio/video      -> Desktop ProjectStorage
Render work/cache               -> Desktop project workspace/work
Final MP4                       -> Desktop project workspace/artifacts
Voice reference/custom voice    -> Cloudflare R2 when remote account storage is required
Business/job/artifact metadata  -> PostgreSQL
```

R2 is **not** the project-media store and is not a transport for generated project images, narration or final MP4 files. It is retained only for authenticated account-owned voice-reference/custom-voice assets.

`project.manifest.json` maps stable backend IDs to project-relative paths, sizes and SHA-256 checksums. Absolute machine paths never become durable backend identities.

## Visual generation

Analyze Chapter keeps the visual intent explicit:

- `IMAGE` supports backend/API image generation and Gemini Web image generation.
- `VIDEO` remains a supported analysis/editor intent for web/browser-driven video generation workflows.
- Python workers do not host a video-generation/I2V provider role.
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

Start backend/worker dependencies, then Desktop:

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

Flyway migrations under `app/backend-service/src/main/resources/db/migration` own the PostgreSQL schema. NarrativeX is still pre-production, so the repository maintains one clean **V1–V8** baseline rather than preserving patch-only migration history. Disposable development/test databases should be recreated when the baseline changes.

At the first production deployment, freeze the accepted baseline and make future schema changes append-only from the next migration version.

## Guardrails

- Chapter → Scene → VisualBeat remains the production hierarchy.
- Narration timing is the master clock.
- A VisualBeat may use image or video media.
- Do not assume fixed image count or fixed image duration.
- Reviewed/generated history must not be silently overwritten.
- Workers and Desktop executors perform only backend-authorized work.
- Final project video bytes stay local.

Canonical product direction: `documentation/source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`.
Active remaining work: `documentation/product/ROADMAP.md`.
