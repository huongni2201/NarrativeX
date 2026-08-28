# Desktop Renderer Feature Boundaries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Desktop Storyboard, Editor, and Chapters renderer hotspots so UI composition, React Query server-state orchestration, pure feature logic, native capability calls, and persistence responsibilities follow the current NarrativeX renderer documentation without changing user-visible behavior or backend/IPC contracts.

**Architecture:** Follow `documentation/codebase/DESKTOP_RENDERER_STRUCTURE.md` as the implementation structure: feature-local `screens/`, `components/`, `queries/`, `api/`, `model/`, and `store/` only when needed. React Query owns server state; screens may compose feature queries/mutations and local UI state but do not directly perform raw backend transport or hide large multi-step provider/media workflows inline. Gemini Web remains a renderer-owned serial queue while Chrome/CDP/filesystem work stays in Electron main behind the typed preload bridge per ADR-0021.

**Tech Stack:** Electron, React 19, TypeScript 7, TanStack Query 5, Zustand 5, Node test runner (`node --test`).

**Spec:** `docs/superpowers/specs/2026-08-28-desktop-renderer-clean-architecture-design.md`

## Global Constraints

- Current code + Flyway migrations + automated tests are authoritative for AS-IS behavior.
- Accepted ADRs decide intentional cross-cutting boundaries; in scope, ADR-0010 and ADR-0021 are mandatory.
- `app/desktop` is the only editor client.
- Renderer owns UI/routing/query/editor state only; no unrestricted Node, filesystem, process, CDP, or credential access.
- React Query owns backend/server state and invalidation.
- Zustand/store modules are only for client state that must survive component boundaries and is not backend-authoritative.
- Do not mirror backend Storyboard, Chapter, Asset, or Production entities into Zustand.
- Preserve current route behavior, UI behavior, backend contracts, typed preload contracts, and local-first media semantics.
- Gemini All is a renderer-owned serial queue; stopping does not promise cancellation of an already-running Chrome generation.
- Gemini generated image flow remains: backend prompt/context -> main-owned Gemini Web provider boundary -> selection token -> backend `LOCAL_ONLY` asset registration -> trusted main commit -> beat media selection.
- No broad UI redesign in this refactor.
- Desktop verification command: `cd app/desktop && npm test && npm run type-check && npm run build` after dependencies are present; before merge run the repository gate from `CONTRIBUTING.md` when environment supports it.
- Runtime UI verification is required before claiming the affected Desktop UI flows fully verified.

---

## File Structure Locked by This Plan

### Storyboard

- Modify: `app/desktop/src/renderer/features/storyboard/screens/StoryboardScreen.tsx` — route-level composition, local selection/form state, callback wiring only.
- Create: `app/desktop/src/renderer/features/storyboard/queries/storyboard.queries.ts` — Storyboard query key, query hook, create/review/approve mutations and invalidation.
- Create: `app/desktop/src/renderer/features/storyboard/queries/storyboard-media.mutations.ts` — Gemini Web/manual image registration, materialization, trusted commit, beat media selection, invalidation.
- Create: `app/desktop/src/renderer/features/storyboard/model/gemini-queue.ts` — pure queue types/transitions/selectors.
- Create: `app/desktop/src/renderer/features/storyboard/store/gemini-queue.persistence.ts` — scoped browser persistence adapter for the renderer-owned queue.
- Create: `app/desktop/src/renderer/features/storyboard/components/StoryboardHeader.tsx` — chapter/provider/status controls currently embedded in screen.
- Create: `app/desktop/src/renderer/features/storyboard/components/SceneRail.tsx` — scene navigation/list.
- Create: `app/desktop/src/renderer/features/storyboard/components/VisualBeatGrid.tsx` — beat list/grid composition.
- Create: `app/desktop/src/renderer/features/storyboard/components/GeminiQueueBanner.tsx` — queue status/actions.
- Modify or retain: `app/desktop/src/renderer/features/storyboard/storyboard-review.ts` — existing pure review filtering unless moving it under `model/` can be done without import churn.
- Test: `app/desktop/test/storyboard-query-keys.test.mjs`
- Test: `app/desktop/test/storyboard-gemini-queue.test.mjs`
- Test: `app/desktop/test/storyboard-media-workflow.test.mjs`
- Existing regression: `app/desktop/test/storyboard-review-filter.test.mjs`

### Editor

- Modify: `app/desktop/src/renderer/features/editor/EditorScreen.tsx` — remove raw asset/production transport calls and keep workspace composition/local editor interaction state.
- Create: `app/desktop/src/renderer/features/editor/queries/editor-media.mutations.ts` — upload/register/commit/attach/reset/fit mutation hooks and invalidation.
- Create: `app/desktop/src/renderer/features/editor/queries/editor-preview.queries.ts` — remote/local preview URL resolution through stable asset contracts.
- Create: `app/desktop/src/renderer/features/editor/model/editor-media-state.ts` — pure stale-request/busy-state transitions only if existing helper cannot be reused.
- Test: `app/desktop/test/editor-media-workflow.test.mjs`
- Existing regression: `app/desktop/test/editor-mutation-state.test.mjs`
- Existing regression: `app/desktop/test/local-asset-preview-url.test.mjs`

### Chapters

- Modify: `app/desktop/src/renderer/features/chapters/screens/ChaptersScreen.tsx` — keep route/form/list composition and consume semantic analysis state/actions.
- Modify: `app/desktop/src/renderer/features/chapters/queries/chapters.queries.ts` — retain Chapter server-state hooks and centralized keys.
- Create: `app/desktop/src/renderer/features/chapters/queries/chapter-analysis.queries.ts` — analyze mutation, job polling/terminal-state mapping and query invalidation.
- Create: `app/desktop/src/renderer/features/chapters/model/chapter-analysis.ts` — pure terminal/progress/error state derivation.
- Test: `app/desktop/test/chapter-analysis-state.test.mjs`
- Test: `app/desktop/test/chapter-analysis-query-keys.test.mjs`

### Architecture documentation/tests

- Modify: `docs/superpowers/specs/2026-08-28-desktop-renderer-clean-architecture-design.md` — align the earlier design with the now-canonical renderer folder/boundary guideline; remove any wording that mandates controller/service folders.
- Modify: `app/desktop/test/feature-boundaries.test.mjs` — add source-level guards that prevent direct raw API imports in the three refactored screens and prevent unrestricted renderer native access.

---

### Task 1: Align the refactor spec with current renderer documentation

**Files:**
- Modify: `docs/superpowers/specs/2026-08-28-desktop-renderer-clean-architecture-design.md`

**Interfaces:**
- Consumes: `documentation/README.md`, `documentation/codebase/DESKTOP_RENDERER_STRUCTURE.md`, ADR-0010, ADR-0021.
- Produces: a non-conflicting refactor spec used by all later tasks.

- [ ] **Step 1: Replace mandatory controller/service folder language**

Use the canonical feature layout:

```text
features/<feature>/
  api/         # raw backend transport
  queries/     # React Query queries/mutations/cache policy and feature workflow hooks
  model/       # deterministic state/selectors/helpers
  components/  # feature presentation
  screens/     # route containers/orchestration
  store/       # optional client-only state/persistence
```

Document that screens may compose query/mutation hooks and ephemeral local state, but raw backend transport and large multi-step provider/media workflows should not remain inline when they can be isolated in feature query/mutation modules.

- [ ] **Step 2: State the Gemini boundary exactly**

Add the invariant:

```text
Renderer serial queue -> typed preload Gemini capability -> selection token
-> backend LOCAL_ONLY asset registration -> typed preload commit
-> backend beat media selection
```

Chrome/CDP/filesystem details remain Electron-main-only.

- [ ] **Step 3: Commit the documentation alignment**

```bash
git add docs/superpowers/specs/2026-08-28-desktop-renderer-clean-architecture-design.md
git commit -m "docs: align renderer refactor with current boundaries"
```

### Task 2: Characterize and extract Storyboard query/cache behavior

**Files:**
- Create: `app/desktop/src/renderer/features/storyboard/queries/storyboard.queries.ts`
- Modify: `app/desktop/src/renderer/features/storyboard/screens/StoryboardScreen.tsx`
- Test: `app/desktop/test/storyboard-query-keys.test.mjs`

**Interfaces:**
- Consumes: `storyboardApi`, existing `storyboardQueryKey(projectId, chapterId)` semantics.
- Produces:

```ts
export const storyboardKeys = {
  chapter(projectId: string, chapterId: string): readonly unknown[];
};

export function useStoryboard(projectId: string, chapterId: string | null): UseQueryResult<StoryboardResponse>;
export function useCreateVisualBeat(projectId: string, chapterId: string | null): UseMutationResult<...>;
export function useUpdateVisualBeatReview(projectId: string, chapterId: string | null): UseMutationResult<...>;
export function useApproveVisualBeats(projectId: string, chapterId: string | null): UseMutationResult<...>;
```

- [ ] **Step 1: Write the failing query-key test**

Create a source-contract test that imports the query module and asserts stable key identity:

```js
assert.deepEqual(
  storyboardKeys.chapter("project-1", "chapter-1"),
  ["projects", "project-1", "storyboard", "chapter-1"],
);
```

- [ ] **Step 2: Run the targeted test and confirm it fails**

```bash
cd app/desktop
node --experimental-strip-types --experimental-transform-types --test test/storyboard-query-keys.test.mjs
```

Expected: module/function missing.

- [ ] **Step 3: Implement `storyboard.queries.ts`**

Move the Storyboard `useQuery`, create-beat mutation, review mutation, approve-all mutation, and Storyboard invalidation policy out of `StoryboardScreen.tsx`. Keep user-facing notices/form resets in the screen callback layer where they are presentation behavior.

- [ ] **Step 4: Rewire `StoryboardScreen.tsx`**

Replace direct `useQuery`, `useMutation`, `useQueryClient`, and direct `storyboardApi` CRUD/review usage with the new hooks. Preserve existing mutation payloads and row-version handling.

- [ ] **Step 5: Run targeted + existing Storyboard tests**

```bash
npm test -- --test-name-pattern="storyboard"
```

If the npm script does not forward the filter correctly, run the two exact Node test files directly.

- [ ] **Step 6: Commit**

```bash
git add app/desktop/src/renderer/features/storyboard/queries/storyboard.queries.ts app/desktop/src/renderer/features/storyboard/screens/StoryboardScreen.tsx app/desktop/test/storyboard-query-keys.test.mjs
git commit -m "refactor(desktop): isolate storyboard query behavior"
```

### Task 3: Extract the Gemini queue into pure model + persistence adapter

**Files:**
- Create: `app/desktop/src/renderer/features/storyboard/model/gemini-queue.ts`
- Create: `app/desktop/src/renderer/features/storyboard/store/gemini-queue.persistence.ts`
- Modify: `app/desktop/src/renderer/features/storyboard/screens/StoryboardScreen.tsx`
- Test: `app/desktop/test/storyboard-gemini-queue.test.mjs`

**Interfaces:**
- Produces:

```ts
export type GeminiQueueStatus = "RUNNING" | "PAUSED" | "COMPLETED";
export type GeminiQueueState = {
  chapterId: string;
  beatIds: string[];
  completedBeatIds: string[];
  skippedBeatIds: string[];
  currentIndex: number;
  status: GeminiQueueStatus;
};

export function restoreQueueForSession(state: GeminiQueueState): GeminiQueueState;
export function reconcileQueue(state: GeminiQueueState, validBeatIds: ReadonlySet<string>): GeminiQueueState | null;
export function markQueueBeatCompleted(state: GeminiQueueState, beatId: string): GeminiQueueState;
export function markQueueBeatSkipped(state: GeminiQueueState, beatId: string): GeminiQueueState;
export function geminiQueueStorageKey(projectId: string, chapterId: string): string;
export function loadGeminiQueue(projectId: string, chapterId: string): GeminiQueueState | null;
export function saveGeminiQueue(projectId: string, chapterId: string, state: GeminiQueueState | null): void;
```

- [ ] **Step 1: Write failing pure transition tests**

Cover restore (`RUNNING` becomes `PAUSED`), invalid beat reconciliation, completion advancement, skip advancement, and completed terminal state.

- [ ] **Step 2: Run the queue test and verify failure**

```bash
cd app/desktop
node --experimental-strip-types --experimental-transform-types --test test/storyboard-gemini-queue.test.mjs
```

- [ ] **Step 3: Implement pure model transitions**

No React, Query, API, Electron bridge, or localStorage imports in `model/gemini-queue.ts`.

- [ ] **Step 4: Implement persistence adapter**

`store/gemini-queue.persistence.ts` owns JSON parsing, storage-key construction, save/remove, and malformed-payload fallback. It may use renderer `localStorage`; the screen may not.

- [ ] **Step 5: Rewire the screen**

Replace inline queue types, key helper, JSON parsing, `localStorage.getItem/setItem/removeItem`, and queue reconciliation mutation code with the model/store functions. Preserve serial behavior and the rule that a running queue restores as paused after renderer restart.

- [ ] **Step 6: Run tests and commit**

```bash
npm test

git add app/desktop/src/renderer/features/storyboard/model/gemini-queue.ts app/desktop/src/renderer/features/storyboard/store/gemini-queue.persistence.ts app/desktop/src/renderer/features/storyboard/screens/StoryboardScreen.tsx app/desktop/test/storyboard-gemini-queue.test.mjs
git commit -m "refactor(desktop): isolate Gemini queue state"
```

### Task 4: Extract Storyboard media/Gemini mutation workflow

**Files:**
- Create: `app/desktop/src/renderer/features/storyboard/queries/storyboard-media.mutations.ts`
- Modify: `app/desktop/src/renderer/features/storyboard/screens/StoryboardScreen.tsx`
- Test: `app/desktop/test/storyboard-media-workflow.test.mjs`

**Interfaces:**
- Produces:

```ts
export type StoryboardImageSelection = {
  selectionToken: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256: string;
  kind: "IMAGE" | "AUDIO" | "VIDEO" | "OTHER";
};

export function useAttachStoryboardImage(projectId: string, chapterId: string | null): ...;
export function useGenerateGeminiStoryboardImage(projectId: string, chapterId: string | null): ...;
```

The Gemini mutation input contains the beat and a callback/phase sink only if needed for UI status text. Backend/native sequencing stays inside the mutation implementation.

- [ ] **Step 1: Write a failing source/workflow contract test**

Assert the extracted module contains the required sequence identifiers and that `StoryboardScreen.tsx` no longer imports `assetsApi` or `productionApi` directly.

- [ ] **Step 2: Run the targeted test and verify failure**

```bash
cd app/desktop
node --experimental-strip-types --experimental-transform-types --test test/storyboard-media-workflow.test.mjs
```

- [ ] **Step 3: Implement manual image attach mutation**

Keep the current contract:

```text
validate IMAGE
-> assetsApi.registerLocal(... type IMAGE ...)
-> trusted commitSelectedAsset(selectionToken)
-> productionApi.updateBeatMedia(... fitMode TRIM, trimStartMs 0)
-> invalidate timeline + storyboard + asset library
```

- [ ] **Step 4: Implement Gemini image mutation**

Keep ADR-0021 sequence:

```text
storyboardApi.geminiContext
-> materialize each reference with typed localStorage bridge
-> build prompt from beat prompt + context.promptContext
-> window.narrativex.geminiWeb.generateImage
-> backend LOCAL_ONLY asset registration
-> window.narrativex.geminiWeb.commitImage
-> productionApi.updateBeatMedia
-> invalidate timeline/storyboard/assets
```

Keep the per-session materialized-reference set inside the feature hook/module or supplied ref; do not move it into backend-authoritative state.

- [ ] **Step 5: Rewire screen callbacks**

`generateWithGemini`, queue runner, and manual import handlers should call semantic mutations/actions rather than backend/native APIs directly. Presentation notices remain in the screen.

- [ ] **Step 6: Run Storyboard/Gemini regression tests**

```bash
npm test
npm run type-check
```

- [ ] **Step 7: Commit**

```bash
git add app/desktop/src/renderer/features/storyboard/queries/storyboard-media.mutations.ts app/desktop/src/renderer/features/storyboard/screens/StoryboardScreen.tsx app/desktop/test/storyboard-media-workflow.test.mjs
git commit -m "refactor(desktop): isolate storyboard media workflows"
```

### Task 5: Split large Storyboard presentation regions into focused components

**Files:**
- Create: `app/desktop/src/renderer/features/storyboard/components/StoryboardHeader.tsx`
- Create: `app/desktop/src/renderer/features/storyboard/components/SceneRail.tsx`
- Create: `app/desktop/src/renderer/features/storyboard/components/VisualBeatGrid.tsx`
- Create: `app/desktop/src/renderer/features/storyboard/components/GeminiQueueBanner.tsx`
- Modify: `app/desktop/src/renderer/features/storyboard/screens/StoryboardScreen.tsx`
- Test: `app/desktop/test/feature-boundaries.test.mjs`

**Interfaces:**
- Components consume explicit props only; they do not import backend API modules, queryClient, or Electron bridge workflows.

- [ ] **Step 1: Extend boundary test with failing Storyboard assertions**

Assert `StoryboardScreen.tsx` has no imports of `../../assets/api/assets.api`, `../../production/api/production.api`, and no direct `localStorage.` usage after Tasks 2-4.

- [ ] **Step 2: Extract presentation regions without visual redesign**

Move independently understandable JSX regions into the four components. Preserve class names, labels, event ordering, disabled states, and existing accessibility attributes.

- [ ] **Step 3: Keep screen responsibilities**

The screen retains chapter/scene selection, create-beat form values, review filter, presentation notice text, and queue-run coordination because current docs explicitly allow route-level orchestration and ephemeral local state.

- [ ] **Step 4: Run tests/type-check and commit**

```bash
npm test
npm run type-check

git add app/desktop/src/renderer/features/storyboard/components app/desktop/src/renderer/features/storyboard/screens/StoryboardScreen.tsx app/desktop/test/feature-boundaries.test.mjs
git commit -m "refactor(desktop): split storyboard presentation"
```

### Task 6: Extract Editor media mutations and preview resolution

**Files:**
- Create: `app/desktop/src/renderer/features/editor/queries/editor-media.mutations.ts`
- Create: `app/desktop/src/renderer/features/editor/queries/editor-preview.queries.ts`
- Modify: `app/desktop/src/renderer/features/editor/EditorScreen.tsx`
- Test: `app/desktop/test/editor-media-workflow.test.mjs`
- Modify: `app/desktop/test/feature-boundaries.test.mjs`

**Interfaces:**
- Produces semantic actions for upload/select/reset/fit and preview URL resolution while preserving existing `productionApi` payloads and native selection/commit contracts.

- [ ] **Step 1: Write failing Editor boundary/workflow tests**

Assert `EditorScreen.tsx` no longer imports `assetsApi` or `productionApi` directly and no longer performs `assetsApi.downloadUrl(...)` in an effect.

- [ ] **Step 2: Move preview resolution to `editor-preview.queries.ts`**

Expose a query/helper that resolves remote asset preview URLs through the existing asset contract and preserves local preview handling.

- [ ] **Step 3: Move media mutation sequence to `editor-media.mutations.ts`**

Preserve:

```text
native select
-> registerLocal
-> trusted commit
-> existing media-fit choice
-> production beat media update
-> relevant invalidation
```

Also move reset/fit/update variants that currently call `productionApi` directly from the screen.

- [ ] **Step 4: Preserve stale mutation protection**

Keep the existing request-token/ref behavior or move its deterministic transition logic to `model/editor-media-state.ts` if extraction makes it clearer. Do not allow an older async completion to overwrite newer UI state.

- [ ] **Step 5: Run Editor tests**

```bash
npm test
npm run type-check
```

- [ ] **Step 6: Commit**

```bash
git add app/desktop/src/renderer/features/editor app/desktop/test/editor-media-workflow.test.mjs app/desktop/test/feature-boundaries.test.mjs
git commit -m "refactor(desktop): isolate editor media orchestration"
```

### Task 7: Extract Chapter analysis job orchestration

**Files:**
- Create: `app/desktop/src/renderer/features/chapters/model/chapter-analysis.ts`
- Create: `app/desktop/src/renderer/features/chapters/queries/chapter-analysis.queries.ts`
- Modify: `app/desktop/src/renderer/features/chapters/screens/ChaptersScreen.tsx`
- Modify: `app/desktop/src/renderer/features/chapters/queries/chapters.queries.ts` only if shared key helpers must be exported.
- Test: `app/desktop/test/chapter-analysis-state.test.mjs`
- Test: `app/desktop/test/chapter-analysis-query-keys.test.mjs`
- Modify: `app/desktop/test/feature-boundaries.test.mjs`

**Interfaces:**
- Produces semantic analysis state:

```ts
export type ChapterAnalysisUiState = {
  isAnalyzing: boolean;
  isTerminal: boolean;
  canAnalyze: boolean;
  message: string | null;
};

export function deriveChapterAnalysisUiState(job: GenerationJob | null, mutationPending: boolean): ChapterAnalysisUiState;
export function useChapterAnalysis(projectId: string, chapterId: string | null): {
  analyze(): Promise<void>;
  job: GenerationJob | null;
  isAnalyzing: boolean;
  canAnalyze: boolean;
  error: unknown;
};
```

- [ ] **Step 1: Write failing pure state tests**

Cover idle, pending, running, completed, failed/cancelled terminal states using the existing generation job status vocabulary from current code/contracts.

- [ ] **Step 2: Implement `model/chapter-analysis.ts`**

No React, API, Query or navigation imports.

- [ ] **Step 3: Write failing query-key/polling contract test**

Assert job keys are stable and terminal states stop polling according to current generation query behavior.

- [ ] **Step 4: Implement `chapter-analysis.queries.ts`**

Move the direct `generationApi.analyze` mutation, job polling composition, terminal state mapping and relevant invalidations out of `ChaptersScreen.tsx`. Reuse existing generation query primitives rather than creating duplicate polling infrastructure.

- [ ] **Step 5: Rewire `ChaptersScreen.tsx`**

Keep editing/create/filter/sort/pagination form state and user-facing notices in the screen. Consume semantic `isAnalyzing`, `canAnalyze`, `job`, and `analyze()` from the new hook.

- [ ] **Step 6: Run Chapter tests and commit**

```bash
npm test
npm run type-check

git add app/desktop/src/renderer/features/chapters app/desktop/test/chapter-analysis-state.test.mjs app/desktop/test/chapter-analysis-query-keys.test.mjs app/desktop/test/feature-boundaries.test.mjs
git commit -m "refactor(desktop): isolate chapter analysis orchestration"
```

### Task 8: Full verification and source-level architecture guard

**Files:**
- Modify: `app/desktop/test/feature-boundaries.test.mjs`
- Modify: renderer docs only if implementation discovered a factual drift.

**Interfaces:**
- Produces a merge-ready branch whose three hotspots follow the documented renderer boundary.

- [ ] **Step 1: Add final boundary assertions**

Check the three screens for direct raw API imports that were intentionally removed. Keep the test narrow: do not prohibit documented screen composition of query/mutation hooks or typed preload capability invocation generally.

- [ ] **Step 2: Run Desktop quality gate**

```bash
cd app/desktop
npm test
npm run type-check
npm run build
```

Expected: all pass.

- [ ] **Step 3: Run repository local gate when supported**

From repository root:

```powershell
pwsh -File scripts/verify-local.ps1
```

If PowerShell/runtime dependencies are unavailable in the execution environment, record that limitation explicitly rather than claiming it passed.

- [ ] **Step 4: Runtime UI verification**

Launch the Electron/Vite environment and exercise:

```text
Storyboard: chapter/scene selection, review filter, create beat, approve/reject,
manual image import, single Gemini generation, Gemini All start/pause/resume/skip.

Editor: asset preview, import/attach, fit/reset/update, stale mutation behavior.

Chapters: create/edit/select, Analyze duplicate-submit protection,
analysis running/terminal/error presentation.
```

Inspect renderer console/network errors and verify no clipped/loading/error regressions. If the environment cannot launch the Desktop runtime, explicitly mark runtime verification as blocked.

- [ ] **Step 5: Final diff review**

Confirm:

```text
no backend/API/IPC contract changes
no renderer access to arbitrary filesystem/process/CDP
no backend entity mirrored into Zustand
no UI redesign hidden inside refactor
no direct localStorage use left in StoryboardScreen
no direct assetsApi/productionApi use left in StoryboardScreen or EditorScreen
no direct generationApi.analyze orchestration left in ChaptersScreen
```

- [ ] **Step 6: Commit any final test/doc cleanup**

```bash
git add app/desktop/test/feature-boundaries.test.mjs documentation docs app/desktop/src/renderer
git commit -m "test(desktop): enforce renderer feature boundaries"
```
