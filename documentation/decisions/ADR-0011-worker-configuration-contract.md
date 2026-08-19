# ADR-0011: Canonical worker deployment configuration

## Status

Accepted

## Context

The Python AI worker exposes `provider_mode` and `worker_concurrency` as settings fields. Docker Compose previously passed the provider value through the legacy `PROVIDER_MODE` environment name and did not pass worker concurrency, while standalone examples used a mixture of names. The backend's `VERTEX_GEMINI_ENABLED` flag is a separate backend concern and must not select the worker adapter.

## Decision

Use these environment variables as the public worker deployment contract:

- `AI_PROVIDER_MODE`, mapped to the internal `provider_mode` setting.
- `WORKER_CONCURRENCY`, mapped to the internal `worker_concurrency` setting.

During compatibility rollout, `PROVIDER_MODE` remains accepted as a legacy alias only when `AI_PROVIDER_MODE` is absent. If both are supplied, `AI_PROVIDER_MODE` wins. The worker chooses its provider adapter from `provider_mode`; it does not read `VERTEX_GEMINI_ENABLED`.

## Consequences

Docker Compose and standalone worker configuration use the same canonical names. Existing standalone deployments using `PROVIDER_MODE` continue to work temporarily. The legacy alias can be removed in a later breaking configuration cleanup after deployment consumers have migrated.
