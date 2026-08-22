# ADR-0007: Storyboard aggregate boundaries and revision lifecycle

- Status: Accepted
- Date: 2026-08-18 (consolidated and updated: 2026-08-21)
- Scope: `storyboard` domain ownership, Chapter & Scene aggregate boundaries, Storyboard Revisions, safe Chapter re-analysis, and pre-lock ownership authorization.
- Consolidated from: former ADR-0007, ADR-0013, and ADR-0021.

## Context

In NarrativeX, a chapter can contain many scenes, and users or background workers may update independent scenes concurrently. Treating the entire chapter and all of its scenes as a single aggregate would cause excessive optimistic-lock contention and force all generation updates through one giant transaction.

Furthermore, Chapter analysis originally materialized Scenes and VisualBeats directly by `chapter_id`. When approved Scene/VisualBeat output existed, overwriting or resetting it violated NarrativeX's core domain rule of immutable approved assets. To enable safe re-analysis after source text changes without destroying previously approved work or creating dead-end UI states, the system requires durable revisioning.

Additionally, Chapter edits, analysis admission, narration, and media planning share a Chapter-scoped PostgreSQL advisory transaction lock. Acquiring this lock using only an unverified `chapterId` before checking the user and project context could allow an attacker guessing IDs to cause cross-tenant lock contention.

## Decision

### 1. Aggregate Boundaries

- **`Chapter` AggregateRoot:** Responsible for chapter identity, StoryVersion link, title, source text, source hash, ordering index, and `current_storyboard_revision_id`.
- **`Scene` AggregateRoot:** Responsible for scene identity, storyboard revision link, chapter link, order index, narration span, duration, and lifecycle status (`DRAFT`, `READY_FOR_VISUAL`, `GENERATING`, `REVIEW`, `APPROVED`, `FAILED`, `OUTDATED`).
- **`VisualBeat` Child Entity:** Subordinate to Scene; does not have its own aggregate root.
- **Identity References:** Cross-aggregate relationships use stable IDs (e.g. `Scene.chapterId`, `Scene.storyboardRevisionId`) rather than mutable nested object graphs.

### 2. Storyboard Revisions & Safe Re-Analysis Lifecycle

- **Durable `storyboard_revisions`:** Scoped to a Chapter.
- **Current Revision Pointer:** `chapters.current_storyboard_revision_id` designates the active revision returned by storyboard read APIs.
- **DRAFT Revision Allocation:** Every newly admitted Chapter analysis creates a fresh `DRAFT` storyboard revision and records its ID on `generation_jobs`.
- **Atomic Activation on Completion:** The worker materializes Scene and VisualBeat rows only into the job's assigned revision. The worker switches `chapters.current_storyboard_revision_id` to the new revision only after materialization succeeds, within the same PostgreSQL transaction.
- **Preservation of Approved State:** If materialization or provider execution fails, the previously active revision remains unchanged. Approved scenes in older revisions are never deleted.
- **Admission Invariant:** If the current revision has approved scenes and its `source_hash` matches the current chapter's `source_hash`, re-analysis is rejected during admission before cost reservation. If the source changed, re-analysis is admitted into a new revision.

### 3. Pre-Lock Ownership Authorization

- **Two-Phase Authorization around Advisory Lock:**
  1. The backend first executes an unlocked ownership query joining `chapters`, `story_versions`, and `projects` checking `project.owner_id == authenticated_user_id` and non-archived state.
  2. If authorized, the chapter-scoped advisory transaction lock is acquired (`pg_advisory_xact_lock`).
  3. The ownership-scoped lookup is repeated inside the lock to ensure no race condition invalidated ownership or source state, and that snapshot is returned.
- **Unauthorized Requests:** Return standard 404 (Not Found) without ever acquiring or waiting on the advisory lock.

### 4. Current Execution Workspace Projection

- Chapter Workspace readiness is projected from the current Chapter snapshot: `chapter_id`,
  `row_version`, `source_hash`, and `current_storyboard_revision_id`.
- Analysis, visual jobs, narration requests, render manifests, and final artifacts from older
  source/revision/media-plan identities remain durable history but cannot satisfy current
  readiness or capability checks.
- When present, the current MediaPlan is selected by Chapter snapshot plus storyboard revision;
  visual and render state is then scoped to that exact MediaPlan revision.

## Invariants

1. `Chapter` and `Scene` are independent `AggregateRoots`.
2. Materialization writes and deletes are strictly scoped by `storyboard_revision_id`, never raw `chapter_id`.
3. Approved scenes/visual beats are immutable and never overwritten by re-analysis.
4. `chapters.current_storyboard_revision_id` changes only upon successful completion of a new revision's materialization transaction.
5. All chapter mutations and analysis admissions verify ownership before acquiring PostgreSQL advisory locks.
6. Workspace readiness never aggregates durable execution history by `chapter_id` alone.

## Consequences

- Workers can update scenes in parallel without locking the entire chapter.
- Users can safely modify chapter text and trigger re-analysis while keeping approved visual scenes intact.
- Unauthorized requests cannot create denial-of-service lock contention for other tenants.
