# NarrativeX AI coding context

Read [AGENTS.md](AGENTS.md) for repository rules and [current status](documentation/CURRENT_STATUS.md) before implementation work. This file is a navigation entry point; it does not duplicate those rules.

| Task | Read |
| --- | --- |
| Find architecture/domain/workflow docs | [Documentation map](documentation/README.md) |
| Identity, ownership, runtime limits | [ADR-0020](documentation/decisions/ADR-0020-single-user-local-first-architecture.md) |
| Backend/compute split | [ADR-0018](documentation/decisions/ADR-0018-backend-control-plane-and-domain-agnostic-gpu-execution-plane.md), [Compute Protocol](documentation/COMPUTE_PROTOCOL.md) |
| GPU service structure and development | [Service README](app/generation-service/README.md), [ADR-0019](documentation/decisions/ADR-0019-generation-service-light-ddd-hexagonal-structure.md) |
| Submission/recovery | [ADR-0021](documentation/decisions/ADR-0021-submission-checkpoint-and-worker-recovery-semantics.md) |
| Database edits | [Database design and baseline](documentation/architecture/DATABASE.md) |
| Verification | [CONTRIBUTING.md](CONTRIBUTING.md) |


Accepted architecture and migration completion are separate. Preserve local-first project media, narration-clock timing, immutable approved snapshots and backend-controlled execution while reconciling older documentation.
