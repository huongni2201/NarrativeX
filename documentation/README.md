# NarrativeX documentation map

The canonical product and architecture baseline is [`source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`](./source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md). Current code, Flyway migrations and tests decide factual AS-IS implementation claims when derived documentation drifts.

NarrativeX is desktop-only at the editor boundary. ADR-0010 defines the Electron client boundary, ADR-0011 defines Google OAuth-only Desktop authentication, and ADR-0012 defines Desktop local-first project media/render execution.

ADR-0003 still governs retained server-worker R2 + Google Drive paths where those paths are used, but its storage rules no longer apply globally to Desktop-local project bytes.

## Navigation

| Area | Purpose |
| --- | --- |
| [`source-of-truth/`](./source-of-truth/) | Canonical V1.11 product/domain/architecture direction |
| [`product/`](./product/) | Product contract, feature catalog and roadmap |
| [`domain/`](./domain/) | Domain model, invariants, glossary and business rules |
| [`architecture/`](./architecture/) | System architecture, boundaries, data flow and technology stack |
| [`workflows/`](./workflows/) | End-to-end workflows |
| [`decisions/`](./decisions/) | Accepted architecture decision records |
| [`plans/DESKTOP_APP_MIGRATION.md`](./plans/DESKTOP_APP_MIGRATION.md) | Desktop migration status, implemented slices and remaining reliability/release work |
| [`codebase/`](./codebase/) | Current implementation maps and persistence notes |
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
2. `app/desktop` is the only editor client. `app/frontend-web` has been removed and must not be recreated without an explicit architecture decision.
3. Electron renderer owns UI only. Native filesystem/process/auth-callback/local-execution capabilities belong to Electron main behind a narrow preload bridge.
4. Google is the only user-facing login provider. Do not reintroduce password login/register/forgot-password product flows.
5. User authentication and device execution credentials are different concepts: Desktop user auth establishes a server-managed NarrativeX session; device tokens authorize machine heartbeat/job APIs.
6. PostgreSQL is authoritative for durable business/domain/policy/job/lease metadata. Redis is non-authoritative for generation correctness.
7. Desktop project media is local-first under `<userData>/projects/<projectId>` and mapped by `project.manifest.json` using stable IDs, project-relative paths, size and SHA-256.
8. Absolute Desktop filesystem paths are never durable backend identifiers.
9. Desktop local FFmpeg execution is backend-assigned/lease-controlled and occurs in Electron main, not the renderer.
10. Cloudflare R2 + Google Drive remain retained server-worker storage paths where required; they are not mandatory Desktop project storage after ADR-0012.
11. Production Compose no longer contains a web frontend or Caddy. Self-hosted deployments may keep Cloudflare Tunnel as direct HTTPS ingress to `backend:8080`; deployments with another HTTPS ingress may omit it.
12. Narration is not synonymous with TTS. `NarrationStrategy.USER_PROVIDED_AUDIO` bypasses TTS for the covered scope.
13. Production persistence is MyBatis + explicit PostgreSQL SQL. Do not reintroduce JPA or direct `JdbcTemplate` persistence as a parallel production path.
14. Cross-cutting changes to client, auth, storage or execution boundaries require an ADR.
15. Update documentation drift checks whenever the canonical current-state document set changes.

## Desktop implementation checkpoint

The migration documentation baseline was originally aligned to:

```text
751f006634218efb2c398fc00c2cbfecd25e1eac
```

Since that checkpoint, the legacy web editor and Caddy ingress layer have been removed. Desktop is now the sole editor surface. Remaining work is focused on reliability, complete local materialization, packaging/signing/auto-update, protocol/OS hardening and production Desktop E2E.
