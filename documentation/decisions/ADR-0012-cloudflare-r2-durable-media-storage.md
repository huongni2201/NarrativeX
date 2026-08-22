# ADR-0012: Cloudflare R2 durable media storage

- Status: Accepted, partially superseded by ADR-0016 for final rendered MP4 exports
- Date: 2026-08-20 (consolidated and updated: 2026-08-22)
- Scope: Durable binary media storage for source/generated/reusable pipeline media across environments.
- Formerly: ADR-0016.

## Context

Media generation runs asynchronously on workers and produces generated images, character reference art, narration audio, subtitle manifests, motion video clips, final exports, and thumbnails. Worker container disks are ephemeral and can disappear during restarts, rescheduling, or auto-scaling.

Treating local filesystem paths as durable asset locations would make disaster recovery node-dependent and force expensive regeneration of media after transient restarts. Storing large binary blobs directly in PostgreSQL would bloat database storage and degrade transaction performance.

ADR-0016 changes one part of the original decision: final rendered MP4 exports are promoted to Google Drive through the provider-neutral `FinalVideoStorage` boundary instead of being retained in R2 by default. This ADR remains authoritative for source/generated/reusable pipeline media.

## Decision

### 1. Cloudflare R2 for pipeline media

- Cloudflare R2 is the durable object store for NarrativeX source/generated/reusable pipeline media in development, staging, and production.
- Covered media includes generated images/keyframes, narration audio, user-provided media accepted into the pipeline, thumbnails, reusable motion/source assets and other non-final media.
- Environment isolation is achieved using dedicated buckets (e.g. `narrativex-dev`, `narrativex-staging`, `narrativex-prod`).
- Worker local disks are designated strictly as scratch space, cache, and FFmpeg working directories. Local paths are never persisted as authoritative media references.
- Final rendered MP4 exports are governed by ADR-0016 and target Google Drive rather than R2 by default.

### 2. Media Lifecycle & Durability Boundary

The durable completion pipeline for R2-backed media stages is strictly ordered:
1. Generate / download / synthesize media into local scratch.
2. Validate media dimensions, duration, checksum, and MIME format.
3. Upload validated media to Cloudflare R2.
4. Persist media asset metadata (including R2 object key and SHA-256 hash) in PostgreSQL.
5. Mark the stage attempt as `COMPLETED`.
6. Purge local scratch files when safe.

For large worker media, the storage boundary is file-based: `download_to_file` reads object bodies
in bounded chunks and verifies both `ContentLength` and SHA-256 metadata; `put_file_immutable`
streams a scratch file to R2 after a streaming checksum. Immutable uploads use the conditional
create path and verify the existing object's checksum on a precondition conflict. The byte APIs
remain available for small-object compatibility but are not used for production chapter assembly.

Final video promotion is a separate storage path:

```text
R2-backed inputs
  -> local FFmpeg final.mp4
  -> validate
  -> FinalVideoStorage
  -> Google Drive resumable upload
  -> verify
  -> PostgreSQL FinalArtifact metadata
  -> READY
```

See ADR-0016.

### 3. Access Control & Storage Security

- All R2 buckets and media objects are private by default.
- Client applications access media via authorized backend endpoints or short-lived signed URLs.
- Workers access R2 through its S3-compatible API using standard credentials (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`).

### 4. Client Presigned Uploads, Verification & Asset Lifecycle Hardening

- **Upload Intent Lifecycle:** Clients initiate an upload intent (`/api/v1/assets/upload-intents`); the backend assigns a storage key and returns a presigned R2 upload URL.
- **Strict Storage Metadata Validation:** Finalization reads object metadata directly from R2. After MIME, size, and SHA-256 strictly match the intent, finalization claims `(account_id, sha256)` through `media_asset_checksums` and persists the canonical `media_assets` row as `VALIDATING`. If an S3-compatible `HEAD` response omits the stored SHA-256, the backend streams the object through a signed `GET` and computes the digest from the stored bytes; it never falls back to trusting the client-provided checksum. The later validator owns the `VALIDATING` → `READY` transition; mismatched uploads transition to `REJECTED`.
- **Durable Content Validation:** Finalization inserts an idempotent `media_validation_jobs` row and a `MEDIA_VALIDATION_REQUESTED` outbox event in the same PostgreSQL transaction. The worker claims jobs with a lease, downloads into a UUID-only scratch directory with content-length/size/checksum limits, then sniffs and decodes audio, image, or video content. Redis notifications are delivery hints only; expired leases are reclaimable from PostgreSQL.
- **Lease fencing:** Each media-validation claim receives a new UUID lease token and increments `row_version`. Heartbeats and completion/retry transitions require the unexpired tokened lease; completion fences the job before mutating asset, upload-session, or cleanup state. A stale worker therefore cannot publish validation results after lease reclamation.
- **Compare-and-set result persistence:** The worker can only transition an asset from `VALIDATING` to `READY` or `REJECTED` when the account and current status still match. It stores bounded detected metadata and sanitized stable error codes; raw ffprobe/ffmpeg output is never persisted.
- **Canonical Checksum Ownership:** `media_asset_checksums` is the account-scoped canonical owner for each verified checksum. Finalization uses PostgreSQL `INSERT ... ON CONFLICT DO NOTHING` and reloads the canonical ID, so retries and concurrent finalizations never rely on a caught constraint violation or a proposed asset ID.
- **Durable Upload Sessions:** Tracked in `media_upload_sessions` with owner-scoped idempotency.
- **Guarded Asset Transitions:** Asset status changes use an explicit transition service. Deletions set `DELETED` and record `deleted_at`; active queries exclude deleted rows.
- **Asynchronous Storage Cleanup:** Background jobs clean up expired pending upload sessions and schedule cleanup tasks for deleted media objects (`media_storage_cleanup_tasks`).

## Invariants

1. An R2-backed media generation stage is never marked `COMPLETED` before both R2 upload and PostgreSQL metadata persistence succeed.
2. A verified upload session and every retry resolve to the canonical asset ID returned by the checksum claim operation; a duplicate R2 object is cleaned asynchronously only after the database transaction commits.
3. Local filesystem paths are never stored as authoritative asset locations.
4. Media recovery and retries reuse existing valid R2 objects whenever available to avoid duplicate provider costs.
5. Final rendered MP4 exports are not duplicated into R2 by default; their durable lifecycle is governed by ADR-0016.

## Consequences

- Worker restarts do not lose durable source/generated/reusable pipeline media.
- PostgreSQL database size remains compact and performance-oriented.
- R2 remains the unified pipeline-media store while final rendered videos use a separate provider-neutral storage boundary backed by Google Drive.
- Upload intent lifetime has one authoritative setting, `narrativex.storage.upload-intent-ttl` (default 15 minutes), validated between one minute and seven days. R2 presigning derives `X-Amz-Expires` from the persisted session expiry and applies a five-second safety margin.
- READY idempotent sessions return their state without a new upload URL; REJECTED or expired sessions require a new idempotency key. Rejected-session reconciliation re-enqueues late-arriving objects for idempotent cleanup, while cleanup skips keys referenced by READY assets.
