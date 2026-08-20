# Local Image-to-Video Workflow

This document defines the target `HYBRID_LOCAL_I2V` media route. It does not claim the complete story-to-final-video pipeline is already implemented. The current code slice provides provider-neutral planning contracts and a Wan-compatible worker adapter.

## Production modes

NarrativeX exposes two production policies:

```text
IMAGE_MOTION
  keyframe reuse/edit/generation
  -> deterministic pan/zoom/parallax/effects
  -> no I2V operation

HYBRID_LOCAL_I2V
  same image-first workflow
  -> SIMPLE scenes: deterministic motion
  -> selected MEDIUM/COMPLEX scenes: local I2V
  -> deterministic fallback when policy allows
```

Production mode is not a provider/model selection. `Wan2.2-TI2V-5B` is the first local adapter target and can be replaced without changing domain planning semantics.

## Audio-first scene timing

For source-preserving narration, the Chapter source is sent to TTS unchanged as one logical Chapter narration. Alignment/timestamps are then used to create adaptive visual scenes.

```text
Chapter sourceText
  -> Chapter TTS
  -> narration asset
  -> word/sentence alignment
  -> VisualScenePlan[]
```

Each `VisualScenePlan` stores an audio span and source-text span. Visual scene duration follows narration; it is not fixed to five or eight seconds.

A scene whose narration span is nine seconds may use a five-second I2V clip followed by deterministic hold/reframe/transition motion. Only the generated five seconds belong to the I2V workload.

## Reuse-first keyframe planning

Before new image generation:

```text
REUSE_APPROVED
  -> REFRAME_DERIVED
  -> EDIT_EXISTING
  -> GENERATE_NEW
```

This reduces both cost and character/location drift. Reused/derived assets retain source lineage so invalidation, review and accounting remain explainable.

## Motion planning

The default policy is:

| Production mode | Complexity | Planned strategy |
|---|---|---|
| `IMAGE_MOTION` | any | `BASIC_IMAGE_MOTION` |
| `HYBRID_LOCAL_I2V` | `SIMPLE` | `BASIC_IMAGE_MOTION` |
| `HYBRID_LOCAL_I2V` | `MEDIUM` | `IMAGE_TO_VIDEO` |
| `HYBRID_LOCAL_I2V` | `COMPLEX` | `IMAGE_TO_VIDEO` |

Cost, entitlement, availability or review policy can downgrade an I2V candidate to deterministic motion. A worker must never upgrade a basic-motion scene to paid/GPU-heavy I2V outside the authorized `OperationPlan`.

## Wan endpoint contract

The worker adapter expects a private Wan-compatible HTTP endpoint. No provider credentials or raw Chapter payloads are embedded in durable media requests.

Configuration:

```text
WAN_VIDEO_ENABLED=true
WAN_ENDPOINT_URL=https://private-wan.example.internal
WAN_MODEL=Wan2.2-TI2V-5B
WAN_API_TOKEN=<secret, optional>
WAN_REQUEST_TIMEOUT_SECONDS=30
```

### Submit

```http
POST /v1/image-to-video
```

```json
{
  "request_id": "stable-idempotent-request-id",
  "model": "Wan2.2-TI2V-5B",
  "image_url": "https://signed-private-object/keyframe.png",
  "prompt": "The character slowly turns toward camera.",
  "negative_prompt": "optional",
  "duration_seconds": 5,
  "resolution": "480p"
}
```

Successful asynchronous response:

```json
{
  "operation_id": "op-123",
  "status": "SUBMITTED"
}
```

`QUEUED` is normalized to `SUBMITTED` by the adapter.

### Status

```http
GET /v1/operations/{operationId}
```

or, when the submit response was lost:

```http
GET /v1/operations/by-request/{requestId}
```

Completed response:

```json
{
  "operation_id": "op-123",
  "status": "COMPLETED",
  "output_url": "https://signed-private-object/op-123.mp4"
}
```

The endpoint must make `request_id` idempotent and queryable. This is required to reconcile an ambiguous submit without blindly generating the same clip twice.

## Failure semantics

- submit 4xx: definitive rejection; no provider work is assumed;
- submit timeout/network/5xx: outcome is `UNKNOWN`; reconcile by operation/request identity before retry;
- status timeout/network/error: status becomes `UNKNOWN`; do not resubmit;
- completed result without an output URL: invalid provider contract and must not be promoted;
- output is still untrusted until MIME, checksum, dimensions, duration, moderation/identity and storage promotion checks pass.

## Cost estimation after Analyze/Plan

The semantic analysis does not hardcode a dollar amount. It produces workload metrics for each available production mode.

Example workload fields:

```text
chapterCount
sourceCharacters
ttsCharacters
narrationSeconds
visualSceneCount
newImageCount
imageEditCount
reuseOrReframeCount
basicMotionSceneCount
plannedI2vSceneCount
plannedI2vOutputSecondsByResolution
finalRenderSeconds
estimatedStorageBytes
estimatedEgressBytes
```

### `IMAGE_MOTION`

The invariant is:

```text
plannedI2vSceneCount = 0
plannedI2vOutputSeconds = 0
```

Expected cost is the sum of analysis/TTS, billable image generation/edit work, deterministic motion/render compute, storage and egress.

### `HYBRID_LOCAL_I2V`

Local Wan does not use a commercial `costPerClip`. NarrativeX prices measured GPU compute.

Persist/version a benchmark snapshot for a model + GPU + resolution + inference profile:

```text
modelKey
modelVersion
hardwareKey
resolution
inferenceProfileVersion
medianGpuSecondsPerOutputSecond
p90GpuSecondsPerOutputSecond
observedAt
```

Then:

```text
expectedI2vGpuSeconds =
    plannedI2vOutputSeconds
  * medianGpuSecondsPerOutputSecond
  * expectedI2vAttemptFactor

expectedI2vCost =
    expectedI2vGpuSeconds / 3600
  * gpuUsdPerHour
```

Reservation uses a conservative benchmark/attempt bound:

```text
reservedI2vGpuSeconds =
    plannedI2vOutputSeconds
  * p90GpuSecondsPerOutputSecond
  * maxAuthorizedI2vAttemptFactor
```

Do not invent a fixed Wan cost before benchmarking the actual deployment. Different GPUs, quantization, resolution, step count, attention kernels and concurrency materially change inference time.

## Estimate response

When the same semantic analysis snapshot is valid, the backend should be able to price both modes without re-running story analysis:

```json
{
  "analysisRevisionId": "ar-123",
  "options": [
    {
      "productionMode": "IMAGE_MOTION",
      "workload": {
        "visualScenes": 0,
        "newImages": 0,
        "imageEdits": 0,
        "reusedOrReframed": 0,
        "i2vScenes": 0,
        "i2vOutputSeconds": 0
      },
      "cost": {
        "currency": "USD",
        "expected": "...",
        "reservationCeiling": "..."
      }
    },
    {
      "productionMode": "HYBRID_LOCAL_I2V",
      "workload": {
        "visualScenes": 0,
        "newImages": 0,
        "imageEdits": 0,
        "reusedOrReframed": 0,
        "basicMotionScenes": 0,
        "i2vScenes": 0,
        "i2vOutputSeconds": 0,
        "i2vResolution": "480p"
      },
      "cost": {
        "currency": "USD",
        "expected": "...",
        "reservationCeiling": "..."
      }
    }
  ]
}
```

Zeros above are placeholders for the real post-analysis workload; they are not fixed production targets.

`expectedCost`, `reservationCeiling` and reconciled `actualCost` are distinct. Prices/rates and benchmark data must be versioned snapshots so historical estimates remain reproducible.

## Implementation slices

1. Planning contracts and Wan HTTP adapter.
2. Full-Chapter TTS + alignment timeline.
3. Reuse-first keyframe resolver and derived-asset lineage.
4. `IMAGE_MOTION` end-to-end deterministic renderer.
5. Backend workload/pricing authority and reservation integration.
6. Durable `HYBRID_LOCAL_I2V` stage/job wiring around the Wan adapter.
7. GPU benchmark capture, actual resource usage reconciliation and autoscaling policy.
8. UI comparison of both modes before expensive generation.
