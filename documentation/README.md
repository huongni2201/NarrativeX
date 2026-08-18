# NarrativeX documentation map

The canonical product and architecture baseline is the attached `NARRATIVEX_PROJECT_SPEC_V1_8.md` (effective 18/08/2026). This repository does not duplicate that specification; the remaining Markdown files are implementation-facing views of the V1.8 contract and the current codebase.

## Navigation

| Area | Purpose |
| --- | --- |
| [`product/`](./product/) | Product scope, feature catalog, roadmap, and delivery timeline |
| [`domain/`](./domain/) | Domain model, business rules, and glossary |
| [`architecture/`](./architecture/) | System architecture, service boundaries, data flow, and technology stack |
| [`workflows/`](./workflows/) | End-to-end application workflows |
| [`decisions/`](./decisions/) | Accepted architecture decision records (ADRs) |
| [`plans/`](./plans/) | Time-boxed implementation plans |
| [`audits/`](./audits/) | Baselines, security/technical-debt audits, and command evidence |
| [`codebase/`](./codebase/) | Current implementation maps and integration matrices |
| [`TRACEABILITY.md`](./TRACEABILITY.md) | Links between specification, implementation, and evidence |

## Maintenance rules

1. Product/domain/architecture invariants override stale implementation notes.
2. Current code is authoritative for factual current-state claims; update stale Markdown instead of changing working code to match old notes.
3. Keep historical audit/evidence files historical; put current navigation and status in maintained README/index files.
4. Record cross-cutting architecture changes in an ADR before implementation.
5. Avoid duplicate source-of-truth documents. Compatibility files should point to the maintained document rather than copy it.
