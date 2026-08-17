# Cross-runtime contracts

This directory contains versioned payloads shared by the Spring Boot API and Python worker. Contracts must be backward-compatible during rolling deployments and must include an explicit schema/version field. A contract describes data and state transitions; it does not grant the worker authority to bypass ownership, entitlement, safety, budget, or provider reconciliation rules.

## Required properties

- Stable identifiers for project, operation, job, stage, and provider operation.
- `schemaVersion` and an idempotency key.
- Resource class and billed user attribution for expensive work.
- Snapshot references for prompt, character/outfit, image settings, render profile, and policy versions where applicable.
- Explicit terminal/error states; ambiguous provider submission is `UNKNOWN`, not an automatic retry.

The first concrete contract is [job-event.v1.schema.json](./job-event.v1.schema.json). It now includes the v1.7 chapter continuation and notification dispatch job types; adding a type does not bypass the backend safety/entitlement gates.
