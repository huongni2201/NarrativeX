# NarrativeX

NarrativeX is an image-first AI Story Video Studio for turning flexible-length stories into consistent, reviewed long-form videos and Short/Reel exports.

## Repository map

| Area | Responsibility |
| --- | --- |
| `app/backend-service` | Spring Boot modular monolith, ownership, domain state, jobs and cost authority |
| `app/ai-worker` | Python AI/media worker, provider ports, QA, TTS and FFmpeg orchestration |
| `app/frontend-web` | Next.js/TypeScript storyboard, review, cost and notification UI |
| `documentation` | Product, domain, architecture, workflows, codebase notes and ADRs |
| `contracts` | Versioned backend ↔ worker payload contracts |
| `docker-compose.yml` | Safe local PostgreSQL 18, Redis 8, backend and AI worker stack |
| `docker-compose.prod.yml` | Production stack with frontend, split AI/narration/render workers, Caddy origin routing and Cloudflare Tunnel |
| `Caddyfile.prod` | Private HTTP origin used only inside the Cloudflare Tunnel Docker network |

## Start the local stack

```powershell
Copy-Item .env.example .env
docker compose up -d --build
```

This starts PostgreSQL 18, Redis 8, the Spring Boot backend and the AI worker. Cloudflare R2 is external managed object storage and is not emulated by a local object-storage container. The worker waits for the backend to become healthy so Flyway can apply the PostgreSQL schema first. The backend is available at `http://localhost:8080`; Actuator health is at `http://localhost:8080/actuator/health`.

The worker uses PostgreSQL as its durable work queue. Its safe local default is `AI_PROVIDER_MODE=disabled`, `IMAGE_PROVIDER_MODE=disabled`, `TTS_PROVIDER_MODE=disabled`, and `MEDIA_STORAGE_MODE=disabled`, so paid/provider work is never enabled accidentally. Configure the corresponding provider and storage settings explicitly before running real generation.

To start only infrastructure dependencies:

```powershell
docker compose up -d postgres redis
```

The backend container uses `postgres` and `redis` as service hostnames. Host-run backend development should continue using `localhost` from `app/backend-service/.env.example`. Media workers use the configured R2 bucket for generated images and narration audio. Worker-local files are scratch/cache/FFmpeg workspace only. After FFmpeg validation, final rendered MP4 files are uploaded directly to the configured Google Drive folder and are not persisted to R2.

PostgreSQL 18 uses a new data directory layout. Do not point it directly at an existing PostgreSQL 16 data volume; migrate retained data with a tested dump/restore or PostgreSQL upgrade procedure first.

Flyway migrations in `app/backend-service/src/main/resources/db/migration` are authoritative for both local and production schemas. The `local` Spring profile currently changes local runtime behavior (for example the secure-session-cookie setting) but does not load a separate demo-data migration location. Existing databases created from an older migration history require operator-reviewed migration/recreation; the application does not rewrite `flyway_schema_history` automatically.

Then follow the module READMEs and `CONTRIBUTING.md` for backend, worker, and frontend checks.

### Local Vertex credentials

When `AI_PROVIDER_MODE=vertex` or `IMAGE_PROVIDER_MODE=vertex`, the worker needs Google Application Default Credentials. Run `gcloud auth application-default login` once, set `GOOGLE_CLOUD_PROJECT`, and set `GOOGLE_CLOUD_CONFIG_HOST` in the untracked root `.env` to the host gcloud directory (for example, `C:/Users/<user>/AppData/Roaming/gcloud`). Compose mounts that directory read-only at the worker's `GOOGLE_APPLICATION_CREDENTIALS` path. Do not commit credential files.

## Run the production stack

Production intentionally uses a separate Compose/env contract so local development cannot silently enable paid providers or secure-cookie/domain settings.

```powershell
Copy-Item .env.example .env.prod
# Fill every secret/path/domain value in .env.prod before continuing.
docker compose --env-file .env.prod -f docker-compose.prod.yml config
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

The production stack forces the Spring `prod` profile, runs the general AI worker separately from the VieNeu narration worker and render worker, enables Vertex analysis/image generation, keeps generated images and narration audio in R2, and stores final rendered MP4 files in Google Drive.

### Publish from a Windows PC with Cloudflare Tunnel

The public connection is `HTTPS client -> Cloudflare -> encrypted tunnel -> cloudflared -> Caddy HTTP on appnet`. Caddy and the application do not publish host ports, so do not add router port-forwarding rules for ports 80 or 443.

1. Add the application domain to Cloudflare and create a remotely-managed Tunnel.
2. Add a Public Hostname route for `APP_DOMAIN` with service URL `http://caddy:80`.
3. Copy the connector token to `CLOUDFLARE_TUNNEL_TOKEN` in the untracked `.env.prod`.
4. Keep `APP_DOMAIN` as a hostname only, for example `app.example.com` (no scheme or path).
5. In Cloudflare, enable Always Use HTTPS and choose an appropriate edge certificate policy. Cloudflare terminates browser TLS; the origin remains private inside the authenticated tunnel.
6. Prevent Windows sleep/hibernate while serving production traffic and configure Docker Desktop to start automatically.

Validate before starting:

```powershell
docker compose --env-file .env.prod -f docker-compose.prod.yml config
docker run --rm -v "${PWD}/Caddyfile.prod:/etc/caddy/Caddyfile:ro" caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile
```

The Compose file fails fast if `CLOUDFLARE_TUNNEL_TOKEN` is missing or empty. Do not start the stack until the resolved configuration command succeeds; otherwise `cloudflared` will repeatedly restart with a missing tunnel identity.

Start and verify:

```powershell
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
docker compose --env-file .env.prod -f docker-compose.prod.yml logs --tail 100 cloudflared caddy
curl.exe -I "https://$((Get-Content .env.prod | Select-String '^APP_DOMAIN=').Line.Split('=',2)[1])"
```

A healthy deployment must redirect or serve only HTTPS publicly, return the expected security headers, keep ports 80/443 closed on the router, and show the Tunnel connector as Healthy in Cloudflare.

For final-video storage, create a Google OAuth refresh token for the Drive account that owns the target folder with the `https://www.googleapis.com/auth/drive` scope, then configure `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN`, and `GOOGLE_DRIVE_FOLDER_ID` in `.env.prod`. The render worker uses resumable uploads and stores the Drive file ID plus view link in `final_artifacts`. The production template defaults VieNeu to the CPU/ONNX backend; GPU/PyTorch deployment requires a GPU-capable image/runtime rather than only changing `VIENEU_BACKEND`.

## Product guardrails

V1.11 is not a fixed-duration or fixed-image-count generator. Planning uses semantic scene boundaries, narration timing, complexity, asset reuse, delta scope, provider capability, and cost reservation. Character identity is versioned and reviewed; external provider outcomes are durable and reconciled; chapter continuation, notifications, entitlement, trust & safety, rights/consent, abuse and privacy gates are part of the product contract, while the current repository remains an incremental foundation.

The canonical source of truth is `documentation/source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`. Accepted ADRs refine cross-cutting decisions; ADR-0016 supersedes the R2-only rule specifically for final rendered video storage. Current code, Flyway migrations and automated tests decide factual AS-IS implementation claims when derived documentation drifts.
