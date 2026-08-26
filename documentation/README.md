# NarrativeX documentation map

The canonical product and architecture baseline is [`source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`](./source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md). Current code, Flyway migrations and automated tests decide factual AS-IS implementation claims when derived documentation drifts.

NarrativeX is desktop-only at the editor boundary. ADR-0010 defines the Electron client boundary, ADR-0011 defines Google-only account sign-in, ADR-0012 defines Desktop local-first project media/render execution, and later ADRs refine local storage, render lifecycle, public IDs and renderer UI structure.

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

Completed migration plans and duplicate integration reports are intentionally not retained as current documentation. Remaining work belongs in [`product/ROADMAP.md`](./product/ROADMAP.md); historical architecture rationale belongs in ADRs and Git history.

## Authority order

When documents conflict:

1. current code + Flyway migrations + automated tests decide factual AS-IS implementation;
2. accepted ADRs decide intentional cross-cutting architecture boundaries;
3. the source-of-truth specification defines maintained product/architecture direction;
4. current roadmap/workflow/codebase docs summarize or plan within those boundaries;
5. Git history preserves retired migration notes and superseded implementation reports.

A newer ADR wins only within the scope it explicitly supersedes.

## Current maintenance rules

1. Keep `IMPLEMENTED`, `IMPLEMENTED foundation`, `PARTIAL`, `TARGET` and `DEFERRED` distinct.
2. `app/desktop` is the only editor client. `app/frontend-web` has been removed and must not be recreated without an explicit architecture decision.
3. Electron renderer owns UI only. Native filesystem/process/auth-callback/local-execution capabilities belong to Electron main behind a narrow preload bridge.
4. Desktop starts with a stable installation-scoped guest identity. The guest principal is an ownership/session mechanism, not a second login provider.
5. Google is the only end-user account sign-in provider. Password login/register/forgot-password product flows must not be reintroduced.
6. Guest free mutations and account/provider-consuming gates are enforced by backend authorization; the renderer must not be the only gate.
7. PostgreSQL is authoritative for durable business/domain/policy/job/lease/artifact metadata. Redis is non-authoritative for generation correctness.
8. Desktop project media is local-first under `<userData>/projects/<projectId>` and mapped by `project.manifest.json` using stable IDs, project-relative paths, size and SHA-256.
9. Absolute Desktop filesystem paths are never durable backend identifiers.
10. Final FFmpeg execution is backend-assigned/lease-controlled and occurs in Electron main, not the renderer or Python workers.
11. Cloudflare R2 is limited to generated-media transport/durability before Desktop materialization; final MP4 bytes remain local and are not stored or proxied by the backend.
12. Narration is not synonymous with TTS. `NarrationStrategy.USER_PROVIDED_AUDIO` bypasses TTS for the covered scope.
13. Production persistence is MyBatis + explicit PostgreSQL SQL. Do not reintroduce JPA or direct `JdbcTemplate` persistence as a parallel production path.
14. Flyway V1-V3 are the frozen core baseline; subsequent feature migrations are append-only.
15. Current dependency versions come from executable manifests (`pom.xml`, `pyproject.toml`, `package.json` and lockfiles), not duplicated migration notes.
16. Cross-cutting changes to client, auth, storage or execution boundaries require an ADR.
17. Update `scripts/check-docs-drift.py` when the canonical current-state document set changes.

## Current documentation checkpoint

Current-state documentation is synchronized against `main` commit:

```text
0aca94e6eef07158e161cd67c648671e74055473
```

on 2026-08-26. Later code still outranks this checkpoint if `main` advances before documentation is refreshed again.
