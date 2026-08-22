# ADR-0015 — Vertex Gemini image batch inference

## Status

Accepted.

## Context

NarrativeX generates independent scene/VisualBeat images and prioritizes predictable image cost over
interactive provider latency. Gemini 2.5 Flash Image supports Vertex Batch inference, while the model
does not support Vertex Flex PayGo. Keeping an online path as the normal execution route would make
cost depend on request shape and would allow singleton/regeneration requests to bypass the discounted
batch policy.

NarrativeX already treats Cloudflare R2 as the only durable media object store. Introducing Vertex
Batch therefore must not make Google Cloud Storage authoritative for generated assets.

## Decision

1. All enabled Gemini 2.5 Flash Image generation uses Vertex Batch inference, including a single
   image request. `VERTEX_IMAGE_EXECUTION_MODE=batch` and `VERTEX_IMAGE_BATCH_MIN_ITEMS=1` are the
   defaults.
2. Keep the online `generateContent` adapter only as a provider capability/future escape hatch. The
   normal `ImageGenerationRunner` depends on a batch-capable provider and calls `submit_batch`, not
   online `submit`.
3. Use Vertex BatchPredictionJob with JSONL input/output. A singleton image is represented as a
   one-line JSONL batch; larger groups use the same contract.
4. Use a configured Google Cloud Storage bucket only as temporary provider staging:
   - request JSONL is uploaded under a deterministic batch fingerprint prefix;
   - Vertex writes batch output under the same batch prefix;
   - reconciled image bytes are validated and returned through the normal provider-neutral image
     result contract;
   - final media ownership remains the existing R2-backed MediaAsset flow.
5. Enabling `IMAGE_PROVIDER_MODE=vertex` with batch execution requires a GCS staging bucket. There is
   no silent online fallback when batch is the selected mode.
6. Keep `VERTEX_IMAGE_SERVICE_TIER=standard` for `gemini-2.5-flash-image`. Configuration rejects
   `flex` for this model instead of silently charging standard rates.
7. Preserve paid-operation durability. Batch submission must be fenced by the existing durable
   provider-operation lifecycle before crossing the provider boundary. A network/5xx ambiguity is
   `UNKNOWN`; it must not trigger blind re-submission.
8. `ImageGenerationRunner` does not poll a submitted batch in process memory. Non-terminal submission
   returns a pending operation that the durable executor must persist and later pass back to
   reconciliation. This preserves the Vertex batch job name across crashes/restarts.
9. Retain the provider batch job name, GCS input/output URI and ordered item fingerprints so a later
   worker can reconcile a submitted batch after a process restart.

## Configuration

```text
VERTEX_IMAGE_MODEL=gemini-2.5-flash-image
VERTEX_IMAGE_LOCATION=global
VERTEX_IMAGE_SERVICE_TIER=standard
VERTEX_IMAGE_EXECUTION_MODE=batch
VERTEX_IMAGE_BATCH_MIN_ITEMS=1
VERTEX_IMAGE_BATCH_LOCATION=global
VERTEX_IMAGE_BATCH_GCS_BUCKET=<temporary-staging-bucket>
VERTEX_IMAGE_BATCH_GCS_PREFIX=narrativex/image-batches
```

The staging bucket should have a lifecycle rule that deletes batch input/output objects after the
reconciliation retention window. Application code must not depend on those objects after the final
R2 media assets and provider audit metadata are durable.

## Consequences

### Positive

- every generated image follows the discounted Vertex Batch path, including singleton regeneration;
- image billing behavior is simpler and more predictable because normal execution has no online
  fallback;
- no additional Google Cloud SDK dependency is required by the worker adapter;
- GCS does not become a second product media store;
- the adapter exposes provider job reconciliation rather than polling only in process memory;
- configuration prevents an invalid Gemini 2.5 Flash Image Flex assumption.

### Tradeoffs

- all generated images inherit Batch completion latency, including one-image requests;
- a GCS staging bucket and IAM permissions are mandatory when the Vertex image provider is enabled;
- the durable media executor must persist pending batch operations before releasing its lease;
- batching one image per provider job is valid for the policy but can later be optimized by grouping
  compatible pending image items into fewer provider jobs;
- GCS staging cleanup is an infrastructure lifecycle concern.

## Required IAM

The worker identity needs Vertex AI permission to create/read batch prediction jobs and GCS access
to create, list and read objects in the configured staging bucket. Production should scope these
permissions to the staging bucket and project rather than grant broad storage administration.
