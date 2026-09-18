# ADR-0006: Transactional chapter creation owns StoryVersion orchestration

## Status

Accepted

## Context

The production UI previously created a StoryVersion and then created a Chapter in two browser requests. A failed second request could leave an unused StoryVersion, while a retry could create duplicate Chapters. Batch import had the same client-side orchestration.

## Decision

`POST /api/v1/projects/{projectId}/chapters` is handled by `CreateChapterWithStoryUseCase` in the project application layer. The use case locks the owned Project, resolves the requested StoryVersion or the active/latest StoryVersion, creates a StoryVersion from the Chapter source when none exists, and creates the Chapter in one database transaction. `Chapter` remains owned by the storyboard bounded context; the Project domain does not import it.

The endpoint requires `Idempotency-Key`. The workflow first locks and ownership-checks the Project, then PostgreSQL stores the owner/project/key and request fingerprint before any StoryVersion or Chapter mutation; it records the resulting Chapter on completion. Reusing the key returns the same Chapter; reusing it for a different request is a conflict.

Batch import accepts an optional `storyVersionId` and performs the same active/latest/creation resolution in its backend transaction. The frontend only calls the chapter API and does not create StoryVersions as part of either workflow.

## Consequences

- StoryVersion and Chapter creation commit or roll back together.
- Browser retries are safe for the same idempotency key.
- `orderIndex` is server-derived when omitted, so clients do not coordinate workflow state.
- API and integration tests must cover ownership, idempotency, rollback, and unique ordering conflicts.
