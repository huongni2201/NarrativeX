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
| `docker-compose.real.yml` | Production-profile Docker stack for real local execution and real provider generation |
| `docker-compose.prod.yml` | Production stack with frontend, split AI/narration/render workers, Caddy origin routing and Cloudflare Tunnel |
| `Caddyfile.prod` | Private HTTP origin used only inside the Cloudflare Tunnel Docker network |

## Run the real stack in Docker on this PC

The supported machine-local runtime is still the `prod` Spring profile, not the `local` profile. It
uses the real Vertex image provider, Cloudflare R2, VieNeu narration and Google Drive final-video
storage; Docker is only the execution environment. Fake providers, local media storage and the
frontend mock mode remain available only to automated tests and Storybook.

Copy the production template once, fill the provider/storage credentials, and run:

```powershell
Copy-Item .env.example .env.prod
docker compose --env-file .env.prod -f docker-compose.real.yml config
docker compose --env-file .env.prod -f docker-compose.real.yml up -d --build
```

The web app is available at `http://localhost:3000`, the backend at `http://localhost:8080`, and
Actuator health at `http://localhost:8080/actuator/health`. The local Docker compose binds these
ports to loopback only. The browser uses server-managed sessions; it does not use a developer
identity fallback.

Required for real image generation:

- Google Application Default Credentials service-account JSON, configured by `GCP_SERVICE_ACCOUNT_FILE`;
- Vertex project and image batch staging bucket, configured by `GOOGLE_CLOUD_PROJECT` and `VERTEX_IMAGE_BATCH_GCS_BUCKET`;
- Cloudflare R2 credentials for durable generated images;
- a VieNeu reference WAV and Google Drive credentials if narration/rendering are enabled.

The worker waits for the backend to become healthy so Flyway can apply the PostgreSQL schema first.
Worker-local files are scratch/cache/FFmpeg workspace only. Generated images and narration audio go
to R2; final rendered MP4 files go to the configured Google Drive folder.

PostgreSQL 18 uses a new data directory layout. Do not point it directly at an existing PostgreSQL 16 data volume; migrate retained data with a tested dump/restore or PostgreSQL upgrade procedure first.

Flyway migrations in `app/backend-service/src/main/resources/db/migration` are authoritative for both local and production schemas. The `local` Spring profile currently changes local runtime behavior (for example the secure-session-cookie setting) but does not load a separate demo-data migration location. Existing databases created from an older migration history require operator-reviewed migration/recreation; the application does not rewrite `flyway_schema_history` automatically.

Then follow the module READMEs and `CONTRIBUTING.md` for backend, worker, and frontend checks.

### Local Vertex credentials

When `AI_PROVIDER_MODE=vertex` or `IMAGE_PROVIDER_MODE=vertex`, the worker needs Google Application Default Credentials. Set `GOOGLE_CLOUD_PROJECT` and point `GCP_SERVICE_ACCOUNT_FILE` to the service-account JSON. Compose mounts that file read-only at the worker's `GOOGLE_APPLICATION_CREDENTIALS` path. Do not commit credential files.

## Run the production stack

The public deployment uses a separate Compose/env contract so the machine-local runtime cannot
silently become internet-facing.

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
