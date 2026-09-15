# NarrativeX documentation map

The canonical product and architecture baseline is [`source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_12.md`](./source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_12.md). Current code, Flyway migrations and automated tests decide factual AS-IS implementation claims when derived documentation drifts. ADR-0030 establishes single-user local-first architecture; ADR-0028/0029 define the target backend control-plane/domain-agnostic GPU execution-plane boundary (`generation-service`); [`COMPUTE_PROTOCOL.md`](./COMPUTE_PROTOCOL.md) is its versioned wire contract; ADR-0031 defines durable submission checkpointing and recovery. The compute migration remains partial until its per-slice cut-over gates pass.

NarrativeX is desktop-only at the editor boundary. ADR-0010 defines the Electron client boundary, ADR-0012 defines Desktop local-first project media/render execution, ADR-0020 defines the PostgreSQL-only MVP runtime, and ADR-0023 makes narration-aligned source ranges the production timing model.

## Navigation

| Area | Purpose |
| --- | --- |
| [`source-of-truth/`](./source-of-truth/) | Canonical V1.12 product/domain/architecture direction and specifications |
| [`product/`](./product/) | Product contract, feature catalog and current roadmap |
| [`domain/`](./domain/) | Domain model, invariants, glossary and business rules |
| [`architecture/`](./architecture/) | Current topology, boundaries, data flow and technology stack |
| [`workflows/`](./workflows/) | End-to-end user and production workflows |
| [`decisions/`](./decisions/) | Classified architecture decision records (ACTIVE, PARTIALLY SUPERSEDED, SUPERSEDED, HISTORICAL) |
| [`codebase/`](./codebase/) | Current implementation maps, database baseline, generation-service structure, renderer structure and quality policy |
| [`history/`](./history/) | Preserved historical workflow and specification documentation |
| [`TRACEABILITY.md`](./TRACEABILITY.md) | Primary capability-to-code/test evidence matrix |
| [`release/`](./release/) | Local/release quality gates |

## Authority order

1. current code + Flyway migrations + automated tests decide factual AS-IS implementation;
2. accepted ADRs decide intentional cross-cutting architecture boundaries;
3. the source-of-truth specification defines maintained product/architecture direction;
4. current roadmap/workflow/codebase docs summarize or plan within those boundaries;
5. Git history preserves retired migration notes and superseded implementation reports.

A newer ADR wins only within the scope it explicitly supersedes.

## Maintenance

Read [current status](CURRENT_STATUS.md) for ADR-0030 identity/limit migration, compute cut-over and deployment gaps. Apply repository rules from [AGENTS.md](../AGENTS.md); do not copy them into individual docs.

- Update the smallest document owning a behavior. Keep IMPLEMENTED, PARTIAL, TARGET and DEFERRED distinct.
- Keep historical ADRs and plans as rationale; their old requirements do not override a newer accepted decision in its superseded scope.
- Verify filenames, links and commands against the working tree. Use [CONTRIBUTING.md](../CONTRIBUTING.md) for validation.
