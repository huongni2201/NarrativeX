# Chapter Editor Panel Decomposition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the oversized Chapter writing surface into focused components, preserve all existing chapter/narration/analyze behavior, then convert the center column from a floating dashboard card into the same adjacent workstation-pane language used by the Chapter navigator and Context inspector.

**Architecture:** Keep `ChaptersScreen` as the owner of server state, mutations and navigation. Keep `ChapterEditorPanel` as the local composition/state boundary for analyze-dialog preferences, but move writing fields, narration controls, next-step actions and the analyze dialog into focused sibling components. Reuse `WorkspacePane`, `PaneHeader` and `InlineNotice`; do not add a second design-system layer.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Electron renderer, Node test runner source-contract tests.

**Spec:** `docs/superpowers/specs/2026-08-31-desktop-ui-refinement-design.md`

## Global Constraints

- Preserve routing, business logic, API contracts, query/mutation behavior, narration behavior and render behavior.
- Keep `ChaptersScreen` call-site props semantically unchanged.
- Do not add dependencies.
- Use existing centralized design tokens and workstation primitives; no hard-coded decorative colors/glows.
- Prefer adjacent panels and subtle separators over floating cards.
- Keep compact desktop control density and keyboard/focus behavior.
- Desktop UI completion still requires actual Electron runtime visual verification; if unavailable, report it as blocked.

---

## File Structure

- Modify: `app/desktop/src/renderer/features/chapters/components/ChapterEditorPanel.tsx`
  - Composition only: analyze preference state, child wiring, save/cancel footer, dialog visibility.
- Create: `app/desktop/src/renderer/features/chapters/components/chapter-editor.types.ts`
  - Shared `ChapterAudioState` and `ChapterEditorPanelProps` contracts used by the decomposed components.
- Create: `app/desktop/src/renderer/features/chapters/components/ChapterWritingForm.tsx`
  - Chapter title/source inputs, counts and saved-backend informational notice.
- Create: `app/desktop/src/renderer/features/chapters/components/ChapterAudioPanel.tsx`
  - Voice/rate controls, narration generation state, preview player and narration errors.
- Create: `app/desktop/src/renderer/features/chapters/components/ChapterNextActions.tsx`
  - Analyze Chapter and Open Editor actions only.
- Create: `app/desktop/src/renderer/features/chapters/components/AnalyzeChapterDialog.tsx`
  - Visual generation mode/provider dialog only.
- Modify: `app/desktop/test/ui-refinement-source.test.mjs`
  - Structural regression tests for decomposition and adjacent-pane styling.

---

### Task 1: Lock the decomposition and visual contract in RED

**Files:**
- Modify: `app/desktop/test/ui-refinement-source.test.mjs`

**Interfaces:**
- Consumes: current renderer source files.
- Produces: source-level contracts that must fail before extraction and pass after extraction.

- [ ] **Step 1: Add the failing decomposition test**

Append:

```js
test("chapter editor delegates focused writing responsibilities", () => {
  const panel = source("features/chapters/components/ChapterEditorPanel.tsx");

  assert.match(panel, /ChapterWritingForm/);
  assert.match(panel, /ChapterAudioPanel/);
  assert.match(panel, /ChapterNextActions/);
  assert.match(panel, /AnalyzeChapterDialog/);
  assert.doesNotMatch(panel, /function AudioChapterCard/);
  assert.doesNotMatch(panel, /function AnalyzeChapterModal/);
});
```

- [ ] **Step 2: Add the failing workstation-pane test**

Append:

```js
test("chapter writing surface is an adjacent workstation pane", () => {
  const panel = source("features/chapters/components/ChapterEditorPanel.tsx");
  const audio = source("features/chapters/components/ChapterAudioPanel.tsx");

  assert.match(panel, /WorkspacePane/);
  assert.match(panel, /PaneHeader/);
  assert.doesNotMatch(panel, /shadow-\[var\(--shadow-panel\)\]/);
  assert.doesNotMatch(panel, /rounded-lg border border-border bg-surface-panel/);
  assert.match(audio, /border-t border-border-subtle/);
  assert.doesNotMatch(audio, /space-y-3 rounded-lg border border-border bg-surface p-3\.5/);
});
```

- [ ] **Step 3: Run only the new source-contract tests and confirm RED**

Run:

```bash
cd app/desktop
node --experimental-strip-types --experimental-transform-types --test --test-name-pattern="chapter editor|chapter writing surface" test/ui-refinement-source.test.mjs
```

Expected: FAIL because the child files/imports do not exist yet and the current center shell still contains `rounded-lg ... shadow-[var(--shadow-panel)]`.

- [ ] **Step 4: Commit the RED contract**

```bash
git add app/desktop/test/ui-refinement-source.test.mjs
git commit -m "test(ui): lock chapter editor decomposition"
```

---

### Task 2: Extract behavior without changing the screen contract

**Files:**
- Create: `app/desktop/src/renderer/features/chapters/components/chapter-editor.types.ts`
- Create: `app/desktop/src/renderer/features/chapters/components/ChapterWritingForm.tsx`
- Create: `app/desktop/src/renderer/features/chapters/components/ChapterAudioPanel.tsx`
- Create: `app/desktop/src/renderer/features/chapters/components/ChapterNextActions.tsx`
- Create: `app/desktop/src/renderer/features/chapters/components/AnalyzeChapterDialog.tsx`
- Modify: `app/desktop/src/renderer/features/chapters/components/ChapterEditorPanel.tsx`

**Interfaces:**
- Consumes: `DesktopChapterDetails`, `DesktopChapterWorkspace`, `DesktopVoice`, `AnalyzeChapterInput`, `ImageGenerationProvider`, `VisualGenerationMode`, and the existing callbacks passed by `ChaptersScreen`.
- Produces:
  - `export type ChapterAudioState`
  - `export type ChapterEditorPanelProps`
  - `export function ChapterWritingForm(...)`
  - `export function ChapterAudioPanel(...)`
  - `export function ChapterNextActions(...)`
  - `export function AnalyzeChapterDialog(...)`

- [ ] **Step 1: Create the shared prop contracts**

`chapter-editor.types.ts`:

```ts
import type {
  AnalyzeChapterInput,
  DesktopChapterDetails,
  DesktopChapterWorkspace,
  DesktopVoice,
} from "@narrativex/client-contracts";

export type ChapterAudioState = Readonly<{
  voices: DesktopVoice[];
  voiceId: string;
  speakingRate: string;
  workspace: DesktopChapterWorkspace | undefined;
  workspaceError: boolean;
  status: string | null;
  busy: boolean;
  ready: boolean;
  processing: boolean;
  controlsDisabled: boolean;
  generatePending: boolean;
  blockMessage: string | null;
  requestError: string | null;
  onVoiceChange: (voiceId: string) => void;
  onSpeakingRateChange: (value: string) => void;
  onCreate: () => void;
  onRefetchWorkspace: () => void;
}>;

export type ChapterEditorPanelProps = Readonly<{
  selected: DesktopChapterDetails | null;
  workspace: DesktopChapterWorkspace | undefined;
  canAnalyze: boolean;
  title: string;
  sourceText: string;
  busy: boolean;
  saveBusy: boolean;
  analyzeBusy: boolean;
  isDirty: boolean;
  notice: string | null;
  audio: ChapterAudioState;
  onTitleChange: (value: string) => void;
  onSourceTextChange: (value: string) => void;
  onBeginCreate: () => void;
  onCancel: () => void;
  onSave: () => void;
  onAnalyze: (input: AnalyzeChapterInput) => void;
  onOpenEditor: () => void;
}>;
```

- [ ] **Step 2: Extract the writing fields unchanged**

Move the title input, source textarea, word/character counters and backend-saved informational note into `ChapterWritingForm.tsx` with this public signature:

```ts
export function ChapterWritingForm({
  title,
  sourceText,
  onTitleChange,
  onSourceTextChange,
}: Readonly<{
  title: string;
  sourceText: string;
  onTitleChange: (value: string) => void;
  onSourceTextChange: (value: string) => void;
}>)
```

Keep `wordCount(sourceText)` and the current `Input`/`Textarea` IDs (`chapter-title`, `chapter-source`) so labels, automation and accessibility do not drift.

- [ ] **Step 3: Extract narration controls unchanged**

Move the current `AudioChapterCard` body into `ChapterAudioPanel.tsx` and rename the component:

```ts
export function ChapterAudioPanel({
  selected,
  generationBlockedByUnsavedChanges,
  audio,
}: Readonly<{
  selected: DesktopChapterDetails | null;
  generationBlockedByUnsavedChanges: boolean;
  audio: ChapterAudioState;
}>)
```

Keep `narrationVoiceName`, `audioButtonLabel`, `audioStatusBadgeClass`, `audioStatusLabel`, `formatDurationMs`, the `<audio>` element, retry/refetch callback, disabled-state calculation and all existing status copy unchanged during this extraction step.

- [ ] **Step 4: Extract next actions unchanged**

Create `ChapterNextActions.tsx` with:

```ts
export function ChapterNextActions({
  selected,
  busy,
  analyzeBusy,
  canAnalyze,
  generationBlockedByUnsavedChanges,
  onAnalyze,
  onOpenEditor,
}: Readonly<{
  selected: DesktopChapterDetails | null;
  busy: boolean;
  analyzeBusy: boolean;
  canAnalyze: boolean;
  generationBlockedByUnsavedChanges: boolean;
  onAnalyze: () => void;
  onOpenEditor: () => void;
}>)
```

Move only the two existing buttons and their explanatory copy.

- [ ] **Step 5: Extract the analyze dialog unchanged**

Create `AnalyzeChapterDialog.tsx` with:

```ts
export function AnalyzeChapterDialog({
  visualGenerationMode,
  imageProvider,
  onVisualGenerationModeChange,
  onImageProviderChange,
  onCancel,
  onSubmit,
}: Readonly<{
  visualGenerationMode: VisualGenerationMode;
  imageProvider: ImageGenerationProvider;
  onVisualGenerationModeChange: (value: VisualGenerationMode) => void;
  onImageProviderChange: (value: ImageGenerationProvider) => void;
  onCancel: () => void;
  onSubmit: () => void;
}>)
```

Move the current modal DOM and provider/mode buttons without changing selection semantics.

- [ ] **Step 6: Reduce `ChapterEditorPanel` to composition**

Keep only:
- `analyzeModalOpen`
- `visualGenerationMode`
- `imageProvider`
- the existing effect that syncs saved analysis preferences
- `submitAnalysis()`
- `generationBlockedByUnsavedChanges`
- composition of the extracted children
- save/cancel footer

The existing `ChaptersScreen` call site must compile without prop changes.

- [ ] **Step 7: Run the focused contract and TypeScript checks**

```bash
cd app/desktop
node --experimental-strip-types --experimental-transform-types --test --test-name-pattern="chapter editor delegates" test/ui-refinement-source.test.mjs
npm run type-check
```

Expected: PASS.

- [ ] **Step 8: Commit the behavior-preserving extraction**

```bash
git add app/desktop/src/renderer/features/chapters/components app/desktop/test/ui-refinement-source.test.mjs
git commit -m "refactor(ui): split chapter editor panel"
```

---

### Task 3: Flatten the Chapter writing workspace after extraction

**Files:**
- Modify: `app/desktop/src/renderer/features/chapters/components/ChapterEditorPanel.tsx`
- Modify: `app/desktop/src/renderer/features/chapters/components/ChapterAudioPanel.tsx`
- Modify: `app/desktop/src/renderer/features/chapters/components/ChapterWritingForm.tsx`

**Interfaces:**
- Consumes: existing workstation primitives from `features/workspace/components/WorkstationPrimitives.tsx`.
- Produces: an adjacent center pane consistent with `ChapterListPanel` and `ChapterWorkspaceContext`.

- [ ] **Step 1: Replace the floating center shell**

Import:

```ts
import {
  PaneHeader,
  WorkspacePane,
} from "../../workspace/components/WorkstationPrimitives";
```

Replace the current outer section:

```tsx
<section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-surface-panel shadow-[var(--shadow-panel)]">
```

with:

```tsx
<WorkspacePane className="flex flex-col border-r border-border-subtle bg-surface-panel">
```

and close with `</WorkspacePane>`.

- [ ] **Step 2: Replace the custom large header with the shared pane header**

Use:

```tsx
<PaneHeader
  title={selected ? "Writing Workspace" : "New Chapter"}
  meta={selected ? "Edit the saved chapter, then run analysis or narration." : "Create and save the chapter before production steps."}
  actions={
    selected ? (
      <Button type="button" variant="outline" size="sm" onClick={onBeginCreate} disabled={busy}>
        <Plus size={12} /> New
      </Button>
    ) : undefined
  }
/>
```

Remove the bespoke `PencilLine` header icon/title/description block, but keep `PencilLine` for the save button.

- [ ] **Step 3: Keep the writing body dense and edge-to-edge**

Use one scrolling body container:

```tsx
<div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
```

Render in order:

```tsx
<ChapterWritingForm ... />
<ChapterAudioPanel ... />
<ChapterNextActions ... />
```

Do not wrap those three children in another card.

- [ ] **Step 4: Flatten the narration section**

Change the `ChapterAudioPanel` root from the current rounded card to:

```tsx
<section className="space-y-3 border-t border-border-subtle pt-3">
```

Keep inner warnings/player surfaces where they communicate actual state; only remove the decorative outer card container.

- [ ] **Step 5: Make the form notice use the shared notice primitive**

In `ChapterWritingForm.tsx`, replace the icon-heavy informational card with:

```tsx
<InlineNotice tone="info">
  Phân tích và tạo audio luôn dùng bản chapter đã lưu trên backend, không dùng nội dung nháp chưa lưu trong form.
</InlineNotice>
```

This preserves the information while matching the workstation grammar.

- [ ] **Step 6: Run the workstation-pane contract and full Desktop check**

```bash
cd app/desktop
node --experimental-strip-types --experimental-transform-types --test --test-name-pattern="chapter writing surface|chapter editor delegates" test/ui-refinement-source.test.mjs
npm run check
```

Expected: source contracts PASS; dependency lock PASS; all Desktop tests PASS; TypeScript PASS; production build PASS.

- [ ] **Step 7: Commit the visual refinement**

```bash
git add app/desktop/src/renderer/features/chapters/components app/desktop/test/ui-refinement-source.test.mjs
git commit -m "refactor(ui): flatten chapter writing workspace"
```

---

### Task 4: Exact-head verification and PR update

**Files:**
- No production code unless verification reveals a regression.
- Update PR #413 description only after the exact-head verification result is known.

**Interfaces:**
- Consumes: final branch head.
- Produces: verification evidence tied to one immutable SHA.

- [ ] **Step 1: Verify branch diff is scoped to Chapter UI decomposition plus the existing UI PR**

```bash
git diff --stat main...HEAD
git diff -- app/desktop/src/renderer/features/chapters app/desktop/test/ui-refinement-source.test.mjs
```

- [ ] **Step 2: Run the final Desktop quality gate**

```bash
cd app/desktop
npm run check
```

Expected: exit 0.

- [ ] **Step 3: Verify Electron runtime when an environment with Desktop GUI access is available**

Check Chapter Workspace at normal and constrained widths:
- chapter selection/edit/create
- unsaved-change warning
- Analyze dialog mode/provider selection
- narration voice/rate generation states
- audio preview player
- save/cancel/new chapter
- Open Editor
- hover/focus/disabled/loading/error states
- no horizontal overflow or floating-card gap between the three Chapter columns

If the runtime cannot be launched, leave PR #413 as draft and explicitly record `runtime visual verification blocked`.

- [ ] **Step 4: Update PR #413 with final SHA and verification counts**

Do not claim completion until the exact-head checks above are green.
