# NarrativeX Dense Creator Workstation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete NarrativeX Desktop UI Pass 2 by replacing remaining sparse dashboard-like layouts with dense creator-workstation panes, compact command surfaces, adaptive media grids, and contextual inspectors while preserving all existing business logic and workflows.

**Architecture:** Keep the current feature modules and data/query/mutation logic. Add a small reusable workstation presentation layer under `features/workspace/components`, then migrate each screen presentation-only. Storyboard and Chapters receive the largest structural layout change; Characters, Voice, Render, Images, Assets, Projects, Settings, and Editor receive progressively smaller density passes.

**Tech Stack:** Electron 44 · React 19 · TypeScript 7 · Tailwind CSS 4 · Radix UI · Lucide · Node test runner

**Spec:** `docs/superpowers/specs/2026-08-31-dense-creator-workstation-design.md`

## Global Constraints

- Preserve routing, API contracts, React Query keys, Zustand state, mutation semantics, Gemini queue semantics, narration behavior, render behavior, and media-storage behavior.
- Do not invent backend data or dashboard metrics merely to fill whitespace.
- Do not introduce a second token/theme system. Reuse existing semantic colors and shared controls.
- Keep the main Editor geometry `Explorer | Preview | Inspector` over `Timeline` unchanged.
- Prefer adjacent panes and 1 px separators over top-level rounded cards with outer gaps.
- Each workspace should have one visually dominant action; secondary actions use outline/ghost/icon treatments.
- Storyboard can only show scenes for the currently loaded chapter. All chapter headers may appear in the navigator, but only the active chapter expands its loaded scenes.
- Existing async, selected, loading, error, disabled, and partial-data states must remain visible after simplification.
- Source verification uses Desktop `npm run check` in CI. Runtime visual verification remains mandatory; if the execution environment still cannot launch Electron, report `runtime-verification blocked` rather than claiming visual completion.

---

### Task 1: Lock Pass 2 structural contracts and add workstation primitives

**Files:**
- Modify: `app/desktop/test/ui-refinement-source.test.mjs`
- Create: `app/desktop/src/renderer/features/workspace/components/WorkstationPrimitives.tsx`
- Modify: `app/desktop/src/renderer/features/workspace/components/FeaturePage.tsx`
- Modify if required: `app/desktop/src/renderer/styles.css`

**Interfaces:**
- `FeaturePage` keeps all existing props and adds optional `contentClassName?: string` so specialized workspaces can opt into edge-to-edge content without duplicating the page header.
- `WorkstationPrimitives.tsx` exports:
  - `WorkspacePane`
  - `WorkspaceToolbar`
  - `PaneHeader`
  - `MetricStrip`
  - `PropertyRow`
  - `StatusIndicator`
  - `InlineNotice`
- These components consume `ReactNode` and semantic Tailwind classes only. They produce no data and hold no application state.

- [ ] Extend source-contract tests before implementation. Add stable structural assertions:

```js
test("dense workstation primitives are shared instead of screen-local shells", () => {
  const primitives = source("features/workspace/components/WorkstationPrimitives.tsx");
  assert.match(primitives, /export function WorkspacePane/);
  assert.match(primitives, /export function WorkspaceToolbar/);
  assert.match(primitives, /export function PropertyRow/);
  assert.match(primitives, /export function InlineNotice/);
});

test("storyboard no longer reserves separate chapter and scene rails", () => {
  const storyboard = source("features/storyboard/screens/StoryboardScreen.tsx");
  assert.doesNotMatch(storyboard, /grid-cols-\[130px_320px_minmax\(0,1fr\)\]/);
  assert.match(storyboard, /StoryboardNavigator/);
});

test("visual beat cards use an adaptive media-first grid", () => {
  const beats = source("features/storyboard/components/VisualBeatGrid.tsx");
  assert.match(beats, /repeat\(auto-fill,minmax/);
  assert.match(beats, /aspect-video/);
  assert.doesNotMatch(beats, />Gemini Web</);
  assert.doesNotMatch(beats, />Generate New</);
});

test("chapters use adjacent workstation panes without outer card gaps", () => {
  const chapters = source("features/chapters/screens/ChaptersScreen.tsx");
  assert.doesNotMatch(chapters, /gap-3 overflow-hidden p-4/);
});
```

- [ ] Commit the test changes first while at least the new structural tests are RED.
- [ ] Implement `WorkstationPrimitives.tsx` with compact semantic defaults. Example contracts:

```tsx
export function WorkspacePane({ children, className = "" }: Readonly<{ children: ReactNode; className?: string }>) {
  return <section className={`min-h-0 min-w-0 overflow-hidden bg-background ${className}`}>{children}</section>;
}

export function PropertyRow({ label, value }: Readonly<{ label: ReactNode; value: ReactNode }>) {
  return (
    <div className="grid min-h-8 grid-cols-[minmax(96px,.8fr)_minmax(0,1.2fr)] items-center gap-3 border-b border-border-subtle px-3 py-1.5 last:border-b-0">
      <span className="text-[10px] text-text-muted">{label}</span>
      <div className="min-w-0 text-right text-[11px] text-text-secondary">{value}</div>
    </div>
  );
}
```

- [ ] Add `FeaturePage.contentClassName` with existing padded behavior as the default; specialized screens will pass an edge-to-edge class explicitly.
- [ ] Run the source test through CI on the next branch commit; expected end-state for this task is the new primitive test GREEN while later Storyboard/Chapter tests may still be RED until their tasks land.
- [ ] Commit implementation as `refactor(ui): add workstation primitives`.

### Task 2: Rebuild Storyboard as a two-region asset-review workstation

**Files:**
- Create: `app/desktop/src/renderer/features/storyboard/components/StoryboardNavigator.tsx`
- Modify: `app/desktop/src/renderer/features/storyboard/screens/StoryboardScreen.tsx`
- Modify: `app/desktop/src/renderer/features/storyboard/components/StoryboardHeader.tsx`
- Modify: `app/desktop/src/renderer/features/storyboard/components/GeminiQueueBanner.tsx`
- Modify: `app/desktop/src/renderer/features/storyboard/components/VisualBeatGrid.tsx`
- Delete after migration if unreferenced: `app/desktop/src/renderer/features/storyboard/components/SceneRail.tsx`
- Modify test: `app/desktop/test/ui-refinement-source.test.mjs`

**Interfaces:**
- `StoryboardNavigator` consumes:
  - `chapters: DesktopChapterDetails[]`
  - `selectedChapterId: string | null`
  - `scenes: StoryboardScene[]`
  - `selectedSceneId: string | null`
  - `loading: boolean`
  - `error: string | null`
  - `onSelectChapter(chapterId: string)`
  - `onSelectScene(sceneId: string)`
- It produces navigation events only. It does not fetch data or own storyboard selection state.
- Existing queue, generation, review, copy-prompt, and image-import callbacks stay in `StoryboardScreen` unchanged.

- [ ] Implement `StoryboardNavigator` as a ~288 px adjacent left pane. All chapter rows are visible; only the active chapter renders the currently fetched `scenes` underneath.
- [ ] Preserve exact chapter-switch side effects currently in `StoryboardScreen`: clear selected scene, composer state, pending import, copied prompt, and notice.
- [ ] Replace the old three-column grid with `minmax(260px,288px) minmax(0,1fr)`.
- [ ] Compact `StoryboardHeader` into one 44–52 px page/metric strip using `MetricStrip`; remove three separate metric cards.
- [ ] Convert the Visual Beats action header into `WorkspaceToolbar`:
  - active scene title/context left
  - review filter and batch secondary actions center/right
  - Add Visual Beat as primary action
- [ ] Convert create-beat UI to a compact composer directly under the toolbar using shared `Input`, `Textarea`, and `Button` primitives. Keep `beatTitle`, `visualIntent`, mutation calls, max lengths, and success-reset behavior unchanged.
- [ ] Refactor `GeminiQueueBanner` into a compact status strip: current beat, processed/total, percent, state, progress line, and current actions. Remove verbose explanatory paragraph from the persistent strip.
- [ ] Refactor `VisualBeatGrid` to media-first adaptive cards:
  - grid: `repeat(auto-fill,minmax(280px,1fr))`
  - preview first with `aspect-video`
  - title/status/timing compactly below
  - one primary generation or review action based on current state
  - secondary import/copy/reset-review actions remain reachable
  - full prompt remains accessible through native `<details>` or a compact expandable detail region
  - remove redundant `Gemini Web` and `Generate New` badges
  - keep queue-current indication semantic and restrained
- [ ] Keep image loading/error/empty states and `useStoryboardImagePreview` behavior unchanged.
- [ ] Update source tests so obsolete `SceneRail` import and old layout fail the test.
- [ ] Commit as `refactor(storyboard): build dense review workstation`.

### Task 3: Convert Chapters into adjacent navigator, writing, and context panes

**Files:**
- Modify: `app/desktop/src/renderer/features/chapters/screens/ChaptersScreen.tsx`
- Modify: `app/desktop/src/renderer/features/chapters/components/ChapterListPanel.tsx`
- Modify: `app/desktop/src/renderer/features/chapters/components/ChapterEditorPanel.tsx`
- Modify: `app/desktop/src/renderer/features/chapters/components/ChapterWorkspaceContext.tsx`
- Modify test: `app/desktop/test/ui-refinement-source.test.mjs`

**Interfaces:**
- Keep all current props/callbacks for `ChapterListPanel`, `ChapterEditorPanel`, and `ChapterWorkspaceContext` unless a purely presentational prop can be removed as unused.
- All mutation/query logic stays in `ChaptersScreen` and existing hooks.

- [ ] Replace the large custom page header with a compact workstation toolbar/status row; keep workspace status and Open Editor action visible.
- [ ] Replace `gap-3 p-4` top-level layout with adjacent panes:
  - navigator: `minmax(270px,300px)`
  - writing: `minmax(420px,1fr)`
  - context: `minmax(250px,280px)`
- [ ] Refactor `ChapterListPanel` outer shell to edge-to-edge pane (no rounded-lg/shadow-panel).
- [ ] Use shared `Input` and Radix `Select` for search/status/sort; preserve filter values and pagination behavior.
- [ ] Make chapter items row-like with a selected left edge/background rather than standalone cards. Preserve delete hover affordance and all status/audio labels.
- [ ] Group bulk Analyze All / Audio All as compact secondary commands instead of two large same-weight blocks.
- [ ] Refactor `ChapterEditorPanel` outer shell to writing pane. Keep title/source state and dirty detection unchanged.
- [ ] Let source textarea occupy most available vertical space; keep word/character footer.
- [ ] Replace action-card section (`Analyze chapter`, `Open Editor`) with compact command bar controls.
- [ ] Flatten `AudioChapterCard` into an inspector-like subsection; keep voice/rate/create audio/player/error states and callbacks exactly unchanged. Migrate raw voice `<select>` to shared `Select` without changing selected value semantics.
- [ ] Keep Analyze modal flow, but visually align it with shared dialog/surface language. No change to analysis preferences or submit semantics.
- [ ] Refactor `ChapterWorkspaceContext` to `PropertyRow`/`StatusIndicator` groups. Replace the large yellow tip card with low-priority inline guidance or remove it if it duplicates already visible workflow text.
- [ ] Keep Render status and Open Render action.
- [ ] Run/update source structural test; expected GREEN for the no-outer-gap Chapters assertion.
- [ ] Commit as `refactor(chapters): convert workspace to adjacent panes`.

### Task 4: Reframe Characters as library, studio, and inspector

**Files:**
- Modify: `app/desktop/src/renderer/features/characters/screens/CharactersScreen.tsx`
- Modify: `app/desktop/src/renderer/features/characters/components/CharacterReferenceStudio.tsx`
- Modify: `app/desktop/src/renderer/features/characters/components/CharacterGeminiQueueBanner.tsx`
- Modify test if needed: `app/desktop/test/ui-refinement-source.test.mjs`

**Interfaces:**
- Keep character query/mutation/queue code in `CharactersScreen` unchanged.
- `CharacterReferenceStudio` keeps the existing `projectId`, `character`, and `generationLocked` props.
- No new backend fields or persistence state.

- [ ] Use `FeaturePage contentClassName="min-h-0 overflow-hidden bg-background p-0"`.
- [ ] Replace permanent full-width create/search card with a compact top toolbar:
  - search is always visible
  - New Character toggles a small inline create row/composer using the existing `name`, `aliases`, and `create()` logic
  - Generate All is secondary unless queue is active
- [ ] Convert queue banner to compact status strip using the same pattern as Storyboard queue.
- [ ] Use three adjacent regions where width permits:
  - character library ~280 px
  - character studio flexible
  - inspector ~300 px
- [ ] Make `CharacterCard` a compact library row: smaller portrait, name, role/status, scene/reference status.
- [ ] Give `CharacterReferenceStudio` the center visual priority. Remove its outer nested card shell, increase useful identity-preview area, retain all create/generate/import/approve/lock/pin actions and notices.
- [ ] Replace hard-coded `emerald-500` / `amber-500` status styling with semantic success/warning classes.
- [ ] Move Project Identity, Version, Appearance, Bible, and Visual Prompt into right-side inspector sections/property rows instead of a card grid.
- [ ] Keep detail-query fallback/error behavior and portrait query behavior unchanged.
- [ ] Commit as `refactor(characters): build library studio inspector layout`.

### Task 5: Tighten Voice without restructuring its working three-column model

**Files:**
- Modify: `app/desktop/src/renderer/features/voices/screens/VoiceScreen.tsx`
- Modify: `app/desktop/src/renderer/features/voices/components/VoiceCard.tsx`
- Modify: `app/desktop/src/renderer/features/voices/components/VoiceFiltersBar.tsx`
- Modify: `app/desktop/src/renderer/features/voices/components/VoiceWorkspaceContext.tsx`
- Modify if no longer consumed: `app/desktop/src/renderer/styles.css`

**Interfaces:**
- Preserve all VoiceScreen state, narration mutations, voice-reference scopes, preview flow, audio import flow, and props passed to `VoiceWorkspaceContext`.

- [ ] Remove page radial gradient and legacy `--voice-glow` dependency from the screen.
- [ ] Reduce Voice header height to compact workstation proportions; keep title, voice count, Import project voice, and reset filters.
- [ ] Convert `VoiceFiltersBar` from stacked labels + controls into a compact command/filter strip; use accessible labels via `aria-label`/`sr-only` text.
- [ ] Reduce VoiceCard height/preview footprint while keeping both select and sample-play affordances obvious.
- [ ] Increase useful grid occupancy with `repeat(auto-fill,minmax(...))` rather than only fixed 1/2/3 breakpoints.
- [ ] Remove the non-actionable bottom footer that only repeats library counts/backend origin.
- [ ] Refactor `VoiceWorkspaceContext` from nested rounded cards to inspector sections and `PropertyRow` rows.
- [ ] Replace native Chapter select and preview textarea with shared `Select` and `Textarea` primitives while keeping values and handlers unchanged.
- [ ] Keep account R2/project-local reference selection, upload, preview generation, audio player, tags, project assets and quick actions fully available.
- [ ] Remove unused voice gradient/card tokens only after confirming no remaining consumer.
- [ ] Commit as `refactor(voice): tighten workstation density`.

### Task 6: Turn Render into a finishing workspace

**Files:**
- Modify: `app/desktop/src/renderer/features/production/screens/RenderScreen.tsx`
- Modify test if needed: `app/desktop/test/ui-refinement-source.test.mjs`

**Interfaces:**
- `useRenderController` and every controller field/method remain unchanged.

- [ ] Keep `FeaturePage` header but set edge-to-edge content.
- [ ] Split content into adjacent panes:
  - Render Settings ~280 px
  - Render / Preflight Workspace flexible
- [ ] Settings pane contains Edit style, Resolution, subtitles state, destination when present, and the primary Choose folder & render action.
- [ ] Main pane contains inline readiness metrics, blockers, Auto Edit summary, notices, preflight asset rows, and live render progress.
- [ ] Remove duplicated top-level metric/control strip and vertical page-card feeling.
- [ ] Preserve dynamic progress width inline style; it is data-driven and intentionally remains inline.
- [ ] Keep all blockers, warnings, preflight asset states, job ID/status/current step and fitSummary values visible.
- [ ] Commit as `refactor(render): build finishing workspace`.

### Task 7: Convert Image Generation into a review workflow

**Files:**
- Modify: `app/desktop/src/renderer/features/generation/screens/ImagesScreen.tsx`

**Interfaces:**
- Preserve all existing `useAnalyzeChapter`, estimate, media job, review, idempotency key, current-job head check, and provider behavior.
- Gemini Web continues to redirect workflow responsibility to Storyboard; no API media job is introduced for it.

- [ ] Use edge-to-edge FeaturePage content.
- [ ] Move Chapter/Provider/Quality/Style controls into a compact settings/command surface rather than a large rounded control card.
- [ ] Present cost estimate, analysis job, generation job and media-head state as inline status rows/strip rather than independent cards.
- [ ] Use a review layout:
  - Visual Beat navigator ~260–300 px
  - Media review workspace flexible
  - optional compact job context on the right only if it can be populated exclusively from existing state; otherwise keep job context as a strip above the review workspace.
- [ ] Make Visual Beat entries compact rows rather than nested cards.
- [ ] Make media review cards preview-first with review actions directly associated with the item.
- [ ] Preserve `MediaItemPreview` loading/retry/error behavior.
- [ ] Keep all generate/estimate/analyze disabled conditions exactly equivalent.
- [ ] Commit as `refactor(images): build media review workspace`.

### Task 8: Improve Assets, Projects, and Settings density without inventing new workflows

**Files:**
- Modify: `app/desktop/src/renderer/features/assets/screens/AssetsScreen.tsx`
- Modify: `app/desktop/src/renderer/features/projects/screens/ProjectsScreen.tsx`
- Modify: `app/desktop/src/renderer/features/projects/components/ProjectCard.tsx`
- Modify if useful: `app/desktop/src/renderer/features/settings/screens/SettingsScreen.tsx`

**Interfaces:**
- No new persisted selection/filter state unless it can be entirely local/presentational and materially improves an existing action.
- Preserve import/repair/delete/favorite/open/create/refetch behavior.

- [ ] Assets: use a denser adaptive media-browser grid, compact notice, stronger file/local-state hierarchy, and keep repair action visible only when needed.
- [ ] Assets: do not add synthetic thumbnails or metadata. Use existing asset type/status/size/duration/local-state only.
- [ ] Projects: make New project the single primary action; make Refresh secondary.
- [ ] Projects: compact the inline creation composer and tighten adaptive grid minimum width; keep natural ProjectCard semantics.
- [ ] ProjectCard: reduce unnecessary minimum height/padding while retaining description, status and chapter count.
- [ ] Settings: keep existing diagnostic rows; only adjust container width/pane treatment if needed for consistency.
- [ ] Commit as `refactor(ui): tighten supporting workspaces`.

### Task 9: Editor micro-density and legacy visual cleanup

**Files:**
- Modify: `app/desktop/src/renderer/features/editor/EditorScreen.tsx`
- Inspect/update as needed: editor panel components
- Modify: `app/desktop/src/renderer/styles.css`
- Modify: `app/desktop/test/ui-refinement-source.test.mjs`

**Interfaces:**
- Editor selection/media mutation/subtitle/render logic must not change.

- [ ] Preserve the exact main Editor grid geometry and state flow.
- [ ] Remove floating Render button `shadow-lg`; align it visually with workstation command surfaces without moving the core panels.
- [ ] Review Explorer/Inspector/Timeline padding and panel headers for consistency with new primitives; make only local density changes.
- [ ] Search branch source for now-unused legacy feature gradients/glows/shadows such as `voice-glow`, `voice-card-selected`, `chapter-selected`, and `shadow-panel`.
- [ ] Remove a legacy token only when code search confirms no consumers remain.
- [ ] Extend source tests to prevent reintroduction of the removed high-level card-gap geometry and obsolete Storyboard rail.
- [ ] Commit as `refactor(editor): align workstation density`.

### Task 10: Verification, diff review, and PR state

**Files:**
- Update PR #413 body with Pass 2 summary and final verification evidence.

- [ ] Freeze implementation SHA before evaluating final CI.
- [ ] Fetch the PR-triggered CI run for that exact SHA.
- [ ] Verify `Desktop check` completes successfully, including `Test, type-check, and build` (`npm run check`).
- [ ] Compare non-Desktop failures against the known baseline rather than attributing them to UI changes without evidence.
- [ ] Review `main...HEAD` changed-file diff to ensure no API contract, route, query key, mutation payload, narration, rendering, or storage logic was accidentally altered.
- [ ] Run a source search for hard-coded hex backgrounds, arbitrary glow shadows, top-level `rounded-lg ... shadow-panel`, and obsolete Storyboard three-column geometry in affected UI files.
- [ ] Runtime verification remains required by `AGENTS.md`: launch/reuse Electron/Vite, navigate Projects, Chapters, Storyboard, Characters, Editor, Image Generation, Voice, Assets, Render, Settings; exercise normal/empty/loading/error/selected/hover/focus/disabled/long-text/narrow-width states and inspect console/network failures.
- [ ] If runtime execution is still unavailable, keep PR #413 draft and explicitly report `runtime-verification blocked`.
- [ ] If runtime verification becomes available and passes, mark the PR ready only after the visual QA evidence is reviewed.
