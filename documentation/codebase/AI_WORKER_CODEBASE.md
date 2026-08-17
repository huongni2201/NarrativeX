# NarrativeX W1-D1 AI Worker Baseline

## Runtime and entry points

- Python runtime verified: `3.12.10`.
- Package: `narrativex-worker 0.1.0`, Hatchling build, Pydantic v2, HTTPX, pytest/pytest-asyncio, Ruff and strict mypy configured in `pyproject.toml`.
- Entry points: `python -m narrativex_worker` and `narrativex-worker`.
- `--dry-run` initializes settings, logs readiness and exits. Normal start enters an idle `asyncio.sleep(1)` loop.

## Current capability classification

| Capability | Classification | Evidence |
|---|---|---|
| Provider-neutral request/schema types | `PORT_ONLY` | `src/narrativex_worker/schema.py`, `providers/ports.py` |
| Safe disabled provider | `DETERMINISTIC_FAKE` | `providers/disabled.py:16-34`; every estimate/submit/status/reconcile call raises `ProviderNotConfiguredError` |
| Rights/prompt boundary | `PORT_ONLY` | `service.py:12-17`, `prompting.py:8-16` |
| Real provider adapter | `UNIMPLEMENTED` | no provider SDK or adapter package found |
| Durable job intake/claim | `UNIMPLEMENTED` | no queue, HTTP consumer, Redis client or backend client |
| Media/object-storage execution | `UNIMPLEMENTED` | no storage/media/FFmpeg client |

## Lifecycle audit

| Concern | Current state | Week 2 foundation gap |
|---|---|---|
| Job intake | none; process only | consume a versioned backend delivery contract |
| Claim/lease | none | claim `StageAttempt` with lease token and durable owner |
| Heartbeat | none | heartbeat and stale lease detection |
| Retry/timeout | none | classify local retryable failures vs external reconcile; explicit timeouts |
| Cancellation/shutdown | process signal handling on non-Windows; `CancelledError` is logged and re-raised | cooperative job cancellation and claim release |
| Idempotency | provider port has no idempotency key field; schema has a job-event idempotency key only | persist and enforce operation/stage idempotency end-to-end |
| UNKNOWN/reconciliation | enum and port method exist, no implementation/state transition | ambiguous submit must persist `UNKNOWN` and reconcile before retry |
| Storage | none | private object-store adapter and immutable asset metadata |
| Logging | basic process-level log format, no job/stage/provider correlation fields | structured correlation without raw story/prompt/secret leakage |
| Testing | 7 unit tests, no queue/provider integration | deterministic fake integration path and recovery tests |

## Provider boundary and untrusted input

The worker follows the intended boundary: `WorkerService` checks rights attestation, `build_story_analysis_prompt` wraps story content in an explicit untrusted-data marker, and `DisabledProvider` refuses to fake success. No real paid provider was called during D1. The current `ProviderOperation` dataclass has `operation_id` and `UNKNOWN`, but there is no durable reservation or reconciliation storage behind it.

## Verification

- `./.venv/Scripts/python.exe -m pytest`: 7 passed.
- `./.venv/Scripts/python.exe -m ruff check .`: pass.
- `./.venv/Scripts/python.exe -m mypy src`: pass with strict configuration.
- `./.venv/Scripts/python.exe -m narrativex_worker --dry-run`: pass; output explicitly says dry run completed and exits.
- The first system-Python pytest/mypy attempts were blocked by missing `pydantic`/`pydantic-settings`; the ignored `.venv` install resolved the environment prerequisite without changing production source.

## Missing Week 2 foundation

Implement only after D1/D2 decisions: backend contract client, durable claim/lease protocol, heartbeat/recovery, fake provider integration, provider-operation reservation and reconciliation, usage reporting, storage adapter, and structured observability. Do not add them as part of this audit.
