# ADR-0024: Chapter continuity, selective regeneration and effective render reuse

**Status:** Accepted  
**Date:** 2026-09-05

## Context

NarrativeX previously analyzed Chapter structure and generated Visual Beats without a durable chapter-wide continuity authority. Re-running analysis or image generation could therefore repeat provider work, lose the exact semantic state that justified a prompt, regenerate more beats than necessary, or invalidate render cache entries because logical job/asset identity changed even when the encoded segment input did not.

The Desktop editor also needs a reviewable continuity report, deterministic stale-write protection and a safe path to regenerate only the affected downstream Visual Beats. These controls must remain compatible with the current PostgreSQL-only MVP runtime and Desktop local-first media/render boundary.

## Decision

NarrativeX adopts the following cross-cutting contract.

### 1. Immutable chapter continuity snapshots

Chapter analysis materializes an immutable `chapter_continuity_plan` plus scene/VisualBeat continuity state. Continuity facts are source/canon grounded, carry provenance, and are versioned with the authoritative chapter `source_hash` and storyboard revision.

Each deterministic/semantic validation pass produces an append-only continuity report revision. Human warning acknowledgements create another report revision; they do not mutate historical reports. Blocking conflicts cannot be acknowledged away.

### 2. PostgreSQL durable analysis checkpoints

Provider-facing analysis subcalls use durable PostgreSQL checkpoints keyed by semantic input fingerprints. A completed checkpoint is reusable only for the same scoped semantic input. Ambiguous provider submission remains `UNKNOWN` until reconciliation proves the terminal outcome.

Redis or a separate broker is not introduced for this feature. This extends ADR-0020's PostgreSQL-only runtime decision.

### 3. Backend-authoritative selective regeneration

The backend owns regeneration planning, ownership checks, stale-plan checks, cost estimation/authorization, idempotency and generation-job lineage.

A regeneration plan is immutable and short-lived. It pins the current continuity plan, source hash, requested beats, deterministically affected downstream beats and reusable beats. A stale continuity/source state produces HTTP 409 instead of silently regenerating against a newer chapter state.

Stable `Idempotency-Key` ownership belongs to the caller command. Transport retry and SSE reconnect must not create a different generation command.

### 4. Shared prompt snapshots

Image generation compiles provider prompts from a pinned backend prompt-input snapshot containing source/canon/continuity state. Selective regeneration reuses the same compiler and generation pipeline with an affected-beat scope; it does not fork a second prompt format.

### 5. Render provenance and effective cache identity

Project render input snapshots pin continuity provenance for each chapter when available: continuity plan ID and report revision for the same chapter/source hash.

Continuity/job/revision IDs are audit provenance, not segment-cache dependencies. A segment cache key is derived only from inputs that can affect encoded pixels: media checksum/type and fit controls, duration/frame count, motion/composition, transitions, baked subtitle slices/style, output dimensions/fps, encoder/quality/color profile and renderer policy versions.

Logical VisualBeat/media IDs and absolute timeline position do not invalidate a segment when those effective encoded inputs are unchanged.

### 6. Security and execution boundary

Provider credentials remain outside the renderer. Backend/worker authority for provider work and Desktop main-process authority for local filesystem/FFmpeg execution remain unchanged. Generated project media and final project render bytes stay local according to ADR-0012/ADR-0022.

## Consequences

Positive consequences:

- chapter continuity becomes reviewable, versioned and reproducible;
- duplicate analysis work can resume from semantic checkpoints;
- selective regeneration is bounded and auditable instead of replacing the whole storyboard;
- retries are safer because idempotency is stable across transport uncertainty;
- render cache misses track actual output dependencies rather than workflow identity churn;
- final render snapshots preserve which continuity state was accepted at render admission.

Costs/trade-offs:

- continuity and checkpoint state add schema/query complexity;
- deterministic scope expansion can intentionally regenerate more than one requested beat when downstream state depends on it;
- regeneration plans can expire or become stale and require replanning;
- cache-key changes require regression coverage because omitting a real pixel dependency risks stale output reuse;
- semantic provider-quality and cost improvements still require measured production-like evaluation; deterministic tests alone cannot prove them.

## Rejected alternatives

- **Mutable continuity rows/reports:** rejected because retries and review history would become non-auditable.
- **Client-computed regeneration scope:** rejected because ownership, cost and stale-state authority belong to the backend.
- **Regenerate every Visual Beat after any edit:** rejected because it wastes provider calls and removes useful unaffected media.
- **Use job/revision/asset IDs in segment cache keys:** rejected because logical identity changes can create unnecessary cache misses.
- **Introduce Redis/broker solely for checkpointing:** rejected because PostgreSQL already owns durable MVP execution state.
- **Allow users to bypass blocking continuity conflicts:** rejected because it would make deterministic safety checks advisory at the point where regeneration/render provenance must be trustworthy.

## Verification

Acceptance requires:

- deterministic continuity fixtures and validator/materialization tests;
- checkpoint fingerprint/replay and UNKNOWN reconciliation tests;
- stale/idempotency/cost-authorization tests for regeneration admission;
- Desktop review/regeneration retry tests;
- render-cache invalidation tests proving identity-only changes reuse cache and effective pixel-input changes miss cache;
- Flyway/MyBatis verification for immutable continuity/regeneration/render provenance state;
- full repository CI without weakening existing lint, type, build or documentation-drift gates.

Provider quality, latency and spend comparisons are evaluated separately with explicit measured data and are not inferred from unit/integration test success.
