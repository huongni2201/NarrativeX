# NarrativeX Data Flow and Durability Model — V1.11

PostgreSQL state, not Redis messages or process memory, determines what NarrativeX believes happened.

## Authority matrix

| Concern | Authority | Notes |
|---|---|---|
| Project/StoryVersion/Chapter/storyboard/continuity | PostgreSQL | ownership and versioning apply |
| GenerationJob/StageAttempt/ProviderOperation | PostgreSQL | Redis may carry hints only |
| MediaPlan / production policy | PostgreSQL | worker executes the persisted authorized revision |
| Narration document/set/timeline metadata | PostgreSQL | source and narration fingerprints pin immutable inputs |
| Durable source/generated/reusable media bytes | Cloudflare R2 | private by default; DB owns metadata/lineage |
| Durable final rendered MP4 bytes | Google Drive | private by default; DB stores provider-neutral storage identity |
| Worker render/media workspace | Local filesystem | ephemeral only; may retain a validated final MP4 across bounded upload retries |
| Browser session | Redis via Spring Session | availability dependency, not business-state authority |

## Chapter Analyze

```text
persisted Chapter
  -> lock/reload authoritative snapshot
  -> admission + atomic reservation
  -> OperationPlan + GenerationJob + StageAttempt + OutboxEvent
  -> worker claim/lease/heartbeat
  -> ProviderOperation
  -> validated structured result
  -> stale-snapshot re-check
  -> continuity/storyboard materialization
```

## Narration selection

```text
NarrationStrategy.TTS
  -> TTS_GENERATE
  -> AUDIO_ALIGN

NarrationStrategy.USER_PROVIDED_AUDIO
  -> AUDIO_ALIGN
  -> no TTS_GENERATE
```

User-provided parts are ordered and mapped onto one logical global audio clock. One part can cover multiple Chapters; Chapter boundaries come from source/alignment, not file boundaries.

## Media execution

```text
valid analysis/review + narration timeline
  -> backend creates immutable MediaPlan revision
  -> job pins exact plan revision
  -> worker executes resolved strategies
  -> provider/local result
  -> validate bytes
  -> R2
  -> PostgreSQL MediaAsset metadata
  -> downstream render
```

A retry/reclaimed job must reuse an already-valid R2 asset when possible instead of regenerating merely because local scratch disappeared.

## Final video render and storage

```text
READY R2 image/audio/media inputs
  -> FFmpeg render in worker-local scratch
  -> final.mp4
  -> validate container/video/audio/duration/dimensions/checksum
  -> UPLOADING
  -> FinalVideoStorage
  -> Google Drive resumable upload
  -> VERIFYING
  -> verify remote file identity + expected size/metadata
  -> persist storageProvider + storageObjectId + checksum + video metadata
  -> READY
  -> delete local final.mp4 when safe
```

The render and upload boundaries are separate. If upload fails after a valid render, NarrativeX retries `UPLOADING`; it does not return to `RENDERING` while the valid local MP4 remains available.

Google Drive-specific identifiers and APIs stay behind the final-video storage adapter. FinalArtifact/domain logic uses provider-neutral storage identity.

## Current gaps

- production user-audio upload/finalize and real alignment runtime hardening;
- VisualScenePlanner;
- production image-generation vertical slice;
- immutable image asset approval/lineage lifecycle;
- IMAGE_MOTION render/final export;
- `FinalVideoStorage` + Google Drive resumable upload/verification implementation;
- complete actual-usage/billing reconciliation and release;
- MyBatis-only persistence regression protection;
- full Character/reference and approved-storyboard workflows;
- broader moderation/SSRF/retention/observability/DR evidence.
