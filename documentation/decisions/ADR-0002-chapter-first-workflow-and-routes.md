# ADR-0002: Chapter-first workflow and routes

- Status: Accepted
- Date: 2026-08-18
- Scope: chapter continuation, affected-scope processing, storyboard navigation and control-plane lifecycle
- Consolidated from the former control-plane and chapter-route decisions.

## Context

Long stories must be processed incrementally. A user may add or edit a Chapter without rebuilding unrelated chapters, while the browser must preserve exact project/chapter context through deep links, reloads and history. Safety, entitlement, notification and deletion decisions also need durable state rather than frontend flags or transient queue messages.

## Decision

- Treat Chapter as a durable analyze/generate/render/resume boundary. New or changed chapters inherit explicit project settings and resolved identity/style snapshots; unaffected scope remains reusable.
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
- Persist rights attestation, moderation decisions, consent, abuse events, entitlement/usage, notification/outbox and deletion state in PostgreSQL. Run abuse, rights, moderation, injection-boundary and entitlement/cost gates before paid work where possible.
- Normalize application safety outcomes to `SAFE`, `REVIEW` and `BLOCK`; provider safety signals do not decide publishability. Terminal render/Short transitions write idempotent outbox events in the same business transaction.

## Consequences

- Chapter resume and continuation require snapshot hashes, dependency analysis and durable progress.
- Redis loss cannot erase safety, usage, notification or deletion intent.
- Full chapter commands, affected-scope resolution and resume execution remain implementation work in the current repository.

## Consolidation note

This file is the canonical replacement for the former control-plane/chapter-continuation and storyboard-route records.
