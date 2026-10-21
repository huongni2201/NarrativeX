# NarrativeX Documentation

Code, migrations and tests establish implementation facts. ADRs establish direction. [Current status](current-status.md) records the gap between them.

## Layout

```text
docs/
  README.md            this map
  current-status.md    IMPLEMENTED / PARTIAL / TARGET / DEFERRED, last verification
  decisions/           ADR-0001…0010: why each boundary exists
  architecture/        how the system is built: topology, protocol, database, pipelines
  domain/              domain model, rules and glossary
  operations/          running the GPU worker; benchmark baselines
  product/             what the product is (spec) and what comes next (roadmap)
  plans/               active implementation plans; delete when finished
```

## Start here

| Document | Purpose |
|---|---|
| [Current status](current-status.md) | What works, what is partial, what was last verified |
| [Architecture decisions](decisions/README.md) | ADR index and "read by change type" |
| [Product specification](product/product-spec.md) | Product contract and capability matrix |
| [Roadmap](product/roadmap.md) | Priorities and acceptance scenarios |

## Architecture

| Document | Purpose |
|---|---|
| [System architecture](architecture/system-architecture.md) | Runtime topology, service boundaries, data flows |
| [Compute Protocol v1](architecture/compute-protocol.md) | Backend ↔ generation-service wire contract |
| [Database](architecture/database.md) | Flyway inventory, baseline rules, schema invariants, removed items |
| [Technology stack](architecture/technology-stack.md) | Stack summary (manifests own exact versions) |
| [Generation routing](architecture/generation-routing.md) | Strategy matrix; active profile is T2V only |
| [Editing pipeline](architecture/editing-pipeline.md) | Selected takes, render snapshots, EDL target |
| [Desktop audio workspace](architecture/desktop-audio-workspace.md) | Audio navigation, character voice profiles, narration, VieNeu/custom voices and voice library |

## Domain

| Document | Purpose |
|---|---|
| [Domain model](domain/domain-model.md) | Aggregates, business rules, glossary |
| [Shot domain](domain/shot-domain.md) | Shot/Take model and durable admission |
| [Generation domain](domain/generation-domain.md) | Take validation metadata and QA taxonomy |
| [Retention domain](domain/retention-domain.md) | Persisted retention data; no engine |

## Operations

| Document | Purpose |
|---|---|
| [GPU worker runtime](operations/gpu-worker-runtime.md) | Worker deployment, capabilities, health checks |
| [Benchmarks](operations/benchmarks/) | Recorded baseline measurements |

## Active plans

| Plan | Status |
|---|---|
| [agy CLI Chapter Analysis](plans/agy-cli-chapter-analysis.md) | PARTIAL: isolation spike passed on agy 1.3.5, real chapter completion pending |
| [Two-stage Chapter Analysis](plans/20261017-two-stage-chapter-analysis.md) | PARTIAL: staged contracts, validation and runner implemented; PostgreSQL/runtime acceptance pending |
| [Prompt Settings](plans/prompt-settings.md) | PARTIAL: backend done, Desktop runtime unverified |
| [Performance optimization](plans/performance-optimization.md) | TARGET: not started |
| [Location continuity](plans/location-continuity.md) | PARTIAL: phase 0 (video prompt) implemented; phases 1–2 not started; phases 3–5 are superseded by the video quality pipeline |
| [Video production and regeneration](plans/20261017-video-production-and-regeneration.md) | PARTIAL: Phase A mostly implemented and Phase B core image attempts added; PostgreSQL/runtime gates remain; phases C–E are TARGET and superseded in order and approach by the video quality pipeline |
| [Production flow bug fixes](plans/20261017-production-flow-bug-fixes.md) | PARTIAL: cue allocation, review/trim and per-Shot UI are implemented; PostgreSQL and Electron runtime gates remain |
| [Video quality pipeline](plans/20261020-video-quality-pipeline.md) | TARGET direction (audio-first, keyframe-conditioned, multi-track render, P0–P14). P1 automatic take QC: P1.1–P1.4 implemented (scorer V2, thresholds V2, per-Take speech expectation) and the P1.F1 Desktop In/Out reset fixed; P1.5 Desktop implemented but runtime-unverified against the real API; P1.6 open; P0 gate not passed; P2–P14 not started |
| [Take/Shot status review fixes](plans/20261021-take-shot-status-review-fixes.md) | TARGET: review findings on the uncommitted QC V2 change (Shot status ownership, job-end Take closing, validation semantics, read-model cost, Take card keyboard access); not started |
| [Story-to-video remediation](plans/20261020-story-to-video-remediation.md) | PARTIAL: core SQL, CAS, duration, cue text and QC-label fixes have automated coverage; Electron/API/GPU acceptance remains |

## Maintenance rules

- Update the smallest document that owns the changed behaviour. Boundary changes need an ADR (see [ADR rules](decisions/README.md#rules)).
- Keep `IMPLEMENTED`, `PARTIAL`, `TARGET` and `DEFERRED` explicit. An accepted ADR or a passing fixture does not promote a target.
- File names are kebab-case. ADRs use `ADR-NNNN-title.md`.
- Finished plans and review snapshots are deleted, and Git history keeps them.
- Before finishing a docs change, verify edited links and run `git diff --check`.
