# Selected AI Video / Motion Generation Workflow

AI video is an optional selected-beat capability. NarrativeX remains image-first: an approved `KeyframeAsset` is the source, and the provider result is a `MotionAsset` that can be accepted, rejected or replaced by deterministic FFmpeg/basic motion.

NarrativeX supports two production policies:

```text
IMAGE_MOTION
  -> deterministic image motion only

HYBRID_LOCAL_I2V
  -> SIMPLE beats use deterministic image motion
  -> selected MEDIUM/COMPLEX beats may use private/self-hosted I2V
```

`IMAGE_MOTION` MUST NOT schedule an I2V operation. `HYBRID_LOCAL_I2V` is provider-neutral; the first worker adapter targets a Wan2.2-compatible endpoint. Commercial providers can be added later without becoming domain dependencies.

## Flow

```text
Approved VisualBeat + KeyframeAsset
  -> production-mode + motion-value/cost policy and affected scope
  -> safety/rights/consent + entitlement/abuse gates
  -> video capability lookup (ratio, duration, resolution, provider)
  -> OperationPlan estimate + max spend confirmation
  -> CostReservation
  -> VIDEO_MOTION_GENERATE StageAttempt
  -> VideoGenerationProvider adapter (Wan-local/future adapters)
  -> MotionAsset validation + R2 persistence + output moderation
  -> Identity QA / human review
  -> approve MotionAsset or fallback to keyframe/basic motion
  -> usage reconciliation + render dependency update
```

## Provider portability

`VideoGenerationProvider` exposes capability, submit, status and reconcile behavior. Domain code uses production/motion capability, never `if provider == ...` business branches. Provider/model names, endpoint/model versions, request options and operation IDs are durable snapshots at the execution/accounting boundary.

The initial `WanVideoProvider` calls a configured private Wan-compatible HTTP endpoint. NarrativeX does not embed Wan runtime dependencies into the backend domain and does not introduce a new domain service. See [ADR-0002](../decisions/ADR-0002-storyboard-character-continuity-and-production-workflows.md).

## Local I2V & Wan2.2 Integration

For `HYBRID_LOCAL_I2V` production mode:
- SIMPLE scenes use deterministic FFmpeg pan/zoom/parallax motion.
- Selected MEDIUM/COMPLEX scenes use local I2V with deterministic fallback when policy allows.
- Motion prompt composer extracts characters, camera movement, and action descriptions from the immutable visual beat snapshot.
- Motion generation jobs run asynchronously with `StageAttempt` leases and save output MP4 directly to R2.

## Shorts / Reels Generation Workflow

Shorts are independent vertical (9:16) artifacts derived from approved long-form timeline and assets:

```text
Approved long-form timeline / chapter
  -> SHORT_HIGHLIGHT_ANALYZE (Vertex AI Gemini)
  -> ranked ShortCandidate (hook/conflict/reveal/emotion/payoff)
  -> 9:16 vertical render plan (crop/reframe approved assets)
  -> SHORT_RENDER with 9:16 vertical RenderProfile
  -> FinalArtifact validation & Google Drive export
```

- Planning rules: Highlight analyzer identifies coherent story beats (30s–60s). Crop/reframe preserves character identity and composition.
- Delta execution: Editing a short creates a delta `OperationPlan` while original chapter assets remain immutable.
- Server-side entitlement enforces monthly short export limits, watermarking, and concurrent job limits atomically.

## Durable and idempotent execution

The request has an idempotent stable request identity/fingerprint over beat snapshot, source keyframe, motion intent, duration, ratio/resolution, model/inference profile and workflow version. The backend must persist the `OperationPlan`, reservation, `GenerationJob`, `StageAttempt` and `ProviderOperation(RESERVED)` before submission.

```text
VideoGenerationAttempt: QUEUED -> SUBMITTED -> RUNNING -> REVIEW
                       -> APPROVED / REJECTED / FAILED / UNKNOWN
ProviderOperation: RESERVED -> SUBMITTED -> RUNNING
                  -> COMPLETED / FAILED / UNKNOWN
```

If the submission request times out or receives an ambiguous server failure after submission may have occurred, the attempt becomes `UNKNOWN`/`RECONCILING`. The worker queries the provider by operation id or idempotent request id; it does not blindly resubmit. Auth/configuration errors require action. Known transient retry is allowed only after the provider outcome is known and within configured caps.

## Output and fallback gates

Provider output is downloaded/written to worker-local scratch and validated for MIME, dimensions, duration, aspect ratio, checksum, manifest and provider response schema. The validated immutable motion object is uploaded to Cloudflare R2 and its Asset/MediaAsset metadata is committed before the producing stage can complete. Output moderation and identity QA then run before human approval. `REVIEW` is not publishable. A failed/blocked/too-expensive/unavailable motion stage can fall back to the approved keyframe with deterministic pan/zoom/parallax/fade if policy and render plan allow; fallback is recorded and does not delete the failed attempt.

Generated I2V duration and narration-span duration are intentionally separate. For example, a five-second generated motion asset can be deterministically extended inside an eight-second narration span; only five generated seconds belong to the I2V workload.

## Final render and storage

Motion assets are pipeline media and remain R2-backed. The final exported MP4 follows a different durable-storage path defined by [ADR-0003](../decisions/ADR-0003-media-storage-generation-pipelines-and-external-integrations.md):

```text
approved R2 image/motion/audio inputs
  -> FFmpeg local render
  -> final.mp4
  -> validate container/video/audio/duration/dimensions/checksum
  -> FinalVideoStorage
  -> Google Drive resumable upload
  -> verify remote file
  -> persist storageProvider + storageObjectId + final metadata
  -> FinalArtifact READY
  -> delete local final.mp4 when safe
```

Final MP4 is not uploaded to R2 by default. Render and upload are separate retry boundaries: if the Drive upload fails while the validated local MP4 still exists, retry the upload instead of rerendering.

## Local GPU cost planning

For local/self-hosted I2V, cost is not a hardcoded vendor price per scene. The planning authority prices the post-analysis I2V workload using a versioned benchmark snapshot for the selected model, GPU, resolution and inference profile:

```text
expectedGpuSeconds
  = plannedI2vOutputSeconds
  * benchmarkMedianGpuSecondsPerOutputSecond
  * expectedAttemptFactor

expectedI2vCost
  = expectedGpuSeconds / 3600
  * gpuUsdPerHour
```

Reservation uses p90/bounded benchmark data and maximum authorized attempts. Actual resource usage is reconciled separately. Changing production mode or local-I2V quality re-plans/re-prices the same valid semantic analysis snapshot instead of re-running story analysis.

Usage records capture actual internal GPU/compute cost, motion seconds, storage/egress and `billed_to_user_id`. The reservation is consumed/released and the parent render dependency is updated transactionally. Final MP4 readiness still requires the normal FFmpeg/FinalArtifact validation gates plus verified durable final-video storage in Google Drive.
