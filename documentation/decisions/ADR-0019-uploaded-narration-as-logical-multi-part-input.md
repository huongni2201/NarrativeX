# ADR-0019: Uploaded narration is a logical multi-part input

## Status

Accepted — 2026-08-21

## Context

Users may select multiple chapters and provide one or more narration files. File count is
independent from chapter count, and an audio boundary may occur inside a chapter or sentence.
The existing V11 narration tables model one chapter-level TTS request and cannot be the identity
of this workflow.

## Decision

- Uploaded audio is represented by immutable `media_assets` metadata with validation states and
  private R2 storage keys. Only `READY` audio can enter production admission.
- `narration_sets` and ordered `narration_parts` are the user-facing audio composition. The
  sequence and SHA-256 of every part form `narrationFingerprint`; reordering or replacing a part
  creates a different execution identity.
- Selected chapter revisions are snapshotted into a `narration_documents` record. Chapter order,
  revision identity, source hash, global text offsets and row version form `documentFingerprint`.
- Alignment consumes the immutable document and narration snapshots and produces one logical
  `NarrationTimeline`. Physical audio concatenation is not required for alignment; part offsets are
  translated onto a single global audio clock.
- `USER_PROVIDED_AUDIO` plans omit `TTS_GENERATE` and do not reserve TTS quota. Missing, invalid or
  incomplete uploaded narration fails closed with user action required; it never falls back to TTS.
- The existing V11 chapter-level TTS tables remain compatible. Multi-part alignment cache rows use
  `narration_alignment_runs` so the legacy worker contract is not changed in place.

## Consequences

Visual planning and rendering can depend only on `NarrationTimeline`, regardless of whether the
source is one uploaded file, many uploaded files or TTS. The uploaded-audio API, worker-side
ffprobe/ASR execution, renderer integration and frontend batch UX remain follow-up slices behind
these immutable contracts.
