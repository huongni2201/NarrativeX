# NarrativeX documentation map

The canonical product and architecture baseline is [`source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`](./source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md). V1.10 is retained only as historical baseline material.

Current code, migrations and tests define factual implementation state when a derived document drifts. Accepted ADRs explain important implementation decisions and deliberate deviations.

## Navigation

| Area | Purpose |
| --- | --- |
| [`source-of-truth/`](./source-of-truth/) | Canonical V1.11 product/domain/architecture direction |
| [`product/`](./product/) | Maintained product contract, feature inventory and dependency-ordered roadmap |
| [`domain/`](./domain/) | Domain model, invariants, glossary and business rules |
| [`architecture/`](./architecture/) | System architecture, boundaries, data flow and technology stack |
| [`workflows/`](./workflows/) | End-to-end workflows, including generated and user-provided narration |
| [`decisions/`](./decisions/) | Accepted architecture decision records (ADRs) |
| [`codebase/`](./codebase/) | Current implementation maps, persistence migration and integration matrices |
| [`TRACEABILITY.md`](./TRACEABILITY.md) | V1.11 capability-to-code/test evidence |

## V1.11 maintenance rules

1. V1.11 is the maintained planning baseline; V1.10 must not be linked as current authority.
2. Code, migrations, tests and accepted ADRs decide factual AS-IS claims.
3. Keep `IMPLEMENTED`, `PARTIAL`, `TARGET` and `DEFERRED` distinct; do not report roadmap intent as merged code.
4. PostgreSQL is authoritative for durable application/execution state; Redis is non-authoritative for generation correctness.
5. Cloudflare R2 is the only durable media object store; worker-local files are scratch/cache only.
6. Backend-authorized `MediaPlan`/execution policy is authoritative; workers execute persisted policy rather than inventing paid work.
7. Narration is not synonymous with TTS. `NarrationStrategy.USER_PROVIDED_AUDIO` bypasses TTS for the covered scope.
8. New persistence-heavy backend work converges on MyBatis + explicit SQL + PostgreSQL. JPA/JDBC are migration-era surfaces.
9. Cross-cutting invariant changes require an ADR when they change an accepted decision.
10. Update `scripts/check-docs-drift.py` whenever the canonical baseline or current-state document set changes.
