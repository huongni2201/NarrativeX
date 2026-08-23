# NarrativeX documentation map

The canonical product and architecture baseline is [`source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`](./source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md). Superseded versioned documents are removed once unique history is preserved in ADRs.

Current code, migrations and tests define factual implementation state when a derived document drifts. Accepted ADRs explain important implementation decisions and deliberate deviations. ADR-0003 defines the split R2 pipeline-media and Google Drive final-video storage contract.

## Navigation

| Area | Purpose |
| --- | --- |
| [`source-of-truth/`](./source-of-truth/) | Canonical V1.11 product/domain/architecture direction |
| [`product/`](./product/) | Maintained product contract, canonical [`FEATURE_CATALOG.md`](./product/FEATURE_CATALOG.md) and dependency-ordered roadmap |
| [`domain/`](./domain/) | Domain model, invariants, glossary and business rules |
| [`architecture/`](./architecture/) | System architecture, boundaries, data flow and technology stack |
| [`workflows/`](./workflows/) | End-to-end workflows, including generated and user-provided narration |
| [`decisions/`](./decisions/) | Accepted architecture decision records (ADRs) |
| [`codebase/`](./codebase/) | Current implementation maps, persistence migration and integration matrices |
| [`TRACEABILITY.md`](./TRACEABILITY.md) | V1.11 capability-to-code/test evidence |

## V1.11 maintenance rules

1. V1.11 is the maintained planning baseline; do not maintain parallel current catalogs/specs with version suffixes.
2. Code, migrations, tests and accepted ADRs decide factual AS-IS claims.
3. Keep `IMPLEMENTED`, `PARTIAL`, `TARGET` and `DEFERRED` distinct; do not report roadmap intent as merged code.
4. PostgreSQL is authoritative for durable application/execution state; Redis is non-authoritative for generation correctness.
5. Cloudflare R2 stores durable source/generated media such as images, narration audio, thumbnails and reusable media assets. Final rendered MP4 exports use the provider-neutral `FinalVideoStorage` boundary, with Google Drive as the authoritative durable provider. Worker-local files are scratch/cache/render workspace only.
6. A final video is not `READY` until local validation succeeds, Google Drive resumable upload completes, the remote object is verified, and authoritative metadata is committed. Only then may the local final file be deleted.
7. Backend-authorized `MediaPlan`/execution policy is authoritative; workers execute persisted policy rather than inventing paid work.
8. Narration is not synonymous with TTS. `NarrationStrategy.USER_PROVIDED_AUDIO` bypasses TTS for the covered scope.
9. Production persistence is MyBatis + explicit SQL + PostgreSQL. Architecture tests prohibit JPA and direct `JdbcTemplate` persistence.
10. Cross-cutting invariant changes require an ADR when they change an accepted decision.
11. Update `scripts/check-docs-drift.py` whenever the canonical baseline or current-state document set changes.
