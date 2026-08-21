# Media generation operations (MVP)

## Admission

The backend authorizes `IMAGE_MOTION` for one Chapter at a time. It snapshots the current approved
storyboard revision, narration/alignment references, provider/model and pricing catalog, and creates one
durable `MediaGenerationItem` per VisualBeat. The requested cost cap is checked against the actual beat
count and a quota reservation is bound to the generation job.

## Execution and recovery

The worker must persist the provider operation/outbox fence before external submission. A timeout,
transport failure, or provider 5xx is `UNKNOWN` and requires reconciliation; it is never retried by blind
resubmission. Successful bytes are checksum-validated and stored under a private immutable R2 result key
before asset metadata and append-only lineage are materialized in PostgreSQL.

## Review and render

Generation completion is not render authorization. The user reviews each READY item through the review API.
Only the approved item set for the exact media-plan revision may be used by `CHAPTER_RENDER`. The renderer
uses deterministic FFmpeg `IMAGE_MOTION` composition, validates the output with ffprobe, and keeps the
final artifact private until the existing entitlement/download policy authorizes access.

## Operational signals

Monitor jobs and items by execution status (`QUEUED`, `RUNNING`, `VALIDATING`, `READY`, `FAILED`,
`UNKNOWN`) and review status (`NOT_READY`, `NEEDS_REVIEW`, `APPROVED`, `REJECTED`). Never report a fake
provider success when image capability is disabled; surface a safe provider-unavailable error and retain
the durable audit state.
