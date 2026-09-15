# Current architecture and migration status

Reviewed against the working tree on 2026-09-15. This is a navigation and migration-status summary, not a release certification. The working tree includes unfinished implementation changes.

## Authority

Current code, migrations and tests establish factual behavior. Accepted ADRs establish intended boundaries; a newer ADR supersedes only its stated scope. V1.11 and older workflow/codebase descriptions contain pre-migration material and must be read with this status page. Historical plans and audit reports are evidence, not current requirements.

## Active decisions

| Area | Direction and evidence | Status |
| --- | --- | --- |
| Local application | [ADR-0030](decisions/ADR-0030-single-user-local-first-architecture.md): single-user local-first; no application account/session identity; runtime limits replace per-user quotas | Accepted; migration remains PARTIAL across repository configuration/docs |
| Business control | Spring Boot modular monolith + PostgreSQL; backend owns admission, jobs, leases, domain state and artifact metadata | Current boundary |
| Compute execution | [ADR-0028](decisions/ADR-0028-backend-control-plane-and-domain-agnostic-gpu-execution-plane.md), [ADR-0029](decisions/ADR-0029-generation-service-light-ddd-hexagonal-structure.md): target topology is `Desktop -> Backend -> Generation Service -> Provider/runtime`. `app/generation-service` is the sole future execution plane; legacy `app/ai-worker` and `narration-worker` are scheduled for complete deletion | Cutover IN PROGRESS |
| Recovery | [ADR-0031](decisions/ADR-0031-submission-checkpoint-and-worker-recovery-semantics.md): durable submission checkpoint before I/O; reconcile ambiguous outcomes | Accepted; validate implementation per executor, not from ADR status alone |
| Database | [Database baseline](codebase/DATABASE_BASELINE.md): seven current SQL migrations, V1 through V7 | File inventory verified; database execution not certified by this documentation review |
| Desktop | Only editor; renderer uses typed native capabilities; Electron main owns local media and final rendering | Retained boundary; UI flow verification required for UI changes |

## Target Topology & Migration Cutover

- **Topology**: `Desktop` -> `Backend Service` -> `Generation Service` -> `Provider runtimes (Qwen, ComfyUI, VoiceStudio, WhisperX)`.
- **Legacy Components**: `app/ai-worker` and `narration-worker` are legacy execution paths scheduled for complete deletion upon cutover completion.
- `docker-compose.yml` and runtime environment are being cut over to run `generation-service` directly and eliminate all Google OAuth, session, and OIDC variables.
- All per-user quotas, account models, and authentication gates are removed in favor of single-user local-first operation.

## Maintaining this page

Update a status only with evidence from the affected implementation and relevant checks. Keep historical ADR rationale intact. When an older current-state document is revised, replace stale claims in that document and remove its migration notice only after its affected sections are reconciled.
