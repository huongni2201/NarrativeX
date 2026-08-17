# Selected AI Video / Motion Generation Workflow

AI video is an optional selected-beat capability. NarrativeX remains image-first: an approved `KeyframeAsset` is the source, and the provider result is a `MotionAsset` that can be accepted, rejected or replaced by deterministic FFmpeg motion.

## Flow

```text
Approved VisualBeat + KeyframeAsset
  -> motion-value/cost policy and affected scope
  -> safety/rights/consent + entitlement/abuse gates
  -> video capability lookup (ratio, duration, resolution, provider)
  -> OperationPlan estimate + max spend confirmation
  -> CostReservation
  -> VIDEO_MOTION_GENERATE StageAttempt
  -> VideoGenerationProvider adapter (Veo/Kling/future)
  -> MotionAsset validation + output moderation
  -> Identity QA / human review
  -> approve MotionAsset or fallback to keyframe/basic motion
  -> usage reconciliation + render dependency update
```

## Provider portability

`VideoGenerationProvider` exposes capability, estimate, submit, status, reconcile, optional cancel and output validation. `VertexVeoProvider` and `KlingProvider` are adapters; provider/model names, pricing versions, location, request options and operation IDs are snapshots on `VideoGenerationAttempt`/`ProviderOperation`. Domain code uses capability/mode, never `if provider == ...` business branches.

## Durable and idempotent execution

The request has an idempotency key and a unique request fingerprint over beat snapshot, source keyframe, motion intent, duration, ratio, quality, provider/model and workflow version. The backend persists the `OperationPlan`, reservation, `GenerationJob`, `StageAttempt` and `ProviderOperation(RESERVED)` before submission.

```text
VideoGenerationAttempt: QUEUED -> SUBMITTED -> RUNNING -> REVIEW
                       -> APPROVED / REJECTED / FAILED / UNKNOWN
ProviderOperation: RESERVED -> SUBMITTED -> RUNNING
                  -> COMPLETED / FAILED / UNKNOWN
```

If the provider request times out after submission may have occurred, the attempt is `UNKNOWN`/`RECONCILING`. The worker queries provider status and storage evidence; it does not resubmit. Auth/IAM/billing errors pause the route/circuit and require action. 408/5xx/429 retry only within configured caps.

## Output and fallback gates

The output is written to temporary storage and validated for MIME, dimensions, duration, aspect ratio, checksum, manifest and provider response schema before immutable promotion. Output moderation and identity QA run before human approval. `REVIEW` is not publishable. A failed/blocked/too-expensive motion stage can fall back to the approved keyframe with deterministic pan/zoom/fade if policy and render plan allow; fallback is recorded and does not delete the failed attempt.

Usage records capture provider cost, actual internal cost, motion seconds, storage/egress and `billed_to_user_id`. The reservation is consumed/released and the parent render dependency is updated transactionally. Final MP4 readiness still requires the normal FFmpeg/FinalArtifact validation gates.
