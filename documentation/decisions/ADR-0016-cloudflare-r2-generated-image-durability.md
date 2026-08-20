# ADR-0016: Cloudflare R2 durable media storage

## Status

Accepted — 2026-08-20  
Amended — 2026-08-21 to make R2 the sole durable media store across environments and media types.

## Context

Media generation runs asynchronously on workers and can produce generated/reference images, narration audio, subtitle/manifests, scene/motion video, final exports and thumbnails. Worker disks are process/container-local and can disappear during restart, rescheduling or lease recovery. Treating a local path as the durable asset would make recovery node-dependent and could force expensive provider regeneration or rendering after otherwise recoverable failures.

NarrativeX already separates authoritative PostgreSQL state from transient execution infrastructure. Binary media needs the same explicit durability boundary without storing large payloads in PostgreSQL. Maintaining a separate local object-storage implementation also creates configuration and behavioral drift without providing a production capability.

## Decision

- Cloudflare R2 is the sole durable object store for NarrativeX media in development, staging and production.
- Environment isolation uses separate buckets/configuration (for example `narrativex-dev` and `narrativex-prod`) rather than a local object-storage server.
- The worker local filesystem is scratch/cache/FFmpeg workspace only. Local media paths are not durable identifiers and must not be persisted as authoritative asset locations.
- Durable R2 media includes generated/reference images, narration audio, subtitle/manifests, scene/motion video, final exports and thumbnails.
- PostgreSQL stores media asset metadata/contracts, including durable R2 object keys and integrity/lineage fields needed by the MediaAsset/Asset model. Binary media payloads remain in R2.
- The target success boundary for media-producing stages is:

```text
generate/download/render
  -> local scratch
  -> validate
  -> upload to R2
  -> persist asset metadata
  -> mark stage complete
  -> clean local scratch when safe
```

- A stage must not report successful durable media production before both the R2 upload and authoritative metadata persistence have succeeded.
- Retry/reconciliation/reclaim code should reuse an already-persisted valid R2 asset when available. Loss of local scratch alone is not a reason to pay for regeneration/re-rendering.
- Object keys should be opaque durable references owned by the storage adapter. UI/API consumers use backend-authorized access/presigned delivery rather than depending on worker filesystem paths or permanent public object URLs.
- R2 buckets/objects are private by default. Public delivery is a separate authorized CDN/access concern, not the durability contract.
- Retention/lifecycle policy for rejected candidates may delete or expire temporary durable objects independently; accepted/production assets must not disappear while referenced by active project history.

## Consequences

### Positive

- Worker restart or horizontal scaling no longer makes durable media availability node-dependent.
- Expensive generated and rendered media can survive retries without blind provider regeneration.
- Development and production exercise the same managed storage semantics; bucket isolation replaces a second local storage product.
- PostgreSQL remains small and transactional because it stores metadata rather than binary media.
- Image, TTS and video/render stages share one durability contract.

### Negative

- Local media-development paths that exercise durable persistence require R2 connectivity and development credentials.
- Media-stage completion depends on object-storage upload plus metadata persistence.
- Lifecycle cleanup, orphan detection and retention rules become required operational concerns.
- Integration tests need a fake/contract-level storage adapter or an explicitly isolated R2 integration environment rather than a local object-storage service.

## Scope and non-goals

This ADR selects the durability boundary for all media. It does not claim that the R2 adapter, image-generation provider, TTS provider, candidate-retention policy, CDN/download delivery or final-video pipeline are already implemented. Those remain implementation work under this accepted storage contract.

The current change establishes configuration and architecture contracts without adding an unused R2 SDK dependency before a media stage can execute it. The first durable image/TTS/render vertical slice should implement the storage adapter behind the existing provider/storage boundary.

## Verification target

- Successful media generation leaves a valid durable R2 object plus authoritative PostgreSQL asset metadata.
- A crash after provider/render output but before durable persistence cannot produce a false `COMPLETED` state.
- A reclaimed job reuses a valid existing R2-backed media object instead of regenerating solely because local scratch is missing.
- Deleting local scratch after durable completion does not make the asset unavailable.
- Development uses an isolated R2 bucket and the same storage contract as production.
