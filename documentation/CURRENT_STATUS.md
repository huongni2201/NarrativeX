# Current architecture and migration status

Reviewed against the working tree on 2026-09-16. This is a navigation and migration-status summary, not a release certification.

## Authority

Current code, migrations and tests establish factual behavior. Accepted ADRs establish intended boundaries; a newer ADR supersedes only its stated scope. V1.11 and older workflow/codebase descriptions contain pre-migration material and must be read with this status page. Historical plans and audit reports are evidence, not current requirements.

## Active decisions

| Area | Direction and evidence | Status |
| --- | --- | --- |
| Local application | [ADR-0030](decisions/ADR-0030-single-user-local-first-architecture.md): single-user local-first; no application account/session identity; runtime limits replace per-user quotas | Cutover COMPLETE across codebase, configuration, and migrations |
| Business control | Spring Boot modular monolith + PostgreSQL; backend owns admission, jobs, leases, domain state and artifact metadata | Current boundary |
| Compute execution | [ADR-0028](decisions/ADR-0028-backend-control-plane-and-domain-agnostic-gpu-execution-plane.md), [ADR-0029](decisions/ADR-0029-generation-service-light-ddd-hexagonal-structure.md): active compute path is `Desktop -> Backend -> Generation Service -> Provider/runtime`. `app/generation-service` owns the registered protocol executors | Cutover COMPLETE; residue checker enforced |
| Recovery | [ADR-0031](decisions/ADR-0031-submission-checkpoint-and-worker-recovery-semantics.md): durable submission checkpoint before I/O; reconcile ambiguous outcomes | Accepted; verified in execution journal and recovery tests |
| Video Generation & Residency | [ADR-0033](decisions/ADR-0033-reference-conditioned-gpu-video-generation.md): Reference-conditioned GPU video generation via Wan2.1/ComfyUI with `GpuResidencyManager` | Accepted; deployment contract in `deploy/remote-gpu/`, residency manager implemented and verified |
| Database | [Database baseline](codebase/DATABASE_BASELINE.md): seven current SQL migrations, V1 through V7 | File inventory verified; baseline migrations aligned; 398 tests passing |
| Desktop | Only editor; renderer uses typed native capabilities; Electron main owns local media and final rendering | Retained boundary; UI flow verification required for UI changes |

## Target Topology & Migration Cutover

- **Topology**: `Desktop` (local editor & final FFmpeg timeline renderer) -> `Backend Service` (modular monolith control plane) -> `Generation Service` (remote or local GPU worker) -> `Provider runtimes (Qwen, ComfyUI, VoiceStudio, WhisperX)`.
- **Active compute runtime**: `app/generation-service` registers all protocol workload adapters, manages single-GPU VRAM residency mutual exclusion via `GpuResidencyManager`, and persists only its local execution journal.
- **Remote GPU deployment**: Production contract in `deploy/remote-gpu/` with capability-based token auth and TLS/SSH tunnel support.
- `docker-compose.yml`, CI and runtime environment run `generation-service` directly; legacy PostgreSQL-polling compute runtime configuration is removed.
- Architecture residue check (`scripts/check_architecture_residue.py`) is enforced as a repository gate in CI.
- All per-user quotas, account models, and authentication gates are removed in favor of single-user local-first operation.

## Maintaining this page

Update a status only with evidence from the affected implementation and relevant checks. Keep historical ADR rationale intact. When an older current-state document is revised, replace stale claims in that document and remove its migration notice only after its affected sections are reconciled.
