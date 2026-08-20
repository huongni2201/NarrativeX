# NarrativeX System Architecture

Status: V1.8 target architecture plus the current Chapter Analysis MVP implementation boundary. The attached `NARRATIVEX_PROJECT_SPEC_V1_8.md` remains the product/architecture contract; this page records the repository-facing AS-IS/TO-BE view.

## Architectural stance

NarrativeX is a modular monolith with a separately deployed Python AI/media worker. The Spring Boot application owns the business/orchestration boundary. It is intentionally not decomposed into many microservices while Project, Story, Character, Scene, Generation, Render, Cost and Entitlement still require frequent cross-domain evolution and transaction coordination.

The Python worker is a hard runtime boundary because AI/provider libraries and later TTS/image/FFmpeg workloads have a different execution/scaling profile. The worker may operate on durable PostgreSQL execution state, but it does not become the owner of browser authentication, project ownership policy, product entitlement or billing policy.

Core invariants:

- PostgreSQL is authoritative for domain state, GenerationJob, StageAttempt, Chapter analysis snapshots and outbox intent.
- Redis is non-authoritative infrastructure used for Spring Session, abuse counters, cache/progress and queue delivery hints. A lost queue hint must not erase durable work.
- Chapter analysis authority is the backend-loaded persisted Chapter, identified by `chapterId + storyVersionId + rowVersion + sourceHash` and snapshotted into the GenerationJob.
- Project creation and Chapter save never implicitly enqueue AI; Analyze is an explicit Chapter action.
- Every external provider result is validated before domain materialization.
- A worker must own the persisted StageAttempt lease before committing its result.
- A stale Chapter analysis result must not materialize if the Chapter `rowVersion/sourceHash` changed while the job was running.
- Dedicated durable `ProviderOperation` persistence, pre-submit `UNKNOWN` fencing and optimistic reconciliation CAS are implemented foundations; real-provider operations and monitoring remain production gates even though the current synchronous Vertex Chapter-analysis adapter performs real provider invocation.
- MinIO/S3-compatible storage remains the binary-media authority boundary for later image/TTS/render stages; Chapter analysis itself does not require media storage.

## Logical topology

```text
Browser
  |
  | HTTPS, REST, Google OIDC redirect
  | NX_SESSION + CSRF token
  v
Next.js + TypeScript frontend
  | same-origin /api, /oauth2, /login, /logout
  v
Spring Boot modular monolith
  |-- auth / ownership / Spring Security session + CSRF
  |-- project / story / chapter / character / storyboard
  |-- generation orchestration
  |-- entitlement / cost / safety foundations
  |-- transactional outbox
  |
  +--> PostgreSQL <---- Flyway migrations
  |      |-- Chapter source + rowVersion/sourceHash
  |      |-- OperationPlan
  |      |-- GenerationJob Chapter snapshot
  |      |-- StageAttempt lease/heartbeat
  |      |-- Character/ProjectCharacter/CharacterVersion
  |      |-- Scene/VisualBeat
  |      `-- OutboxEvent
  |
  +--> Redis
  |      |-- Spring Session
  |      |-- auth abuse-limit counters
  |      |-- best-effort generation delivery hints
  |      `-- cache / progress
  |
  +--> MinIO/S3-compatible object storage
  |
  `--> Python 3.12 AI worker
           |-- PostgreSQL claim/lease/heartbeat
           |-- prompt/schema boundary
           |-- provider ports
           |-- Vertex Gemini Chapter-analysis adapter
           |-- structured result validation
           `-- Character/Storyboard materialization

                 +--> Vertex AI Gemini via ADC/workload identity
```

## Current Chapter Analysis execution path

The current MVP branch implements this path:

```text
Save Chapter
  -> sourceText persisted
  -> sourceHash computed by backend
  -> rowVersion persisted

User clicks Analyze
  -> POST /api/v1/projects/{projectId}/chapters/{chapterId}/analysis-jobs
  -> backend checks ownership and Chapter/Project/StoryVersion consistency
  -> backend reloads persisted Chapter
  -> one transaction persists:
       OperationPlan
       GenerationJob(snapshot)
       StageAttempt
       OutboxEvent
  -> COMMIT
  -> optional Redis hint
  -> worker claims StageAttempt from PostgreSQL
  -> worker heartbeats lease
  -> Vertex/disabled provider through LlmProvider port
  -> structured result validation
  -> stale Chapter snapshot check
  -> Character + ProjectCharacter + CharacterVersion
  -> Scene + VisualBeat
  -> StageAttempt COMPLETED
  -> GenerationJob COMPLETED
```

This is the first real product durability boundary. It is still an MVP foundation because public Character/Storyboard read APIs, durable ProviderOperation persistence/reconciliation, production cost/safety gates and full E2E verification remain incomplete.

## Runtime responsibilities

### Web application

Next.js renders project and Chapter workflows. The current Chapter editor owns local dirty state and persisted Chapter save UX. Analyze is disabled while the Chapter is dirty or empty.

The frontend creates the Chapter analysis job only after save, then polls:

```text
GET /api/v1/generation-jobs/{jobId}
```

for `QUEUED -> RUNNING -> COMPLETED/FAILED` progress.

The browser never sends arbitrary current editor text as the authoritative AI payload. The backend loads the saved Chapter and snapshots it into the durable job.

TanStack Query remains the owner of persisted server state. Zustand is limited to transient wizard/editor state. API mode must not fall back to fixture analysis results.

### Spring Boot modular monolith

The backend is the canonical authorization and orchestration boundary. It owns:

- session/CSRF and project ownership checks;
- Project, StoryVersion and Chapter command/query contracts;
- optimistic Chapter concurrency using `rowVersion`, ETag and `If-Match`;
- Chapter source hashing;
- durable analysis enqueue transaction;
- GenerationJob read API;
- outbox persistence and post-commit delivery hint dispatch;
- domain/persistence ownership for Character/Storyboard state.

For the current analysis slice, the backend snapshots:

```text
projectId
storyVersionId
chapterId
chapterRowVersion
sourceHash
sourceText
sourceLanguage
```

onto the GenerationJob. This removes dependence on mutable browser state after the job is accepted.

### Python worker

The worker is no longer a sleep-only/port-only shell. On the Chapter Analysis branch it:

- connects to PostgreSQL;
- claims eligible StageAttempt rows with `FOR UPDATE ... SKIP LOCKED`;
- persists lease owner and heartbeat;
- calls the configured LLM provider;
- validates `ChapterAnalysisResult`;
- verifies the Chapter still matches the job snapshot;
- materializes Character and Storyboard rows;
- commits terminal StageAttempt/GenerationJob state.

The safe default provider remains disabled and fails explicitly rather than faking success.

### Vertex Gemini provider

The current real LLM adapter uses Vertex AI Gemini with Google Application Default Credentials/workload identity. It requests structured JSON and revalidates the response with Pydantic.

This adapter is intentionally the only real LLM adapter needed for the current MVP. OpenAI/Anthropic/multi-provider routing are not prerequisites for proving the core product loop.

The current call is synchronous from the worker's perspective. Production-grade ambiguity handling still requires durable `ProviderOperation` state:

```text
RESERVED -> UNKNOWN -> SUBMITTED -> RUNNING -> COMPLETED
                    \-> RUNNING / COMPLETED / FAILED
SUBMITTED -> UNKNOWN / COMPLETED / FAILED
RUNNING   -> UNKNOWN / COMPLETED / FAILED
COMPLETED / FAILED -> terminal
```

`COMPLETED`, not `SUCCEEDED`, is the canonical successful provider terminal status.

## Redis boundary

Redis has two different roles that must not be conflated:

1. Spring Session / transient application infrastructure;
2. best-effort generation delivery/progress acceleration.

A Redis outage may invalidate browser sessions or delay a delivery hint, but must not erase PostgreSQL Chapter, GenerationJob or StageAttempt state.

The Chapter-analysis worker can discover durable queued work directly from PostgreSQL. Therefore Redis is not the queue source of truth.

## Outbox boundary

The backend analysis enqueue transaction writes a unique outbox intent together with the durable job/stage state. Only after transaction commit may the dispatcher publish a Redis hint.

The Redis hint does not need to contain Chapter `sourceText`; the durable GenerationJob already owns the snapshot.

Terminal notification delivery remains a later production concern. Generation delivery outbox and user notification outbox should not be treated as the same product capability simply because both use the outbox pattern.

## Chapter snapshot and concurrency boundary

For MVP, no separate `ChapterVersion`, `ChapterRevision` or `ChapterSnapshot` aggregate is introduced.

Instead:

```text
Chapter
  id
  storyVersionId
  sourceText
  sourceHash
  rowVersion
```

plus the GenerationJob snapshot provide enough identity to answer: “which saved Chapter source did this AI job analyze?”

When Chapter text changes:

```text
sourceText changes
  -> backend recalculates sourceHash
  -> optimistic rowVersion advances
  -> a new Analyze request creates/returns work for the new persisted source identity
```

Before worker materialization, the live Chapter must still match the snapshotted rowVersion/sourceHash. Otherwise the stale AI result is rejected.

## Frontend state and transport boundary

- TanStack Query owns persisted server state and job polling.
- URL/search params own navigable/shareable route state.
- Zustand is reserved for transient wizard/editor state.
- local Chapter text/title state may be dirty, but dirty data is not AI-authoritative until saved.
- `src/shared/api/client.ts` owns credentials, CSRF, envelope validation and typed transport/protocol errors.
- API mode is authoritative; mocks remain limited to explicit test/design boundaries.

## Control planes

1. **Chapter analysis orchestration — implemented foundation:** persisted Chapter -> OperationPlan -> GenerationJob -> StageAttempt -> worker -> materialized analysis.
2. **Provider durability — implemented foundation:** provider port, persistent ProviderOperation, pre-submit `UNKNOWN` fence, status graph and optimistic `row_version` reconciliation CAS exist; leasing and production monitoring remain pending.
3. **Cost/entitlement — implemented MVP:** Chapter analysis runs a safety, entitlement and atomic quota reservation gate with a bounded non-zero cost estimate before OperationPlan/GenerationJob creation. Provider submission uses durable fingerprinted ProviderOperation rows and UNKNOWN reconciliation; provider-specific billing ledger enforcement remains a release gate.
4. **Trust & Safety — production target:** no blanket per-story copyright attestation; moderation, consent where applicable, abuse controls and output review remain separate gates.
5. **Notification — future production path:** terminal state and notification intent should eventually be committed durably and delivered asynchronously.
6. **Media pipeline — next milestones:** approved analysis -> image -> TTS -> FFmpeg, each with durable stages/assets/validation.

## Deployment and isolation

Local/dev Docker Compose includes PostgreSQL, Redis, MinIO, backend and AI worker. The worker deployment contract uses `AI_PROVIDER_MODE` and `WORKER_CONCURRENCY`; `PROVIDER_MODE` remains a temporary legacy input for standalone compatibility. `VERTEX_GEMINI_ENABLED` belongs to backend configuration and does not select the worker adapter. The AI worker defaults to disabled provider mode. Vertex execution requires explicit ADC/workload-identity credentials and project/location/model configuration.

Do not bake local developer credentials into the worker image.

The frontend, backend and worker remain separately buildable/deployable artifacts. A containerized frontend must use an internal backend destination such as `http://backend:8080`; its own `localhost:8080` is not another container.

Production baseline remains private PostgreSQL with backup/PITR, Redis, versioned private object storage, multiple API replicas, worker pools and centralized telemetry. The current Chapter Analysis MVP does not imply that all of those production gates are already satisfied.

## Verification baseline

The Chapter Analysis Vertical Slice must pass three repository CI gates:

### Backend

```text
mvn clean verify
```

including tests, Flyway verification, formatting/quality checks and JaCoCo floor.

### Worker

```text
ruff check .
ruff format --check .
mypy src tests
pytest
```

### Frontend

```text
npm ci
npm test
npm run lint
npm run type-check
npm run build
```

Source presence alone is not enough. Before the Chapter Analysis milestone is considered done, integration/E2E must prove:

```text
saved Chapter
  -> Analyze
  -> QUEUED
  -> worker claim
  -> RUNNING
  -> structured AI result
  -> Character/Scene/VisualBeat rows
  -> COMPLETED
```

and also prove stale-source rejection and worker lease recovery.

## Next architecture slice

After Chapter Analysis is stable, the next architecture work should expose and review the materialized analysis before adding media generation:

```text
M1: Chapter Analysis
  -> M2: Character read/review/approve
  -> M3: Storyboard read/review/approve
  -> M4: Image generation
  -> M5: TTS
  -> M6: FFmpeg render
```

This keeps NarrativeX image/video stages downstream of a durable, reviewable story understanding model rather than coupling media generation directly to raw Chapter text.
