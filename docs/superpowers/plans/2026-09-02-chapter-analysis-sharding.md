# Chapter Analysis Sharding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single oversized Vertex chapter-analysis request with durable structure + adaptive visual-beat shard requests while preserving the final `ChapterAnalysisResult` contract.

**Architecture:** Vertex analysis uses a two-phase orchestrator. A structure call extracts characters/locations/scenes with scene source anchors; deterministic local planning splits scene source into bounded beat shards; shard calls run with concurrency 3; results are validated, optionally repaired once, merged, and then materialized through the existing repository path. Existing `provider_operations` provide durable per-call fences using deterministic fingerprints; no database migration is required.

**Tech Stack:** Python 3.12, asyncio, Pydantic 2, httpx 0.28, asyncpg, pytest 9, Ruff, mypy.

**Spec:** `docs/superpowers/specs/2026-09-02-chapter-analysis-sharding-design.md`

## Global Constraints

- Preserve the public/final `ChapterAnalysisResult` materialization contract.
- Preserve the current 7.5-second target and 10-second hard maximum visual-beat density policy.
- Do not blind-retry ambiguous paid Vertex submissions.
- Keep fake and disabled provider paths unchanged.
- Default shard concurrency is 3 and must not exceed 4.
- Default shard target is 12 beats; no shard target may exceed 20 beats.
- Newly generated visual beats require a verbatim `source_anchor`.
- Do not add a database migration in this change.

---

### Task 1: Internal structure and shard models

**Files:**
- Modify: `app/ai-worker/src/narrativex_worker/schema.py`
- Create: `app/ai-worker/src/narrativex_worker/chapter_analysis_sharding.py`
- Test: `app/ai-worker/tests/test_chapter_analysis_sharding.py`

**Interfaces:**
- Produces: `ChapterStructureResult`, `SceneStructure`, `VisualBeatShard`, `VisualBeatShardResult`, `plan_visual_beat_shards()`, `merge_shard_results()`.

- [ ] Write tests showing source anchors are required for generated beats and structure scene anchors resolve monotonically.
- [ ] Run focused tests and confirm failure because the new models/planner do not exist.
- [ ] Add the internal models and deterministic source-range resolver.
- [ ] Add adaptive shard planning using the existing visual-density policy and sentence/paragraph boundaries.
- [ ] Add merge validation that rejects anchors outside the shard or out of source order.
- [ ] Run focused tests and confirm pass.

### Task 2: Split structure and shard prompts

**Files:**
- Modify: `app/ai-worker/src/narrativex_worker/prompting.py`
- Test: `app/ai-worker/tests/test_prompting.py`

**Interfaces:**
- Produces: `build_chapter_structure_prompt(request)`, `build_visual_beat_shard_prompt(request, structure, shard, repair=None)`.

- [ ] Write tests proving structure prompts omit visual-beat expansion and shard prompts contain only shard source, not the full chapter.
- [ ] Run focused tests and confirm failure.
- [ ] Implement structure and shard prompt builders while reusing visual direction/safety instructions.
- [ ] Preserve the existing `build_chapter_analysis_prompt()` for fake/compatibility callers.
- [ ] Run focused tests and confirm pass.

### Task 3: Vertex bounded calls and timeout profile

**Files:**
- Modify: `app/ai-worker/src/narrativex_worker/config.py`
- Modify: `app/ai-worker/src/narrativex_worker/providers/vertex.py`
- Test: `app/ai-worker/tests/test_vertex_provider.py`
- Modify: `.env.example`
- Modify: `docker-compose.yml`

**Interfaces:**
- Produces: `VertexGeminiProvider.submit_structure()`, `submit_visual_beat_shard()`, `repair_visual_beat_shard()` and explicit `httpx.Timeout` construction.

- [ ] Write tests for config bounds and split timeout values.
- [ ] Write provider tests for structure/shard schema selection and timeout/network error classification.
- [ ] Run focused tests and confirm failure.
- [ ] Add shard configuration fields and environment examples.
- [ ] Refactor shared Vertex HTTP submission into one private structured-generation helper.
- [ ] Add structure/shard/repair methods using internal schemas.
- [ ] Run focused tests, Ruff and mypy on touched modules.

### Task 4: Durable Vertex sharded orchestrator

**Files:**
- Create: `app/ai-worker/src/narrativex_worker/vertex_chapter_analysis.py`
- Modify: `app/ai-worker/src/narrativex_worker/repository/implementation.py`
- Modify: `app/ai-worker/src/narrativex_worker/repository/__init__.py`
- Modify: `app/ai-worker/src/narrativex_worker/worker.py`
- Test: `app/ai-worker/tests/test_vertex_chapter_analysis.py`
- Test: `app/ai-worker/tests/test_repository_postgres.py`

**Interfaces:**
- Produces: `VertexChapterAnalysisOrchestrator.analyze(claimed) -> ChapterAnalysisResult` and repository helpers that reserve/persist generic internal provider-operation JSON without materializing it as a final chapter result.

- [ ] Write tests for deterministic per-phase fingerprints and replay of completed structure/shards.
- [ ] Write tests proving at most configured shard concurrency is used.
- [ ] Write tests proving under-dense otherwise-valid shards get at most one repair request.
- [ ] Run focused tests and confirm failure.
- [ ] Add generic JSON payload persistence/replay helpers on `provider_operations`, retaining existing final-result methods unchanged.
- [ ] Implement the orchestrator with external-call fences around each structure/shard/repair request.
- [ ] Route only `provider_mode=vertex` through the orchestrator; keep fake/disabled flows unchanged.
- [ ] Run worker/repository/orchestrator tests and confirm pass.

### Task 5: Final validation and documentation

**Files:**
- Modify: `app/ai-worker/README.md`
- Modify: `documentation/codebase/AI_WORKER_CODEBASE.md`

**Interfaces:**
- Consumes all prior tasks; produces no new code interface.

- [ ] Run `pytest` for the AI worker.
- [ ] Run `ruff check src tests`.
- [ ] Run `ruff format --check src tests`.
- [ ] Run `mypy src`.
- [ ] Update docs with structure → adaptive shards → repair → merge flow and timeout/config knobs.
- [ ] Confirm no database migration was added and fake-provider tests still pass.
