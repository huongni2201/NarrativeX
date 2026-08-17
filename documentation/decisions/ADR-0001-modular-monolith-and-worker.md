# ADR-0001: Modular monolith and separated AI/media worker

- Status: Accepted
- Date: 2026-08-17
- Scope: v1.7 baseline

## Context

NarrativeX has transaction-heavy project/story/character state and a separate runtime-heavy AI/media workload. The domain is expected to change quickly, while Python model, GPU, provider SDK, and FFmpeg dependencies have a different lifecycle from the Spring application.

## Decision

Use a Spring Boot modular monolith for the application authority and a Python 3.12 worker as a technical runtime boundary. Keep provider-specific SDKs and workflows behind ports/adapters. Add more services only when measured bottlenecks, ownership, and deployment boundaries justify extraction.

## Consequences

- Domain transactions and ownership checks stay local and explicit.
- Worker scaling and GPU/CPU resource classes can evolve independently.
- Cross-runtime job contracts must be versioned and tested.
- The repository must resist accidental provider branching inside domain code.
