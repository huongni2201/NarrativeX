# NarrativeX AI Worker

## Purpose

The AI Worker is the asynchronous execution runtime for NarrativeX AI/media workloads. The current vertical slice executes persisted Chapter analysis. Image generation, TTS and FFmpeg rendering remain later stages.

The worker is not an HTTP API service. It claims durable PostgreSQL work created by the backend and executes against a persisted Chapter snapshot.

## Runtime

- Python 3.12+
- Pydantic / Pydantic Settings
- asyncpg
- HTTPX
- google-auth / ADC
- Ruff, strict mypy, pytest/pytest-asyncio

The current package does not depend on FastAPI/Starlette/Uvicorn.

## Current Chapter Analysis Flow

```text
Backend durable enqueue
  -> GenerationJob + StageAttempt
  -> optional Redis hint
  -> worker polls PostgreSQL
  -> FOR UPDATE ... SKIP LOCKED claim
  -> lease owner + heartbeat
  -> reserve durable ProviderOperation
  -> configured provider
  -> structured ChapterAnalysisResult
  -> persist provider result/reconciliation state
  -> verify Chapter rowVersion/sourceHash
  -> materialize Character + Location continuity
  -> materialize Scene + VisualBeat + Scene relations
  -> terminal StageAttempt + GenerationJob
```

PostgreSQL is authoritative. Redis is not required for generation correctness.

## Chapter Analysis Contract

`ChapterAnalysisRequest` is scoped to persisted project/story/chapter identity and includes the Chapter snapshot (`chapterRowVersion`, `sourceHash`, persisted `sourceText`). The browser does not supply arbitrary unsaved text as execution authority.

The structured result uses stable AI keys for Character/Location identity and Scene references. Schema validation rejects dangling continuity references before persistence.

The prompt treats Chapter source text as untrusted data. Story content cannot redefine system/tool/ownership/billing instructions.

## Continuity materialization

Current worker materialization persists:

- reusable Character / ProjectCharacter / CharacterVersion foundations;
- stable project Character AI-key mappings;
- project-scoped Locations and stable Location AI-key mappings;
- Scene / VisualBeat rows;
- Scene -> ProjectCharacter relations;
- Scene -> Location continuity references.

Continuity matching uses durable keys first and controlled candidate matching where required. Distinct response identities must not silently collapse into one project identity.

## Provider modes

### Disabled

```env
AI_PROVIDER_MODE=disabled
```

Safe default. It fails explicitly and never fakes a successful AI result.

### Vertex Gemini

```env
AI_PROVIDER_MODE=vertex
VERTEX_PROJECT_ID=<gcp-project>
VERTEX_LOCATION=us-central1
VERTEX_MODEL=gemini-2.5-flash
VERTEX_TIMEOUT_SECONDS=120
```

Authentication uses ADC/workload identity. Credentials never come from the browser.

## Durable media storage

Cloudflare R2 is the only supported durable media object store across development, staging and production. Use separate buckets per environment (for example `narrativex-dev` and `narrativex-prod`).

```env
R2_ACCOUNT_ID=<cloudflare-account-id>
R2_ACCESS_KEY_ID=<r2-access-key-id>
R2_SECRET_ACCESS_KEY=<r2-secret-access-key>
R2_BUCKET=narrativex-dev
# Optional; otherwise derived from R2_ACCOUNT_ID.
R2_ENDPOINT=
```

Durable generated/reference images, narration audio, subtitles/manifests, scene/motion video, final exports and thumbnails belong in R2. PostgreSQL stores the durable object key plus metadata, checksums and lineage. Worker-local files are ephemeral scratch/cache/FFmpeg workspace only and must never become authoritative asset locations.

The R2 configuration contract is present before the media vertical slice so image/TTS/render execution can share one storage boundary. The actual upload/download adapter is implemented with the first durable media stage rather than adding an unused storage SDK ahead of execution wiring.

## Durable ProviderOperation lifecycle

The worker persists provider-operation state around external execution. Current lifecycle foundation includes:

```text
RESERVED -> SUBMITTED -> RUNNING/COMPLETED
                      \-> FAILED
ambiguity/timeout -> UNKNOWN -> reconcile
```

Restart recovery reconciles persisted `RESERVED`/`SUBMITTED` operations instead of blindly submitting another provider request. A persisted completed normalized result can be replayed into materialization after a process crash without another provider call.

This is an implemented durability foundation, not a claim that every provider failure/reconciliation/actual-usage scenario is production-hardened.

## Claim, lease and concurrency

Worker claims use PostgreSQL row locking with `FOR UPDATE ... SKIP LOCKED`. Running attempts carry persisted worker ownership/heartbeat state and stale work can be reclaimed according to lease policy.

`WORKER_CONCURRENCY` defaults to 4 and is bounded by configuration. Graceful shutdown stops new claims and waits for in-flight work according to the runtime contract.

## Stale Chapter protection

Before result materialization, the live Chapter must still match the job snapshot:

```text
chapter.id == request.chapterId
chapter.storyVersionId == request.storyVersionId
chapter.rowVersion == request.chapterRowVersion
chapter.sourceHash == request.sourceHash
```

A stale result is rejected rather than applied to a newer Chapter source.

## Local development

```bash
python -m venv .venv
pip install -e ".[dev]"
python -m narrativex_worker --dry-run
python -m narrativex_worker
```

Quality gates:

```bash
pytest
ruff check .
ruff format --check .
mypy src tests
```

## Application boundaries

The worker owns durable AI/media execution mechanics, provider invocation, schema validation, lease/heartbeat behavior and result materialization.

It does not own browser authentication/authorization, project ownership, public APIs, product entitlement/billing policy authority or Flyway schema ownership.

## Remaining worker/media gaps

- Production hardening for all provider reconciliation/recovery cases and actual provider usage accounting.
- Full Character review/version-lock/reference workflow is owned across backend/product boundaries, not solved by analysis materialization alone.
- Image generation and generated-asset lifecycle.
- TTS/subtitles.
- Render/export/final artifact validation.
- Broader production observability and real-provider E2E evidence.
