# NarrativeX Documentation Map

This directory contains the authoritative architecture, product, domain, workflow, and operational documentation for NarrativeX.

Current source code, Flyway migrations, and automated tests establish factual implementation truth. Accepted Architecture Decision Records (ADRs) establish architectural direction and safety boundaries.

## Documentation Structure

| Directory / File | Description |
| :--- | :--- |
| [`CURRENT_STATUS.md`](./CURRENT_STATUS.md) | Navigation index, implementation reality, and migration status |
| [`COMPUTE_PROTOCOL.md`](./COMPUTE_PROTOCOL.md) | Compute Protocol v1 wire contract between Backend and Generation Service |
| [`product/`](./product/) | Product specification (`PRODUCT_SPEC.md`) and project roadmap (`ROADMAP.md`) |
| [`architecture/`](./architecture/) | System architecture (`SYSTEM_ARCHITECTURE.md`), database design (`DATABASE.md`), and technology stack (`TECHNOLOGY_STACK.md`) |
| [`domain/`](./domain/) | Core domain model, invariants, business rules, and terminology (`DOMAIN.md`) |
| [`workflows/`](./workflows/) | End-to-end production pipelines: story-to-video (`STORY_TO_VIDEO.md`), narration audio (`NARRATION_AUDIO.md`), image generation (`IMAGE_GENERATION.md`) |
| [`operations/`](./operations/) | Operational guides including remote GPU runtime operations (`REMOTE_GPU_RUNTIME.md`) |
| [`decisions/`](./decisions/) | Architecture Decision Records (ADRs) with classification and supersession rules (`README.md`) |

## Authority Hierarchy

1. **Source Code & Tests**: The working code, database migrations, and automated tests are the primary factual source of truth.
2. **Accepted ADRs**: Decisions in [`decisions/`](./decisions/) establish cross-cutting boundaries. A newer ADR supersedes an older ADR only within its explicitly defined scope.
3. **Active Documentation**: Specifications and workflow documents summarize current capabilities and intended design within the bounds established by code and ADRs.
4. **Git History**: Historical background and superseded migration notes are preserved in Git history rather than dead documentation files.

## Maintenance Guidelines

- When modifying system behavior, update the smallest relevant document that owns that behavior.
- Distinguish clearly between `IMPLEMENTED`, `PARTIAL`, and `DEFERRED` capabilities.
- Never document hypothetical features or unapproved designs as implemented.
- Check links and references using `python -B scripts/check-docs-drift.py`.
