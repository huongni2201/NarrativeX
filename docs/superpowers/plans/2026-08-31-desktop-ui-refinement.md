# NarrativeX Desktop UI Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or subagent-driven-development to execute task-by-task.

**Goal:** Refine NarrativeX Desktop into a consistent, restrained professional creative workstation while preserving layout, routing, behavior, data flow, and business logic.

**Architecture:** Foundation-first presentation refactor. Strengthen the existing semantic token layer and shared primitives, migrate shared shell/page patterns, then remove per-feature visual drift from the editor and standard screens. No parallel design system and no behavior rewrite.

**Tech Stack:** Electron 44 · React 19 · TypeScript 7 · Tailwind CSS 4 · Radix UI · Lucide · Node test runner

**Spec:** `docs/superpowers/specs/2026-08-31-desktop-ui-refinement-design.md`

## Baseline

- `main` Desktop check passes at `108764bc69d3942f68a282dccce9581574e9dd62`.
- Overall CI is currently red because the pre-existing `Backend verify` job fails; UI work must not be blamed for that baseline failure.
- Local clone/runtime execution is unavailable in the current agent environment because external GitHub DNS resolution is blocked. Desktop CI is therefore the source-level verification path; Electron runtime visual verification remains a separate completion gate.

---

### Task 1: Add source-level visual-contract tests

**Files:**
- Create: `app/desktop/test/ui-refinement-source.test.mjs`

- [ ] Assert `WorkspaceShell` contains no hard-coded hex selected background or arbitrary glow shadow.
- [ ] Assert shared semantic classes/tokens exist for selected, hover, control heights, typography roles, and overlay shadow.
- [ ] Assert core shared controls use compact/standard application density instead of relying on per-screen overrides.
- [ ] Assert editor source no longer uses decorative orange/purple arbitrary shadows for normal panel states.
- [ ] Commit failing/source-contract tests first where possible.

### Task 2: Refine global UI foundation

**Files:**
- Modify: `app/desktop/src/renderer/styles.css`
- Modify: `app/desktop/src/renderer/components/ui/button.tsx`
- Modify: `app/desktop/src/renderer/components/ui/input.tsx`
- Modify: `app/desktop/src/renderer/components/ui/textarea.tsx`
- Modify as required: `select.tsx`, `tabs.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `tooltip.tsx`

- [ ] Add semantic surface hover/selected, text disabled, border strong, control heights, typography roles, motion, and overlay-shadow tokens.
- [ ] Normalize button hierarchy and 28/32 px control density.
- [ ] Normalize inputs/selects/textareas to the same focus, disabled, border, radius, and typography language.
- [ ] Reserve shadows for overlays rather than standard controls/panels.

### Task 3: Refine shared shell and page patterns

**Files:**
- Modify: `app/desktop/src/renderer/features/workspace/components/WorkspaceShell.tsx`
- Modify: `app/desktop/src/renderer/features/workspace/components/FeaturePage.tsx`

- [ ] Replace hard-coded rail selected styling with semantic selected treatment.
- [ ] Reduce glow/border noise while keeping active destination obvious.
- [ ] Standardize header title/description/context typography.
- [ ] Make empty/status patterns direct, restrained, and reusable.

### Task 4: Migrate Projects to the shared application language

**Files:**
- Modify: `app/desktop/src/renderer/features/projects/screens/ProjectsScreen.tsx`
- Modify as required: `app/desktop/src/renderer/features/projects/components/ProjectCard.tsx`

- [ ] Reuse shared page/header hierarchy rather than duplicating it.
- [ ] Remove unnecessary badges/card framing and arbitrary micro typography.
- [ ] Keep create/delete/favorite/open behavior unchanged.
- [ ] Normalize loading/error/empty/action states.

### Task 5: Refine the editor workstation without changing layout

**Files:**
- Modify: `app/desktop/src/renderer/features/editor/EditorScreen.tsx`
- Modify: `app/desktop/src/renderer/features/editor/components/EditorExplorerPanel.tsx`
- Modify: `app/desktop/src/renderer/features/editor/components/EditorPreviewViewport.tsx`
- Modify: `app/desktop/src/renderer/features/editor/components/EditorInspectorPanel.tsx`
- Modify: `app/desktop/src/renderer/features/editor/components/EditorMultiTrackTimeline.tsx`
- Modify as required: `EditorPlaybackSurface.tsx`

- [ ] Preserve Explorer | Preview | Inspector | Timeline geometry and all existing callbacks/state.
- [ ] Remove decorative hard-coded hex/glow treatments.
- [ ] Make Explorer rows dense/adjacent rather than card-like.
- [ ] Make Preview framing functional and restrained; preserve subtitles/playback behavior.
- [ ] Flatten Inspector property groups and normalize fields/actions/notices.
- [ ] Make Timeline tracks/clips use semantic track colors and selected state without neon glow.

### Task 6: Sweep standard screens and feature-specific decorative drift

**Files:**
- Inspect/update only where needed under `features/{chapters,storyboard,characters,generation,voices,assets,production,settings}`.
- Priority known hotspots: chapter panels, Gemini queue banners, Render screen/dialog.

- [ ] Replace arbitrary hard-coded visual values with semantic tokens where existing shared primitives fit.
- [ ] Remove feature-specific decorative gradients/glows that do not convey state.
- [ ] Do not rewrite feature logic or introduce one-off abstractions.
- [ ] Search again for hard-coded hex colors, arbitrary box shadows, excessive rounded containers, and duplicated page headers.

### Task 7: Verification and review

- [ ] Run/inspect Desktop CI: `npm run check` (lock, tests, type-check, build).
- [ ] Compare any CI failure against the `main` baseline; `Backend verify` is pre-existing unless evidence shows otherwise.
- [ ] Review changed files for accidental business-logic/routing/data-flow changes.
- [ ] Perform a final source consistency scan for hard-coded colors/glows and per-screen control overrides.
- [ ] Runtime Desktop UI verification: navigate all affected screens, inspect console/API errors, hover/focus/selected/loading/error/empty/overflow/long-text states, and capture screenshots when the environment supports it.
- [ ] If runtime automation remains unavailable, report `runtime-verification blocked` rather than claiming the visual task fully verified.
