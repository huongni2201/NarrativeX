# NarrativeX System Architecture

Status: V1.8 target architecture and current implementation boundary. The attached `NARRATIVEX_PROJECT_SPEC_V1_8.md` is the product/architecture contract; this page records the repository-facing view.

## Architectural stance

NarrativeX is a modular monolith with a separately deployed Python AI/media worker. The Spring Boot application owns the business state and orchestration contract. It is intentionally not a full microservice decomposition: Project, Story, Character, Scene, Generation, Render, Cost and Entitlement require transactional consistency and are still evolving together.

The Python worker is a hard technical boundary because AI/GPU libraries, provider SDKs, TTS, image processing and FFmpeg have a different runtime and scaling profile. It never becomes the owner of user authorization, canonical job state or billing history.

Core invariants:

- PostgreSQL is the authoritative source for domain, job, stage, provider-operation, cost, entitlement, notification-outbox and audit state.
- Redis is delivery/cache/progress acceleration only. Queued work must be reconstructable from PostgreSQL and the outbox after Redis loss.
- MinIO in local/dev and private S3-compatible storage in staging/production hold binary media; PostgreSQL stores metadata, checksums, manifests and lifecycle state.
- Every expensive operation has an `OperationPlan`, estimate range/confidence, `CostReservation`, `max_authorized_cost` and `billed_to_user_id` before a billable stage is submitted.
- Every external submission has a durable `StageAttempt` and `ProviderOperation`. An ambiguous result is `UNKNOWN` and must be reconciled before any resubmission.
- Final artifacts are immutable and become `READY` only after file, MIME, dimensions, checksum and manifest validation.
- Trust & Safety is a control plane across authentication/abuse, rights/consent, input moderation, prompt-injection defense, provider safety, output moderation, identity QA and human approval.

## Logical topology

```text
Browser
  |
  | HTTPS, REST, SSE, Google OIDC redirect
  v
Next.js + TypeScript frontend
  |  same-origin /api, /oauth2, /login, /logout
  |  (Next.js rewrite or future runtime reverse proxy/BFF)
  v
Spring Boot 4.1 modular monolith
  |-- auth / ownership / session
  |-- project / story / character / scene
  |-- generation / render / shorts
  |-- provider ports / capability routing
  |-- cost / entitlement / usage
  |-- safety / rights / identity consent
  |-- notification + transactional outbox
  |
  | transactional state and durable queue intent
  +--> PostgreSQL <---- Flyway migrations
  |
  +--> Redis (queue delivery, cache, progress acceleration)
  |
  +--> MinIO/S3-compatible object storage (private media)
  |
  +--> CPU worker pool / optional GPU worker pool
           |
           | Python 3.12 worker
           |-- provider adapters
           |-- prompt/schema boundary
           |-- identity QA
           |-- TTS / Pillow / OpenCV
           |-- FFmpeg render and validation
           |
           +--> Vertex AI Gemini (planning/intelligence)
           +--> image provider adapters
           +--> Vertex Veo / Kling / future video adapters
```

## Runtime responsibilities

### Web application

Next.js renders project, storyboard, review, cost-confirmation, job-progress and notification UX. It consumes backend APIs and SSE; it does not call providers, connect to PostgreSQL/Redis/object storage directly, or hold provider credentials.

The browser uses same-origin application paths for session-authenticated API and auth traffic. In the current standalone frontend build, Next.js rewrites `/api`, `/oauth2`, `/login` and `/logout` to the backend destination configured for the image build. This preserves the browser origin/cookie boundary while allowing frontend and backend to run on separate internal hosts.

Route identity is canonical: `/projects` is the project collection, `/projects/[projectId]` owns project identity, `/dashboard` is redirect-only, and authenticated users visiting `/auth` are replaced to `/projects` rather than rendering application content under an auth URL.

### Spring Boot modular monolith

The backend is the canonical application boundary. It validates ownership and optimistic-concurrency tokens, applies entitlement and abuse limits, creates operation plans and reservations, persists jobs/stages/provider operations, exposes APIs/SSE, and writes transactional outbox events. Domain modules depend on ports, not vendor SDKs.

### Python worker

Workers claim persisted stages using leases, execute deterministic or provider-backed work, upload verified outputs, meter usage, and report stage results to the backend. A worker restart cannot erase state. A submitted external operation is reconciled rather than blindly submitted again.

### External providers

`LlmProvider`, `ImageGenerationProvider` and `VideoGenerationProvider` are separate ports. Gemini planning through Vertex AI is not the same capability as Veo media generation, even though both may use Google Cloud. Kling and future providers are adapters selected through capabilities and routing policy, not domain conditionals.

## Frontend state and transport boundary

- TanStack Query owns persisted server state and cursor pagination.
- URL/search params own navigable/shareable state such as project identity and project-list filters.
- Zustand is limited to transient cross-screen/editor/wizard/demo state.
- Local component state may be used to make high-frequency interaction responsive; project search, for example, debounces URL synchronization rather than replacing the route on every keystroke.
- `src/shared/api/client.ts` owns credentials, CSRF, response-envelope validation, typed transport/protocol errors and unauthorized signaling without importing React/Zustand/feature state.
- API mode is authoritative. Mock data is restricted to validated test/Storybook-style runtime boundaries.
- Dynamically imported heavy overlays are mounted only when active so closed modals do not defeat lazy-loading boundaries.

## Control planes

1. Orchestration: `GenerationJob` -> `StageAttempt` -> provider/local execution -> persisted result.
2. Cost and entitlement: account abuse limiter -> entitlement/quota check -> `OperationPlan` -> reservation -> measured usage -> append-only ledger.
3. Trust & Safety: rights/consent, moderation decisions (`SAFE`/`REVIEW`/`BLOCK`), prompt-injection boundary, output moderation, identity QA and human review.
4. Notification: terminal job transaction writes an outbox event; a dispatcher creates durable in-app notifications and best-effort email/web-push delivery.
5. Lifecycle and recovery: deletion requests stop new work, reconcile late provider results, revoke URLs and expire/delete media according to retention policy.

## Deployment and isolation

Local/dev uses Docker Compose with PostgreSQL, Redis and MinIO; fake providers are the default. Staging and production use separate databases, Redis namespaces, object-storage buckets/roots, OIDC callbacks, secrets and provider projects/locations.

The frontend, backend and worker are separately buildable/deployable artifacts. For the current frontend Dockerfile, Next.js rewrite destinations are part of build configuration. A frontend image built for a container topology must therefore receive a backend network destination such as `http://backend:8080`; frontend-container `localhost:8080` must not be treated as another service.

Where staging and production promote the exact same immutable frontend image, environment-specific backend routing must be provided by a runtime reverse proxy/BFF or another environment-neutral routing layer. If routing is baked into the frontend build, those build inputs are part of the image identity and staging/production equivalence must be assessed accordingly.

Production baseline is at least two API replicas, private PostgreSQL with automated backup/WAL/PITR, Redis, versioned private object storage, CPU workers, optional GPU pool and centralized metrics/logs/traces. Managed-provider mode may run with zero self-hosted GPUs. A single MinIO node/volume is acceptable only for local/dev, never as the sole copy of critical media.

## Verification baseline

Frontend CI uses Node.js 22 and runs:

```bash
npm ci
npm test
npm run lint
npm run type-check
npm run build
```

`npm test` currently provides architecture/tooling regression coverage; lint also runs the architecture checker. Behavioral component, accessibility automation and end-to-end suites remain additional quality work rather than being implied as complete by this gate.

## Recovery targets

- PostgreSQL metadata: automated backups plus WAL/PITR, at least 30-day retention, quarterly restore drill, target RPO <= 15 minutes and RTO <= 4 hours.
- Critical media (Character Master/References, Approved Assets, FinalArtifacts): object versioning plus a second failure-domain copy, target RPO <= 1 hour and RTO <= 8 hours.
- Intermediate attempts/cache: lifecycle-managed and rebuildable from persisted prompt/reference/model snapshots; RPO <= 24 hours or regeneration is acceptable.
- Redis: never treated as backup source. Rebuild queued/retryable delivery from PostgreSQL/outbox without duplicate provider submission.

## Current implementation note

The repository currently contains the application shells and partial API integrations described in `documentation/codebase/`. The architecture above is the contract to implement incrementally. Current security is an implementation foundation: OIDC mode requires authentication, local/test may use a configured fallback, CSRF and configured credentialed CORS are present, and shared environments must fail closed when OIDC is disabled.
