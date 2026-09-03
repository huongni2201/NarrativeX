# Visual Pipeline V3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy single-camera/quality-tier image pipeline with structured shot direction, chapter-level shot planning, semantic beat allocation, deterministic camera motion, Prompt V3, faster Gemini Web automation, validated image post-processing, and real render-quality tests.

**Architecture:** AI analysis owns semantic/visual intent and structured visual direction. A deterministic chapter-level planner coordinates shot diversity, backend composes the final provider prompt, Desktop only submits that prompt and validates generated/cleaned assets, and the renderer executes motion without re-interpreting story text. Legacy fields remain only at explicit compatibility boundaries until the last consumer is cut over.

**Tech Stack:** Python 3.12/Pydantic/pytest, Java/Spring/MyBatis/JUnit, TypeScript/Electron/Node tests, FFmpeg/ffprobe.

**Spec:** `Pasted markdown(3).md` audit supplied in the implementation session and `docs/superpowers/specs/2026-09-03-render-motion-quality-design.md` for existing render composition behavior.

## Global Constraints

- Backend remains the sole owner of the final image-generation prompt.
- `source_anchor` is mandatory for newly analyzed visual beats.
- Do not hard-code a fixed visual-beat count; keep duration budgeting and add semantic weighting.
- Renderer executes structured motion; it must not infer story semantics from prompt/title keywords.
- Image generation uses one best-quality mode; remove DRAFT/STANDARD/HIGH choice from active product paths.
- Keep original generated assets immutable; cleaned variants are preferred only after validation.
- Keep fresh Gemini conversations to avoid context contamination.
- Preserve current 2x working-canvas + zoompan + Lanczos render path unless a measured regression requires otherwise.

---

### Task 1: Structured Visual Direction V3 contract
- [ ] Add RED tests for required source anchors and structured shot fields.
- [ ] Add shot-size, camera-angle, lens, action-phase, camera-movement, direction/intensity and crop-safe-area types.
- [ ] Materialize legacy `visual_intent` from structured direction only where compatibility requires it.
- [ ] Cut active image-quality configuration to one best-quality mode.
- [ ] Run AI worker contract tests.

### Task 2: Semantic beat allocation
- [ ] Add RED tests proving semantic events receive more budget than equal-length static scenes.
- [ ] Add deterministic semantic-weight budgeting without fixed beat counts.
- [ ] Preserve target duration and hard maximum validators.
- [ ] Run density/sharding tests.

### Task 3: ShotSequencePlanner
- [ ] Add RED tests for repeated-shot prevention, location establishing shots, dialogue focus swaps, reaction close-ups, and determinism.
- [ ] Add chapter-level planner after shard merge and before materialization.
- [ ] Run planner/materialization tests.

### Task 4: Structured camera movement cut-over
- [ ] Add RED tests that materialization consumes authored movement rather than keyword inference.
- [ ] Remove keyword/regex camera resolver and old tests/exports after last consumer cut-over.
- [ ] Validate movement enum/direction/intensity deterministically with safe NONE fallback.
- [ ] Run AI worker and backend motion tests.

### Task 5: Backend Prompt Composer V3
- [ ] Add RED tests for section order, single canonical identity emission, shot grammar, and shot-specific constraints.
- [ ] Compose TASK -> STORY MOMENT -> SHOT -> CHARACTER LOCKS -> CURRENT STATE -> ENVIRONMENT -> LIGHT AND COLOR -> STYLE -> HARD CONSTRAINTS.
- [ ] Remove duplicated/global composition rules that conflict with wide/establishing shots.
- [ ] Keep Desktop prompt submission pass-through only.
- [ ] Run backend prompt/provider contract tests.

### Task 6: Gemini Web throughput and generated-image validation
- [ ] Add RED tests for DOM-state waits, lane state cache, and decoded image dimension/aspect validation.
- [ ] Replace happy-path fixed sleeps with state-based waits plus bounded fallback.
- [ ] Cache selected model/preset/mode per lane while preserving fresh conversations.
- [ ] Add adaptive effective concurrency on quota/timeout signals within configured tab limits.
- [ ] Persist actual selected model/preset metadata.
- [ ] Reject thumbnails/invalid images after decode.
- [ ] Run Desktop Gemini tests.

### Task 7: Watermark quality gate and Golden Render Harness
- [ ] Add RED tests for immutable originals, decoded cleaned-variant validation, dimension/aspect preservation and cleaned fallback.
- [ ] Bundle/resolve watermark dependencies without per-image `pnpm dlx` on the happy path.
- [ ] Add a short deterministic render fixture and decode/ffprobe metrics for frame count, duplicate/drop indicators, A/V drift, subtitle boundary timing and sample sharpness.
- [ ] Keep smoke harness CPU/x264-friendly for normal CI and leave NVENC/full benchmark opt-in.
- [ ] Update drifted Desktop/image-generation documentation and remove obsolete tests/code after cut-over.
- [ ] Run Repository gates, Desktop check, Backend verify and AI worker checks.
