# NarrativeX documentation map

The canonical product and architecture baseline is [`source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_7.md`](./source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_7.md). The remaining Markdown files are implementation-facing views of that baseline and the current codebase.

## Navigation

| Area | Purpose |
| --- | --- |
| [`source-of-truth/`](./source-of-truth/) | Canonical NarrativeX project specification |
| [`product/`](./product/) | Product scope, feature catalog, roadmap, and delivery timeline |
| [`domain/`](./domain/) | Domain model, business rules, and glossary |
| [`architecture/`](./architecture/) | System architecture, service boundaries, data flow, and technology stack |
| [`workflows/`](./workflows/) | End-to-end application workflows |
| [`decisions/`](./decisions/) | Accepted architecture decision records (ADRs) |
| [`plans/`](./plans/) | Time-boxed implementation plans |
| [`execution/`](./execution/) | AI/coding-agent execution prompts that point to maintained plans |
| [`audits/`](./audits/) | Baselines, security/technical-debt audits, and command evidence |
| [`codebase/`](./codebase/) | Current implementation maps and integration matrices |
| [`TRACEABILITY.md`](./TRACEABILITY.md) | Links between specification, implementation, and evidence |

## Maintenance rules

1. Product/domain/architecture invariants override stale implementation notes.
2. Current code is authoritative for factual current-state claims; update stale Markdown instead of changing working code to match old notes.
3. Keep historical audit/evidence files historical; put current navigation and status in maintained README/index files.
4. Record cross-cutting architecture changes in an ADR before implementation.
5. Avoid duplicate source-of-truth documents. Compatibility files should point to the maintained document rather than copy it.
