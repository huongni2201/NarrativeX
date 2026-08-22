# ADR-0014: Immutable chapter content variants and translation lineage

- Status: Accepted
- Date: 2026-08-22
- Scope: Chapter content import, language detection, translation admission, and analysis snapshots

## Decision

Every saved Chapter input creates an `ORIGINAL` row in `chapter_content_variants`. The existing
`chapters.source_text/source_hash` columns remain the compatibility pointer to the current original
snapshot, but they are no longer the only lineage record. Translation output is a separate
`TRANSLATION` variant whose `source_variant_id` and `source_content_hash` identify the exact input
snapshot. A changed original marks translations based on an older source as `STALE`.

Language detection is persisted against the variant hash. The deterministic local detector handles
clear cases without provider quota; high-confidence language mismatches become
`PENDING_CONFIRMATION`. Translation confirmation is the first point at which operation planning,
quota reservation, idempotency locking, a `CHAPTER_TRANSLATE` generation job, stage attempt, and
outbox event are created.

Analysis receives an explicit `contentVariantId` when selected. Its generation job and storyboard
revision retain the variant pointer and content hash, so later edits cannot silently change the
analysis input.

## Consequences

- Original chapter text is never destroyed when a new input is imported.
- Double confirmation reuses the owner-scoped idempotency key and cannot create a second durable job.
- Translation execution must validate provider output before inserting the immutable translation row;
  the worker-side chunking and structural validation helpers live in `app/ai-worker`.
- Existing clients remain compatible: the old analysis endpoint still selects the current original
  when no variant is supplied, and `sourceLanguage` remains the public compatibility name for the
  project's analysis language while application code exposes `getProjectLanguage()`.
