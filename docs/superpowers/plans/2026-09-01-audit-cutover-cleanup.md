# Audit Cutover Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current audit branch green and finish the remaining local-first and renderer-boundary cleanup without restoring legacy runtime behavior.

**Architecture:** Preserve the existing backend/worker/Desktop authorities. Tests are updated to the current local-final-artifact contract, Desktop project media loses the last storage-mode abstraction, and Assets/Characters screens delegate native/backend/cache workflows to semantic feature hooks.

**Tech Stack:** Java 25/Spring/MyBatis/JUnit, Python 3.12/Pydantic/Ruff/mypy/pytest, Electron/React 19/TypeScript/TanStack Query/Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-01-audit-cutover-cleanup-design.md`

## Global Constraints

- Do not restore backend final-artifact content/download URLs.
- Do not restore project-media R2 fallback, dual write, or `storageMode` branching.
- Preserve current user-visible UI and serial Gemini queue semantics.
- Preserve intentional source-anchor/audio-timing compatibility seams.
- Do not force Electron `sandbox: true` in this tranche without runtime smoke verification.
- New production workflow code must have a failing regression/source-boundary test first.

---

### Task 1: Repair stale CI contracts

**Files:**
- Modify: `app/backend-service/src/test/java/com/narrativex/backend/feature/storyboard/api/StoryboardApiIntegrationTest.java`
- Modify: `app/ai-worker/tests/test_contract_boundaries.py`

**Interfaces:**
- Consumes: current `FinalArtifactResponse.from()` metadata-only behavior.
- Produces: Backend Verify and Ruff expectations aligned to current production contracts.

- [ ] Change Storyboard final-artifact assertions to `previewAvailable=false`, absent preview URL, `downloadAvailable=false`, absent download URL.
- [ ] Keep assertions proving removed remote credential/file-id fields remain absent.
- [ ] Sort the Python contract-boundary test imports exactly as Ruff expects.
- [ ] Verify targeted tests/checks, then full backend/worker checks.

### Task 2: Remove Desktop storage-mode residue and stale fixture vocabulary

**Files:**
- Modify: `app/desktop/src/main/local-execution/backend-client.ts`
- Modify: `app/desktop/test/render-readiness.test.mjs`
- Modify: `app/desktop/test/auto-edit-planner.test.mjs`
- Modify: `app/desktop/test/preview-playback.test.mjs`
- Modify any additional Desktop fixture found by repository search that still supplies `storageMode`.
- Modify stale test fixtures using `assetStrategy: "GENERATE"` to current `GENERATE_NEW` where the fixture represents the production contract.
- Modify: `app/desktop/test/project-local-storage-mode.test.mjs` or `device-local-project-isolation.test.mjs` to guard the main local-execution contract too.

**Interfaces:**
- Consumes: project-media implicit-local invariant.
- Produces: `ClaimedProjectRenderBeat` and Desktop fixtures without storage-mode branching.

- [ ] Add/extend a source-level failing test that checks `src/main/local-execution/backend-client.ts` contains no `storageMode`, `REMOTE`, `LOCAL_ONLY`, or `HYBRID` project-media branch.
- [ ] Remove `storageMode` from the local render beat type and all affected fixtures.
- [ ] Normalize stale `GENERATE` fixture values to `GENERATE_NEW` where appropriate.
- [ ] Run Desktop tests/type-check/build.

### Task 3: Remove unused MediaBeatPlan compatibility constructors

**Files:**
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/domain/value/MediaBeatPlan.java`
- Modify: `app/backend-service/src/test/java/com/narrativex/backend/feature/generation/domain/aggregate/MediaPlanTest.java`
- Add/modify an architecture/domain source test proving compatibility constructors are absent if needed.

**Interfaces:**
- Consumes: canonical record constructor used by `CreateMediaPlanUseCase`.
- Produces: one current construction contract, with tests supplying complete explicit values.

- [ ] Write/extend a failing test that rejects the legacy constructor comment/signature.
- [ ] Replace test-only short construction with full canonical construction or a test helper local to the test source set.
- [ ] Remove compatibility overloads not used by production callers.
- [ ] Run domain tests and backend verify.

### Task 4: Move Assets workflow behind feature hooks

**Files:**
- Create: `app/desktop/src/renderer/features/assets/queries/asset-local-state.queries.ts`
- Create: `app/desktop/src/renderer/features/assets/queries/asset-media.mutations.ts`
- Modify: `app/desktop/src/renderer/features/assets/screens/AssetsScreen.tsx`
- Modify: `app/desktop/test/feature-boundaries.test.mjs`
- Add targeted asset workflow tests as needed.

**Interfaces:**
- Produces:
  - `useProjectAssetLocalStates(projectId, assetIds)`
  - `useImportProjectAsset(projectId)`
  - `useRepairProjectAsset(projectId)` or one semantic mutation supporting optional repair target.
- Hooks own `assetsApi.registerLocal`, typed `window.narrativex.localStorage` calls, and asset-library invalidation.

- [ ] Add a failing boundary test asserting `AssetsScreen` does not import `useQueryClient`/`assetsApi` and does not directly call localStorage select/commit/repair/verify.
- [ ] Implement focused query/mutation hooks preserving selection-cancel and error semantics.
- [ ] Rewire screen to presentation state only.
- [ ] Run targeted boundary/workflow tests and full Desktop checks.

### Task 5: Move Characters generation workflow behind feature hooks

**Files:**
- Create: `app/desktop/src/renderer/features/characters/queries/character-generation.mutations.ts`
- Create: `app/desktop/src/renderer/features/characters/queries/character-gemini-queue.ts` or equivalent focused hook module.
- Modify: `app/desktop/src/renderer/features/characters/screens/CharactersScreen.tsx`
- Modify: `app/desktop/test/feature-boundaries.test.mjs`
- Add targeted character generation/queue tests.

**Interfaces:**
- Produces semantic generation action returning `generated | skipped | failed` plus notice text/details needed by presentation.
- Queue hook owns serial execution, reconciliation, persistence publication, stop/resume/skip semantics, and uses the pure existing queue model/store.

- [ ] Add a failing boundary test asserting `CharactersScreen` does not import `useQueryClient` or raw `charactersApi`, and does not call `generateCharacterIdentityReference` directly.
- [ ] Extract single-character generation workflow with cache invalidation.
- [ ] Extract serial queue runner while preserving run-token cancellation semantics.
- [ ] Rewire screen to selection/search/forms/notice presentation and semantic callbacks.
- [ ] Run character tests and full Desktop checks.

### Task 6: Move narration invalidation into the owning mutation hook

**Files:**
- Modify: `app/desktop/src/renderer/features/generation/queries/narration.queries.ts`
- Modify: `app/desktop/src/renderer/features/chapters/screens/ChaptersScreen.tsx`
- Modify/add query-boundary tests.

**Interfaces:**
- `useGenerateNarration` and batch narration mutations invalidate the required chapter/timeline/narration caches after success.

- [ ] Add a failing source/query test proving ChaptersScreen does not manually invalidate narration mutation results.
- [ ] Move invalidation policy into narration query hooks.
- [ ] Remove screen-level `useQueryClient` if no longer needed for another responsibility; otherwise remove only narration invalidation.
- [ ] Run chapter/narration and full Desktop checks.

### Task 7: Final verification and branch cleanup

**Files:**
- Modify docs only if implementation changes an AS-IS contract described by maintained documentation.

**Interfaces:**
- Produces an exact final head with green repository gates, Desktop check, Backend verify, and AI worker checks.

- [ ] Run/observe repository gates.
- [ ] Run/observe Desktop `npm test && npm run type-check && npm run build`.
- [ ] Run/observe backend `mvn verify`.
- [ ] Run/observe worker tests + Ruff + mypy.
- [ ] Confirm no `storageMode` remains in current Desktop project-media production contracts.
- [ ] Confirm no backend final video content/download path was restored.
- [ ] Keep `sandbox:false` documented as the remaining runtime compatibility exception rather than claiming it fixed.
