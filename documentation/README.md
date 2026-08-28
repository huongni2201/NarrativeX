# NarrativeX documentation map

The canonical product and architecture baseline is [`source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`](./source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md). Current code, Flyway migrations and automated tests decide factual AS-IS implementation claims. Accepted ADRs refine or supersede the baseline only within their declared scope.

NarrativeX is desktop-only at the editor boundary. ADR-0010 defines the Electron client boundary, ADR-0011 defines Google-only account sign-in, ADR-0012 defines Desktop local-first project media/render execution, ADR-0020 defines the PostgreSQL-only MVP runtime, and ADR-0021 defines the Desktop Gemini Web execution boundary.

## Document lifecycle

Documentation is intentionally split by lifecycle so historical material cannot be mistaken for current behavior.

| Class | Location | Authority |
| --- | --- | --- |
| **CURRENT** | `documentation/` except ADR bodies | Maintained description of current product, architecture, workflows, codebase and roadmap |
| **CANONICAL** | `documentation/source-of-truth/` | Maintained product/architecture contract and baseline implementation checkpoint |
| **EVIDENCE** | `documentation/TRACEABILITY.md` | Capability-to-code/test status at the documented implementation checkpoint |
| **HISTORICAL DECISION** | `documentation/decisions/ADR-*.md` | Decision rationale; later ADRs may supersede part of an older ADR |
| **ACTIVE/COMPLETED PLAN** | `docs/superpowers/plans/` | Non-authoritative implementation planning; status is tracked in the plans index |
| **RETIRED** | Git history only | Completed migrations, obsolete reports and superseded implementation notes must not return as current docs |

An ADR or implementation plan is never sufficient evidence for an `IMPLEMENTED` claim. Verify current code, migrations and tests and then update `TRACEABILITY.md`.

## Navigation

| Area | Purpose |
| --- | --- |
| [`source-of-truth/`](./source-of-truth/) | Canonical V1.11 product/domain/architecture direction and synchronized implementation baseline |
| [`product/`](./product/) | Product contract, feature catalog and active roadmap |
| [`domain/`](./domain/) | Domain model, invariants, glossary and business rules |
| [`architecture/`](./architecture/) | Current topology, boundaries, data flow and technology stack |
| [`workflows/`](./workflows/) | Current end-to-end user and production workflows |
| [`decisions/`](./decisions/) | ADR decision ledger and historical decision evidence |
| [`codebase/`](./codebase/) | Current implementation maps, database baseline, renderer structure and quality policy |
| [`TRACEABILITY.md`](./TRACEABILITY.md) | Primary capability-to-code/test evidence matrix |
| [`release/`](./release/) | Local/release quality gates |
| [`../docs/superpowers/plans/`](../docs/superpowers/plans/) | Non-authoritative active/completed implementation plans |

## Authority order

1. current code + Flyway migrations + automated tests decide factual AS-IS implementation;
2. accepted ADRs decide intentional cross-cutting architecture boundaries;
3. the source-of-truth specification defines maintained product/architecture direction;
4. `TRACEABILITY.md` records verified capability status at the synchronized implementation checkpoint;
5. current roadmap/workflow/codebase docs summarize or plan within those boundaries;
6. Git history preserves retired migration notes and superseded reports.

A newer ADR wins only within the scope it explicitly supersedes. A plan never outranks current documentation or code.

## Current maintenance rules

1. Keep `IMPLEMENTED`, `IMPLEMENTED foundation`, `PARTIAL`, `TARGET` and `DEFERRED` distinct.
2. `app/desktop` is the only editor client.
3. Electron renderer owns UI only; native capabilities belong to Electron main behind a narrow preload bridge.
4. Desktop starts with a stable installation-scoped guest identity; Google is the only end-user account sign-in provider.
5. PostgreSQL is authoritative for durable business/domain/policy/job/lease/artifact metadata, server sessions and one-time Desktop OAuth handoffs. Redis is not required by the MVP runtime.
6. Python workers poll/claim durable PostgreSQL queue rows directly; do not document Redis, a broker, `LISTEN`, or `NOTIFY` as a current queue dependency.
7. Desktop project media is local-first under `<userData>/projects/<projectId>` and mapped by `project.manifest.json`.
8. Absolute Desktop filesystem paths are never durable backend identifiers.
9. Final FFmpeg execution is backend-assigned/lease-controlled and occurs in Electron main.
10. Cloudflare R2 is limited to generated-media transport/durability before Desktop materialization; final MP4 bytes remain local.
11. Narration is not synonymous with TTS. `USER_PROVIDED_AUDIO` bypasses TTS for the covered scope.
12. Narration alignment persistence exists, but exact storyboard Visual Beat source offsets and source-to-audio timing reconciliation must not be claimed complete until the implementation and tests exist.
13. Production persistence is MyBatis + explicit PostgreSQL SQL.
14. Flyway V1-V8 form the clean pre-release baseline; V1-V6 separate schema/database responsibilities, V7 owns indexes and V8 owns deterministic catalog seeds. After the first production deployment, later migrations are append-only V9+.
15. Cross-cutting changes to client, auth, storage or execution boundaries require an ADR.
16. Gemini Web is a Desktop-main Chrome/CDP path, not a Python worker or browser-editor architecture; keep its prompt wrapper and privileged file commit behind the typed bridge.
17. Completed/superseded implementation plans must be reclassified in `docs/superpowers/plans/README.md`; do not leave completed plans looking active.
18. `scripts/check-docs-drift.py` and `scripts/check-docs-checkpoint.py` are required safeguards: a code change beyond the documented implementation checkpoint requires a docs resync.
