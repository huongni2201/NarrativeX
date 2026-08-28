# NarrativeX AI Worker Codebase

## Authority and role

The Python worker executes durable AI/media work authorized by Spring backend plans. It is not a public HTTP/FastAPI service and it is not product/domain authority. PostgreSQL remains the durable execution source of truth.

## Runtime and dependencies

- Python `>=3.12`.
- Package: `narrativex-worker` built with Hatchling.
- Validation/config: Pydantic v2 + Pydantic Settings.
- PostgreSQL: asyncpg.
- HTTP: HTTPX.
- Google auth: `google-auth` / ADC or workload identity where provider access requires it.
- Quality: pytest/pytest-asyncio, Ruff and mypy.
- Entry points: `python -m narrativex_worker` and `narrativex-worker`.

The worker dependency manifest does not make FastAPI/Starlette/Uvicorn part of the runtime architecture. Exact versions belong in `app/ai-worker/pyproject.toml`.

## Worker roles

The current supervisor supports:

```text
analysis
narration
media-validation
image-generation
```

There is no final-render worker role in `narrativex_worker.__main__`. Final project rendering belongs to Electron main under backend assignment/lease.

`WORKER_ROLES` selects enabled roles and a shared concurrency gate bounds active work. Role-specific optional imports prevent one role from requiring every media dependency merely to start. Translation is not a supported worker role in the current product baseline.

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

The analysis source is authoritative saved `chapters.source_text/source_hash`; there is no translation/content-variant selection layer. Dropped delivery hints do not lose queued work because PostgreSQL is authoritative.

### Character analysis/materialization

Current Character analysis includes source-grounded profile fields in addition to identity:

```text
key / name / aliases / description
role / importance / groups
bible / visual_prompt
age_state / hairstyle / injury / wardrobe_context / appearance_prompt
```

Materialization rules:

- merge/retain project-level role, importance and groups without destructively replacing stronger existing state;
- create and pin an AI-derived `CharacterVersion` only when `ProjectCharacter.pinned_character_version_id` is absent;
- never overwrite an explicitly pinned Character version merely because a later Chapter is analyzed;
- persist Chapter-scoped `CharacterAppearance` when source-grounded appearance fields exist;
- use stable Character/ProjectCharacter IDs rather than display names as relational identity.

### Scene and Visual Beat analysis

Current analysis schema supports:

```text
Scene
  title / narration / character refs / location ref

VisualBeat
  title
  visual_intent
  camera_angle
  characters[{character_key, role}]
```

Beat Character roles are `PRIMARY`, `SECONDARY`, or `BACKGROUND`. A beat Character must already be present in the parent Scene, and materialization persists `visual_beat_characters` rather than copying the full Scene cast into every beat.

Current non-claim: `VisualBeatAnalysis` does not yet contain stable source-span references, and storyboard materialization does not yet persist deterministic `text_start/text_end` or narration-derived `audio_start_ms/audio_end_ms` for every analyzed beat.

## Provider operation fence

External paid/provider work follows a fail-closed durable fence:

```text
RESERVED
  -> persist submission fence before external call
  -> SUBMITTED / RUNNING when durable provider identity is known
  -> COMPLETED / FAILED
  -> UNKNOWN when acceptance/outcome is ambiguous
```

Rules:

- never blind-resubmit `UNKNOWN`, `SUBMITTED` or `RUNNING` work;
- reconcile using durable operation/request identity when supported;
- keep unsupported ambiguous outcomes visible rather than manufacturing success/failure;
- mutate provider state using status/row-version/CAS rules;
- treat terminal results as immutable except idempotent same-fingerprint replay;
- stale reconciliation responses must not overwrite newer durable state;
- stage lease loss cancels claimed processing and prevents new side effects from the stale worker.

## Image generation

The image role executes backend-authorized image-generation work through the configured Vertex/provider adapter and durable reconciliation path.

```text
queued media-generation items
  -> stage lease
  -> deterministic request fingerprint
  -> provider-operation submission fence
  -> provider staging/execution
  -> durable reconciliation
  -> validate/correlate image output
  -> stable MediaAsset + lineage
  -> R2 transport when remote durability is required
  -> item/stage/job aggregation
```

Provider batch correlation fails closed when output is missing, duplicated or unmatchable. One completed provider batch cannot complete a parent job while other items remain pending.

Remote R2 output is a generated-media transport/durability boundary. Desktop workflows materialize accepted MediaAssets locally through authorized Desktop/backend flows; the worker never owns the Desktop machine path.

Gemini Web generation is not a worker adapter. It is a Desktop-main Chrome/CDP path.

## Narration

```text
TTS
  -> VieNeu/provider execution
  -> validate/normalize
  -> retained remote transport when required
  -> durable narration asset
  -> source-hash-bound alignment spans

USER_PROVIDED_AUDIO
  -> ordered registered parts
  -> logical global clock/alignment foundations
  -> no TTS generation for covered scope
```

Current generated narration alignment spans persist:

```text
textStart / textEnd
audioStartMs / audioEndMs
```

They are produced from real synthesized/materialized audio duration. This is a narration contract, not proof that storyboard Visual Beat timing has been reconciled. The current narration completion path does not write exact audio timing to every Visual Beat.

## Visual Beat timing boundary

Approved target flow, not current AS-IS implementation:

```text
semantic source-segment refs
  -> deterministic UTF-16 VisualBeat text_start/text_end
  -> compatible persisted narration alignment
  -> deterministic VisualBeatTimingReconciler
  -> VisualBeat audio_start_ms/audio_end_ms
```

AI must not count characters or invent timestamps. Source hash/version compatibility must guard later reconciliation.

## Claim, lease and concurrency

Worker claims use PostgreSQL row locking/`SKIP LOCKED` plus observed status/version fences. Parent GenerationJob and StageAttempt transitions must stay consistent; stale cancellation/failure must not be resurrected by a broad claim predicate.

Heartbeat/terminal mutations carry worker/lease identity where the role owns a claim. Lease loss stops the old owner from creating durable side effects or terminalizing success.

Retry/backoff behavior uses shared deterministic bounded policies where implemented; arbitrary `sleep()`-driven correctness is not acceptable for tests or state-machine fencing.

## Runtime files and local scratch

Worker-local files are ephemeral execution scratch/cache. Runtime-file helpers validate paths/sizes/media constraints and must not be confused with Desktop ProjectStorage.

- Desktop local project bytes are owned by Electron main.
- Worker scratch is disposable.
- Generated remote provider media may use R2 while transport durability is required.
- Final project MP4 bytes are owned by Desktop local artifacts.

## Final project rendering

Final project video rendering belongs to Electron main under backend assignment/lease. The AI worker does not own Desktop `LOCAL_DEVICE` rendering, Desktop project paths or final MP4 bytes.

## Worker authority boundary

### Worker owns

- durable claimed AI/media stage execution;
- provider invocation/reconciliation through adapters;
- structured response/media validation;
- stale-source/lease fences during execution;
- generated-media transport/materialization under persisted backend authorization.

### Worker does not own

- guest/account authentication or authorization;
- project ownership policy;
- public product APIs or HTTP sessions;
- entitlement/billing policy authority;
- Flyway schema ownership;
- Desktop native paths/ProjectStorage/device credentials;
- final project render execution;
- Chapter translation/content variants;
- arbitrary paid-work escalation.

## Current gaps

- deterministic Visual Beat source-span materialization and narration timing reconciliation;
- complete actual-usage reconciliation across all operation types;
- arbitrary multi-part user-audio production slicing/stitching/correction hardening;
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

Tests should cover claim/lease loss, provider submission ambiguity, stale source rejection, Character profile/pinning behavior, beat Character validation, deterministic validation failures, reconciliation, shutdown behavior and role-specific optional dependency boundaries.
