# Architecture Decision Records

ADRs record **why** a boundary exists. They do not record whether it is finished: implementation status lives in [current status](../current-status.md), and an accepted ADR is not proof of implementation.

## Index

| ADR | Decision | Status |
|---|---|---|
| [0001](ADR-0001-single-user-local-first.md) | Single-user local-first installation; Project is the business boundary | Accepted |
| [0002](ADR-0002-system-topology-and-control-plane.md) | Spring control plane, PostgreSQL authority, domain-agnostic compute plane; pre-production baseline policy; ID policy | Accepted |
| [0003](ADR-0003-durable-compute-execution.md) | Intent before I/O, UNKNOWN fencing, worker journal/outbox, signed callbacks, reconciliation | Accepted |
| [0004](ADR-0004-desktop-client-boundary.md) | Desktop is the only editor; main / preload / renderer split | Accepted |
| [0005](ADR-0005-local-media-and-final-render.md) | Local-first project media; Desktop-only leased final render, cache, backup, watermark | Accepted |
| [0006](ADR-0006-story-structure-and-source-anchoring.md) | StoryBeat hierarchy, source anchoring, fail-closed materialization, narration assembly | Accepted |
| [0007](ADR-0007-narration-tts-and-alignment.md) | VieNeu TTS and WhisperX alignment | Accepted |
| [0008](ADR-0008-video-first-shot-production.md) | Video-first Shot/Take/SelectedTake; capability-gated strategies; retention scope | Accepted |
| [0009](ADR-0009-chapter-analysis-agy-cli.md) | Chapter Analysis via the user's `agy` CLI session; isolation gate; account rotation deferred | Accepted (impl. PARTIAL) |
| [0010](ADR-0010-installation-wide-prompt-settings.md) | Installation-wide Prompt Settings frozen at admission | Proposed |

## Read by change type

| You are changing… | Read |
|---|---|
| Identity, ownership, limits | 0001 |
| Backend/worker boundary, schema policy | 0002, [database](../architecture/database.md) |
| Dispatch, retries, callbacks | 0003, [Compute Protocol](../architecture/compute-protocol.md) |
| Desktop IPC, security | 0004 |
| Local storage, render, export | 0005 |
| Analysis output, story structure, timing | 0006, 0009 |
| TTS / alignment | 0007 |
| Shots, takes, generation strategies | 0008 |
| Prompts and styles | 0010 |

## Rules

1. **Numbering.** On 2026-10-15 the records were consolidated and renumbered 0001–0010. Earlier numbers (for example the old 0006, 0018, 0020, 0024, 0026, 0035, 0038 and 0040) exist only in Git history and must not be cited. Each new ADR takes the next free number.
2. **One topic per ADR.** When a decision changes, edit the owning ADR if the change refines it. If it reverses it, write a new ADR, set the old one to `Superseded by ADR-XXXX` and keep only a one-line pointer in the index.
3. **Template.** Each ADR has a header block (Status, Date, Replaces), then Context, Decision, Invariants, Consequences and Related. Deferred directions get their own section. Implementation checkpoints, test counts, and schema column lists stay out of ADRs.
4. **Write an ADR** when a change crosses a client, storage, identity, timing-authority or execution boundary, or adds infrastructure (broker, cache, service). Synchronizing docs with an existing ADR needs no new one.
5. **Statuses:** `Proposed` → `Accepted` → `Superseded by …` / `Deprecated`.
