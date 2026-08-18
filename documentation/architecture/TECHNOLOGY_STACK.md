# NarrativeX Technology Stack

This page separates technology visible in the repository from the V1.8 target contract. Versions below are derived from the current build files where available; the attached V1.8 specification remains the authority for intended production behavior.

## Application stack

| Layer | Current repository evidence | V1.8 role |
|---|---|---|
| Web | Next.js `^16.3.1`, React `^19.2.8`, TypeScript `^5.8.2`, Tailwind CSS, TanStack Query, Zustand; Node.js 22 CI/runtime baseline | Route-driven story/project UI, visual review, cost confirmation, SSE progress and notifications as backend contracts become available |
| Backend | Java `25`, Spring Boot `4.1.0`, Web, Validation, JPA, Security, Actuator | Modular monolith, API, ownership, durable orchestration and business rules |
| Persistence | PostgreSQL driver, Flyway, Spring Data JPA; consolidated V1 baseline plus forward-only migrations through V7 | Authoritative transactional domain/job/cost/safety state |
| Redis infrastructure | Spring Data Redis | Delivery hints, cache, progress/scheduling and transient abuse-control counters; not durable business state |
| Session storage | Spring Session Data Redis | Shared server-managed `HttpSession` storage for Spring Security; opaque `NX_SESSION` cookie with configurable timeout/namespace |
| Worker | Python `>=3.12`, Pydantic v2/settings, HTTPX, Hatchling | Async AI/media execution, adapters, QA and FFmpeg orchestration |
| Media | FFmpeg, Pillow/OpenCV and optional PyTorch/Diffusers in target | TTS/audio assembly, image pre/post-processing, deterministic motion and render |
| Object storage | MinIO local/dev; S3-compatible private storage target | Images, audio, video and derivative media; versioning for critical media |
| AI | Vertex AI Gemini through server-side ADC/workload identity; provider ports | Story/scene/visual/prompt/highlight planning; optional image/video providers |
| Auth | Spring Security + email/password + Google OIDC + CSRF + Spring Session Redis | Server-side Secure/HttpOnly/SameSite session; provider tokens and bearer/refresh tokens never reach browser in the current contract |
| Migrations | Flyway `V1__initial_schema.sql` plus forward migrations V2-V7 | PostgreSQL bootstrap and forward-only schema evolution; historical shared migrations are not rewritten |
| Observability | Spring Boot Actuator foundation | Correlated logs/metrics/traces across request -> job -> worker -> provider/storage |
| Testing/quality | Backend JUnit/Spring/Testcontainers; worker Pytest; frontend Node regression tests + ESLint + TypeScript + Next build + architecture-boundary check in CI | Contract, idempotency, provider reconciliation, safety, restore, accessibility and E2E gates |

## Frontend runtime contract

- Next.js App Router is route-driven. `/projects` is the project collection and `/projects/[projectId]` is the project workspace; `/dashboard` is legacy redirect-only. `/auth` is an auth entry and authenticated sessions replace to `/projects`.
- TanStack Query owns backend state and cursor pagination. URL/search params own navigable identity and shareable filters. Zustand is limited to transient editor/wizard/demo state that cannot naturally live in URL or Query cache.
- Project search keeps immediate local input state but debounces synchronization to the `q` URL parameter, avoiding a router replacement on each keystroke.
- `src/shared/api/client.ts` is framework/state-agnostic transport infrastructure. It may expose typed errors/events but does not import Zustand or feature state. Malformed successful JSON is normalized as a protocol error.
- Production/API mode never substitutes persisted business data with fixture data. Mock modules stay behind lazy test/Storybook boundaries.
- Expensive overlay components use lazy boundaries and are mounted only when open/selected; closed modals must not cause their dynamic chunks to load eagerly.
- Frontend CI uses Node.js 22 and runs `npm ci`, `npm test`, `npm run lint`, `npm run type-check`, and `npm run build`. The lint command also enforces architecture boundaries. Current Node tests are architecture/tooling regression tests, not a claim of complete component/E2E coverage.

## Frontend proxy and packaging contract

Browser requests default to same-origin paths so session cookies, CSRF and OAuth routes stay on the application origin. Next.js rewrites forward `/api`, `/oauth2`, `/login` and `/logout` to the backend destination.

The current standalone frontend image resolves its rewrite configuration when `next build` runs. Docker builds therefore accept `BACKEND_INTERNAL_URL`, `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_NX_DATA_MODE` as build arguments. When frontend and backend run as separate containers, `BACKEND_INTERNAL_URL` must name the backend service/network address; frontend-container `localhost:8080` is not a backend-service address.

This build-time proxy contract is acceptable for environment-specific image builds. If staging and production must promote the exact same immutable frontend image while using different backend hosts, use a runtime reverse proxy/BFF topology for that destination instead of baking an environment-specific backend host into the Next.js build.

## Authentication and Redis contract

The browser authentication contract is still server-managed session + CSRF. Password login/registration and Google OIDC resolve to the internal NarrativeX user and persist the Spring Security context in Spring Session Redis.

- Default session cookie: `NX_SESSION`, `HttpOnly`, `Secure`, `SameSite=Lax`.
- Explicit `local` and test configuration may set `Secure=false` for HTTP localhost/test usage.
- Default session timeout: 7 days via `NARRATIVEX_SESSION_TIMEOUT`.
- Default Redis session namespace: `narrativex:session` via `NARRATIVEX_SESSION_REDIS_NAMESPACE`.
- `POST /logout` invalidates the server session, clears authentication/session cookies and returns `204 No Content`; CSRF still applies.
- Password login/register abuse limiting uses separate Redis counters and intentionally fails open on Redis data-access failures; session storage does not share that fail-open behavior.
- JWT access tokens, refresh tokens, refresh-token persistence/rotation/revocation and JWKS are not part of the current implementation.

## Provider and media contract

The domain uses `LlmProvider`, `ImageGenerationProvider` and `VideoGenerationProvider` ports. A provider adapter supplies capabilities, estimate, submit, status, reconcile, optional cancel and output validation. Provider names, pricing versions and model options are snapshots on attempts/plans, not scattered business conditionals.

Production Gemini uses Vertex AI project/location and workload identity or ADC. Provider credentials never reach the browser or source repository. Self-hosted ComfyUI uses a separately scheduled GPU pool; managed provider mode can scale that pool to zero.

## Runtime and packaging

Local development uses Docker Compose with isolated local PostgreSQL, Redis and MinIO. Staging and production promote immutable OCI images from a registry; production does not build on the server. The same image version is used for staging rehearsal and production promotion only when its runtime routing/configuration is environment-neutral; otherwise environment-specific build inputs are part of the artifact identity.

The frontend, backend and worker are separately buildable packages under `app/`, while the backend is the single business deployment. CPU worker pools and optional GPU pools scale independently from API replicas.

## Security and configuration

- Environment variables/config are injected per environment; production secrets are not copied into frontend bundles or shipped `.env` files.
- `NEXT_PUBLIC_*` values are public build-time frontend configuration and must never carry secrets.
- Dev, staging and production have distinct DBs, storage roots/buckets, Redis namespaces, OIDC callback settings, provider projects/locations and secret scopes.
- Object buckets remain private; the asset module issues short-lived signed URLs.
- Account/API abuse limiting runs before quota/cost/provider submission. Provider rate limiting and circuit breaking are a separate outbound layer.
- Story text is untrusted data. Structured output, explicit delimiters, allowlists and schema/domain validation prevent prompt injection from authorizing tools, billing, ownership, storage or arbitrary jobs.

## Reliability and DR

PostgreSQL uses automated backups/WAL/PITR, >=30-day retention and quarterly restore drills (RPO <=15 minutes, RTO <=4 hours). Critical objects use versioning and a secondary failure-domain copy (RPO <=1 hour, RTO <=8 hours). Intermediate artifacts can use cheaper retention and regeneration from persisted snapshots. Redis is not a backup source: queue/delivery/progress state must be reconstructable where designed, while loss of the Redis session namespace may intentionally invalidate active browser sessions without losing durable business state.

## Capacity baseline

- API: at least two production replicas with readiness probes.
- CPU workers: at least two processes/replicas; provider I/O concurrency and FFmpeg concurrency are benchmarked separately.
- GPU: optional 0..4 MVP workers, one heavy workflow per GPU by default; scale on queue age/depth, utilization and measured `gpu_seconds`.
- Render: bounded per-scene parallelism, normalized codec/fps/resolution/audio, then compatible concat/stream-copy where possible.

## Version drift note

The frontend README, package manifest and this document agree on Next.js 16.3.1 and the Node.js 22 CI/runtime baseline. The backend POM currently uses Java 25, while the specification's general Java baseline is Java 21+.
