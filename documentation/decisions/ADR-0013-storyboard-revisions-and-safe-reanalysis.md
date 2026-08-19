# ADR-0013: Storyboard revisions and safe Chapter re-analysis

## Status

Accepted — 2026-08-19

## Context

Chapter analysis originally materialized Scenes and VisualBeats directly by `chapter_id`. The worker correctly refused to overwrite approved Scene or VisualBeat output, but that protection happened only during materialization, after backend admission, quota reservation, durable job creation, and potentially a paid provider call. The Chapter Workspace capability also treated a saved source plus an inactive job as sufficient for `canAnalyze`, creating a UI/API dead end after approved storyboard output existed.

A destructive `reset` endpoint would remove the dead end but would violate NarrativeX's immutable-approved-output rule and erase useful review history. The fix must preserve the existing Chapter Workspace interaction as much as possible while making re-analysis safe and cost-aware.

## Decision

- Introduce durable `storyboard_revisions` scoped to a Chapter.
- `chapters.current_storyboard_revision_id` selects the revision exposed by normal storyboard/workspace reads.
- Every newly admitted Chapter analysis creates a fresh DRAFT storyboard revision and stores its ID on the durable `generation_jobs` row.
- Enqueue does **not** switch the Chapter's current revision.
- The worker materializes only into the job's own DRAFT revision. It must never delete or overwrite Scenes belonging to another revision.
- The worker switches `current_storyboard_revision_id` only after the new revision has been fully materialized, in the same PostgreSQL transaction as materialization. Any failure rolls back the new visible state and leaves the previous current revision intact.
- Existing approved Scene/VisualBeat state remains the review authority. Revisioning is an internal persistence/orchestration boundary and does not require a new user-facing revision workflow.
- If the current revision contains approved output and its `source_hash` equals the current Chapter `source_hash`, Chapter analysis is rejected during admission before cost estimation/quota reservation/provider execution.
- If approved output exists but the Chapter source changed, analysis is allowed and targets a new revision. The existing UI can continue to expose the same Analyze action.
- `sourceOutdated` is derived from the current storyboard revision source hash, not from the latest GenerationJob. A failed newer job therefore cannot make an older current storyboard appear synchronized.
- Analyze and VisualBeat approval acquire the same chapter-scoped PostgreSQL advisory transaction lock so approval cannot race between admission and revision creation.
- Normal storyboard read repositories must scope Scene reads to `current_storyboard_revision_id`; historical revisions are not mixed into the existing UI/API response.

## Invariants

1. Approved Scene/VisualBeat output is never deleted by Chapter re-analysis.
2. A paid Chapter analysis has exactly one durable target storyboard revision.
3. A target revision is not visible as current until materialization commits successfully.
4. Provider/materialization failure leaves the previously current storyboard visible and unchanged.
5. Same-source approved re-analysis is rejected before quota reservation.
6. Source-changed approved Chapters may be re-analyzed without an explicit reset action.
7. Chapter Workspace `sourceOutdated` compares Chapter source to the current storyboard revision, not to an unrelated failed or running job.
8. Chapter-scoped Analyze and approval mutations serialize through one PostgreSQL advisory transaction lock.

## Consequences

- The Chapter Workspace UI does not need a destructive Reset Storyboard button or a new mandatory revision-management surface.
- Historical storyboard rows remain durable and can support a future revision-history UI without another destructive migration.
- Storage grows with successful re-analysis revisions; retention/archival policy can be added later without changing the correctness model.
- The worker production entry point uses revision-aware materialization while the base repository remains available for focused legacy tests and utilities.
- All new code must treat `DELETE ... WHERE chapter_id = ?` for storyboard replacement as invalid. Replacement, replay, and cleanup must always be scoped by `storyboard_revision_id`.

## Verification

- Backend tests verify a protected storyboard admission failure occurs before quota reservation.
- Workspace queries read only the Chapter's current storyboard revision.
- Worker materialization validates that the job's target revision matches Chapter ID, source hash, and source row version before writing.
- Worker deletes/replays only rows inside the target revision and activates that revision only at the end of the materialization transaction.
