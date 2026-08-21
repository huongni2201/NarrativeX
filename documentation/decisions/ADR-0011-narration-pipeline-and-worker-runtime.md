# ADR-0011: Narration audio pipeline, multi-part alignment and worker concurrency

- Status: Accepted
- Date: 2026-08-20 (consolidated and updated: 2026-08-21)
- Scope: Full-chapter TTS narration, multi-part uploaded narration alignment, audio-driven visual timing, worker deployment contracts, and worker task concurrency.
- Consolidated from: former ADR-0011 (worker config), ADR-0018, ADR-0019, and ADR-0022.

## Context

NarrativeX uses an audio-first visual planning pipeline where the narration timeline directly dictates the visual timing of scenes. Generating narration or processing uploaded audio must survive retries without losing audio continuity or generating inconsistent visual beats.

Furthermore, users may provide uploaded audio split across multiple files, where file boundaries do not align with chapter or sentence boundaries. The worker must also support bounded concurrent job execution (`WORKER_CONCURRENCY`) without overloading provider rate limits or exceeding database connection limits.

## Decision

### 1. Full-Chapter TTS Narration & Alignment

- **Source Snapshots:** A narration request binds to `chapter_id`, `chapter_row_version`, `source_hash`, voice settings, and exact source text.
- **Deterministic Identity:** Request identity is derived from the source snapshot and voice/language configuration. Duplicate requests reuse existing results.
- **Alignment Spans:** Spans use UTF-16 code-unit text offsets and millisecond audio timestamps (`audioStartMs < audioEndMs`, `textStart <= textEnd`).
- **Logical Unity:** Full-chapter narration is represented as one logical `NarrationAsset` pointing to durable media in Cloudflare R2.

### 2. Uploaded Narration as Logical Multi-Part Input

- **Media Assets:** Uploaded audio parts are validated and stored in R2 with `READY` state.
- **Composition Models:**
  - `narration_sets` and `narration_parts`: represent the ordered audio parts and `narrationFingerprint`.
  - `narration_documents`: snapshot selected chapter versions and `documentFingerprint`.
- **Global Continuous Clock:** Alignment translates all parts onto a single global continuous audio clock without requiring physical audio file concatenation.

### 3. Worker Deployment Contract & Bounded Concurrency

- **Configuration Contract:**
  - `AI_PROVIDER_MODE` (mapped to internal `provider_mode`).
  - `WORKER_CONCURRENCY` (mapped to internal `worker_concurrency`).
- **Task Runner Concurrency:**
  - `NarrationWorkerRunner` maintains an in-flight asyncio task set, claiming at most `WORKER_CONCURRENCY` independent chapter jobs via `FOR UPDATE SKIP LOCKED`.
  - Each task maintains an independent `StageAttempt` heartbeat. Lease loss immediately cancels the task.
  - Sequential internal synthesis: Within a single chapter, TTS segments are processed sequentially to avoid memory and provider bursts.
- **Graceful Shutdown:** On SIGTERM/SIGINT, the worker stops claiming new jobs, drains in-flight tasks, and releases database connections cleanly.
- **Connection Pool Sizing:** PostgreSQL connection pool is sized dynamically as `max(5, WORKER_CONCURRENCY + 2)`.

### 4. Bounded-memory chapter assembly

- Provider PCM responses are written immediately to the per-job worker scratch workspace. The
  execution pipeline retains segment metadata and file paths, not aggregate PCM bytes.
- Segment files are concatenated in chunks, FFmpeg reads the chapter PCM file and writes an MP3
  scratch file, and SHA-256 is computed by streaming that file.
- Durable media storage exposes file boundaries for large objects: downloads stream to a file and
  uploads pass a file object to the S3-compatible adapter. Existing byte APIs remain only for
  small-object compatibility and are not used by the production narration runner.
- Scratch workspaces are context-managed and removed on success, provider failure, storage failure,
  database failure, lease loss, and task cancellation. Scratch paths are never authoritative media
  references.

### 5. Durable failure taxonomy and crash recovery

- The narration runner uses typed outcomes: permanent request/provider rejection, retryable infrastructure failure, ambiguous provider outcome, and lease loss.
- Once a `ProviderOperation` crosses `RESERVED -> UNKNOWN`, no automatic retry invokes TTS again. The operation receives an initial `next_reconcile_at`; later reconciliation uses deterministic bounded backoff (`5, 10, 20, 40, 80, 160, 300` seconds) and CAS-fenced `reconcile_attempts`/`last_reconcile_error` updates.
- Existing immutable R2 segment objects are recovered and checksum-validated before the provider operation is completed. R2 or PostgreSQL failures after provider submission keep the operation `UNKNOWN`; finalization-only failures move the stage/job to `STALLED` for a safe retry.
- `mark_unknown` and `mark_stalled` update the parent `GenerationJob` only when the owned `RUNNING` `StageAttempt` transition affects exactly one row. A worker that loses its lease has no authority to mutate the parent job.
- Provider operations are reused by `(provider_key, request_fingerprint)` across retry `StageAttempt` rows. The original `stage_attempt_id` remains audit provenance and is not a retry identity constraint.
- Reconciliation exhaustion is explicit suspension/manual attention while preserving `ProviderOperation = UNKNOWN`; it is never an automatic `FAILED` or provider resubmission.

## Invariants

1. Narration duration drives visual planning durations; visual beats never use arbitrary hardcoded lengths.
2. Uploaded audio parts produce one unified `NarrationTimeline` without physical file concatenation.
3. Durable audio files are stored in private Cloudflare R2; worker local disk is scratch only.
4. The worker never exceeds `WORKER_CONCURRENCY` simultaneous in-flight narration jobs.
5. Production chapter assembly does not create aggregate PCM or MP3 `bytes` proportional to chapter
   duration.
6. A known transient infrastructure failure cannot terminalize a post-fence narration operation as
   `FAILED` or cause a second TTS submission.
7. An unowned narration lease cannot mutate its parent `GenerationJob`.

## Consequences

- Visual scenes synchronize accurately with both generated TTS and uploaded voiceover tracks.
- Narration workers scale horizontally and vertically under clear resource and connection limits.
