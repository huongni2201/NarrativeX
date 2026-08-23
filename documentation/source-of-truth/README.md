# NarrativeX Source of Truth V1.11

## Canonical baseline

- Version: `V1.11`
- Repository: `huongni2201/NarrativeX`
- Implementation checkpoint: `fix/render-snapshot-retry-integrity` at `a167a88709e342b882cef0ceea6f0d6bd4122e4f`
- Canonical specification: `documentation/source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`

Current code and Flyway migrations decide factual AS-IS implementation claims when a derived document drifts.

## Current implemented foundations

- Project/Chapter authoring, dashboard/favorite, Analyze and durable PostgreSQL worker execution.
- MyBatis + explicit SQL across production backend persistence; no JPA or direct `JdbcTemplate` persistence in production code.
- Backend-authoritative MediaPlan, generation job/stage durability, provider-operation reconciliation and provider failure transition fencing.
- Character/Location continuity, Scene/VisualBeat and project-scoped Character reads.
- Full-chapter generated narration through Google TTS/local VieNeu with R2-backed durable audio.
- Narration alignment (sentence/word spans) and deterministic burned ASS subtitle generation during video render.
- User-provided narration planning/timeline foundation: ordered parts, one logical global audio clock, fingerprints and TTS bypass.
- Real Vertex image-generation foundation with validated images persisted to R2.
- Dedicated `IMAGE_MOTION` render worker using FFmpeg/ffprobe with burned ASS subtitles against snapshotted R2 image + generated narration inputs.
- Immutable `RenderInputSnapshot` persisted at admission; render worker claims and executes exclusively against snapshotted state.
- Final rendered MP4 storage in Google Drive via resumable upload with session-scoped PostgreSQL advisory lock (`render_fingerprint_lock`) to serialize Drive upload and verify/reuse remote checksums idempotently.
- FinalArtifact stores Drive/provider metadata; final MP4 is not duplicated into R2 by default.

## Current durable storage split

```text
Generated images          -> Cloudflare R2
Generated narration       -> Cloudflare R2
Accepted uploaded audio   -> Cloudflare R2
Reusable pipeline media   -> Cloudflare R2
Final rendered MP4        -> Google Drive
PostgreSQL                -> authoritative metadata/state/lineage
Worker local filesystem   -> ephemeral scratch only
```

[ADR-0003](../decisions/ADR-0003-media-storage-generation-pipelines-and-external-integrations.md) governs media storage (R2 for pipeline media + Google Drive for final rendered MP4 exports).

## Primary remaining V1.11 work

- Harden production user-audio upload/finalize/alignment.
- Connect aligned multi-part uploaded narration to chapter render slicing/stitching; the current render worker requires a matching generated narration snapshot.
- Complete narration-driven `VisualScenePlanner` and review/approval flow.
- Harden image reuse/reframe/edit/approval lineage after the current generate-new foundation.
- Add owner-authorized preview/download/streaming for Drive-backed FinalArtifacts.
- Preserve a validated local MP4 across cross-attempt Drive upload retries if rerender avoidance is required; current resumable upload is robust within an attempt and idempotent by render fingerprint, but the job workspace itself is ephemeral.
- Complete actual usage/billing reconciliation, moderation, SSRF, retention, observability and DR evidence.
- Add future social publishing through a provider-neutral final-video read/stream boundary.

Derived documents must distinguish these remaining gaps from already-implemented image, render and Google Drive storage foundations.
