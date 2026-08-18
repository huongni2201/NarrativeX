# NarrativeX AI Worker

## Purpose

The AI Worker is the asynchronous execution runtime for NarrativeX AI/media workloads. In the current MVP slice it executes **persisted Chapter analysis**. Image generation, TTS and FFmpeg rendering remain later stages.

The worker does not accept arbitrary browser story text as its authority. It claims durable PostgreSQL work created by the backend and receives a persisted Chapter snapshot identity.

## Current Chapter Analysis Flow

```text
Backend durable enqueue
  -> GenerationJob + StageAttempt in PostgreSQL
  -> optional Redis delivery hint
  -> worker polls PostgreSQL
  -> claim with FOR UPDATE ... SKIP LOCKED
  -> lease owner + heartbeat
  -> ChapterAnalysisRequest
  -> configured LLM provider
  -> structured ChapterAnalysisResult
  -> verify Chapter rowVersion/sourceHash snapshot
  -> persist Character / ProjectCharacter / CharacterVersion
  -> persist Scene / VisualBeat
  -> StageAttempt COMPLETED
  -> GenerationJob COMPLETED
```

PostgreSQL is the source of truth. Redis is not required for correctness and a dropped Redis message must not lose queued work.

## Chapter Analysis Contract

`ChapterAnalysisRequest` contains:

```text
projectId
storyVersionId
chapterId
chapterRowVersion
sourceHash
sourceText
sourceLanguage
```

The obsolete per-story rights-attestation fields are intentionally absent:

```text
rights_attested
rights_policy_version
rights_basis
```

The prompt treats Chapter source text as untrusted story data. Instructions embedded in the story must not become system/tool instructions.

The provider result is validated with Pydantic before persistence and contains the MVP analysis structure:

```text
characters[]
locations[]
scenes[]
  narration
  characters[]
  location
  visual_beats[]
```

## Provider Modes

### Disabled — safe default

```env
PROVIDER_MODE=disabled
```

The disabled provider fails explicitly. It never returns fake successful AI output in normal runtime.

### Vertex Gemini

```env
PROVIDER_MODE=vertex
VERTEX_PROJECT_ID=<gcp-project>
VERTEX_LOCATION=us-central1
VERTEX_MODEL=gemini-2.5-flash
VERTEX_TIMEOUT_SECONDS=120
```

Authentication uses Google Application Default Credentials / workload identity. Provider credentials must not be passed from the browser.

The Vertex adapter requests structured JSON and validates the result with `ChapterAnalysisResult` before materialization.

Current limitation: dedicated durable `ProviderOperation` persistence and `UNKNOWN` reconciliation are still required before production readiness. The current synchronous Vertex Chapter-analysis adapter is an MVP foundation, not the final external-operation recovery model.

## Durable Claim and Lease

The worker claims work directly from PostgreSQL with row locking:

```text
FOR UPDATE ... SKIP LOCKED
```

A claimed `StageAttempt` records:

- `worker_id`
- `status = RUNNING`
- `heartbeat_at`

The worker periodically updates the heartbeat. A stale running attempt can be reclaimed after the configured lease timeout.

Before committing analysis output, the worker verifies that it still owns the StageAttempt lease.

## Stale Chapter Protection

Before result materialization, the worker checks:

```text
chapter.id == request.chapterId
chapter.storyVersionId == request.storyVersionId
chapter.rowVersion == request.chapterRowVersion
chapter.sourceHash == request.sourceHash
```

If the Chapter changed while AI was executing, the old result is rejected rather than applied to the newer Chapter source.

For the MVP, no `ChapterVersion`, `ChapterRevision` or `ChapterSnapshot` aggregate is required. The saved Chapter `rowVersion/sourceHash` and the GenerationJob snapshot form the analysis boundary.

## Technology Stack

- **Language:** Python 3.12
- **Configuration & Validation:** Pydantic v2, Pydantic Settings
- **Database client:** asyncpg
- **HTTP client:** HTTPX
- **Google authentication:** google-auth / ADC
- **Code Quality:** Ruff, Mypy
- **Testing:** Pytest, Pytest-asyncio
- **Packaging:** `pyproject.toml` with Hatchling

## Local Prerequisites

- Python 3.12+
- PostgreSQL with NarrativeX Flyway schema applied
- virtual environment tool (`venv` or `uv`)
- Google ADC credentials only when `PROVIDER_MODE=vertex`

## Environment

See `.env.example`. Important worker settings include:

```env
WORKER_NAME=narrativex-worker
WORKER_ENV=development
LOG_LEVEL=INFO
DATABASE_URL=postgresql://narrativex:password@localhost:5432/narrativex
POLL_INTERVAL_SECONDS=2
LEASE_SECONDS=60
PROVIDER_MODE=disabled
VERTEX_PROJECT_ID=
VERTEX_LOCATION=us-central1
VERTEX_MODEL=gemini-2.5-flash
VERTEX_TIMEOUT_SECONDS=120
```

## Development Commands

### Set Up Virtual Environment & Install Dependencies

```bash
python -m venv .venv

# Windows PowerShell
.venv\Scripts\Activate.ps1

# Unix
source .venv/bin/activate

pip install -e ".[dev]"
```

### Run Worker Locally

```bash
python -m narrativex_worker
```

### Verification / Dry Run

Dry run validates worker construction/configuration without connecting to PostgreSQL or executing a job:

```bash
python -m narrativex_worker --dry-run
```

### Run Tests

```bash
pytest
```

### Linting & Formatting

```bash
ruff check .
ruff format --check .
ruff format .
```

### Type Checking

CI checks both source and tests:

```bash
mypy src tests
```

## Docker Compose

The root `docker-compose.yml` includes an `ai-worker` service. The worker depends on the PostgreSQL schema owned/migrated by the backend.

The safe local default remains:

```env
AI_PROVIDER_MODE=disabled
```

To run Vertex from a container, ADC/workload-identity credentials must be made available explicitly. Do not bake developer credentials into the image.

## Application Boundaries

### Worker owns

- claiming durable AI/media stages;
- lease/heartbeat while executing a stage;
- provider invocation through provider ports;
- prompt/schema boundary;
- provider result validation;
- current Chapter-analysis result materialization;
- later media-processing execution such as image/TTS/FFmpeg when those stages land.

### Worker must not own

- browser authentication/authorization;
- deciding whether a user owns a Project;
- accepting arbitrary browser source text as canonical Chapter state;
- HTTP session management;
- product entitlement/billing policy authority;
- Flyway schema ownership;
- direct browser communication.

The backend remains the canonical orchestration and authorization boundary even though the worker reads/writes PostgreSQL durable execution state.

## Current MVP Definition of Done

The Chapter-analysis worker portion is complete only when CI and integration/E2E verification prove:

```text
saved Chapter
  -> durable queued job
  -> worker claim
  -> heartbeat
  -> structured provider result
  -> Character + Scene + VisualBeat persistence
  -> COMPLETED
```

Also required:

- stale Chapter snapshot is rejected;
- worker restart/stale lease recovery does not duplicate materialization;
- disabled provider never fakes success;
- real Vertex smoke test validates the structured output contract;
- dedicated ProviderOperation durability/reconciliation is completed before production-grade external retry claims are made.
