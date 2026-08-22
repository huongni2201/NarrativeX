# ADR-0016: Google Drive final video storage

- Status: Accepted
- Date: 2026-08-22
- Scope: Durable storage and lifecycle of final rendered MP4 exports.
- Supersedes: ADR-0012 only for final rendered video exports. ADR-0012 remains authoritative for source/generated/reusable media stored in R2.

## Context

NarrativeX uses Cloudflare R2 for generated images, narration audio, uploaded source media and other reusable pipeline assets. Final rendered MP4 exports are materially larger and can accumulate quickly, so retaining them in R2 by default is undesirable when Google Drive capacity is available for final outputs.

Final-video storage must also remain provider-neutral at the application/domain boundary so future preview/download and social publishing do not couple business policy to Drive URLs.

## Decision

### 1. Split durable media storage by lifecycle

Cloudflare R2 remains the durable store for source/generated/reusable pipeline media, including generated images/keyframes, narration/TTS audio, accepted user-provided media, thumbnails and reusable motion/source assets.

Google Drive is the durable target for final rendered MP4 exports.

PostgreSQL remains authoritative for metadata, lineage, job state and logical storage identity.

### 2. Render locally, then promote the final MP4

```text
R2 source/generated assets
  -> worker-local FFmpeg workspace
  -> final.mp4
  -> local validation
  -> Google Drive resumable upload
  -> remote verification
  -> persist final-video metadata in PostgreSQL
  -> mark FinalArtifact READY
  -> delete local workspace when safe
```

The worker does not upload the final MP4 to R2 merely as an intermediate step before Drive.

### 3. Provider-neutral final-video storage boundary

Render/application logic depends on a final-video storage abstraction. The first implementation is `GoogleDriveFinalVideoStorage`. Google-specific OAuth/API/file IDs remain in the adapter/infrastructure boundary.

The current adapter exposes the minimum write-side behavior required by render. Future read/stream/delete capabilities can extend the provider-neutral boundary for preview/download/publishing.

### 4. Durable identity and metadata

Current `FinalArtifact` storage metadata is:

```text
storageProvider = GOOGLE_DRIVE
storageKey = gdrive:<driveFileId>
externalFileId = <driveFileId>
webViewLink = <optional convenience link>
mimeType = video/mp4
sizeBytes
checksumSha256
durationMs
width
height
fps
```

The Drive file ID/provider metadata is the authoritative remote identity. `webViewLink` is convenience metadata and is not required for correctness or authorization.

### 5. Upload and verification semantics

Large MP4 uploads use Drive resumable-upload sessions and chunked transfer. The implementation:

- uploads chunks using a size that is a multiple of 256 KiB;
- queries the resumable-session offset after ambiguous timeout/network outcomes;
- looks up an existing Drive object by `renderFingerprint` before creating a new one;
- verifies returned file ID and remote size;
- persists the local SHA-256 checksum for integrity/audit;
- commits `FinalArtifact` metadata before the render job is completed.

A final artifact is not `READY` solely because an upload request returned success.

### 6. Retry target vs current implementation

The architectural target is to keep render and upload as independently retryable expensive boundaries so a successful render does not need to be repeated because remote upload failed.

The **current implementation partially satisfies this**:

- resumable upload can recover within the same worker attempt;
- a later retry can detect and reuse a Drive file if the remote upload already completed;
- however, `final.mp4` currently lives in the ephemeral job workspace;
- if an attempt exits and the render job becomes `STALLED`, the next claim may rerender because the validated local MP4 is no longer retained durably.

Therefore cross-attempt `UPLOAD_FAILED -> retry UPLOADING without rerender` remains a hardening target. Documentation must not present it as fully implemented today.

Possible future implementation choices include a durable upload-stage checkpoint, bounded retained local render storage on a persistent volume, or another provider-neutral temporary-render persistence mechanism. Final MP4 should still not be retained permanently in R2 by default.

### 7. Privacy and access

Drive files are private by default. Persistent public `anyoneWithLink` permissions are not part of the storage contract.

Owner-authorized preview/download/streaming is a separate application capability. Future publishing should consume a provider-neutral file/stream boundary rather than require a public Drive URL.

### 8. Folder organization

The current runtime targets one configured Drive folder through `GOOGLE_DRIVE_FOLDER_ID`; PostgreSQL owns business metadata and lineage. More elaborate project subfolder organization is optional and must not become the business identity model.

## Current implementation status

Implemented foundation:

- `GoogleDriveFinalVideoStorage`;
- user OAuth refresh-token credentials on the render worker;
- resumable upload;
- render-fingerprint lookup/idempotency;
- remote size verification;
- `V10__final_video_google_drive_storage.sql`;
- FinalArtifact provider/external-file metadata;
- render worker direct promotion from local MP4 to Drive;
- no final MP4 R2 upload by default.

Still incomplete:

- cross-attempt upload-only retry without rerender;
- backend-authorized Drive file streaming/download;
- social publishing read/stream adapter;
- explicit Drive health/config endpoint/observability;
- retention/deletion synchronization between PostgreSQL and Drive.

## Invariants

1. Worker-local paths are not authoritative durable identities.
2. A final video is not `READY` before local validation, successful Drive upload/verification and PostgreSQL metadata commit.
3. Final rendered MP4 is not duplicated into R2 by default.
4. R2 remains authoritative durable object storage for source/generated/reusable pipeline media covered by ADR-0012.
5. Google Drive-specific behavior stays behind the final-video storage adapter boundary.
6. Remote files are private by default.
7. A retry must not create duplicate Drive final files for the same render fingerprint when an already-uploaded matching remote file can be identified.
8. Cross-attempt rerender avoidance is a target invariant, not yet an implemented guarantee.

## Consequences

- Large final MP4 retention consumes Google Drive capacity instead of R2 capacity.
- The current storage pipeline is `R2 assets -> local FFmpeg render -> Google Drive final`.
- Retry/idempotency is improved through resumable upload and fingerprint lookup, while cross-attempt rerender avoidance still needs hardening.
- Future auto-publishing can be built without making Drive files public or coupling domain policy to Drive URLs.
