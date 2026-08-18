# NarrativeX Technology Stack

This page separates technology visible in the repository from the V1.8 target contract. Versions below are derived from the current build files where available; the attached V1.8 specification remains the authority for intended production behavior.

## Application stack

| Layer | Current repository evidence | V1.8 role |
|---|---|---|
| Web | Next.js `^16.3.1`, React `19.2.8`, TypeScript, Tailwind CSS | Story/project UI, visual review, cost confirmation, SSE progress and notifications |
| Backend | Java `25`, Spring Boot `4.1.0`, Web, Validation, JPA, Security, Actuator | Modular monolith, API, ownership, durable orchestration and business rules |
| Persistence | PostgreSQL driver, Flyway, Spring Data JPA; baseline migration only today | Authoritative transactional domain/job/cost/safety state |
| Queue/cache | Spring Data Redis dependency | Delivery, cache, progress acceleration and scheduling hints; not source of truth |
| Worker | Python `>=3.12`, Pydantic v2/settings, HTTPX, Hatchling | Async AI/media execution, adapters, QA and FFmpeg orchestration |
| Media | FFmpeg, Pillow/OpenCV and optional PyTorch/Diffusers in target | TTS/audio assembly, image pre/post-processing, deterministic motion and render |
| Object storage | MinIO local/dev; S3-compatible private storage target | Images, audio, video and derivative media; versioning for critical media |
| AI | Vertex AI Gemini through server-side ADC/workload identity; provider ports | Story/scene/visual/prompt/highlight planning; optional image/video providers |
| Auth | Spring Security dependency; current config is permissive scaffold | Google OIDC with server-side Secure/HttpOnly/SameSite session |
| Migrations | Flyway consolidated baseline `V1__initial_schema.sql` | PostgreSQL schema bootstrap; future changes must use new forward migrations |
| Observability | Spring Boot Actuator foundation | Correlated logs/metrics/traces across request -> job -> worker -> provider/storage |
| Testing | JUnit/Spring Boot/Testcontainers; Pytest/pytest-asyncio; frontend lint/type-check | Contract, idempotency, provider reconciliation, safety, restore and E2E gates |

## Provider and media contract

The domain uses `LlmProvider`, `ImageGenerationProvider` and `VideoGenerationProvider` ports. A provider adapter supplies capabilities, estimate, submit, status, reconcile, optional cancel and output validation. Provider names, pricing versions and model options are snapshots on attempts/plans, not scattered business conditionals.

Production Gemini uses Vertex AI project/location and workload identity or ADC. Provider credentials never reach the browser or source repository. Self-hosted ComfyUI uses a separately scheduled GPU pool; managed provider mode can scale that pool to zero.

## Runtime and packaging

Local development uses Docker Compose with isolated local PostgreSQL, Redis and MinIO. Staging and production promote immutable OCI images from a registry; production does not build on the server. The same image version is used for staging rehearsal and production promotion.

The frontend, backend and worker are separately buildable packages under `app/`, while the backend is the single business deployment. CPU worker pools and optional GPU pools scale independently from API replicas.

## Security and configuration

- Environment variables/config are injected per environment; production secrets are not copied into frontend bundles or shipped `.env` files.
- Dev, staging and production have distinct DBs, storage roots/buckets, Redis namespaces, OIDC callback settings, provider projects/locations and secret scopes.
- Object buckets remain private; the asset module issues short-lived signed URLs.
- Account/API abuse limiting runs before quota/cost/provider submission. Provider rate limiting and circuit breaking are a separate outbound layer.
- Story text is untrusted data. Structured output, explicit delimiters, allowlists and schema/domain validation prevent prompt injection from authorizing tools, billing, ownership, storage or arbitrary jobs.

## Reliability and DR

PostgreSQL uses automated backups/WAL/PITR, >=30-day retention and quarterly restore drills (RPO <=15 minutes, RTO <=4 hours). Critical objects use versioning and a secondary failure-domain copy (RPO <=1 hour, RTO <=8 hours). Intermediate artifacts can use cheaper retention and regeneration from persisted snapshots. Redis is reconstructable and is not a backup source.

## Capacity baseline

- API: at least two production replicas with readiness probes.
- CPU workers: at least two processes/replicas; provider I/O concurrency and FFmpeg concurrency are benchmarked separately.
- GPU: optional 0..4 MVP workers, one heavy workflow per GPU by default; scale on queue age/depth, utilization and measured `gpu_seconds`.
- Render: bounded per-scene parallelism, normalized codec/fps/resolution/audio, then compatible concat/stream-copy where possible.

## Version drift note

The frontend README mentions Next.js 15, but `package.json` currently declares Next.js 16.3.1; this document follows the build file. The backend POM currently uses Java 25, while the specification's general Java baseline is Java 21+.
