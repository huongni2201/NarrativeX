# NarrativeX

NarrativeX is a desktop-first, image-first AI Story Video Studio for turning flexible-length stories into reviewed long-form videos and Short/Reel exports.

The Electron application is the only supported editor client. Spring Boot remains the authoritative control plane for durable business metadata, ownership, policy and execution state. Project media and final rendering use a local-first Desktop boundary.

## Repository map

| Area | Responsibility |
| --- | --- |
| `app/desktop` | Electron + React + TypeScript editor; guest bootstrap, local project storage, native capabilities and local FFmpeg execution through Electron main |
| `app/backend-service` | Spring Boot modular monolith; auth/ownership, domain metadata, policy, jobs, leases, quotas and durable state |
| `app/ai-worker` | Python AI/media worker; chapter analysis, image generation, narration and generated-media validation |
| `packages/client-contracts` | Shared typed Desktop/backend contracts |
| `contracts` | Versioned backend ↔ worker payload contracts |
| `documentation` | Product, domain, architecture, workflows, current-state maps and ADRs |
| `docker-compose.yml` | Backend/AI-worker runtime with optional Cloudflare Tunnel ingress |

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
        backend session transport, project storage, FFmpeg/ffprobe
        |
        +------------------------+
        |                        |
        v                        v
Spring Boot Backend         Local project workspace
  -> PostgreSQL               -> images/audio/video
     domain/jobs/session      -> render work/cache
     OAuth handoffs           -> final MP4 artifacts
  -> Python AI workers
```

PostgreSQL is authoritative for users, projects, source versions, ownership, entitlement/policy, server sessions, one-time Desktop OAuth handoffs, render assignment, leases and durable job/artifact metadata. Python workers claim durable jobs directly from PostgreSQL. Electron local storage is authoritative for machine-local project bytes referenced by stable backend IDs and integrity metadata. Redis is not required by the MVP runtime.

## Guest-first authentication

NarrativeX Desktop opens into a stable installation-scoped guest workspace. The guest principal exists for ownership continuity and is **not** a second login provider.

Google is the only end-user sign-in provider. Account-bound or provider-consuming actions are backend-gated to `ROLE_USER`; when a guest reaches one of those actions, Desktop opens the login modal over the current route.

```text
Desktop start
  -> GET /api/v1/auth/me
  -> if needed POST /api/v1/auth/desktop/guest
  -> stable ROLE_GUEST session
  -> free project/chapter/local-workspace editing

Gated action
  -> 403 AUTHENTICATION_REQUIRED
  -> LoginModal
  -> system browser /api/v1/auth/desktop/start
  -> Google OIDC
  -> narrativex://auth/callback?code=<one-time-code>
  -> POST /api/v1/auth/desktop/exchange
  -> transfer eligible guest-owned workspace metadata
  -> ROLE_USER session, same project/editor route
```

Google access/refresh tokens never enter Electron. The installation guest secret and local-execution device credentials are separate credentials with separate responsibilities. `NX_SESSION` and hashed, short-lived Desktop OAuth handoffs are stored in PostgreSQL.

See `documentation/workflows/AUTHENTICATION.md` for the current contract.

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
  assets/
    images/
    audio/
    video/
  artifacts/
    <jobId>/final.mp4
  work/
```

`project.manifest.json` maps backend IDs to project-relative paths, sizes and SHA-256 checksums. Absolute local filesystem paths must not become durable backend identifiers.

Cloudflare R2 is used only as remote transport/durable storage for generated AI media such as images and narration audio before Desktop materializes those bytes into the local workspace. Final MP4 bytes are never stored or proxied by the backend; playback and export read the local artifact directly.

## Current creator/editor foundations

The current Desktop code includes:

- project/chapter authoring and project catalog state;
- guest-first session bootstrap and in-context Google sign-in;
- chapter analysis and generation admission flows;
- image generation/review plus remote-to-local materialization;
- generated narration/voice preview and local audio import safeguards;
- authenticated generation SSE with reconnect/watchdog status recovery;
- native local asset registration;
- production timeline editing including beat media selection, probed media duration, duration/camera/fit draft state, Auto Edit planning and undo/redo;
- local render preflight, lease-controlled FFmpeg execution and final artifact metadata registration;
- immutable narration subtitle snapshots and local UTF-8 SRT generation during render;
- render journal discovery, segment caching and project storage verification/cleanup;
- workspace backup/restore/archive-copy foundations;
- source-owned Tailwind/shadcn-style renderer component structure.

Chapter generation consumes the saved chapter source directly. NarrativeX does not maintain a translation/content-variant workflow in the current product baseline.

Remaining product work is tracked in `documentation/product/ROADMAP.md`, not in completed migration plans.

## Run Desktop in development

Start the backend/required server dependencies, then run Desktop:

```powershell
docker compose up -d --build
cd app/desktop
npm ci
npm run dev
```

The default Compose topology requires PostgreSQL but no Redis service.

Verify the backend before opening Desktop:

```powershell
Invoke-WebRequest http://localhost:8080/actuator/health
```

Desktop quality gate:

```powershell
npm run check
```

Default backend URL:

```text
NARRATIVEX_BACKEND_URL=http://localhost:8080
```

Local project rendering additionally requires FFmpeg/ffprobe and:

```text
NARRATIVEX_DESKTOP_PROJECT_RENDER_ENABLED=true
```

## Production backend ingress

Production Compose contains no browser frontend and no Caddy layer. Cloudflare Tunnel is optional HTTPS ingress for self-hosted deployments and routes directly to `backend:8080` when the `tunnel` profile is enabled.

```powershell
docker compose --profile tunnel up -d
```

If another platform already provides HTTPS ingress, leave the tunnel profile disabled. The public backend origin and Google OAuth redirect URI must match the deployed HTTPS host.

## Persistence

Flyway migrations under `app/backend-service/src/main/resources/db/migration` are authoritative for PostgreSQL schema evolution. The current pre-release baseline is responsibility-separated across `V1__identity_and_access.sql` through `V6__database_logic_and_triggers.sql`, followed by `V7__indexes.sql` and deterministic `V8__seed_catalog.sql`. Project-render subtitle fields, the Chapter Workspace covering index and VieNeu speaking-rate capability are folded directly into that final baseline rather than represented as patch migrations. Until the first production deployment, disposable local/test databases are recreated when the baseline is rewritten; after the first production deployment, applied migrations become immutable and future changes are append-only. Production persistence uses MyBatis + explicit SQL; JPA and direct `JdbcTemplate` persistence are not part of the production application persistence path. Spring Session JDBC and Desktop OAuth handoff state share PostgreSQL without becoming domain entities.

## Product guardrails

NarrativeX is not a fixed-duration or fixed-image-count generator. Narration timing is the master clock. Expensive work pins source identity and must not silently overwrite immutable reviewed history. Workers and Desktop executors perform backend-authorized work; they do not invent paid operations.

The canonical product/architecture baseline is `documentation/source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`. Accepted ADRs refine that baseline. For factual AS-IS implementation claims, current code, Flyway migrations and automated tests outrank derived documentation.
