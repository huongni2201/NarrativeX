# ADR-0019: Light DDD and Hexagonal structure for the generation service

## Status

Accepted

## Context

The new `app/generation-service` is a domain-agnostic compute execution plane. Its first scaffold
already enforced the important boundary: no NarrativeX database, project domain vocabulary or
business orchestration. However, the package layout mixed protocol Pydantic models, execution
lifecycle orchestration, SQLite persistence, artifact HTTP and executor selection under
`domain`, `runtime` and `executors` names.

Provider SDKs, local/remote runtimes and model revisions are expected to change independently. If
those changes enter the lifecycle code, every provider migration becomes a replay/recovery risk.

## Decision

Use light DDD and Hexagonal Architecture inside the service:

- `contracts` owns Compute Protocol v1 wire models and canonical request fingerprinting.
- `domain` owns only the framework-free `ExecutionAttempt` lifecycle aggregate: identity,
  sequencing, terminal-state invariants and duplicate/older observation handling.
- `application` owns `ExecutionApplicationService`, application errors and ports. It coordinates
  submit/replay, capacity, cancellation, timeout and restart recovery without importing adapters.
- `adapters/inbound/http` owns FastAPI parsing, authentication, response mapping and request-size
  enforcement.
- `adapters/executors` owns capability/model resolution. Provider/runtime implementations will be
  added as adapters behind `ExecutorPort`; the application does not branch on provider names.
- `adapters/persistence` owns the execution-local SQLite journal. It is not a NarrativeX business
  repository and stores only protocol tasks/observations.
- `adapters/artifacts` owns capability-based HTTP byte transport and integrity checks.
- `bootstrap.py` is the composition root and the only module that selects concrete adapters.

The former `domain.models` and `runtime` imports remain thin compatibility shims for the migration
window. The top-level `executors` package is intentionally removed; new code has one canonical
executor location under `adapters/executors`.

## Consequences

Provider/runtime/model replacements are localized to adapter registration and their own tests.
Application tests can inject in-memory ports, while contract tests continue to validate the
external protocol. The service gains a few packages and temporary shims, but the lifecycle and
recovery rules now have one explicit owner and are protected from infrastructure churn.

This does not create a new microservice, database, broker or provider abstraction hierarchy. The
worker remains a single deployable execution plane with a small domain core.

## References

- `app/generation-service/README.md`
- `documentation/COMPUTE_PROTOCOL.md`
- `documentation/decisions/ADR-0018-backend-control-plane-and-domain-agnostic-gpu-execution-plane.md`
