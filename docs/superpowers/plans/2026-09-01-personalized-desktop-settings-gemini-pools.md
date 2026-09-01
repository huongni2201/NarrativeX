# Personalized Desktop Settings and Gemini Pools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-user local Desktop preferences, restore/reset window geometry, expose Gemini concurrency in Settings, and allow Character/Storyboard Gemini Web work to use configurable parallel tab pools.

**Architecture:** Electron main owns a versioned per-user preferences store and native window persistence. Renderer binds the authenticated/guest `user.id` through a narrow preload bridge. Gemini Web keeps one Chrome process/profile but generalizes each logical lane into independent slots; renderer generate-all queues fan out up to the effective per-lane concurrency.

**Tech Stack:** Electron 44, TypeScript 7, React 19, Node test runner, React Query, existing NarrativeX preload IPC/security helpers.

**Spec:** `docs/superpowers/specs/2026-09-01-personalized-desktop-settings-gemini-pools-design.md`

## Global Constraints

- Built-in Character default: `2`.
- Built-in Storyboard default: `4`.
- Allowed Gemini concurrency range: `1..8`.
- Environment defaults: `NARRATIVEX_GEMINI_CHARACTER_TAB_COUNT`, `NARRATIVEX_GEMINI_STORYBOARD_TAB_COUNT`.
- Preference precedence: user override -> valid environment default -> built-in default.
- Preferences are local/device-scoped and isolated by NarrativeX user id.
- One Chrome process/profile remains shared; work slots must not share target ids, busy flags, network capture, or download directories.
- Active generation keeps its concurrency snapshot; changed settings apply to subsequent runs.

---

### Task 1: Pure preference model and persistence

**Files:**
- Create: `app/desktop/src/main/preferences/desktop-preferences.ts`
- Test: `app/desktop/test/desktop-preferences.test.mjs`

**Interfaces:**
- Produces `resolveGeminiDefaults(env)`, `DesktopPreferencesStore`, `EffectiveDesktopPreferences`, `SavedWindowState`.

- [ ] Write tests that assert built-in/env fallback, per-user isolation, updates, reset semantics, and corrupted-file recovery.
- [ ] Run the test and confirm failure because the module does not exist.
- [ ] Implement the versioned JSON store with atomic-enough serialized writes and input validation.
- [ ] Run the preference test and confirm pass.

### Task 2: Window-state validation and restore

**Files:**
- Create: `app/desktop/src/main/preferences/window-state.ts`
- Modify: `app/desktop/src/main/main.ts`
- Test: `app/desktop/test/window-state.test.mjs`

**Interfaces:**
- Consumes `SavedWindowState`.
- Produces `resolveRestoredWindowState(saved, displays, fallbackDisplay)` and `defaultWindowBounds(display)`.

- [ ] Write tests for valid restore, off-screen fallback, minimum size, and maximized state.
- [ ] Run and confirm failure because the helpers do not exist.
- [ ] Implement pure window-state helpers.
- [ ] Wire `main.ts` to load last active profile before `BrowserWindow`, persist normal bounds/maximized state, and apply reset immediately.
- [ ] Run window/preference tests and type-check.

### Task 3: Preload preferences contract and user binding

**Files:**
- Modify: `app/desktop/src/preload/types.ts`
- Modify: `app/desktop/src/preload/index.ts`
- Modify: `app/desktop/src/main/main.ts`
- Modify: `app/desktop/src/renderer/features/auth/AuthGuard.tsx`
- Test: `app/desktop/test/personalized-settings-contract.test.mjs`

**Interfaces:**
- `window.narrativex.preferences.bindUser(userId)`
- `get()`
- `updateGemini({ characterTabs?, storyboardTabs? })`
- `reset("GEMINI" | "WINDOW" | "ALL")`

- [ ] Write contract tests for typed preload exposure and current-user binding.
- [ ] Run and confirm failure.
- [ ] Implement trusted IPC handlers, preload bridge, types, and AuthGuard binding.
- [ ] Run contract tests and type-check.

### Task 4: Settings UI

**Files:**
- Modify: `app/desktop/src/renderer/features/settings/screens/SettingsScreen.tsx`
- Test: `app/desktop/test/personalized-settings-ui.test.mjs`

**Interfaces:**
- Consumes `window.narrativex.preferences`.

- [ ] Write UI source-contract tests for two concurrency controls and three reset actions.
- [ ] Run and confirm failure.
- [ ] Add a Personalization settings group with `1..8` controls, environment-default labels, save feedback, and reset buttons.
- [ ] Run UI test and type-check.

### Task 5: Gemini lane slots

**Files:**
- Modify: `app/desktop/src/main/gemini-web/gemini-web-automation.ts`
- Modify: `app/desktop/src/main/gemini-web/gemini-web-ipc.ts`
- Test: `app/desktop/test/gemini-web-lanes.test.mjs`

**Interfaces:**
- `GeminiWebAutomation.generateImage(lane, prompt, references, requestedConcurrency?)` uses a free slot from the configured lane pool.
- Lane slot directories are `lanes/<lane>/slot-<n>/downloads`.

- [ ] Extend lane tests to require lane slot state rather than one globally-active lane target.
- [ ] Run and confirm the old single-target implementation fails the new assertions.
- [ ] Generalize persisted session target ids to per-lane arrays and add slot acquisition/release.
- [ ] Resolve effective concurrency from the active preference profile when handling generation IPC.
- [ ] Run Gemini tests and type-check.

### Task 6: Parallel Character and Storyboard queue state

**Files:**
- Modify: `app/desktop/src/renderer/features/storyboard/model/gemini-queue.ts`
- Modify: Storyboard generate-all runner/query files discovered by call-site search.
- Modify: `app/desktop/src/renderer/features/characters/model/character-gemini-queue.ts`
- Modify: Character generate-all runner/query files discovered by call-site search.
- Test: existing queue tests plus focused new assertions.

**Interfaces:**
- Queue state gains active item ids and supports claiming up to the concurrency snapshot.
- Completion/skip update one item without invalidating siblings.

- [ ] Add failing model tests for claiming multiple pending items and independent completion.
- [ ] Implement minimal pure queue transitions.
- [ ] Update runners to fan out up to effective concurrency while preserving per-item durable persistence semantics.
- [ ] Run all Desktop tests.

### Task 7: Verification and documentation

**Files:**
- Modify relevant Desktop README/ADR only where AS-IS behavior changed.

- [ ] Run `npm test` in `app/desktop`.
- [ ] Run `npm run type-check`.
- [ ] Run `npm run build`.
- [ ] Run repository CI/checks and fix only regressions caused by this change.
- [ ] Update current-state docs for personalized preferences and Gemini slot pools.
