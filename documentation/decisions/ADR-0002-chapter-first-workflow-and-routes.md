# ADR-0002: Chapter-first workflow and routes

- Status: Accepted
- Date: 2026-08-18
- Scope: chapter continuation, affected-scope processing, storyboard navigation and control-plane lifecycle
- Consolidated from the former control-plane and chapter-route decisions.

## Context

Long stories must be processed incrementally. A user may add or edit a Chapter without rebuilding unrelated chapters, while the browser must preserve exact project/chapter context through deep links, reloads and history. Safety, entitlement, notification and deletion decisions also need durable state rather than frontend flags or transient queue messages.

## Decision

- Creating a Project is metadata-only. `Create Project` must never enqueue story analysis or any other paid AI/media operation.
- Treat Chapter as the durable analyze/generate/render/resume boundary. Story analysis is requested only for a persisted Chapter after its source content/snapshot exists; creating the Project itself is not an analysis trigger.
- The chapter-scoped analysis command is exposed under `POST /api/v1/projects/{projectId}/chapters/{chapterId}/analysis-jobs`. Until durable execution exists, this endpoint remains fail-closed with `FEATURE_NOT_AVAILABLE` and must not create fake queued work.
- New or changed chapters inherit explicit project settings and resolved identity/style snapshots; unaffected scope remains reusable.
- Resolve `AffectedScope` before expensive work. Edits create new snapshots or attempts where required and never mutate locked versions, approved assets or completed renders.
- Use the target App Router hierarchy:

  ```text
  /projects/[projectId]
  /projects/[projectId]/chapters/[chapterId]
  /projects/[projectId]/chapters/[chapterId]/storyboard
  /projects/[projectId]/chapters/[chapterId]/visuals
  /projects/[projectId]/chapters/[chapterId]/audio
  /projects/[projectId]/chapters/[chapterId]/render
  ```

- Chapter child routes keep project/chapter context visible and addressable. The current prototype may use a workspace switcher until the remaining APIs exist, but it must not present fixture mutations as persisted production state.
- Persist moderation decisions, consent, abuse events, entitlement/usage, notification/outbox and deletion state in PostgreSQL. Run abuse, moderation, injection-boundary and entitlement/cost gates before paid work where possible. Ordinary story/chapter analysis does not require a blanket copyright/rights-attestation checkbox.
- Normalize application safety outcomes to `SAFE`, `REVIEW` and `BLOCK`; provider safety signals do not decide publishability. Terminal render/Short transitions write idempotent outbox events in the same business transaction.

## Consequences

- Project creation stays fast and deterministic and does not depend on provider availability.
- Analysis/re-analysis cost is scoped to the Chapter that the user explicitly submits for analysis rather than to Project creation.
- Chapter resume and continuation require snapshot hashes, dependency analysis and durable progress.
- Redis loss cannot erase safety, usage, notification or deletion intent.
- Full chapter commands, chapter source persistence alignment, affected-scope resolution and resume execution remain implementation work in the current repository.

## Consolidation note

This file is the canonical replacement for the former control-plane/chapter-continuation and storyboard-route records.
