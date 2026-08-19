# NarrativeX documentation map

The canonical product and architecture baseline is **`NARRATIVEX_PROJECT_SPEC_V1_10.md`** (effective 19/08/2026, aligned with `main@193e602c5f1671ad3280f8952206535aa8f29bb4`). Older V1.8/V1.9 documents are historical references only and must not override the current baseline.

## Navigation

| Area | Purpose |
| --- | --- |
| [`source-of-truth/`](./source-of-truth/) | Canonical product/domain/architecture baseline |
| [`product/`](./product/) | Product scope, feature catalog, roadmap, delivery timeline |
| [`domain/`](./domain/) | Domain model, invariants, glossary and business rules |
| [`architecture/`](./architecture/) | System architecture, boundaries, data flow and technology stack |
| [`workflows/`](./workflows/) | End-to-end application workflows |
| [`decisions/`](./decisions/) | Accepted architecture decision records (ADRs) |
| [`plans/`](./plans/) | Time-boxed implementation plans |
| [`audits/`](./audits/) | Historical baselines, security audits and command evidence |
| [`codebase/`](./codebase/) | Current implementation maps and integration matrices |
| [`TRACEABILITY.md`](./TRACEABILITY.md) | Links between specification, implementation and evidence |

## Maintenance rules

1. The current source-of-truth document defines product/domain/architecture invariants.
2. Current code, migrations, tests and accepted ADRs define factual AS-IS implementation claims.
3. Historical audit/evidence files remain historical; do not rewrite evidence to match current status.
4. Cross-cutting architecture changes require an ADR before implementation.
5. Avoid duplicate source-of-truth documents. Derived Markdown files should link back to the maintained baseline.
6. Implementation status must distinguish IMPLEMENTED, PARTIAL, PENDING, PROTOTYPE and TARGET.
