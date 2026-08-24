# NarrativeX documentation map

The canonical product and architecture baseline is [`source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`](./source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md). Current code, Flyway migrations and tests decide factual AS-IS implementation claims when derived documentation drifts.

NarrativeX is now desktop-first. ADR-0010 defines the Electron client boundary, ADR-0011 defines Google OAuth-only Desktop authentication, and ADR-0012 defines Desktop local-first project media/render execution.

ADR-0003 still governs the retained cloud/worker R2 + Google Drive path, but its storage rules no longer apply globally to Desktop-local project bytes.

## Navigation

| Area | Purpose |
| --- | --- |
| [`source-of-truth/`](./source-of-truth/) | Canonical V1.11 product/domain/architecture direction |
| [`product/`](./product/) | Product contract, feature catalog and roadmap |
| [`domain/`](./domain/) | Domain model, invariants, glossary and business rules |
| [`architecture/`](./architecture/) | System architecture, boundaries, data flow and technology stack |
| [`workflows/`](./workflows/) | End-to-end workflows |
| [`decisions/`](./decisions/) | Accepted architecture decision records |
| [`plans/DESKTOP_APP_MIGRATION.md`](./plans/DESKTOP_APP_MIGRATION.md) | Desktop migration status, implemented slices and remaining parity/reliability work |
| [`codebase/`](./codebase/) | Current implementation maps, persistence notes and integration matrices |
| [`TRACEABILITY.md`](./TRACEABILITY.md) | Capability-to-code/test evidence |

## Current authority order

When documents conflict:

1. current code + migrations + automated tests decide factual AS-IS implementation;
2. accepted ADRs decide intentional cross-cutting architecture boundaries;
3. the source-of-truth specification defines maintained product/architecture direction;
4. derived reports/plans must be updated to match the above.

A newer ADR wins only within the scope it explicitly supersedes.

## V1.11 maintenance rules

1. Keep `IMPLEMENTED`, `IMPLEMENTED foundation`, `PARTIAL`, `TARGET`, `DEFERRED` and `LEGACY/FALLBACK` distinct.
2. `app/desktop` is the primary editor client. `app/frontend-web` is a temporary legacy migration client until parity/removal gates pass.
3. Electron renderer owns UI only. Native filesystem/process/auth-callback/local-execution capabilities belong to Electron main behind a narrow preload bridge.
4. Google is the only user-facing login provider. Do not reintroduce password login/register/forgot-password product flows.
5. User authentication and device execution credentials are different concepts: Desktop user auth establishes a server-managed NarrativeX session; device tokens authorize machine heartbeat/job APIs.
6. PostgreSQL is authoritative for durable business/domain/policy/job/lease metadata. Redis is non-authoritative for generation correctness.
7. Desktop project media is local-first under `<userData>/projects/<projectId>` and mapped by `project.manifest.json` using stable IDs, project-relative paths, size and SHA-256.
8. Absolute Desktop filesystem paths are never durable backend identifiers.
9. Desktop local FFmpeg execution is backend-assigned/lease-controlled and occurs in Electron main, not the renderer.
10. Cloudflare R2 + Google Drive remain the retained cloud/legacy storage path under ADR-0003; they are not mandatory Desktop project storage after ADR-0012.
11. Narration is not synonymous with TTS. `NarrationStrategy.USER_PROVIDED_AUDIO` bypasses TTS for the covered scope.
12. Production persistence is MyBatis + explicit PostgreSQL SQL. Do not reintroduce JPA or direct `JdbcTemplate` persistence as a parallel production path.
13. Cross-cutting changes to client, auth, storage or execution boundaries require an ADR.
14. Update documentation drift checks whenever the canonical current-state document set changes.

## Desktop implementation checkpoint

The migration documentation is aligned to `main` commit:

```text
751f006634218efb2c398fc00c2cbfecd25e1eac
```

At that checkpoint, local project storage, explicit device pairing/heartbeat, local render claim/lease/progress/completion, FFmpeg/ffprobe rendering and in-process cancellation are implemented foundations. Restart-safe recovery, complete local materialization of every generation/import path, full Desktop parity and legacy web removal remain incomplete.
