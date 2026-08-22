# ADR-0015 — Vertex Gemini image batch inference

## Status

Accepted.

## Context

NarrativeX generates many independent scene/VisualBeat images. The existing image adapter uses
synchronous Vertex `generateContent`, which is appropriate for interactive preview but pays the
standard online inference rate for every generated image.

Gemini 2.5 Flash Image supports Vertex Batch inference. Batch inference is priced below standard
online inference and is suitable for non-interactive chapter/project generation. The model does not
support Vertex Flex PayGo, so setting Flex headers for `gemini-2.5-flash-image` would not be a valid
cost optimization.

NarrativeX already treats Cloudflare R2 as the only durable media object store. Introducing Vertex
Batch therefore must not make Google Cloud Storage authoritative for generated assets.

## Decision

1. Keep synchronous `generateContent` as the online execution path.
2. Add a provider-neutral batch image contract and a Vertex batch-capable image adapter.
3. Use Vertex BatchPredictionJob with JSONL input/output for discounted non-interactive image sets.
4. Use a configured Google Cloud Storage bucket only as temporary provider staging:
   - request JSONL is uploaded under a deterministic batch fingerprint prefix;
   - Vertex writes batch output under the same batch prefix;
   - reconciled image bytes are validated and returned through the normal provider-neutral image
     result contract;
   - final media ownership remains the existing R2-backed MediaAsset flow.
5. Default image execution mode to `auto`:
   - if no GCS staging bucket is configured, use online generation;
   - if the batch threshold is not reached, use online generation;
   - otherwise the higher-level media executor may select Batch.
6. Keep `VERTEX_IMAGE_SERVICE_TIER=standard` for `gemini-2.5-flash-image`. Configuration rejects
   `flex` for this model instead of silently charging standard rates.
7. Preserve paid-operation durability. Batch submission must be fenced by the existing durable
   provider-operation lifecycle before crossing the provider boundary. A network/5xx ambiguity is
   `UNKNOWN`; it must not trigger blind re-submission.
8. Retain the provider batch job name, GCS input/output URI and ordered item fingerprints so a later
   worker can reconcile a submitted batch after a process restart.

## Configuration

```text
VERTEX_IMAGE_MODEL=gemini-2.5-flash-image
VERTEX_IMAGE_LOCATION=global
VERTEX_IMAGE_SERVICE_TIER=standard
VERTEX_IMAGE_EXECUTION_MODE=auto
VERTEX_IMAGE_BATCH_MIN_ITEMS=8
VERTEX_IMAGE_BATCH_LOCATION=global
VERTEX_IMAGE_BATCH_GCS_BUCKET=<temporary-staging-bucket>
VERTEX_IMAGE_BATCH_GCS_PREFIX=narrativex/image-batches
```

The staging bucket should have a lifecycle rule that deletes batch input/output objects after the
reconciliation retention window. Application code must not depend on those objects after the final
R2 media assets and provider audit metadata are durable.

## Consequences

### Positive

- bulk image generation can use Vertex Batch discounted pricing;
- interactive requests remain low-latency and unchanged;
- no additional Google Cloud SDK dependency is required by the worker adapter;
- GCS does not become a second product media store;
- the adapter exposes provider job reconciliation rather than polling only in process memory;
- configuration prevents an invalid Gemini 2.5 Flash Image Flex assumption.

### Tradeoffs

- a GCS staging bucket and IAM permissions are required for Batch;
- Batch completion latency is intentionally higher than online generation;
- the higher-level media executor must persist the batch provider operation before relying on
  asynchronous reconciliation;
- GCS staging cleanup is an infrastructure lifecycle concern.

## Required IAM

The worker identity needs Vertex AI permission to create/read batch prediction jobs and GCS access
to create, list and read objects in the configured staging bucket. Production should scope these
permissions to the staging bucket and project rather than grant broad storage administration.
