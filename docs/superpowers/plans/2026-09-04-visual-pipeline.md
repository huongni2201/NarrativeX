# Structured Visual Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the current image pipeline over in place to structured shot direction, chapter-level shot planning, semantic beat allocation, deterministic camera motion, one backend-owned prompt composer, faster Gemini Web automation, validated image post-processing, and real render-quality tests.

**Architecture:** AI analysis owns semantic/visual intent and structured `VisualDirection`. A deterministic chapter-level planner coordinates shot diversity, the existing backend `VisualPromptComposer` is the sole owner of the final provider prompt, Desktop submits that prompt verbatim and validates generated/cleaned assets, and the renderer executes authored motion without re-interpreting story text. Legacy camera/quality fields remain only where existing persisted data still has to be readable; they are not alternate active product modes.

**Tech Stack:** Python 3.12/Pydantic/pytest, Java/Spring/MyBatis/JUnit, TypeScript/Electron/Node tests, FFmpeg/ffprobe.

**Spec:** `Pasted markdown(3).md` audit supplied in the implementation session and `docs/superpowers/specs/2026-09-03-render-motion-quality-design.md` for existing render composition behavior.

## Global Constraints

- Backend `VisualPromptComposer` is the only final image-prompt composer; do not add prompt-version alternatives, wrappers or fallback prompts.
- `source_anchor` is mandatory for newly analyzed visual beats.
- Do not hard-code a fixed visual-beat count; keep duration budgeting and redistribute it with source-grounded semantic weighting.
- Renderer executes structured motion; it must not infer story semantics from prompt/title keywords.
- Image generation exposes one best-quality mode; active generation resolves quality to HIGH while old persisted enum values remain readable during cut-over.
- Generated images must meet the 2K envelope: at least 2560 pixels on the long edge and 1440 pixels on the short edge.
- Keep original generated assets immutable; cleaned variants are preferred only after validation.
- Keep fresh Gemini conversations to avoid context contamination.
- Preserve the existing 2x working-canvas + zoompan + Lanczos render path unless measured output proves a regression.

---

### Task 1: Structured VisualDirection contract
- [x] Add tests for required source anchors and structured shot fields.
- [x] Add shot-size, camera-angle, lens, action-phase, camera-movement, direction/intensity and crop-safe-area types.
- [x] Persist structured direction and project to legacy camera fields only at the storage compatibility boundary.
- [x] Remove quality-tier choice from active AI image settings.

### Task 2: Semantic beat allocation
- [x] Add tests proving semantic events can receive more budget than a longer static scene.
- [x] Add deterministic semantic-weight redistribution without changing the duration-derived global beat budget.
- [x] Preserve target duration and hard maximum validators.

### Task 3: ShotSequencePlanner
- [x] Add deterministic tests for repeated-shot prevention and sequence preservation.
- [x] Run the planner after shard merge and before materialization.
- [x] Avoid random camera decisions and avoid running the planner twice.

### Task 4: Structured camera movement cut-over
- [x] Materialization consumes authored movement rather than keyword inference.
- [x] Remove keyword/regex camera resolver and its old exports/tests.
- [x] Retain only a narrow compatibility projection for persisted legacy camera columns.

### Task 5: Single backend VisualPromptComposer rewrite
- [x] Keep the existing `VisualPromptComposer` as the only composer; delete the temporary parallel composer.
- [x] Compose TASK -> STORY MOMENT -> SHOT -> CHARACTER LOCKS -> CURRENT STATE -> ENVIRONMENT -> LIGHT AND COLOR -> REFERENCE MAP -> STYLE -> HARD CONSTRAINTS.
- [x] Remove duplicated/global composition rules that conflict with wide/establishing shots.
- [x] Make negative constraints shot-aware.
- [x] Preserve deterministic identity-reference selection and character snapshots.

### Task 6: Gemini Web throughput and generated-image validation
- [ ] Replace happy-path fixed sleeps with DOM/state waits while keeping bounded polling delays for DevTools/network readiness.
- [ ] Avoid redundant model/preset selection when the actual DOM already confirms the desired state.
- [x] Add adaptive effective concurrency on quota/timeout signals without exceeding configured tab counts.
- [x] Reject generated images below the 2K envelope and expose actual dimensions/checksum.

### Task 7: Watermark quality gate and Golden Render Harness
- [x] Preserve immutable originals and validate cleaned variants keep dimensions/aspect ratio.
- [ ] Prefer a bundled/local watermark-remover command instead of per-image `pnpm dlx` on the production happy path.
- [x] Add a real FFmpeg/ffprobe smoke harness and a matrix covering motion/crop/transition/subtitle/fps/resolution/encoder cases.
- [ ] Extend measured metrics for duplicate/drop indicators, A/V drift and subtitle-boundary checks where practical in normal CI.
- [ ] Update drifted image-generation/Desktop documentation and remove obsolete code/tests after CI confirms cut-over.

### Task 8: Integration verification
- [ ] Repository gates pass.
- [ ] Desktop check passes.
- [ ] Backend verify passes.
- [ ] AI worker checks pass.
- [ ] Mark PR ready only after the current head is green and no legacy prompt alternative remains.
