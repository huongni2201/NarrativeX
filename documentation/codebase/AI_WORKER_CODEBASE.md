# NarrativeX AI Worker Codebase

## Authority and role

The Python worker executes durable AI/media work authorized by Spring backend plans. It is not a public HTTP/FastAPI service and it is not product/domain authority. PostgreSQL remains the durable execution source of truth.

## Runtime and dependencies

- Python `>=3.12`.
- Package: `narrativex-worker` built with Hatchling.
- Validation/config: Pydantic v2 + Pydantic Settings.
- PostgreSQL: asyncpg.
- HTTP: HTTPX.
- Google auth: `google-auth` / ADC or workload identity.
- Quality: pytest/pytest-asyncio, Ruff and mypy.
- Entry points: `python -m narrativex_worker` and `narrativex-worker`.

The worker dependency manifest does not make FastAPI/Starlette/Uvicorn part of the runtime architecture.

Exact versions belong in `app/ai-worker/pyproject.toml`; do not duplicate version pins here as migration targets.

## Worker roles

The supported worker roles are:

```text
analysis
narration
media-validation
image-generation
```

The same source tree is packaged into role-specific runtimes. Current Compose/config separates general/image and narration concurrency using role-appropriate settings such as:

```text
GENERAL_WORKER_CONCURRENCY
NARRATION_WORKER_CONCURRENCY
WORKER_ROLES
```

Role-specific images/imports prevent one worker role from requiring every optional media dependency merely to start. Translation is not a supported worker role in the current product baseline.

## Chapter Analyze

```text
Backend durable admission
  -> OperationPlan + GenerationJob + StageAttempt
  -> worker polls PostgreSQL
  -> FOR UPDATE ... SKIP LOCKED claim
  -> lease owner + heartbeat
  -> persisted saved Chapter source request
  -> provider execution
  -> Pydantic structured-result validation
  -> Chapter rowVersion/sourceHash stale guard
  -> Character/Location/Scene/VisualBeat materialization
  -> terminal durable state
```

The analysis source is the authoritative saved `chapters.source_text/source_hash`; there is no translation/content-variant selection layer. Dropped delivery hints do not lose queued work because PostgreSQL is authoritative.

## Provider operation fence

External paid/provider work follows a fail-closed durable fence:

```text
RESERVED
  -> persist the submission fence before external call
  -> SUBMITTED / RUNNING when durable provider identity is known
  -> COMPLETED / FAILED
  -> UNKNOWN when acceptance/outcome is ambiguous
```

Rules:

- never blind-resubmit `UNKNOWN`, `SUBMITTED` or `RUNNING` work;
- reconcile using durable operation/request identity when the provider supports it;
- keep unsupported ambiguous outcomes visible for explicit attention rather than manufacturing success/failure;
- mutate provider operation state using status/row-version CAS rules;
- treat `COMPLETED` and `FAILED` as terminal;
- stale reconciliation responses must not overwrite newer durable state;
- stage lease loss cancels claimed processing and prevents new submissions from the stale worker.

Image and narration paths apply this boundary with workflow-specific reconciliation/finalization rules.

## Image generation

The image role executes backend-authorized `SHOT_IMAGE_GENERATE` work through the configured Vertex image adapter and durable batch/reconciliation path.

```text
queued media-generation items
  -> stage lease
  -> deterministic request fingerprint
  -> provider-operation submission fence
  -> Vertex batch staging/execution
  -> durable reconciliation
  -> validate/correlate image output
  -> stable MediaAsset + lineage
  -> retained remote materialization when required
  -> item/stage/job aggregation
```

Provider batch correlation fails closed when rows are missing/duplicate/unmatchable. One completed provider batch cannot complete a parent job while other items remain pending.

Remote R2 output is a server/provider durability boundary. Desktop workflows may then materialize the accepted MediaAsset locally through authorized Desktop/backend flows; the worker never owns the Desktop machine path.

## Narration

```text
TTS
  -> VieNeu execution
  -> validate/normalize
  -> retained remote materialization where required
  -> alignment

USER_PROVIDED_AUDIO
  -> ordered registered parts
  -> logical global clock
  -> alignment
  -> no TTS_GENERATE for covered scope
```

Narration generation consumes saved Chapter content directly. Narration provider ambiguity uses the same durable operation rules. Infrastructure failures after an external TTS side effect must not cause blind paid resubmission.

The worker may process user-owned voice references in ephemeral job storage when the authorized narration request allows it. Real-person samples require appropriate consent and must not become arbitrary durable payload secrets.

## Claim, lease and concurrency

Worker claims use PostgreSQL row locking/`SKIP LOCKED` plus observed status/version fences. Parent GenerationJob and StageAttempt transitions must stay consistent; stale cancellation/failure must not be resurrected by a broad claim predicate.

Heartbeat/terminal mutations carry worker/lease identity where the role owns a claim. Lease loss stops the old owner from creating durable side effects or terminalizing success.

Retry/backoff behavior uses shared deterministic bounded policies where implemented; arbitrary `sleep()`-driven correctness is not acceptable for tests or state-machine fencing.

## Runtime files and local scratch

Worker-local files are ephemeral execution scratch/cache. Runtime-file helpers validate paths/sizes/media constraints and must not be confused with Desktop ProjectStorage.

- Desktop local project bytes are owned by Electron main.
- Worker scratch is disposable.
- Retained remote server/provider media may use R2.

The worker does not decide the Desktop storage topology.

## Final project rendering

Final project video rendering belongs to Electron main under backend assignment/lease. The AI worker does not own Desktop `LOCAL_DEVICE` rendering, Desktop project paths or final MP4 bytes.

## Worker authority boundary

### Worker owns

- durable claimed AI/media stage execution;
- provider invocation/reconciliation through adapters;
- structured response/media validation;
- stale-source/lease fences during execution;
- provider/server materialization under persisted backend authorization.

### Worker does not own

- guest/account authentication or authorization;
- project ownership policy;
- public product APIs or HTTP sessions;
- entitlement/billing policy authority;
- Flyway schema ownership;
- Desktop native paths/ProjectStorage/device credentials;
- final project render execution;
- chapter translation/content variants;
- arbitrary paid-work escalation.

## Current gaps

- complete actual-usage reconciliation across all operation types;
- arbitrary multi-part user-audio production slicing/stitching hardening;
- richer generated-media review/reuse lineage;
- broader provider failure/recovery/observability evidence;
- optional I2V runtime hardening only when the product enables that path.

## Verification expectations

```bash
pytest
ruff check .
ruff format --check .
mypy src tests
```

Tests should cover claim/lease loss, provider submission ambiguity, stale source rejection, deterministic validation failures, reconciliation, shutdown behavior and role-specific optional dependency boundaries.
