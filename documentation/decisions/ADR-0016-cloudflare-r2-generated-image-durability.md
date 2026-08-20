# ADR-0016: Cloudflare R2 generated-image durability

## Status

Accepted — 2026-08-20

## Context

Image generation will run asynchronously on media workers and may produce many files during a chapter/video workflow. Worker disks are process/container-local and can disappear during restart, rescheduling or lease recovery. Treating a local path as the durable asset would make recovery node-dependent and could force expensive provider regeneration after otherwise recoverable failures.

NarrativeX already separates authoritative PostgreSQL state from transient execution infrastructure. Generated image bytes need the same explicit durability boundary without storing large binaries in PostgreSQL.

## Decision

- Cloudflare R2 is the production durable object store for generated image bytes.
- The worker local filesystem is scratch/cache only. Local image paths are not durable identifiers and must not be persisted as the authoritative asset location.
- MinIO may be used for local development as an S3-compatible implementation of the same object-storage port. Production semantics remain R2-backed.
- PostgreSQL stores image asset metadata/contracts, including the durable object key and integrity/lineage fields needed by the implemented MediaAsset/Asset model. Binary image payloads remain in object storage.
- The target success boundary for image generation is:

```text
generate/download
  -> local scratch
  -> validate
  -> upload to R2
  -> persist asset metadata
  -> mark stage complete
  -> clean local scratch when safe
```

- A stage must not report successful durable image production before both the R2 upload and authoritative metadata persistence have succeeded.
- Retry/reconciliation/reclaim code should reuse an already-persisted valid R2 asset when available. Loss of local scratch alone is not a reason to pay for regeneration.
- Object keys should be opaque durable references owned by the storage adapter. UI/API consumers should use backend-authorized asset access rather than depending on worker filesystem paths.
- Retention/lifecycle policy for rejected candidates may delete or expire temporary objects independently; accepted/production image assets must not disappear while referenced by active project history.

## Consequences

### Positive

- Worker restart or horizontal scaling no longer makes durable image availability node-dependent.
- Expensive generated images can survive retries without blind provider regeneration.
- The S3-compatible boundary allows MinIO in local development while keeping Cloudflare R2 as the production target.
- PostgreSQL remains small and transactional because it stores metadata rather than image blobs.

### Negative

- Image-generation completion now depends on object-storage upload plus metadata persistence.
- Lifecycle cleanup, orphan detection and retention rules become required operational concerns.
- Integration tests need an S3-compatible test fixture and must prove failure behavior around upload/persistence ordering.

## Scope and non-goals

This ADR selects the durability boundary for generated images. It does not claim that the R2 adapter, image-generation provider, candidate-retention policy, CDN/download delivery, TTS storage or final-video storage are already implemented. Those remain separate implementation work unless covered by another accepted decision.

## Verification target

- Successful image generation leaves a valid durable object plus authoritative PostgreSQL asset metadata.
- A crash after provider output but before durable persistence cannot produce a false `COMPLETED` state.
- A reclaimed job reuses a valid existing R2-backed image instead of regenerating solely because local scratch is missing.
- Deleting local scratch after durable completion does not make the asset unavailable.
- Local-development tests may use MinIO/S3 compatibility without changing production R2 semantics.
