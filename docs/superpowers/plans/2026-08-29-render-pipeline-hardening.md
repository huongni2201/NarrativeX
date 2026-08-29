# Render Pipeline Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean the current Architecture A local-first render code and complete the end-to-end Editor -> render -> final MP4 flow without replacing the existing backend snapshot/local FFmpeg architecture.

**Architecture:** Keep narration as the master clock and keep immutable backend render snapshots. The renderer UI remains orchestration-only; Electron main/local execution owns filesystem access, asset materialization, FFmpeg, verification, artifact registration, and final delivery. REMOTE/HYBRID assets may be materialized after job claim, while LOCAL_ONLY assets must already exist locally.

**Tech Stack:** Electron 43 · React 19 · TypeScript 7 · Node test runner · FFmpeg/FFprobe · Spring Boot backend render snapshot APIs

**Spec:** `docs/superpowers/specs/2026-08-29-cinematic-editor-preview-render-design.md` and `docs/superpowers/specs/2026-08-29-local-first-editor-render-design.md`

## Global Constraints

- Do not bypass backend render snapshots or call FFmpeg from React renderer code.
- Do not add a new database table.
- Narration remains the master clock and final render requires exact contiguous beat timing.
- Keep LOCAL_ONLY media valid for local-device render.
- Keep destination selection behind trusted Electron IPC/token authorization.
- 2K means QHD 2560x1440 for 16:9.
- Preserve internal artifact registration even if final destination delivery later fails.
- Use TDD for each behavior change.

---

### Task 1: Fix local render preflight semantics

**Files:**
- Modify: `app/desktop/test/local-render-preflight.test.mjs`
- Modify: `app/desktop/src/main/rendering/local-render-preflight.ts`
- Modify: `packages/client-contracts/src/production.ts` only if the preflight input contract needs asset source metadata.

**Interfaces:**
- Consumes: project id, render asset descriptors, runtime/device/disk context.
- Produces: blockers only for assets that must already exist locally or are locally corrupt; REMOTE/HYBRID materializable assets do not fail preflight merely because they are absent from local storage.

- [ ] Add a failing test proving a REMOTE/HYBRID materializable asset does not produce `ASSET_MISSING` when not yet local.
- [ ] Add a failing test proving a LOCAL_ONLY asset that is absent still produces `ASSET_MISSING`.
- [ ] Change preflight input from bare ids to descriptors containing `assetId`, `storageMode`, and whether a remote source exists.
- [ ] Keep checksum/file verification for assets that are present locally.
- [ ] Run focused desktop tests and commit.

### Task 2: Make subtitle output real

**Files:**
- Modify: `app/desktop/src/main/rendering/project-renderer.ts`
- Modify: `app/desktop/src/main/rendering/audio-muxer.ts`
- Reuse: `app/desktop/src/main/rendering/subtitle-srt.ts`
- Add/modify tests under `app/desktop/test/` for final mux args.

**Interfaces:**
- Consumes: `manifest.subtitles`.
- Produces: final MP4 with narration plus subtitle track/burn-in behavior matching the UI contract; if there are no valid cues, render proceeds without subtitles.

- [ ] Add failing tests proving subtitle SRT is passed into finalization when cues exist and omitted when no cues exist.
- [ ] Write SRT during render finalization.
- [ ] Update final FFmpeg command to include subtitles deterministically without changing narration duration.
- [ ] Run focused render tests and commit.

### Task 3: Unify transition decisions used by preview and final render

**Files:**
- Modify: `packages/client-contracts/src/production.ts`
- Modify: `app/desktop/src/renderer/features/production/auto-edit-planner.ts`
- Modify: `app/desktop/src/shared/transition-planner.ts`
- Modify: `app/desktop/src/main/rendering/render-manifest.ts`
- Modify related auto-edit/transition/manifest tests.

**Interfaces:**
- Produces: duration-preserving transition metadata on Auto Edit decisions and render overrides/snapshot-compatible data, with deterministic fallback to CUT.

- [ ] Add failing Auto Edit tests for scene dissolve/chapter dip-black behavior and duration clamping.
- [ ] Extend edit decision types with transition type/duration and motion metadata needed by preview/render.
- [ ] Make transition planning a shared pure function consumed by preview and final manifest generation.
- [ ] Keep beat start/end offsets unchanged.
- [ ] Run focused tests and commit.

### Task 4: Clean render orchestration

**Files:**
- Modify: `app/desktop/src/renderer/features/production/useRenderController.ts`
- Create: `app/desktop/src/renderer/features/production/render-preflight.ts`
- Create: `app/desktop/src/renderer/features/production/render-delivery.ts` only if extraction materially reduces controller responsibility.
- Modify: `app/desktop/src/renderer/features/production/api/production.api.ts`
- Modify controller/readiness tests.

**Interfaces:**
- `useRenderController` owns UI state and sequence only.
- Pure helpers build asset descriptors, estimate bytes, and normalize user-facing failures.

- [ ] Add failing helper/controller tests for preflight input construction and destination cancellation.
- [ ] Extract preflight request construction and bitrate estimation from the hook.
- [ ] Keep pairing/start-render API behavior unchanged.
- [ ] Keep delivery token lifecycle single-use and job-bound.
- [ ] Run focused tests and commit.

### Task 5: Regression verification and docs

**Files:**
- Modify relevant render workflow documentation only where behavior changed.

- [ ] Run Desktop tests/typecheck/build/repository gates.
- [ ] Run backend render request/use-case verification for 1440p and local-device snapshot flow.
- [ ] Verify no MediaPlan dependency was reintroduced.
- [ ] Verify destination cancellation creates no job and completed artifact delivery preserves the internal artifact.
- [ ] Update docs and commit.
