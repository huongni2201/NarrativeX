# NarrativeX

NarrativeX is a desktop-first, image-first AI Story Video Studio for turning flexible-length stories into consistent, reviewed long-form videos and Short/Reel exports.

The primary and only editor client is the Electron desktop application. Spring Boot remains the authoritative control plane for durable business metadata and execution state, while project media and local rendering use a local-first Desktop boundary.

## Repository map

| Area | Responsibility |
| --- | --- |
| `app/desktop` | Primary Electron + React + TypeScript editor; local project storage, native capabilities and local FFmpeg execution through Electron main |
| `app/backend-service` | Spring Boot modular monolith; ownership, domain metadata, policy, jobs, leases and cost authority |
| `app/ai-worker` | Python AI/media worker; provider execution and retained server-side processing paths |
| `packages/client-contracts` | Shared typed client/backend contracts |
| `contracts` | Versioned backend ↔ worker payload contracts |
| `documentation` | Product, domain, architecture, workflows, migration plans and ADRs |
| `docker-compose.yml` | Local Desktop development dependencies and backend runtime |
| `docker-compose.prod.yml` | Production backend/worker runtime with optional Cloudflare Tunnel ingress |

## Primary runtime topology

```text
Electron Desktop
  renderer: editor UI / routing / state
        |
        v
  preload: narrow typed capability bridge
        |
        v
  main: OAuth deep link, native filesystem, local project manifest,
        backend session transport, device execution, FFmpeg/ffprobe
        |
        +------------------------+
        |                        |
        v                        v
Spring Boot Backend         Local project workspace
  -> PostgreSQL               -> images/audio/video
  -> Redis                    -> render work files
  -> Python workers           -> final MP4 artifacts
```

The backend remains authoritative for users, projects, source versions, ownership, entitlement/policy, render assignment, leases and durable job state. Electron local storage is authoritative only for Desktop project bytes referenced by stable backend asset IDs/checksums.

## Desktop local-first media contract

For the Desktop path:

```text
Generated/imported project images   -> local project workspace
Project narration/audio             -> local project workspace
Imported project media              -> local project workspace
Render intermediates                -> local project workspace/work
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

`project.manifest.json` maps backend asset IDs to project-relative paths, sizes and SHA-256 checksums. Absolute local filesystem paths must not be stored in backend state.

Cloudflare R2 and Google Drive remain part of retained server-worker paths where remote durability is still required. They are not the primary Desktop project-media boundary. Shared voice/sample media may remain remote when cross-install reuse requires it.

## Authentication

NarrativeX uses Google OAuth only for end-user login. Password login/register/forgot-password flows must not be reintroduced.

Desktop authentication uses the system browser:

```text
GET /api/v1/auth/desktop/start
  -> Google OIDC
  -> backend OAuth callback
  -> narrativex://auth/callback?code=<one-time-code>
  -> POST /api/v1/auth/desktop/exchange
  -> server-managed NarrativeX session
```

Google access/refresh tokens never enter Electron. Local execution uses a separate device credential for heartbeat/render APIs; that device token is not the user's OAuth/session token.

## Run Desktop in development

Start the backend/required server dependencies, then run the desktop client:

```powershell
docker compose up -d --build
cd app/desktop
npm ci
npm run dev
```

Desktop checks:

```powershell
npm run type-check
npm run build
```

Default backend URL:

```text
NARRATIVEX_BACKEND_URL=http://localhost:8080
```

Local project rendering additionally requires FFmpeg/ffprobe to be available and:

```text
NARRATIVEX_DESKTOP_PROJECT_RENDER_ENABLED=true
```

## Local render foundation

The current Desktop implementation can claim backend-assigned local project renders, resolve checksum-verified local assets, render FFmpeg segments, concatenate video and narration, mux, validate with ffprobe, register the local artifact and report progress/completion back to the backend.

Lease heartbeat, failure reporting and in-process cancellation are implemented foundations. Process-restart crash recovery/resume remains a hardening item.

## Production backend ingress

`docker-compose.prod.yml` contains the production backend, PostgreSQL, Redis and retained server workers. There is no web frontend service and no Caddy layer.

For a self-hosted production backend, Cloudflare Tunnel is retained as an optional HTTPS ingress and should route the public API hostname directly to:

```text
http://backend:8080
```

The Electron app then uses `https://<APP_DOMAIN>` as its remote backend origin. If deployment already provides another HTTPS reverse proxy/load balancer, the `cloudflared` service and its environment variables can be removed without changing NarrativeX application code.

## Persistence

Flyway migrations in `app/backend-service/src/main/resources/db/migration` are authoritative for PostgreSQL schemas. Production persistence uses MyBatis + explicit SQL; JPA and direct `JdbcTemplate` persistence are not part of the production persistence path.

## Product guardrails

NarrativeX is not a fixed-duration or fixed-image-count generator. Planning uses narration timing, semantic scene boundaries, complexity, asset reuse, source/version identity, provider capability and cost authorization.

Narration timing is the master clock. Expensive work pins source identity and must not silently overwrite immutable reviewed history. Workers execute backend-authorized plans and may not invent paid work.

The canonical product/architecture baseline is `documentation/source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`. Accepted ADRs refine that baseline; for factual AS-IS implementation claims, current code, Flyway migrations and automated tests outrank stale derived documentation.

Desktop-specific boundaries are defined by ADR-0010, ADR-0011 and ADR-0012, with `documentation/plans/DESKTOP_APP_MIGRATION.md` tracking remaining migration work.
