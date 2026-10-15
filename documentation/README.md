# NarrativeX Documentation

This directory contains the maintained product contract, current architecture, domain and workflow contracts, operational guidance, and architecture decisions. Source code, migrations, and tests establish implementation facts; accepted ADRs establish direction.

## Start here

| Document | Purpose |
| --- | --- |
| [Current status](./CURRENT_STATUS.md) | Implemented, partial, target, deferred, and last verified state |
| [Product specification](./product/PRODUCT_SPEC.md) | Current product contract and capability matrix |
| [Roadmap](./product/ROADMAP.md) | Current priorities and acceptance scenarios |
| [Architecture decisions](./decisions/README.md) | Active, proposed, and partially superseded ADRs |

## Architecture and contracts

| Document | Purpose |
| --- | --- |
| [System architecture](./architecture/SYSTEM_ARCHITECTURE.md) | Current Desktop, backend, worker, storage, and runtime boundaries |
| [Compute Protocol](./COMPUTE_PROTOCOL.md) | Backend-to-generation-service wire contract |
| [Database architecture](./architecture/DATABASE.md) | PostgreSQL authority, Flyway inventory, and schema invariants |
| [Generation routing](./architecture/generation-routing.md) | Active T2V capability and gated extended strategies |
| [Editing pipeline](./architecture/editing-pipeline.md) | Timeline, selected takes, immutable snapshots, and local rendering |
| [Technology stack](./architecture/TECHNOLOGY_STACK.md) | Current stack summary; executable manifests own exact versions |
| [Domain model](./domain/DOMAIN.md) | Shared domain hierarchy, business rules, and glossary |
| [Shot domain](./domain/shot-domain.md) | Shot/Take model and durable admission boundary |
| [Generation domain](./domain/generation-domain.md) | Take validation metadata and current generation limits |
| [Retention domain](./domain/retention-domain.md) | Partial retention data model and deferred automation |
| [Video-first cut-over inventory](./migration/current-state-inventory.md) | Current compatibility paths and removal gates |

## Workflows and operations

| Document | Purpose |
| --- | --- |
| [Story to video](./workflows/STORY_TO_VIDEO.md) | Chapter analysis through shot/take review and render |
| [Narration and audio](./workflows/NARRATION_AUDIO.md) | TTS, user audio, alignment, and timing authority |
| [Image generation](./workflows/IMAGE_GENERATION.md) | Current text-to-image path and reference-conditioning limits |
| [GPU worker operations](./operations/REMOTE_GPU_RUNTIME.md) | Worker deployment target, capabilities, and runtime checks |

## Active proposals and verification

| Document | Purpose |
| --- | --- |
| [Prompt Settings plan](./product/PROMPT_SETTINGS_IMPLEMENTATION_PLAN.md) | Proposed installation-wide editable prompts and shared visual styles; not implemented |
| [Antigravity OAuth/API plan](./product/ANTIGRAVITY_STORY_ANALYSIS_IMPLEMENTATION_PLAN.md) | Proposed direct API execution and durability work; not implemented |
| [Performance optimization plan](./product/PERFORMANCE_OPTIMIZATION_PLAN.md) | Proposed realtime, dispatch, integrity-cache and worker memory optimizations; not implemented |
| [Account flow plan](./product/ACCOUNT_TAB_IMPLEMENTATION_PLAN.md) | Proposed provider connection UX and credential lifecycle; not implemented |
| [Antigravity OAuth/API research](./product/ANTIGRAVITY_OAUTH_API_RESEARCH.md) | Current interoperability evidence and provider limitations |
| [Latest review evidence](./reviews/2026-10-12-review-cleanup.md) | Last recorded gate results, native Editor gaps, and runtime limits |

## Maintenance

- Update the smallest document that owns a changed behavior or boundary.
- Keep `IMPLEMENTED`, `PARTIAL`, `TARGET`, and `DEFERRED` explicit.
- Do not promote a target to implemented based on an accepted ADR or deterministic fixture alone.
- Historical plans and review snapshots belong in Git history when they no longer guide current work.
- Check links and documentation drift with `python -B scripts/check-docs-drift.py`.
