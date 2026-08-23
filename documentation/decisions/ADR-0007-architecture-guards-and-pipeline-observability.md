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
- Count final artifact range requests and streamed bytes at the application boundary so local and
  Google Drive storage adapters share the same operational measurements.

## Consequences

Architecture violations fail in backend tests before they become dependency drift. A `jobId` can
be used to follow the worker metric lines through generation, TTS, FFmpeg/render, upload, and
artifact delivery. Metrics remain logger-backed and dependency-light in the worker; the backend
uses Micrometer counters for HTTP artifact delivery.
