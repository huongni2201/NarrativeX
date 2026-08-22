# ADR-0016: Google Drive final video storage

- Status: Accepted
- Date: 2026-08-22
- Scope: Durable storage and lifecycle of final rendered MP4 exports.
- Supersedes: ADR-0012 only for final rendered video exports. ADR-0012 remains authoritative for source/generated/reusable media stored in R2.

## Context

NarrativeX uses Cloudflare R2 effectively for generated images, narration audio, thumbnails, uploaded source media and other reusable pipeline assets. Final rendered MP4 exports are materially larger and can accumulate quickly. Keeping every final MP4 in R2 would consume object-storage capacity that is better reserved for pipeline assets while duplicating storage already available in the configured Google Drive account.

The render worker also needs a crash-safe boundary. Rendering and remote upload are separate expensive operations: if remote upload fails after FFmpeg has already produced a valid MP4, NarrativeX must retry the upload rather than render the video again.

Future social publishing must not depend on Google Drive-specific domain code. The final-video storage provider therefore needs to be abstracted behind a provider-neutral port so a future publisher can stream the stored final video regardless of whether the implementation is Google Drive, R2 or another provider.

## Decision

### 1. Split durable media storage by lifecycle

Cloudflare R2 remains the durable store for source/generated/reusable pipeline media, including:

- generated images and keyframes;
- narration/TTS audio;
- user-provided media accepted into the pipeline;
- thumbnails;
- reusable motion/source assets and other non-final media.

Google Drive becomes the target durable store for final rendered MP4 exports.

PostgreSQL remains authoritative for metadata, lineage, job state and the logical storage identity of every asset.

### 2. Render locally, then promote the final MP4

Final video render flow:

```text
R2 source/generated assets
  -> worker-local FFmpeg workspace
  -> final.mp4
  -> local validation
  -> Google Drive resumable upload
  -> remote verification
  -> persist final-video metadata in PostgreSQL
  -> mark FinalArtifact READY
  -> delete local final.mp4 when safe
```

The worker must not render directly into Google Drive and must not upload the final MP4 to R2 merely as an intermediate step before Drive.

### 3. Provider-neutral final-video storage port

The render/application boundary uses a provider-neutral abstraction such as:

```text
FinalVideoStorage
  upload(localFile, metadata)
  openStream(storageObjectId)
  getMetadata(storageObjectId)
  delete(storageObjectId)
```

The first target implementation is:

```text
GoogleDriveFinalVideoStorage
```

Future implementations may include R2 or another storage provider without changing render-domain policy or social-publishing logic.

Vendor SDK calls and Drive-specific identifiers remain in infrastructure/worker adapters, not domain branching.

### 4. Durable identity and metadata

A final artifact stores provider-neutral metadata such as:

```text
storageProvider = GOOGLE_DRIVE
storageObjectId = <driveFileId>
fileName
mimeType = video/mp4
sizeBytes
checksumSha256
durationMs
width
height
fps
uploadedAt
```

`storageObjectId` is the authoritative remote object identity. A Drive share URL or web-view URL is not the durable identity and must not be required for correctness.

### 5. Upload and verification semantics

Large final MP4 uploads use Google Drive resumable upload semantics.

FinalArtifact must not transition to `READY` merely because the upload request returned success. After upload, NarrativeX verifies the remote file identity and expected metadata, at minimum:

- returned Drive file ID exists;
- size matches the validated local file;
- expected MIME/type is compatible;
- authoritative PostgreSQL metadata commit succeeds.

Where practical, the local SHA-256 checksum is persisted for audit/integrity even when the remote provider does not expose an equivalent cryptographic checksum suitable for direct comparison.

### 6. Retry boundary

Render and upload are separate durable stages.

Recommended lifecycle:

```text
QUEUED
  -> PREPARING
  -> RENDERING
  -> VALIDATING
  -> UPLOADING
  -> VERIFYING
  -> READY
```

Upload failure must not cause a successful render to be repeated while the validated local MP4 is still available.

```text
UPLOAD_FAILED
  -> retry UPLOADING
```

not:

```text
UPLOAD_FAILED
  -> RENDERING
```

A worker may retain the local final file through bounded upload retries. Cleanup happens only after verified remote durability or explicit terminal cleanup policy.

### 7. Privacy and access

Final Drive files are private by default. Persistent public `anyoneWithLink` permissions are not part of the storage contract.

Preview/download is backend-authorized. A later publishing subsystem may use `FinalVideoStorage.openStream(...)` or equivalent controlled access to upload the video to YouTube, Facebook or TikTok without making the Drive object public.

### 8. Folder organization

Drive folder layout should stay shallow and operationally simple, for example:

```text
NarrativeX/
  projects/
    {projectId}/
      videos/
        {finalArtifactId}.mp4
```

PostgreSQL, not Drive folder depth or file names, owns business metadata and lineage.

## Invariants

1. Worker-local final video paths are ephemeral and are never authoritative durable identities.
2. A final video is not `READY` before local validation, successful remote upload, remote verification and PostgreSQL metadata commit.
3. An upload retry must reuse an already-valid rendered MP4 when available; it must not rerender solely because Drive upload failed.
4. Final rendered MP4 is not duplicated into R2 by default.
5. R2 remains authoritative durable object storage for source/generated/reusable pipeline media covered by ADR-0012.
6. Google Drive-specific behavior stays behind the final-video storage adapter boundary.
7. Remote files are private by default.

## Consequences

- Large final MP4 retention consumes Google Drive capacity instead of R2 capacity.
- The first complete video pipeline becomes `R2 assets -> local FFmpeg render -> Google Drive final`.
- Upload failures are cheaper because they do not require rerendering.
- Future auto-publishing can consume the same provider-neutral final-video source without coupling to Drive URLs.
- Final-video availability now depends on Google Drive API credentials/quota/availability, so health checks, retry policy and actionable configuration errors are required before production rollout.
