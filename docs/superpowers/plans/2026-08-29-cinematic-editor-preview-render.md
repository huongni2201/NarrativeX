# Cinematic Editor Preview and Render Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Editor preview narration-driven and cinematic, show subtitles and richer transitions, and allow 720p/1080p/2K local rendering from Editor into a user-selected destination folder.

**Architecture:** Reuse the existing local-first production timeline, subtitle planner, FFmpeg renderer, render preflight, and render job pipeline. Add missing shared contracts and UI orchestration rather than creating a second render path. Preview and render share deterministic motion/transition/subtitle decisions; narration remains the master clock.

**Tech Stack:** Java 25 · Spring Boot 4.1 · Electron 43 · React 19 · TypeScript 7 · Node test runner · FFmpeg/FFprobe

**Spec:** `docs/superpowers/specs/2026-08-29-cinematic-editor-preview-render-design.md`

## Global Constraints

- Narration is the authoritative timeline clock.
- Render resolutions are `720p`, `1080p`, and `1440p`; product label for `1440p` is `2K · QHD`.
- 16:9 `1440p` output is exactly `2560x1440`; other aspect ratios preserve ratio and even dimensions.
- Folder selection must use trusted Electron IPC; cancellation queues no render job.
- Internal render artifacts/journals remain managed by ProjectStorage; user-selected output is a delivery copy.
- Existing subtitle planner/alignment data is reused; do not create a duplicate subtitle model in the renderer.
- Preview failure must stop playback instead of letting a timer continue silently.
- Every production behavior change is preceded by a failing test.

---

### Task 1: Add the 2K render contract end-to-end

**Files:**
- Modify: `packages/client-contracts/src/production.ts`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/api/request/CreateProjectRenderRequest.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/usecase/CreateProjectRenderUseCase.java`
- Modify: `app/backend-service/src/test/java/com/narrativex/backend/feature/generation/application/usecase/CreateProjectRenderUseCaseTest.java`
- Modify: `app/desktop/src/renderer/features/production/api/production.api.ts`
- Test/create desktop contract test for `renderDimensions("1440p", "16:9") === { width: 2560, height: 1440 }`.

**Interfaces:**
- Produces `RenderResolution = "720p" | "1080p" | "1440p"`.
- Backend accepts `1440p` and entitlement ranking treats it above `1080p`.

- [ ] Write failing backend/API/desktop tests for 1440p.
- [ ] Verify the tests fail because request validation/API typing rejects 1440p.
- [ ] Add the shared resolution type, backend validation/ranking, and production API support.
- [ ] Verify focused backend and desktop tests pass.
- [ ] Commit as `feat(render): add 2k output preset`.

### Task 2: Add trusted destination-folder selection and delivery export

**Files:**
- Create: `app/desktop/src/main/rendering/render-destination.ts`
- Modify: `app/desktop/src/main/main.ts`
- Modify: `app/desktop/src/preload/types.ts`
- Modify: `app/desktop/src/preload/index.ts`
- Add desktop tests around destination naming/validation and bridge contract.

**Interfaces:**
- `window.narrativex.render.chooseDestination(): Promise<{ token: string; directory: string } | null>`
- `window.narrativex.render.deliverArtifact({ token, projectId, jobId, projectName? }): Promise<{ path: string }>`
- Main-process token store authorizes the exact selected directory for one render delivery.

- [ ] Write failing tests for sanitized filename, cancellation contract, one-use authorization, and duplicate-safe destination naming.
- [ ] Verify RED.
- [ ] Implement folder picker with `openDirectory` + `createDirectory`, short-lived selection token, and `copyFile` of the registered internal artifact.
- [ ] Add preload types/bridge calls.
- [ ] Verify desktop tests and type contracts.
- [ ] Commit as `feat(desktop): export render to selected folder`.

### Task 3: Centralize render orchestration and expose Render in Editor

**Files:**
- Create: `app/desktop/src/renderer/features/production/useRenderController.ts`
- Create: `app/desktop/src/renderer/features/production/components/RenderDialog.tsx`
- Modify: `app/desktop/src/renderer/features/production/screens/RenderScreen.tsx`
- Modify: `app/desktop/src/renderer/features/editor/EditorScreen.tsx`
- Add focused pure-state/controller tests where possible.

**Interfaces:**
- Controller owns resolution, style, subtitles flag, readiness blockers, preflight, active job, progress, selected destination, and final delivered path.
- `startRender()` must choose/validate destination before calling `productionApi.startRender()`.

- [ ] Write failing tests proving cancellation/no destination does not call render start and 1440p is selectable.
- [ ] Verify RED.
- [ ] Extract existing RenderScreen orchestration into the shared controller.
- [ ] Add compact dialog with `720p`, `1080p`, `2K · 1440p (QHD)`, Auto Edit style, subtitles toggle, destination, progress, and Open output.
- [ ] Add Editor Render button/dialog; keep RenderScreen using the same controller.
- [ ] Verify desktop tests/typecheck via CI.
- [ ] Commit as `feat(editor): render from editor workspace`.

### Task 4: Make preview narration the master clock

**Files:**
- Modify: `app/desktop/src/renderer/features/editor/preview-playback.ts`
- Modify: `app/desktop/src/renderer/features/editor/components/EditorPlaybackSurface.tsx`
- Modify: `app/desktop/src/renderer/features/editor/components/EditorPreviewViewport.tsx`
- Modify: `app/desktop/test/preview-playback.test.mjs`

**Interfaces:**
- Preview viewport reports audio clock changes and playback failures upward.
- PlaybackSurface no longer advances time with `setInterval` while narration exists.

- [ ] Add failing tests for chapter-local/global clock mapping, seek mapping, and end-of-chapter handoff helpers.
- [ ] Verify RED.
- [ ] Implement pure clock helpers.
- [ ] Replace synthetic timer with `requestAnimationFrame` sampling of `<audio>.currentTime` and stop playback on `play()`/load failure.
- [ ] Ensure seeking updates narration before visual selection and chapter switch preserves global position.
- [ ] Verify preview tests/typecheck.
- [ ] Commit as `fix(editor): drive preview from narration clock`.

### Task 5: Upgrade deterministic cinematic transitions and motion

**Files:**
- Modify: `packages/client-contracts/src/production.ts`
- Modify: `app/desktop/src/renderer/features/production/auto-edit-planner.ts`
- Modify: `app/desktop/test/auto-edit-planner.test.mjs`
- Modify: `app/desktop/src/main/rendering/transition-planner.ts`
- Modify: `app/desktop/test/transition-planner.test.mjs`
- Modify: `app/desktop/src/main/rendering/render-manifest.ts`
- Modify only as required: `app/desktop/src/main/rendering/segment-renderer.ts`

**Interfaces:**
- Decisions expose `motionIntensity`, `motionEasing`, `transitionOut`, `transitionDurationMs`.
- Renderer maps ordinary calm scene changes to a short dissolve/fade-style duration-preserving treatment, dynamic beats to CUT, chapter boundaries to DIP/FADE BLACK.

- [ ] Write failing decision/transition tests for dynamic CUT, scene dissolve, chapter dip, and duration clamp.
- [ ] Verify RED.
- [ ] Extend Auto Edit decisions and transition planner without changing narration/beat durations.
- [ ] Make preview use intensity/easing and render manifest consume the same deterministic policy.
- [ ] Verify auto-edit, transition, and renderer regression tests.
- [ ] Commit as `feat(editor): add cinematic auto edit transitions`.

### Task 6: Surface existing subtitles in Editor preview and timeline

**Files:**
- Add shared renderer-safe subtitle cue contract or adapter without duplicating timing logic.
- Modify timeline/workspace contracts only if subtitle text/alignment is not already exposed to renderer UI.
- Modify: `app/desktop/src/renderer/features/editor/components/EditorMultiTrackTimeline.tsx`
- Modify: `app/desktop/src/renderer/features/editor/components/EditorPreviewViewport.tsx`
- Add subtitle cue lookup tests.

**Interfaces:**
- Editor receives global subtitle cues derived from the same chapter narration text/alignment rules as `subtitle-planner.ts`.
- `activeSubtitleAt(cues, playheadMs)` returns the active cue or null.

- [ ] Write failing active-cue and timeline presentation tests.
- [ ] Verify RED.
- [ ] Reuse/extract pure subtitle planning so main and renderer can consume equivalent logic without importing Electron-only modules.
- [ ] Add Subtitle track and preview overlay with safe lower margin.
- [ ] Keep render subtitle toggle wired to final FFmpeg subtitle inclusion; missing cues do not block render.
- [ ] Verify subtitle/desktop tests.
- [ ] Commit as `feat(editor): preview narration subtitles`.

### Task 7: Regression verification and integration cleanup

**Files:**
- Modify documentation only where behavior changed.

- [ ] Run/inspect Desktop check: tests, type-check, build.
- [ ] Run/inspect Backend verify with focused render tests.
- [ ] Verify no duplicated RenderScreen business logic remains.
- [ ] Verify destination cancellation queues no job, 2K request is accepted, and final artifact path is user-selected.
- [ ] Verify preview play/pause/seek/chapter handoff and subtitle overlay share the global narration clock.
- [ ] Commit final cleanup/documentation if needed.
