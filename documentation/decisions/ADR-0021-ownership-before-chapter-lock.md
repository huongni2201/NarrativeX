# ADR-0021: Authorize ownership before Chapter serialization locks

## Status

Accepted

## Context

Chapter edits, story analysis admission, narration admission, and media-plan creation share a
Chapter-scoped PostgreSQL advisory transaction lock. The previous source-access contract acquired
that lock using only `chapterId`, then checked the requested project and authenticated owner. A
caller who could guess another user's Chapter ID could therefore create cross-tenant lock
contention before authorization failed.

## Decision

Chapter source admission uses an ownership-scoped contract with `projectId`, `chapterId`, and the
authenticated `userId`. The PostgreSQL adapter joins `chapters`, `story_versions`, and `projects`
and applies the project owner and non-archived predicates. The service performs this lookup before
acquiring the existing advisory transaction lock, then repeats the same ownership-scoped lookup
after the lock and returns that second result as the authoritative source snapshot.

Chapter updates follow the same boundary: an unlocked ownership check happens first, the existing
Chapter advisory lock is acquired only after authorization, and the Chapter is reloaded before the
optimistic update.

Cross-tenant and cross-project scope failures use the existing not-found behavior so Chapter
existence is not disclosed. The advisory lock primitive and Chapter key remain unchanged; all
operations that depend on the source snapshot must use the ownership-scoped source contract.

## Consequences

- Unauthorized requests no longer wait on or hold a Chapter serialization lock.
- The post-lock ownership re-read prevents a stale pre-authorization snapshot from reaching
  admission or generation job creation.
- The source access contract is shared by analysis, narration, and media-plan operations.
- Ownership is evaluated twice around the advisory lock, adding one inexpensive indexed relation
  lookup in exchange for a clear security and concurrency boundary.
