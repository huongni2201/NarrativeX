# ADR-0032: Domain-neutral text generation compute boundary

**Status:** Superseded by ADR-0034 (2026-09-18)
**Date:** 2026-09-16

## Context

Chapter analysis needs a Qwen runtime, but the provider must not read NarrativeX PostgreSQL or
interpret business identifiers. The backend remains responsible for admission, prompt assembly,
chapter interpretation, validation, persistence, and lifecycle state.

## Decision

Qwen text generation crosses the Compute Protocol v1 boundary as `text.generate`. Its closed input
schema contains only prompt and model-generation settings. Project, chapter, user, filesystem,
database, and provider-operation identifiers are forbidden. The generation-service may return an
opaque, capability-backed output artifact, while the backend decides whether that output is valid
for a business operation.

`ACCEPTED` and `RUNNING` observations are never business completion. The backend reconciles the
attempt to a terminal observation and keeps ambiguous outcomes conservative; it never blindly
resubmits a Qwen request after an unconfirmed external dispatch.

## Consequences

- Qwen configuration and provider credentials live with generation-service, not the backend.
- Contract schemas, examples, capability advertisement, and tests must include `text.generate`.
- Backend tests must keep business interpretation and persistence outside the compute payload.
- Historical direct PostgreSQL-polling worker references remain historical until the hard-cutover
  removal is completed.
