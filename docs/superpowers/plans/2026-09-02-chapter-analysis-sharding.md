# Chapter Analysis Sharding Implementation Plan

**Goal:** Replace the single oversized Vertex chapter-analysis response with structure extraction plus bounded adaptive visual-beat shards while preserving the final `ChapterAnalysisResult` contract and existing paid-provider safety fence.

**Spec:** `docs/superpowers/specs/2026-09-02-chapter-analysis-sharding-design.md`

## Implemented scope

- [x] Add internal structure/shard models and deterministic source-boundary resolution.
- [x] Reconstruct exact source-preserving scene narration locally instead of asking Gemini to echo scene text.
- [x] Plan shards from the existing 7.5-second target / 10-second hard-maximum density policy.
- [x] Target approximately 12 beats per shard and enforce a configurable hard cap (default 20).
- [x] Add structure and shard-specific prompts so shard calls never receive the full chapter.
- [x] Run shard generation with bounded configurable concurrency (default 3, max 4).
- [x] Repair under-dense shards with a full replacement response, default one attempt.
- [x] Reject missing/out-of-range/out-of-order anchors, under-dense output, and over-dense output.
- [x] Merge validated shards into the existing final result contract.
- [x] Aggregate token usage and actual cost across structure/shard/repair calls into the existing final provider billing record.
- [x] Split HTTP timeout into connect/write/read/pool values while preserving `VERTEX_TIMEOUT_SECONDS` as the read timeout.
- [x] Expose shard concurrency/target/max/repair settings through `WorkerSettings`, `.env.example`, and Compose.
- [x] Add regression tests for planning, exact source coverage, prompt isolation, concurrency, repair, configuration, merge, and billing.

## Explicitly not bundled into this PR

Per-shard durable paid-provider operations are not added here. Synchronous Vertex `generateContent` does not provide a durable operation id before the response arrives, so checkpointing a child row cannot make a `ReadTimeout` safe to retry. Blind child retry could duplicate paid work, and billing reconciliation currently sums billed `provider_operations` for a job.

If zero-loss recovery after an ambiguous shard submission is required, implement it as a separate provider-execution change using an asynchronous/reconcilable provider operation rather than weakening NarrativeX's existing no-blind-retry rule.

## Verification gate

- [ ] AI worker full pytest suite passes.
- [ ] Ruff passes.
- [ ] Mypy passes.
- [ ] Repository gates pass.
- [ ] Backend verify passes or any unrelated baseline failure is documented.
- [ ] Desktop check passes or any unrelated flaky failure is documented/re-run.
