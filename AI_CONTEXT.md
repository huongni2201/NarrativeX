# NarrativeX AI coding context

NarrativeX is a desktop-first, image-first AI Story Video Studio. It turns flexible-length stories into reviewed storyboard/media state, narration, generated visuals and FFmpeg-rendered long-form or Short/Reel artifacts.

## Current repository shape

- `app/desktop`: primary Electron + React + TypeScript editor client; owns local project storage, native capabilities and local FFmpeg execution through Electron main.
- `app/backend-service`: Spring Boot modular monolith; authoritative user/project ownership, domain metadata, policy, job admission and durable orchestration state.
- `app/ai-worker`: Python AI/media worker; provider adapters and cloud/server execution paths for analysis, image generation, TTS/alignment and fallback rendering/storage flows.
- `app/frontend-web`: temporary legacy migration client. Do not treat it as the target UI architecture or add new browser-only product constraints unless explicitly maintaining legacy parity.
- `packages/client-contracts`: shared client-facing contracts used by Desktop and migration surfaces.
- `documentation`: product, domain, architecture, workflow, ADR and implementation notes.
- `contracts`: versioned backend ↔ worker payload contracts.

Implementation checkpoint for the desktop migration docs: `main` at `751f006634218efb2c398fc00c2cbfecd25e1eac` (2026-08-24).

## Authority model

```text
PostgreSQL
  -> authoritative durable business/domain/job/policy metadata

Electron Desktop main
  -> local project bytes, project.manifest.json, native filesystem,
     system-browser/deep-link handling, device credentials and FFmpeg execution

Electron renderer
  -> UI/routing/query/editor state only

Python workers
  -> asynchronous provider/media execution according to backend-authorized plans
```

The renderer is never a second domain authority and never receives unrestricted Node.js access.

## Desktop local-first media contract

For the primary Desktop workflow:

```text
Generated/imported project images   -> local project workspace
Project narration/audio             -> local project workspace
Imported project media              -> local project workspace
Render intermediates                -> local project workspace/work
Final rendered MP4                  -> local project workspace/artifacts
Metadata / ownership / job state    -> PostgreSQL
Shared reusable voice/sample media  -> R2 only when cross-install reuse requires remote durability
```

Workspace layout:

```text
<userData>/projects/<projectId>/
  project.manifest.json
  assets/{images,audio,video}/
  artifacts/<jobId>/final.mp4
  work/
```

`project.manifest.json` maps stable backend asset IDs to project-relative paths, sizes and SHA-256 checksums. Absolute filesystem paths must never be persisted or sent to the backend.

Cloudflare R2 + Google Drive remain valid for the retained cloud/legacy worker execution path during migration. Do not describe that cloud storage topology as the Desktop project-media contract.

## Implemented desktop foundations

- Electron Vite + React editor shell with project-scoped routes and shared backend contracts.
- secure BrowserWindow configuration: `contextIsolation: true`, `nodeIntegration: false`, sandbox enabled;
- Google OAuth start in the system browser and `narrativex://auth/callback` custom-protocol handoff;
- backend one-time desktop auth code exchange into a server-managed NarrativeX session;
- local `ProjectStorage` manifest with workspace-boundary validation, size verification and SHA-256 checks;
- device identity/pairing, heartbeat and local-execution status;
- backend-assigned local project-render claim with lease heartbeat, progress, failure and completion reporting;
- local FFmpeg/ffprobe capability probing;
- local render pipeline: segment render → video concat → narration concat → mux → ffprobe validation → checksum-verified local artifact registration;
- in-process render cancellation.

Process-restart render recovery/resume and complete registration of every generation/import path into local project storage remain hardening/migration work.

## Authentication model

Google is the only user-facing identity provider. Do not reintroduce password login, registration or forgot-password flows.

Desktop authentication:

```text
Electron main
  -> system browser /api/v1/auth/desktop/start
  -> Google OIDC
  -> narrativex://auth/callback?code=<one-time-code>
  -> backend desktop exchange
  -> server-managed NarrativeX session
```

Google access/refresh tokens never enter Electron. A local-execution device token is a separate machine credential used only by device/job APIs and stored through Electron protected storage; it is not the user's OAuth/session token.

## Rendering rules

- Narration timing remains the master clock.
- FFmpeg execution belongs to Electron main for `LOCAL_DEVICE` Desktop renders, never the renderer.
- Desktop render inputs are resolved by stable asset IDs/checksums through the local manifest.
- Local completion records provider identity such as `LOCAL_DESKTOP` plus an opaque project-relative artifact key; do not persist an absolute path.
- The backend remains authoritative for assignment, lease lifecycle, progress state and terminal job state.
- The cloud render worker remains a migration fallback and does not redefine the Desktop local-first boundary.

Local project rendering is gated by FFmpeg availability and `NARRATIVEX_DESKTOP_PROJECT_RENDER_ENABLED=true`.

## Production persistence

Production backend persistence is MyBatis + explicit PostgreSQL SQL. JPA and direct `JdbcTemplate` persistence are absent from production code.

## Important product constraints

Do not encode fixed duration or fixed image-count assumptions. Do not silently replace approved/versioned state. Do not let workers invent paid work outside backend-authorized plans. Do not expose provider credentials, Google tokens, device tokens or arbitrary filesystem capabilities to renderer code.

Character model:
- Character = reusable User/Workspace-owned identity.
- ProjectCharacter = Character assignment within one Project.
- CharacterVersion = immutable identity snapshot.
- CharacterAppearance = story/timeline visual state.
- Scene/VisualBeat generation resolves only participating ProjectCharacters.
- Never duplicate Character solely for outfit/age/hairstyle/injury changes.
- Never use character name as a relational identity key.
