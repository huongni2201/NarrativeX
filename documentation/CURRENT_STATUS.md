# Current architecture and migration status

Reviewed against the working tree on 2026-09-15. This is a navigation and migration-status summary, not a release certification. The working tree includes unfinished implementation changes.

## Authority

Current code, migrations and tests establish factual behavior. Accepted ADRs establish intended boundaries; a newer ADR supersedes only its stated scope. V1.11 and older workflow/codebase descriptions contain pre-migration material and must be read with this status page. Historical plans and audit reports are evidence, not current requirements.

## Active decisions

| Area | Direction and evidence | Status |
| --- | --- | --- |
| Local application | [ADR-0030](decisions/ADR-0030-single-user-local-first-architecture.md): single-user local-first; no application account/session identity; runtime limits replace per-user quotas | Accepted; migration remains PARTIAL across repository configuration/docs |
| Business control | Spring Boot modular monolith + PostgreSQL; backend owns admission, jobs, leases, domain state and artifact metadata | Current boundary |
| Compute execution | [ADR-0028](decisions/ADR-0028-backend-control-plane-and-domain-agnostic-gpu-execution-plane.md), [ADR-0029](decisions/ADR-0029-generation-service-light-ddd-hexagonal-structure.md): backend-push tasks to domain-agnostic `app/generation-service` | PARTIAL; legacy `app/ai-worker` still exists and Compose still configures database-polling workers |
| Recovery | [ADR-0031](decisions/ADR-0031-submission-checkpoint-and-worker-recovery-semantics.md): durable submission checkpoint before I/O; reconcile ambiguous outcomes | Accepted; validate implementation per executor, not from ADR status alone |
| Database | [Database baseline](codebase/DATABASE_BASELINE.md): seven current SQL migrations, V1 through V7 | File inventory verified; database execution not certified by this documentation review |
| Desktop | Only editor; renderer uses typed native capabilities; Electron main owns local media and final rendering | Retained boundary; UI flow verification required for UI changes |

## Known migration gaps

- `docker-compose.yml` still requires Google OAuth variables and configures session/OIDC settings despite ADR-0030. Do not describe the default deployment as fully migrated or remove credential protections merely to match prose.
- Older documents still describe guest/account ownership, Google sign-in and account voice storage. These are pre-ADR-0030 descriptions, not instructions to restore identity infrastructure. Storage transport changes need implementation evidence; ADR-0030 alone does not certify removal of every R2 integration.
- The provider-independent `scripts/verify-local.py` gate covers the backend, legacy AI worker and Desktop; it does not yet include generation-service checks. Run that service's documented checks separately for changes there.
- A registered compute adapter or accepted task is not evidence of successful real-provider execution. Complete each slice's contract, recovery, artifact and integration checks before marking cut-over complete.

## Maintaining this page

Update a status only with evidence from the affected implementation and relevant checks. Keep historical ADR rationale intact. When an older current-state document is revised, replace stale claims in that document and remove its migration notice only after its affected sections are reconciled.
