# NarrativeX System Architecture

**Status:** V1.10 current architecture and implementation boundary.
**Canonical source:** `../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_10.md`.

## Architectural stance

NarrativeX is a Spring Boot modular monolith with a separately deployed Python AI/media worker. The backend owns browser/API authorization, business policy and durable orchestration. The worker owns asynchronous execution mechanics.

PostgreSQL is authoritative for durable domain and generation state. Redis has two non-equivalent roles: Spring Session state and transient/non-authoritative delivery/progress/abuse-control infrastructure.

## Logical topology

```text
Browser
  -> Next.js frontend
  -> Spring Boot API
       -> PostgreSQL (authoritative)
       -> Redis (session + transient hints/counters)
       -> Cloudflare R2 (durable media object storage)

PostgreSQL durable work
  -> Python 3.12 worker
       -> provider ports
       -> Vertex Gemini for current Chapter analysis
       -> Cloudflare R2 for durable media stage outputs
       -> validated continuity/storyboard materialization
```

## Current Chapter Analyze path

```text
Save Chapter
  -> sourceText/sourceHash/rowVersion persisted

Analyze
  -> ownership + persisted snapshot validation
  -> safety / entitlement / quota / cost admission
  -> atomic usage reservation
  -> OperationPlan + GenerationJob + StageAttempt + OutboxEvent
  -> COMMIT
  -> optional Redis hint
  -> worker PostgreSQL claim/lease/heartbeat
  -> ProviderOperation RESERVED
  -> provider submission/result/reconciliation
  -> stale Chapter check
  -> Character + Location continuity materialization
  -> Scene + VisualBeat + Scene relations
  -> terminal StageAttempt/GenerationJob
```

Creating a Project or saving a Chapter never implicitly starts AI work.

## Backend boundary

The Spring Boot application owns:

- server session/CSRF and ownership;
- Project, StoryVersion, Chapter and review APIs;
- durable generation admission and enqueue;
- PostgreSQL/Flyway schema ownership;
- GenerationJob/read/control-plane state;
- product entitlement/quota/cost/safety policy foundations.

Heavy provider/media execution does not run in HTTP request threads.

## Worker boundary

The Python worker:

- claims durable StageAttempt work using PostgreSQL `FOR UPDATE ... SKIP LOCKED`;
- maintains lease/heartbeat ownership;
- runs bounded concurrent jobs;
- reserves/persists ProviderOperation state around external execution;
- reconciles ambiguous/restarted provider operations rather than blindly resubmitting;
- validates structured provider output;
- verifies the Chapter snapshot before materialization;
- materializes Character/Location identity continuity plus Scene/VisualBeat relations.

The worker is not a public HTTP/FastAPI service and does not own browser authorization, entitlement policy or Flyway migrations.

## Provider durability

Current provider lifecycle foundation:

```text
RESERVED -> UNKNOWN -> SUBMITTED -> RUNNING -> COMPLETED
                    \-> RUNNING | COMPLETED | FAILED
SUBMITTED -> UNKNOWN | COMPLETED | FAILED
RUNNING -> UNKNOWN | COMPLETED | FAILED
COMPLETED | FAILED -> terminal
```

Tests cover restart reconciliation for persisted `RESERVED`/`SUBMITTED`, timeout-to-`UNKNOWN`, completed-result replay after a crash and lease-loss cancellation. Production hardening still requires broader provider-specific recovery/usage/observability evidence.

## Continuity boundary

Structured analysis uses stable Character/Location keys. The current worker persists project-scoped identity mappings, materializes Locations and writes Scene -> ProjectCharacter / Scene -> Location relations.

This closes the earlier analysis-time continuity persistence gap. It does not close the separate Character review/version-lock/reference workflow required before deterministic media generation.

## Redis boundary

Redis generation messages are hints, not the queue source of truth. Losing a hint must not erase PostgreSQL work.

Spring Session Redis is different: Redis availability affects authenticated session reads/writes and may sign users out, but it still does not replace PostgreSQL business state.

## Frontend boundary

TanStack Query owns persisted server state. URL/search params own navigable state. Zustand is limited to transient editor/wizard state. API mode must not silently substitute fixture analysis/progress/continuity data.

## Media/storage boundary

Cloudflare R2 is the sole durable media object store across development, staging and production. Environment isolation is handled with separate R2 buckets/configuration rather than a local object-storage service.

Worker-local media files are ephemeral scratch/cache/FFmpeg workspace only. A generated image, narration file or video is not durable merely because it exists on a worker filesystem. The target completion boundary is: validate the media payload, upload it to R2, persist the corresponding Asset/MediaAsset metadata in PostgreSQL, then mark the producing stage complete and clean local scratch when safe. Retry/reclaim paths should reuse a valid existing R2 object rather than regenerate because local files disappeared.

Durable R2 payloads include generated/reference images, narration audio, subtitles/manifests, scene/motion video, final exports and thumbnails. R2 objects remain private by default and access should be backend-authorized.

Image generation and its R2 persistence path, TTS/subtitles and FFmpeg render/export are not implemented end-to-end yet and remain downstream of reviewed analysis/storyboard state.

## Production gaps

- Full Character editing/version-lock/reference workflow.
- Approved storyboard reset/versioning UX/contract.
- Complete actual provider usage/billing reconciliation.
- Image generation and R2-backed generated-asset lifecycle.
- TTS/subtitles with R2-backed narration artifacts.
- Render/export/FinalArtifact validation with R2-backed outputs.
- Broader moderation/consent/abuse coverage.
- Production observability, deletion/retention and backup/restore evidence.
- Full real-provider E2E/load/recovery verification.

## Verification baseline

Backend:

```text
./mvnw clean verify
```

Worker:

```text
ruff check .
ruff format --check .
mypy src tests
pytest
```

Frontend:

```text
npm ci
npm test
npm run lint
npm run type-check
npm run build
```

Source presence alone is not production evidence; integration/E2E tests remain required for release claims.
