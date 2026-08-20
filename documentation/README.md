# NarrativeX documentation map

The canonical product and architecture baseline is [`source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_10.md`](./source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_10.md). Current code, migrations and tests define factual implementation state when derived documentation drifts.

Older V1.8/V1.9 labels may remain only where a document is explicitly historical or where a stable requirement ID originated in that catalog. They must not be presented as the current repository baseline.

## Navigation

| Area | Purpose |
| --- | --- |
| [`source-of-truth/`](./source-of-truth/) | Canonical product/domain/architecture baseline |
| [`product/`](./product/) | Maintained product contract, feature inventory and roadmap |
| [`domain/`](./domain/) | Domain model, invariants, glossary and business rules |
| [`architecture/`](./architecture/) | System architecture, boundaries, data flow and technology stack |
| [`workflows/`](./workflows/) | End-to-end application workflows |
| [`decisions/`](./decisions/) | Accepted architecture decision records (ADRs) |
| [`codebase/`](./codebase/) | Current implementation maps and integration matrices |
| [`TRACEABILITY.md`](./TRACEABILITY.md) | Requirement/capability to implementation and evidence mapping |

`plans/` and `audits/` are not current repository directories and therefore are not part of this navigation map.

## Maintenance rules

1. The current source-of-truth document defines maintained product/domain/architecture invariants.
2. Current code, migrations, tests and accepted ADRs define factual AS-IS implementation claims.
3. Historical evidence must be labeled historical rather than silently reused as current status.
4. Cross-cutting architecture/invariant changes require an ADR when they change an accepted decision.
5. Avoid duplicate source-of-truth documents. Derived Markdown files link back to the maintained baseline.
6. Current implementation status uses only `IMPLEMENTED`, `PARTIAL`, `PENDING`, `PROTOTYPE` and `TARGET`.
7. Do not encode a branch/commit SHA in the documentation map as permanent authority; verify factual status against the current repository revision.
