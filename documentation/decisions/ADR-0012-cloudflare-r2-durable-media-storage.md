# ADR-0012: Cloudflare R2 durable media storage

- Status: Accepted
- Date: 2026-08-20 (consolidated and updated: 2026-08-21)
- Scope: Durable binary media storage for all media types and environments.
- Formerly: ADR-0016.

## Context

Media generation runs asynchronously on workers and produces generated images, character reference art, narration audio, subtitle manifests, motion video clips, final exports, and thumbnails. Worker container disks are ephemeral and can disappear during restarts, rescheduling, or auto-scaling.

Treating local filesystem paths as durable asset locations would make disaster recovery node-dependent and force expensive regeneration of media after transient restarts. Storing large binary blobs directly in PostgreSQL would bloat database storage and degrade transaction performance.

## Decision

### 1. Cloudflare R2 as Exclusive Durable Store

- Cloudflare R2 is the sole durable object store for NarrativeX media in development, staging, and production.
- Environment isolation is achieved using dedicated buckets (e.g. `narrativex-dev`, `narrativex-staging`, `narrativex-prod`).
- Worker local disks are designated strictly as scratch space, cache, and FFmpeg working directories. Local paths are never persisted as authoritative media references.

### 2. Media Lifecycle & Durability Boundary

The durable completion pipeline for any media stage is strictly ordered:
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

### 3. Access Control & Storage Security

- All R2 buckets and media objects are private by default.
- Client applications access media via authorized backend endpoints or short-lived signed URLs.
- Workers access R2 through its S3-compatible API using standard credentials (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`).

### 4. Client Presigned Uploads, Verification & Asset Lifecycle Hardening

- **Upload Intent Lifecycle:** Clients initiate an upload intent (`/api/v1/assets/upload-intents`); the backend assigns a storage key and returns a presigned R2 upload URL.
- **Strict Storage Metadata Validation:** Finalization reads object metadata directly from R2. A `READY` `media_assets` record is persisted only after MIME, size, and SHA-256 strictly match the intent. Mismatched uploads transition to `REJECTED`.
- **Durable Upload Sessions:** Tracked in `media_upload_sessions` with owner-scoped idempotency.
- **Guarded Asset Transitions:** Asset status changes use an explicit transition service. Deletions set `DELETED` and record `deleted_at`; active queries exclude deleted rows.
- **Asynchronous Storage Cleanup:** Background jobs clean up expired pending upload sessions and schedule cleanup tasks for deleted media objects (`media_storage_cleanup_tasks`).

## Invariants

1. A media generation stage is never marked `COMPLETED` before both R2 upload and PostgreSQL metadata persistence succeed.
2. Local filesystem paths are never stored as authoritative asset locations.
3. Media recovery and retries reuse existing valid R2 objects whenever available to avoid duplicate provider costs.

## Consequences

- Zero data loss on worker restarts or pod rescheduling.
- PostgreSQL database size remains compact and performance-oriented.
- Unified storage architecture across images, TTS narration, video beats, and final exported movies.
