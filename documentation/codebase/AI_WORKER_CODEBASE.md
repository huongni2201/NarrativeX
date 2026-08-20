# NarrativeX AI Worker Codebase

## Authority and role

This document describes the current Python worker implementation for the V1.10 baseline. Product and architecture authority remains `../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_10.md`.

The worker is the asynchronous execution runtime for AI/media workloads. It is not a browser-facing API and it is not canonical product/domain authority. Spring Boot owns client APIs, authorization and durable orchestration policy; PostgreSQL owns durable execution state.

## Runtime and dependencies

- Python `>=3.12`.
- Package: `narrativex-worker 0.1.0`, built with Hatchling.
- Configuration/validation: Pydantic v2 + Pydantic Settings.
- PostgreSQL client: asyncpg.
- HTTP client: HTTPX.
- Google authentication: `google-auth` / ADC or workload identity.
- Quality: Ruff, strict mypy, pytest and pytest-asyncio.
- Entry points: `python -m narrativex_worker` and `narrativex-worker`.

The current dependency manifest does **not** include FastAPI, Starlette or Uvicorn. The worker is not an HTTP API service.

## Current Chapter Analyze flow

```text
Backend admission + durable enqueue
  -> OperationPlan + GenerationJob + StageAttempt
  -> optional Redis delivery hint
  -> worker polls PostgreSQL
  -> FOR UPDATE ... SKIP LOCKED claim
  -> lease owner + heartbeat
  -> persisted Chapter snapshot request
  -> provider port
  -> Vertex Gemini when configured
  -> Pydantic structured-result validation
  -> Chapter rowVersion/sourceHash validation
  -> Character / ProjectCharacter / CharacterVersion materialization
  -> Scene / VisualBeat materialization
  -> terminal StageAttempt + GenerationJob state
```

A dropped Redis delivery hint must not lose queued work. PostgreSQL remains authoritative.

## Capability classification

| Capability | Current state |
|---|---|
| Provider-neutral schemas/ports | IMPLEMENTED |
| Disabled safe provider | IMPLEMENTED; fails explicitly and never fakes successful production output |
| PostgreSQL durable job polling | IMPLEMENTED |
| Claim with `FOR UPDATE ... SKIP LOCKED` | IMPLEMENTED |
| StageAttempt lease/heartbeat/stale recovery foundation | IMPLEMENTED |
| Bounded worker concurrency | IMPLEMENTED; configured by `WORKER_CONCURRENCY` |
| Chapter snapshot protection | IMPLEMENTED using `rowVersion` + `sourceHash` checks |
| Vertex Gemini structured Chapter analysis | IMPLEMENTED foundation |
| Character/Scene/VisualBeat result materialization | IMPLEMENTED foundation |
| ProviderOperation durable lifecycle | IMPLEMENTED foundation in the V1.10 execution model; complete reconciliation/usage hardening remains ongoing |
| Location materialization | PENDING |
| Scene character/location continuity materialization | PENDING |
| Image generation | PENDING |
| TTS/subtitle generation | PENDING |
| FFmpeg render/export | PENDING |

## Chapter analysis contract

The worker executes against persisted Chapter identity/state rather than arbitrary browser text. The request includes the project/story/chapter identity plus the Chapter snapshot fields required to reject stale results.

Before materialization the worker verifies that the persisted Chapter still matches the execution snapshot. If the Chapter changed while AI was executing, the old result must not be applied to the newer source.

The provider result is validated with Pydantic before persistence. Current analysis output supports Characters, Locations in the schema, Scenes and VisualBeats; however Location and Scene continuity persistence are still incomplete and must not be advertised as durable simply because the provider returned them.

## Provider modes

### Disabled

`AI_PROVIDER_MODE=disabled` is the safe default. It fails explicitly instead of synthesizing successful AI output.

### Vertex Gemini

`AI_PROVIDER_MODE=vertex` enables the Vertex Gemini adapter. Authentication uses Google Application Default Credentials/workload identity. Provider credentials must never come from the browser or be baked into the image.

External provider execution must follow the durable ProviderOperation lifecycle: `RESERVED` is CAS-fenced to `UNKNOWN` before the external call, then `UNKNOWN`/`SUBMITTED`/`RUNNING` outcomes are reconciled rather than blindly retried. Worker mutations use the loaded operation snapshot and status + `row_version` CAS; `COMPLETED` and `FAILED` are terminal.

## Claim, lease and concurrency

Workers claim eligible durable attempts with PostgreSQL row locking and `SKIP LOCKED`. A running attempt records worker ownership and heartbeat state. Stale attempts can be recovered according to lease policy.

`WORKER_CONCURRENCY` defaults to 4 and is bounded by configuration. Database pool sizing follows configured concurrency. Graceful shutdown stops new claims and waits for in-flight work according to the worker runtime contract.

## Application boundaries

### Worker owns

- durable AI/media stage execution;
- claim/lease/heartbeat execution mechanics;
- provider invocation through provider-neutral ports;
- prompt/schema boundary and structured validation;
- stale Chapter protection;
- current Chapter-analysis result materialization;
- future media execution once those stages are implemented.

### Worker does not own

- browser authentication/authorization;
- user/project ownership decisions;
- HTTP session management;
- public product APIs;
- entitlement/billing policy authority;
- Flyway schema ownership;
- arbitrary direct mutation of domain state outside defined durable execution/materialization contracts.

## Current gaps

- AI Location materialization.
- Durable Scene -> ProjectCharacter and Scene -> Location continuity relations.
- Complete provider actual-usage reconciliation across all operation types.
- Image generation and asset production.
- TTS/subtitle generation.
- Render/export/final artifact validation.
- Broader production observability, recovery and provider integration evidence.

## Verification expectations

Worker CI must continue to run Ruff, mypy and pytest. Integration/E2E verification should prove the durable path:

```text
saved Chapter
  -> durable queued work
  -> worker claim + heartbeat
  -> provider execution
  -> validated materialization
  -> durable terminal state
```

It should additionally cover stale Chapter rejection, stale lease recovery, disabled-provider fail-closed behavior and real-provider structured-output compatibility.
