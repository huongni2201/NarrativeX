# ADR-0011: Local VieNeu narration execution

- Status: Accepted
- Date: 2026-08-22

## Context

NarrativeX supports both external TTS providers and VieNeu-TTS v3 Turbo running inside the AI worker. External providers require durable submission fencing because a timeout can leave the provider outcome unknown and blind retries can duplicate billable work. VieNeu is local execution: a failed inference has no external billable side effect and can be retried safely.

The previous narration runner applied external-provider durability to every provider. For VieNeu that meant one provider-operation row and one R2 PCM object per NarrativeX segment, while also invoking the model one segment at a time. This prevented VieNeu's GPU `infer_batch` path from combining work and added avoidable database/object-storage round trips.

## Decision

Narration providers declare explicit capabilities and one execution semantic:

- `EXTERNAL_DURABLE`: retain provider-operation submit fences, UNKNOWN reconciliation, and durable per-segment recovery. Google Cloud TTS uses this path.
- `LOCAL_RETRYABLE`: allow safe regeneration after a local failure and keep generated PCM in the ephemeral job workspace. VieNeu uses this path.

VieNeu execution is optimized as follows:

1. Segment text using the existing sentence-aware NarrativeX segmenter.
2. Group up to `VIENEU_BATCH_MAX_SEGMENTS` segments and call VieNeu `infer_batch` once per group.
3. Let VieNeu use `VIENEU_MAX_BATCH_SIZE` for its internal GPU chunk batching.
4. Serialize access to one model instance with `VIENEU_INFERENCE_CONCURRENCY=1` by default. Scale throughput with dedicated narration worker processes/GPUs rather than concurrent calls into one model instance.
5. For an uploaded voice reference, prepare and enroll the reference once per narration job, reuse the temporary voice for all batches, and remove it when the job finishes.
6. Keep segment PCM only in the worker workspace. Upload only the final MP3 to R2.
7. Content-address the local final MP3 key with a checksum suffix. VieNeu synthesis is stochastic, so a retry after an R2-success/DB-failure must not conflict with an earlier immutable waveform.
8. Encode narration MP3 at a configurable bitrate, default `96k` mono.
9. Treat VieNeu external API authorization cost as zero while still reserving the normal expensive-job concurrency slot.

## Deployment

`WORKER_ROLES` allows one codebase to host only selected workers. Recommended production layout:

```text
ai-worker-general
  analysis,translation,media-validation,image-generation

ai-worker-tts
  narration
```

A CPU narration worker uses VieNeu's ONNX runtime and does not install Torch by default. GPU deployments install the worker `gpu` optional dependency and use `VIENEU_BACKEND=pytorch` or `auto` on a CUDA host.

## API and catalog

The voice catalog publishes capabilities in `metadata_json` (`supportsSpeakingRate`, `supportsVoiceClone`, `supportsBatch`, `sampleRateHz`, and `executionSemantics`). VieNeu requests accept only `speakingRate=1.0` and are rejected by the backend before enqueue when the rate is unsupported.

The batch narration API accepts up to 50 chapter IDs but creates one independent narration job per chapter. This preserves per-chapter idempotency, retry, progress, quota reservation, and job history.

## Consequences

Positive:

- fewer R2 writes and database operations for local TTS;
- GPU batching is reachable for long-form narration;
- voice-cloning reference encoding happens once per job rather than once per segment;
- TTS workers can scale independently;
- CPU images stay smaller because Torch/Torchaudio are no longer base dependencies;
- Google TTS safety semantics are unchanged.

Trade-offs:

- local retries may synthesize a different waveform because generation is stochastic;
- content-addressed retry outputs can leave an orphan object if R2 succeeds but database completion repeatedly fails; normal media-storage cleanup must remove unreferenced objects;
- local and external providers intentionally have different durability paths, so provider capability tests are required when adding new TTS adapters.
