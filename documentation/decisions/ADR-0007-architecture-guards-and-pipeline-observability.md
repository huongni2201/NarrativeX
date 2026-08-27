# ADR-0007: Architecture guards and pipeline observability

## Status

Accepted

## Context

NarrativeX is a modular monolith with asynchronous Python media workers. Refactors must preserve
feature boundaries while production failures need to be traceable across job admission, worker
execution, storage, and artifact streaming.

## Decision

- Keep the existing source-level architecture checks and add ArchUnit rules for framework-free
  domains, feature-domain isolation (with `feature.common` as the shared kernel), API isolation
  from infrastructure/outbound ports, and infrastructure isolation from delivery adapters.
- Keep worker repository imports stable through package facades while organizing implementation
  seams by claims, inputs, artifacts/operations, completion, and models.
- Emit pipeline duration/size metrics with correlation fields: `jobId`, `projectId`, `chapterId`,
  `mediaPlanId`, `renderFingerprint`, and `artifactId`.
- Count local final-artifact registration/open/reveal operations and generation status delivery at
  the relevant application boundaries without treating Desktop bytes as backend storage.

## Consequences

Architecture violations fail in backend tests before they become dependency drift. A `jobId` can
be used to follow the worker metric lines through generation, TTS, FFmpeg/render, upload, and
  artifact registration and status delivery. Metrics remain logger-backed and dependency-light in
  the worker; the backend uses Micrometer counters for applicable API/SSE boundaries.
