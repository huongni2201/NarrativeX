# Sharded Chapter Analysis Design

> **Status: superseded for production orchestration.** The deterministic sharding, source-coverage, density, and bounded-repair ideas below remain historical design context, but the provider topology and recovery boundary were replaced by the continuity-first architecture in `documentation/plans/2026-09-05-chapter-continuity-and-render-pipeline.md`. Production Chapter analysis now runs through `ContinuityVertexGeminiProvider` and `run_chapter_analysis_pipeline`; do not reintroduce the retired `VertexGeminiProvider.submit()` orchestration described below.

## Problem

The current Vertex chapter-analysis adapter sends one synchronous `generateContent` request that asks Gemini to return chapter structure plus all visual beats. With the current density policy (target 7.5 seconds, hard maximum 10 seconds), long chapters can require dozens of beats in one structured JSON response. This increases response latency and makes `httpx.ReadTimeout` likely. Because synchronous `generateContent` does not return a durable provider operation id before the response arrives, a timeout is an ambiguous paid-provider outcome and NarrativeX correctly refuses a blind retry.

## Goals

- Keep the existing chapter-analysis result/materialization contract.
- Reduce the size and latency tail of each Vertex response instead of merely increasing the timeout.
- Preserve source-grounded `source_anchor` values and the existing visual-beat density policy.
- Preserve exact chapter source coverage and source-preserving scene narration.
- Bound concurrent Vertex calls and make the policy configurable.
- Repair only an under-dense shard rather than regenerating the full chapter.
- Keep the existing outer paid-provider fence and fake/disabled provider behavior unchanged.

## Architecture

For Vertex only, `VertexGeminiProvider.submit()` becomes an internal two-phase operation while its public provider contract remains unchanged.

1. **Structure phase**: one request extracts reusable characters, reusable locations, and ordered scenes, but no visual beats and no duplicated scene narration. Each scene returns short verbatim `source_start_anchor` and `source_end_anchor` boundary excerpts.
2. **Deterministic scene reconstruction**: local code resolves scene start anchors in source order. The next scene's start is the authoritative boundary of the current scene; the end anchor validates that no non-whitespace story source is left uncovered. This guarantees that the reconstructed scene ranges concatenate back to the exact chapter source.
3. **Adaptive shard planning**: each scene range is split near paragraph/sentence/whitespace boundaries. Shards target approximately 12 visual beats and have a hard configurable cap of 20. Per-shard minimum/target/maximum counts use the existing 10s/7.5s density policy.
4. **Beat generation**: at most `VERTEX_ANALYSIS_SHARD_CONCURRENCY` shard requests run concurrently (default 3, max 4). A shard request receives only its source slice plus the relevant scene title, character canon, and location canon; it never receives the full chapter.
5. **Validation/repair**: local validation rejects missing/out-of-range/out-of-order anchors, output below the shard minimum, and output above the shard maximum. An otherwise valid under-dense shard receives at most the configured number of repair attempts (default one). Repair regenerates the complete replacement beat set for that shard so anchor ordering cannot be corrupted by appending late beats.
6. **Merge**: validated shard beats are merged in source order. Scene narration is reconstructed directly from the exact shard source, not rewritten by Gemini. Billing/usage from the structure, shard, and repair calls is aggregated into the single final provider operation.

## Paid-provider safety and recovery boundary

The existing worker fence remains outside `VertexGeminiProvider.submit()`. A chapter analysis therefore still has one durable provider operation from the worker's perspective.

This is intentional for this latency fix. Reusing `provider_operations` as child checkpoints would preserve successful sibling outputs, but it would **not** make a timed-out synchronous Vertex child safe to retry: `generateContent` still provides no provider operation id before the response is received. Blindly resubmitting that child could duplicate paid work. It would also complicate aggregate billing semantics because job reconciliation sums billed provider operations.

Consequently:

- smaller shard calls materially reduce the probability and blast radius of a read timeout;
- a network/read timeout after the paid-provider fence remains UNKNOWN/unreconcilable exactly as before;
- automatic retry is not added for ambiguous submissions;
- true zero-loss shard recovery requires a provider execution mode with a durable/reconcilable operation id (for example an asynchronous provider job) and should be implemented as a separate architecture change rather than pretending a local checkpoint solves provider ambiguity.

## Provider implementation

`VertexGeminiProvider` keeps the existing `LlmProvider` interface. A private `_generate_structured()` helper performs each bounded structured call and uses the model's JSON schema. This avoids exposing Vertex-specific phases to the worker/service layer.

HTTP timeout is explicit:

- connect: 10 seconds;
- write: 30 seconds;
- read: `VERTEX_TIMEOUT_SECONDS` (default remains 120 seconds);
- pool: 10 seconds.

The read timeout remains configurable, but sharding is the primary latency mitigation rather than raising it to 300-600 seconds.

## Internal models

The sharded path uses internal Pydantic models separate from the durable final result:

- `ChapterStructureResult`
- `SceneStructure`
- `VisualBeatShard`
- `VisualBeatShardResult`

Provider-generated shard results require every visual beat to have `source_anchor`. The final output remains the existing `ChapterAnalysisResult` consumed by materialization.

## Configuration

- `VERTEX_ANALYSIS_SHARD_CONCURRENCY=3`, allowed 1-4.
- `VERTEX_ANALYSIS_SHARD_TARGET_BEATS=12`, allowed 4-20.
- `VERTEX_ANALYSIS_SHARD_MAX_BEATS=20`, allowed 8-24 and never lower than target.
- `VERTEX_ANALYSIS_REPAIR_ATTEMPTS=1`, allowed 0-2.
- `VERTEX_TIMEOUT_SECONDS=120` remains the default read timeout.

These values are exposed through `WorkerSettings`, `.env.example`, and the AI-worker Compose environment.

## Error handling

- Authentication/config errors fail before the provider call.
- Timeout/network errors after the existing external-call fence remain UNKNOWN/unreconcilable; they are never blindly retried.
- HTTP 4xx responses are terminal failures.
- HTTP 5xx responses remain ambiguous under the existing provider safety policy.
- Invalid structure boundaries, schema failures, invalid beat anchors, under-density after repair, and over-density fail the provider operation rather than materializing unsafe output.

## Testing

Tests cover:

- deterministic scene-boundary resolution and exact chapter source coverage;
- approximately 12 beats per long-scene shard with a hard maximum;
- source-preserving narration reconstruction;
- required, in-range, source-ordered visual-beat anchors;
- rejection of under-dense and over-dense shard output;
- structure prompt excludes visual-beat expansion and full scene narration echo;
- shard prompt contains only shard source, not the full chapter;
- bounded concurrency;
- one full-replacement repair for under-dense output;
- aggregate billing across structure/shard/repair calls;
- split connect/write/read/pool timeout behavior;
- configuration bounds and Compose propagation.
