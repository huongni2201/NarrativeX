# Legacy Architecture Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove proven-unused compatibility seams and document the remaining renderer migration debt without changing runtime behavior or public contracts.

**Architecture:** Keep the current feature-oriented renderer architecture defined by `DESKTOP_RENDERER_STRUCTURE.md`. This pass only removes compatibility code with no repository callers and a redundant renderer entry facade; larger Voice/Images/Assets/Production workflow extraction remains a follow-up because it requires broader behavioral verification.

**Tech Stack:** Electron, React, TypeScript, TanStack Query, Java 25, Spring Boot, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-28-desktop-renderer-clean-architecture-design.md`

## Global Constraints

- Preserve existing backend, database, route and preload contracts.
- Keep domain APIs inside owning renderer features; `renderer/api` remains cross-feature transport only.
- React Query remains authoritative for server state.
- Do not move filesystem/process/provider-native responsibilities into React.
- UI behavior must remain unchanged; this pass contains no visual redesign.
- Do not remove compatibility paths merely because they contain the word `legacy`; remove only code with no repository caller and no documented compatibility requirement.

---

### Task 1: Remove ownerless generation repository shims

**Files:**
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/port/out/GenerationJobRepository.java`

**Interfaces:**
- Consumes: existing owner-scoped `findByIdempotencyKey(String, String)` and `acquireIdempotencyLock(String, String)` methods.
- Produces: the same owner-scoped repository interface without deprecated one-argument default methods.

- [ ] **Step 1: Verify repository callers**

Search for one-argument calls to `findByIdempotencyKey(...)` and `acquireIdempotencyLock(...)`. Expected: no production/test caller relies on the deprecated overloads.

- [ ] **Step 2: Remove the deprecated overloads**

Delete only the two `@Deprecated` default methods. Keep owner-scoped signatures unchanged.

- [ ] **Step 3: Verify backend compilation/tests**

Run the repository backend quality gate in a capable environment. Any compile failure referencing a one-argument overload means the shim still has a caller and must be restored or migrated explicitly.

### Task 2: Remove redundant renderer App facade

**Files:**
- Delete: `app/desktop/src/renderer/App.tsx`
- Modify: `app/desktop/src/renderer/main.tsx`
- Create: `app/desktop/test/legacy-cleanup.test.mjs`

**Interfaces:**
- Consumes: `DesktopApp` from `app/DesktopApp.tsx`.
- Produces: the same renderer root, imported directly from its canonical app boundary.

- [ ] **Step 1: Add a source-level regression test**

Create a Node test that asserts `renderer/App.tsx` does not exist and `renderer/main.tsx` imports/renders `DesktopApp` directly.

- [ ] **Step 2: Update the renderer entrypoint**

Replace the `App` facade import/render with direct `DesktopApp` import/render.

- [ ] **Step 3: Delete the facade**

Delete `app/desktop/src/renderer/App.tsx`.

- [ ] **Step 4: Verify Desktop**

Run `npm test`, `npm run type-check`, and `npm run build` under `app/desktop` in a capable environment.

### Task 3: Track remaining migration debt instead of mixing it into the safe cleanup

**Files:**
- No runtime code changes in this task.

**Interfaces:**
- Produces: explicit follow-up scope for a later behavior-preserving renderer cleanup.

- [ ] **Step 1: Keep pure model relocation as follow-up**

Candidates currently living at feature roots include `voices/voice-filters.ts`, `generation/generation-status.ts`, `generation/media-review-policy.ts`, `storyboard/storyboard-review.ts`, `editor/editor-mutation-state.ts`, `editor/editor-timeline.ts`, `editor/preview-playback.ts`, and production planner/history helpers. These should move under feature `model/` folders only together with import/test updates.

- [ ] **Step 2: Keep raw screen workflow extraction as follow-up**

`VoiceScreen`, `ImagesScreen`, `AssetsScreen`, and `RenderScreen` still own raw API/native multi-step workflows that the newer Storyboard/Editor/Chapters architecture delegates to feature query/mutation modules. Extract these in separate behavior-characterized changes with Desktop runtime verification.

- [ ] **Step 3: Preserve intentional compatibility**

Do not remove PR #350's legacy audio-label compatibility path without a separate contract audit; it was intentionally retained while other chapter-audio legacy state was removed.
