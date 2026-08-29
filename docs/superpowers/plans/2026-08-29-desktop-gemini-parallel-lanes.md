# Desktop Gemini Parallel Lanes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved Desktop Gemini parallel-lanes design so Character and Storyboard generation use isolated tabs and resources, while Storyboard Generate All accurately persists and restores progress.

**Architecture:** Keep one Electron-owned Chrome process/profile and refactor `GeminiWebAutomation` into a shared host with two lane states (`CHARACTER` and `STORYBOARD`). Each lane owns its target id, busy lock, CDP/network tracker, capture baseline, and download directory; the renderer passes a required lane discriminator. Keep the Storyboard queue renderer-owned, but publish every transition to project/chapter local storage synchronously so it survives screen unmounts. Treat React Query invalidation as a handled background refresh after durable image persistence.

**Tech Stack:** Electron main/preload IPC, TypeScript, Chrome DevTools Protocol, React, TanStack Query, Node `node:test`, Vite desktop build.

**Spec:** `docs/superpowers/specs/2026-08-29-desktop-gemini-parallel-lanes-design.md`

## Global Constraints

- Use one visible Chrome process/profile and two logical Gemini lanes; never launch two Chrome processes against the shared profile.
- `GeminiWebGenerateImageInput.lane` is required and is exactly `CHARACTER` or `STORYBOARD`; missing/unknown values are rejected without a default lane.
- Character and Storyboard never share Gemini target ids, active locks, CDP trackers, capture baselines, or download directories.
- Persist lane target ids with the shared CDP port and discard/recreate stale targets independently.
- Durable ProjectStorage registration/commit/attachment is generation success; cache invalidation is best-effort background work and cannot reject or pause a successful generation.
- Storyboard queue transitions publish to local project/chapter storage even after `StoryboardScreen` unmounts; approved beats are excluded or skipped.
- Do not introduce a browser editor, provider SDK, backend queue, broker, Redis dependency, or runtime mock data.
- Preserve sender-bound, operation-bound, short-lived, single-use selection tokens and record the lane on staged selections.

---

### Task 1: Add the typed lane contract and enforce lane-aware call sites

**Files:**
- Modify: `app/desktop/src/preload/types.ts:115-123,227-233` to export `GeminiWebLane`, require `lane` on `GeminiWebGenerateImageInput`, and require it on the Gemini commit input used by both renderer features.
- Modify: `app/desktop/src/main/gemini-web/gemini-web-ipc.ts:17-55,115-171` to validate the discriminator, include it in staged selection values, and verify the commit input lane matches the staged lane before consuming it.
- Modify: `app/desktop/src/renderer/features/characters/services/character-reference-generation.ts:37-83` so both Character Gemini calls send `lane: "CHARACTER"`.
- Modify: `app/desktop/src/renderer/features/storyboard/queries/storyboard-media.mutations.ts:27-43,134-217` so Storyboard generation and commit calls send `lane: "STORYBOARD"`.
- Modify: `app/desktop/src/renderer/features/storyboard/queries/storyboard-media.queries.ts:34-42` if the shared persistence dependency type needs the lane field.
- Test: `app/desktop/test/gemini-web-lanes.test.mjs` (create) for accepted/rejected lane payloads, staged-lane mismatch, and renderer call-site literals.

**Interfaces:**
- Produces `GeminiWebLane = "CHARACTER" | "STORYBOARD"` and `GeminiWebGenerateImageInput { lane, projectId?, prompt, references? }` for preload/main/renderer.
- Produces `GeminiWebCommitImageInput { lane, projectId, assetId, selectionToken }`; staged selections store `{ sourcePath, lane }`.
- Main IPC calls `automation.generateImage(input.lane, input.prompt, references)` and rejects invalid lane input before reference resolution.

- [ ] **Step 1: Write the failing contract tests**

```js
test("generation input requires an explicit supported lane", () => {
  const source = readFileSync("../src/main/gemini-web/gemini-web-ipc.ts", "utf8");
  assert.match(source, /CHARACTER.*STORYBOARD/);
  assert.match(source, /input\.lane/);
  assert.doesNotMatch(source, /input\.lane\s*\?\?/);
});

test("Character and Storyboard send their own lane", () => {
  assert.match(readFileSync("../src/renderer/features/characters/services/character-reference-generation.ts", "utf8"), /lane:\s*["']CHARACTER["']/);
  assert.match(readFileSync("../src/renderer/features/storyboard/queries/storyboard-media.mutations.ts", "utf8"), /lane:\s*["']STORYBOARD["']/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run from `app/desktop`: `node --experimental-strip-types --experimental-transform-types --test test/gemini-web-lanes.test.mjs`

Expected: FAIL because the current preload input has no lane, IPC accepts arbitrary payloads, and neither call site supplies a lane.

- [ ] **Step 3: Implement the minimal typed contract and validation**

Add a shared lane type in preload types, make the renderer API commit signature explicit, and use a runtime guard equivalent to:

```ts
function isGeminiLane(value: unknown): value is GeminiWebLane {
  return value === "CHARACTER" || value === "STORYBOARD";
}

function isGenerateInput(value: unknown): value is GeminiGenerateInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  if (!isGeminiLane(input.lane)) return false;
  if (typeof input.prompt !== "string" || !input.prompt.trim()) return false;
  if (input.projectId !== undefined && typeof input.projectId !== "string") return false;
  if (input.references === undefined) return true;
  if (!Array.isArray(input.references) || input.references.length > 3) return false;
  if (input.references.length > 0 && typeof input.projectId !== "string") return false;
  return input.references.every(isReferenceInput);
}
```

When staging, create `{ sourcePath, lane: input.lane }`; on commit, consume the selection only after checking the requested lane equals the staged lane, so a mismatch cannot consume a valid token.

- [ ] **Step 4: Run the focused test and type-check**

Run from `app/desktop`: `node --experimental-strip-types --experimental-transform-types --test test/gemini-web-lanes.test.mjs` and `npm run type-check`.

Expected: PASS with lane validation and both call sites compiling against the required field.

- [ ] **Step 5: Commit the contract change**

```bash
git add app/desktop/src/preload/types.ts app/desktop/src/preload/index.ts app/desktop/src/main/gemini-web/gemini-web-ipc.ts app/desktop/src/renderer/features/characters/services/character-reference-generation.ts app/desktop/src/renderer/features/storyboard/queries/storyboard-media.mutations.ts app/desktop/src/renderer/features/storyboard/queries/storyboard-media.queries.ts app/desktop/test/gemini-web-lanes.test.mjs
git commit -m "feat(desktop): require explicit Gemini generation lanes"
```

### Task 2: Refactor Gemini Web automation into two isolated lanes under one Chrome host

**Files:**
- Create: `app/desktop/src/shared/gemini-web-lanes.ts` for lane constants, persisted target metadata, lane directory mapping, and testable lane state helpers shared by preload, main, and renderer.
- Modify: `app/desktop/src/main/gemini-web/gemini-web-automation.ts:58-70,276-515,1330-1515` to replace global `active`/download state with shared Chrome lifecycle plus per-lane state, target restoration/recreation, lane-scoped CDP/network/download paths, and a startup promise that prevents two Chrome launches against one profile.
- Modify: `app/desktop/src/main/gemini-web/gemini-web-ipc.ts:21-59` to pass the lane through the new automation signature and stop the shared host exactly once.
- Test: `app/desktop/test/gemini-web-lanes.test.mjs` for concurrent lane locks, duplicate same-lane rejection, target persistence/recreation, per-lane directories, and no arbitrary Gemini target fallback.
- Test: `app/desktop/test/gemini-web-network-capture.test.mjs` or a new focused automation test for lane-specific capture/download source selection.

**Interfaces:**
- `GeminiWebAutomation.generateImage(lane: GeminiWebLane, prompt: string, references?: readonly GeminiWebReferenceFile[]): Promise<GeminiWebGenerationResult>`.
- `PersistedSession` becomes `{ port: number; targets?: Partial<Record<GeminiWebLane, string>> }`.
- `LaneState` owns `active`, `targetId`, `downloadDirectory`; `GeminiWebAutomation` owns one Chrome process/profile/port and `Map<GeminiWebLane, LaneState>`.
- `ensureGeminiPage(port, lane)` only returns the persisted/live target for that lane or creates a new Gemini tab for that lane; it never picks another lane's target.

- [ ] **Step 1: Write failing isolation tests**

```js
test("both lanes can be active while duplicate work is rejected only within one lane", () => {
  const source = readFileSync("../src/main/gemini-web/gemini-web-automation.ts", "utf8");
  assert.match(source, /Map<GeminiWebLane/);
  assert.match(source, /CHARACTER/);
  assert.match(source, /STORYBOARD/);
  assert.doesNotMatch(source, /private active = false/);
});

test("lane paths and target metadata are distinct", () => {
  const source = readFileSync("../src/main/gemini-web/gemini-web-automation.ts", "utf8");
  assert.match(source, /lanes[\\/]+character[\\/]+downloads/);
  assert.match(source, /lanes[\\/]+storyboard[\\/]+downloads/);
  assert.match(source, /targets/);
  assert.match(source, /targetId/);
});
```

- [ ] **Step 2: Run the focused isolation tests and verify they fail**

Run from `app/desktop`: `node --experimental-strip-types --experimental-transform-types --test test/gemini-web-lanes.test.mjs`

Expected: FAIL because automation currently has one active flag, one download directory, and selects the first Gemini page.

- [ ] **Step 3: Add lane state and shared-host lifecycle**

Implement `gemini-web-lanes.ts` with:

```ts
export const GEMINI_WEB_LANES = ["CHARACTER", "STORYBOARD"] as const;
export type GeminiWebLane = (typeof GEMINI_WEB_LANES)[number];
export function laneDownloadDirectory(root: string, lane: GeminiWebLane): string {
  return join(root, "lanes", lane.toLowerCase(), "downloads");
}
```

Initialize both lane directories, store each lane's target id, and add `chromeStartPromise` around executable discovery/spawn/port probing. Persist `{ port, targets }` after every target assignment. `stop()` closes the one browser and clears all lane locks/target metadata.

- [ ] **Step 4: Route generation and capture through the requested lane**

Change `generateImage` to acquire only `lanes.get(lane).active`; throw `GEMINI_BUSY` with the lane name if that lock is already held. Connect CDP to the lane target, set `Page.setDownloadBehavior.downloadPath` to that lane's directory, instantiate a lane-local `NetworkImageTracker`, and pass the lane directory into `snapshotDownloads`, fallback capture, and persisted fallback output. Always release only that lane's lock and tracker in `finally`.

- [ ] **Step 5: Implement target restoration/recreation without cross-lane reuse**

Have `ensureGeminiPage(port, lane)` fetch `/json`, first find the persisted target id for the requested lane, then clear that id if stale. If no requested target exists, create exactly one new Gemini tab and persist its id for the requested lane. Do not return an arbitrary page or a target id stored for the other lane. Keep the other lane's target untouched when one lane is recreated.

- [ ] **Step 6: Run automation tests and desktop type-check**

Run from `app/desktop`: `node --experimental-strip-types --experimental-transform-types --test test/gemini-web-lanes.test.mjs test/gemini-web-network-capture.test.mjs` and `npm run type-check`.

Expected: PASS; test assertions show concurrent lane ownership, independent target/download paths, and one shared Chrome startup path.

- [ ] **Step 7: Commit the isolated automation host**

```bash
git add app/desktop/src/shared/gemini-web-lanes.ts app/desktop/src/main/gemini-web/gemini-web-automation.ts app/desktop/src/main/gemini-web/gemini-web-ipc.ts app/desktop/test/gemini-web-lanes.test.mjs app/desktop/test/gemini-web-network-capture.test.mjs
git commit -m "feat(desktop): isolate Gemini Character and Storyboard lanes"
```

### Task 3: Make Storyboard queue transitions durable across unmount and immediate after persistence

**Files:**
- Modify: `app/desktop/src/renderer/features/storyboard/screens/StoryboardScreen.tsx:130-340` to centralize queue publication, persist every transition, keep the runner alive after unmount, and mark a beat completed before checking whether the screen/run token is still current.
- Modify: `app/desktop/src/renderer/features/storyboard/store/gemini-queue.persistence.ts:1-80` only if a small queue-transition publisher helper is needed; keep storage scoped by project/chapter.
- Modify: `app/desktop/src/renderer/features/storyboard/model/gemini-queue.ts:1-120` only if a pure transition helper is needed for testing completion/current-index/progress behavior.
- Test: `app/desktop/test/storyboard-gemini-queue.test.mjs` for durable transition publication and completed-beat advancement.

**Interfaces:**
- Add a screen-local `publishGeminiQueue(next: GeminiQueueState | null, projectId: string, chapterId: string)` that calls both React state setter and `saveGeminiQueue` synchronously.
- All runner transitions call `publishGeminiQueue`; no runner path calls `setGeminiQueue` alone.
- `runGeminiQueue` records a successful `generateGeminiImage` result with `markQueueBeatCompleted` and publishes it before any stale-token/unmounted return.

- [ ] **Step 1: Write failing queue persistence tests**

```js
test("queue transitions publish completion before a stale runner exits", () => {
  const source = readFileSync("../src/renderer/features/storyboard/screens/StoryboardScreen.tsx", "utf8");
  assert.match(source, /saveGeminiQueue/);
  assert.match(source, /markQueueBeatCompleted/);
  assert.match(source, /publishGeminiQueue/);
  assert.match(source, /generated[\\s\\S]*markQueueBeatCompleted/);
});

test("completed queue state restores with the next index", () => {
  const next = markQueueBeatCompleted(queue(), "beat-1");
  assert.equal(next.currentIndex, 1);
  assert.deepEqual(next.completedBeatIds, ["beat-1"]);
});
```

- [ ] **Step 2: Run the queue tests and verify the new publication assertion fails**

Run from `app/desktop`: `node --experimental-strip-types --experimental-transform-types --test test/storyboard-gemini-queue.test.mjs`

Expected: the existing pure transition tests pass, while the new source assertion fails because transitions currently update React state without a centralized synchronous publisher and stale-token handling can return before completion is recorded.

- [ ] **Step 3: Centralize synchronous queue publication**

Implement:

```ts
const publishGeminiQueue = (next: GeminiQueueState | null) => {
  setGeminiQueue(next);
  saveGeminiQueue(projectId, chapterId, next);
};
```

Use it for start, running/current beat, approval skip, completion, pause, stop, and final completed transitions. Keep the load/reconcile effect read-only except for restoring state; it must not erase a newer queue written by a background runner.

- [ ] **Step 4: Record durable success before stale/unmount checks**

After `await generateGeminiImage(...)`, if it resolves, call `markQueueBeatCompleted` and `publishGeminiQueue` first. Only then check the run token to decide whether to submit another beat. If persistence rejects, publish `PAUSED` for the failing beat; if the run was stopped while the prompt was in flight, retain the completed transition but do not submit another beat.

- [ ] **Step 5: Run queue, media, and type tests**

Run from `app/desktop`: `node --experimental-strip-types --experimental-transform-types --test test/storyboard-gemini-queue.test.mjs test/storyboard-media-workflow.test.mjs` and `npm run type-check`.

Expected: PASS with approved exclusion/skip, generated/skipped counts, current index, and restored state all reflecting durable transitions.

- [ ] **Step 6: Commit queue persistence changes**

```bash
git add app/desktop/src/renderer/features/storyboard/screens/StoryboardScreen.tsx app/desktop/src/renderer/features/storyboard/store/gemini-queue.persistence.ts app/desktop/src/renderer/features/storyboard/model/gemini-queue.ts app/desktop/test/storyboard-gemini-queue.test.mjs
git commit -m "fix(desktop): persist Storyboard Gemini queue transitions"
```

### Task 4: Make cache invalidation best-effort after durable media persistence

**Files:**
- Modify: `app/desktop/src/renderer/features/storyboard/queries/storyboard-media.queries.ts:14-28,65-126` to expose a non-blocking refresh helper and replace awaited `onSettled` invalidations.
- Create: `app/desktop/src/renderer/features/storyboard/model/storyboard-media-refresh.ts` for the pure fire-and-handle background refresh wrapper.
- Modify: `app/desktop/src/renderer/features/storyboard/queries/storyboard-media.mutations.ts:1-220` only if the generation dependency needs the explicit `lane: "STORYBOARD"` contract or a durable-success result boundary.
- Test: `app/desktop/test/storyboard-media-workflow.test.mjs` for a refresh rejection that leaves the generation promise resolved and the queue completion path available.

**Interfaces:**
- `refreshStoryboardMediaInBackground(queryClient, projectId, chapterId, context): void` starts `invalidateStoryboardMedia(...).catch(...)` without returning its promise.
- `onSettled` handlers invoke the helper synchronously; `mutateAsync` resolves/rejects solely from durable persistence/generation work.

- [ ] **Step 1: Write the failing refresh-isolation test**

```js
test("cache refresh rejection does not turn durable generation into a failure", async () => {
  const source = readFileSync("../src/renderer/features/storyboard/queries/storyboard-media.queries.ts", "utf8");
  assert.match(source, /refreshStoryboardMediaInBackground/);
  assert.doesNotMatch(source, /onSettled:\s*async/);
});
```

- [ ] **Step 2: Run it and verify it fails**

Run from `app/desktop`: `node --experimental-strip-types --experimental-transform-types --test test/storyboard-media-workflow.test.mjs`

Expected: FAIL because both `onSettled` handlers currently await `invalidateStoryboardMedia`.

- [ ] **Step 3: Implement handled background refresh**

Add:

```ts
export function refreshStoryboardMediaInBackground(
  queryClient: QueryClient,
  projectId: string,
  chapterId: string | null,
  context: string,
): void {
  void invalidateStoryboardMedia(queryClient, projectId, chapterId).catch((error) => {
    console.warn("Storyboard media cache refresh failed", { context, projectId, chapterId, error });
  });
}
```

Call it from import and Gemini `onSettled` without `async`/`await`; preserve durable `persistStoryboardImage` ordering and report the operation context in logs.

- [ ] **Step 4: Run focused workflow tests and type-check**

Run from `app/desktop`: `node --experimental-strip-types --experimental-transform-types --test test/storyboard-media-workflow.test.mjs` and `npm run type-check`.

Expected: PASS; an invalidation rejection is logged but does not reject successful media persistence or pause Generate All.

- [ ] **Step 5: Commit cache refresh changes**

```bash
git add app/desktop/src/renderer/features/storyboard/queries/storyboard-media.queries.ts app/desktop/src/renderer/features/storyboard/queries/storyboard-media.mutations.ts app/desktop/test/storyboard-media-workflow.test.mjs
git commit -m "fix(desktop): decouple Storyboard progress from cache refresh"
```

### Task 5: Verify contracts, build, and real Desktop behavior

**Files:**
- Modify: `documentation/decisions/ADR-0021-desktop-gemini-web-image-generation.md` only if implementation details reveal a wording mismatch with the already amended decision.
- Test: all relevant `app/desktop/test/*.test.mjs` files; no runtime mock replacement.

**Interfaces:**
- The delivered behavior must satisfy the approved spec and the existing preload/main security boundary.

- [ ] **Step 1: Run the narrow automated suite**

Run from `app/desktop`: `npm run check`.

Expected: lock sync, all desktop tests, type-check, and production build pass; any pre-existing environment-only skips are reported.

- [ ] **Step 2: Run repository verification**

Run: `pwsh -File scripts/verify-local.ps1`.

Expected: secret scan and repository checks pass; if the known pre-existing Flyway migration drift still blocks verification, report that exact unrelated baseline failure instead of hiding it.

- [ ] **Step 3: Start/reuse the Electron/Vite environment and exercise the real flow**

Start the documented Desktop dev command, open Storyboard and Characters, trigger Character generation and Storyboard Generate All concurrently, inspect that two Gemini tabs are used, then navigate away and back to Storyboard. Verify approved beats are not submitted, current border moves to the active beat, generated/skipped counts and percentage advance immediately after persistence, and a cache refresh failure does not pause or regenerate a completed beat. Inspect console errors, failed requests, loading/empty states, and screenshots.

- [ ] **Step 4: Record runtime verification honestly**

If Electron/browser automation remains unavailable because the environment cannot attach to the desktop window, report implementation and automated checks separately as runtime-verification blocked; do not claim visual completion.

- [ ] **Step 5: Commit final verification-only documentation adjustments**

```bash
git add documentation/decisions/ADR-0021-desktop-gemini-web-image-generation.md
git commit -m "docs: align Gemini lane decision with implementation"
```

Only create this final commit when the ADR actually changed during implementation; otherwise leave the already committed amendment untouched.
