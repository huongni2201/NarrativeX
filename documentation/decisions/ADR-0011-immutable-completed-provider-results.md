# ADR-0011: Immutable completed provider results

## Status

Accepted — 2026-08-20

## Decision

A durable provider operation that reaches `COMPLETED` owns one immutable provider-neutral normalized result. The worker computes `provider_operations.result_fingerprint` as a SHA-256 digest of the canonical JSON serialization of `ChapterAnalysisResult` and persists the result, fingerprint, completion timestamp, and `COMPLETED` state atomically.

First completion uses compare-and-set semantics and is allowed only from `SUBMITTED`, `RUNNING`, or `UNKNOWN`. A later completion carrying the same fingerprint is an idempotent success and does not mutate the completed row. A later completion carrying a different fingerprint is a provider-result invariant violation; the original durable result remains authoritative and must not be overwritten.

Historical `COMPLETED` rows can predate fingerprints. The schema constraint is introduced `NOT VALID` so those rows remain readable. If such a row is encountered again, the worker derives the fingerprint from its already persisted normalized result. A matching duplicate may backfill the missing fingerprint once; a mismatching duplicate is rejected. We intentionally do not bulk-hash historical JSON in SQL because the application canonicalizer is the source of truth for result fingerprints.

## Invariants

- `COMPLETED` provider results are immutable.
- New or updated `COMPLETED` rows have both `normalized_result_json` and `result_fingerprint`.
- `result_fingerprint` is a lowercase 64-character SHA-256 hexadecimal digest.
- `COMPLETED + same fingerprint` is idempotent success and does not change `row_version`, `completed_at`, or the stored result.
- `COMPLETED + different fingerprint` raises an invariant violation and preserves the first durable result.
- Concurrent conflicting completions have exactly one winner.

## Consequences

Reconciliation and duplicate callbacks cannot silently replace content that has already become the authoritative durable provider result. Billing and downstream materialization therefore continue to reference the same completed output even when providers or workers race. Historical rows remain deployable without an unsafe SQL-side reserialization/backfill step.
