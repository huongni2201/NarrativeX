# NarrativeX documentation map

The canonical product and architecture baseline is [`source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`](./source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md). Current code, Flyway migrations and automated tests decide factual AS-IS implementation claims when derived documentation drifts. ADR-0020 supersedes older Redis/session/delivery guidance within its scope.

NarrativeX is desktop-only at the editor boundary. ADR-0010 defines the Electron client boundary, ADR-0011 defines Google-only account sign-in, ADR-0012 defines Desktop local-first project media/render execution, and ADR-0020 defines the PostgreSQL-only MVP runtime.

## Navigation

| Area | Purpose |
| --- | --- |
| [`source-of-truth/`](./source-of-truth/) | Canonical V1.11 product/domain/architecture direction and current implementation summary |
| [`product/`](./product/) | Product contract, feature catalog and current roadmap |
| [`domain/`](./domain/) | Domain model, invariants, glossary and business rules |
| [`architecture/`](./architecture/) | Current topology, boundaries, data flow and technology stack |
| [`workflows/`](./workflows/) | End-to-end user and production workflows |
| [`decisions/`](./decisions/) | Accepted architecture decision records; keep these as historical decision evidence |
| [`codebase/`](./codebase/) | Current implementation maps, database baseline, renderer structure and quality policy |
| [`TRACEABILITY.md`](./TRACEABILITY.md) | Primary capability-to-code/test evidence matrix |
| [`release/`](./release/) | Local/release quality gates |

## Authority order

1. current code + Flyway migrations + automated tests decide factual AS-IS implementation;
2. accepted ADRs decide intentional cross-cutting architecture boundaries;
3. the source-of-truth specification defines maintained product/architecture direction;
4. current roadmap/workflow/codebase docs summarize or plan within those boundaries;
5. Git history preserves retired migration notes and superseded implementation reports.

A newer ADR wins only within the scope it explicitly supersedes.

## Current maintenance rules

1. Keep `IMPLEMENTED`, `IMPLEMENTED foundation`, `PARTIAL`, `TARGET` and `DEFERRED` distinct.
2. `app/desktop` is the only editor client.
3. Electron renderer owns UI only; native capabilities belong to Electron main behind a narrow preload bridge.
4. Desktop starts with a stable installation-scoped guest identity; Google is the only end-user account sign-in provider.
5. PostgreSQL is authoritative for durable business/domain/policy/job/lease/artifact metadata, server sessions and one-time Desktop OAuth handoffs. Redis is not required by the MVP runtime.
6. Python workers poll/claim durable PostgreSQL queue rows directly; do not document Redis, broker, `LISTEN`, or `NOTIFY` as a current queue dependency.
7. Desktop project media is local-first under `<userData>/projects/<projectId>` and mapped by `project.manifest.json`.
8. Absolute Desktop filesystem paths are never durable backend identifiers.
9. Final FFmpeg execution is backend-assigned/lease-controlled and occurs in Electron main.
10. Cloudflare R2 is limited to generated-media transport/durability before Desktop materialization; final MP4 bytes remain local.
11. Narration is not synonymous with TTS. `NarrationStrategy.USER_PROVIDED_AUDIO` bypasses TTS for the covered scope.
12. Production persistence is MyBatis + explicit PostgreSQL SQL.
13. Flyway V1-V3 are frozen; V4 adds immutable render subtitle snapshots and V5 adds the Chapter Workspace generation lookup index; later migrations are append-only V6+.
14. Cross-cutting changes to client, auth, storage or execution boundaries require an ADR.
