# Sharded Chapter Analysis Design

## Problem

The current Vertex chapter-analysis adapter sends one synchronous `generateContent` request that asks Gemini to return chapter structure plus all visual beats. With the current density policy (target 7.5 seconds, hard maximum 10 seconds), long chapters can require dozens of beats in one structured JSON response. This increases response latency and makes `httpx.ReadTimeout` likely. Because synchronous `generateContent` does not return a durable provider operation id before the response arrives, a timeout is an ambiguous paid-provider outcome and NarrativeX correctly refuses a blind retry.

## Goals

- Keep the existing chapter-analysis result/materialization contract.
- Reduce the size and latency tail of each Vertex request.
- Preserve source-grounded `source_anchor` values and visual-beat density.
- Persist progress per structure/shard so successful work is not discarded when one shard fails.
- Avoid a new database migration in the first implementation by reusing `provider_operations` with deterministic request fingerprints.
- Keep fake/disabled provider behavior unchanged.

## Architecture

For Vertex only, chapter analysis becomes a two-phase orchestrated operation.

1. **Structure phase**: one bounded request extracts reusable characters, reusable locations, and ordered scenes. Each scene includes a verbatim contiguous `source_anchor` covering the scene source region, scene narration, character references, and location reference, but no visual beats.
2. **Shard planning phase**: deterministic local code resolves each scene anchor to a source range and creates adaptive source shards. Shards target 12 visual beats, permit 8-16 by default, and cap at 20. Small adjacent ranges within one scene may be grouped; long scenes are split on paragraph/sentence boundaries. The planner computes each shard target from the existing 7.5s/10s density policy.
3. **Beat generation phase**: at most `VERTEX_ANALYSIS_SHARD_CONCURRENCY` shard requests run concurrently (default 3, max 4). Each request receives only its shard source plus the small set of relevant character/location canon and must return source-ordered visual beats whose anchors are verbatim excerpts inside that shard.
4. **Validation/repair phase**: deterministic code rejects out-of-range/non-monotonic anchors and under-dense shard output. A deficient but otherwise valid shard may receive one bounded repair request asking only for the missing source-grounded beats. Invalid provider output fails the shard rather than regenerating the chapter.
5. **Merge phase**: shard beats are merged into their parent scene in source order, then the existing `ChapterAnalysisResult` validation and global density validation run before materialization.

## Durable provider operations

The existing `provider_operations` table is reused. Every external call has a deterministic fingerprint derived from the chapter snapshot plus a phase/shard identity. Structure and shard operations therefore persist independently. Completed operations can be replayed after worker restart.

Because Vertex synchronous `generateContent` has no operation id prior to response completion, a timeout remains ambiguous. The timed-out shard is suspended exactly as today instead of blindly retried. Other completed shards remain durable and reusable for a subsequent explicit job/recovery path.

## Provider interfaces

The generic `LlmProvider.submit()` contract remains unchanged for fake/disabled providers. `VertexGeminiProvider` gains bounded methods used by a new Vertex analysis orchestrator:

- `submit_structure(request) -> ChapterStructureResult`
- `submit_visual_beat_shard(request, structure, shard) -> VisualBeatShardResult`
- `repair_visual_beat_shard(request, structure, shard, existing, missing_count) -> VisualBeatShardResult`

HTTP timeout is split into connect/write/read/pool values. `VERTEX_TIMEOUT_SECONDS` remains the read timeout compatibility setting; connect=10s, write=30s and pool=10s are explicit.

## Models

New internal Pydantic models are separate from the durable final result:

- `ChapterStructureResult`
- `SceneStructure`
- `VisualBeatShard`
- `VisualBeatShardResult`

`VisualBeatAnalysis.source_anchor` becomes required for newly generated analysis. Legacy persisted results remain readable only through the existing database/materialization compatibility path; provider-generated results may no longer omit it.

## Configuration

- `VERTEX_ANALYSIS_SHARD_CONCURRENCY=3`, allowed 1-4.
- `VERTEX_ANALYSIS_SHARD_TARGET_BEATS=12`, allowed 4-20.
- `VERTEX_ANALYSIS_SHARD_MAX_BEATS=20`, allowed 8-24 and not lower than target.
- `VERTEX_ANALYSIS_REPAIR_ATTEMPTS=1`, allowed 0-2.
- `VERTEX_TIMEOUT_SECONDS` stays default 120s initially; sharding is the primary latency fix rather than simply raising the timeout.

## Error handling

- Authentication/config errors fail before crossing the provider boundary.
- Timeout/network errors after the external-call fence remain UNKNOWN/unreconcilable for that individual structure/shard request.
- 4xx responses are terminal failures.
- 5xx responses remain ambiguous under the existing provider safety policy.
- Schema, anchor, or density validation failures are terminal for the response; only under-density with otherwise valid anchors qualifies for one repair request.

## Testing

Tests cover:

- deterministic shard planning and source coverage;
- 8-16 beat target behavior and 20-beat cap;
- required source anchors and source-order validation;
- structure/beat prompt isolation (no full chapter text in shard calls);
- bounded concurrency;
- one repair for an under-dense shard;
- deterministic fingerprints for structure and shards;
- merge produces a valid `ChapterAnalysisResult` and preserves global density;
- timeout construction uses separate connect/write/read/pool limits;
- fake provider path remains unchanged.
