# NarrativeX AI coding context

Read [AGENTS.md](AGENTS.md) for repository rules and [current status](documentation/CURRENT_STATUS.md) before implementation work. This file is a navigation entry point; it does not duplicate those rules.

| Task | Read |
| --- | --- |
| Find architecture/domain/workflow docs | [Documentation map](documentation/README.md) |
| Identity, ownership, runtime limits | [ADR-0030](documentation/decisions/ADR-0030-single-user-local-first-architecture.md) |
| Backend/compute split | [ADR-0028](documentation/decisions/ADR-0028-backend-control-plane-and-domain-agnostic-gpu-execution-plane.md), [Compute Protocol](documentation/COMPUTE_PROTOCOL.md) |
| GPU service structure and development | [Service README](app/generation-service/README.md), [ADR-0029](documentation/decisions/ADR-0029-generation-service-light-ddd-hexagonal-structure.md) |
| Submission/recovery | [ADR-0031](documentation/decisions/ADR-0031-submission-checkpoint-and-worker-recovery-semantics.md) |
| Database edits | [Database design and baseline](documentation/architecture/DATABASE.md) |
| Verification | [CONTRIBUTING.md](CONTRIBUTING.md) |


Accepted architecture and migration completion are separate. Preserve local-first project media, narration-clock timing, immutable approved snapshots and backend-controlled execution while reconciling older documentation.
