# Desktop UI Foundation and Themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Deliver an accessible, cohesive NarrativeX desktop visual foundation with persistent light/dark themes and a burnished-amber identity while preserving every renderer workflow.

**Architecture:** Retain React, Tailwind 4, Radix, Lucide, routes, API/query/state flows, and screen geometry. Add a renderer-only theme preference boundary that writes data-theme on the document root; semantic CSS variables drive shared controls and all feature screens.

**Tech Stack:** Electron 44, React 19, TypeScript, Tailwind CSS 4, Radix UI, Lucide React, Node built-in test runner.

**Spec:** docs/superpowers/specs/2026-08-31-desktop-ui-foundation-and-themes-design.md

## Global Constraints

- Do not change API calls, feature state/query logic, routing, validation, event handlers, preload APIs, or Electron main-process code.
- Keep the workspace rail and the Editor explorer/preview/timeline/inspector layout unchanged.
- Primary is #E6A057, hover is #F0B66E, and primary foreground is #090D14; never put light text on the amber primary surface.
- Dark is the fallback. Persist only the renderer-local theme choice.
- Reuse semantic tokens and existing shared primitives; do not add a UI library or a parallel design system.
- Use Lucide only. Keep accessible labels/tooltips for icon-only controls.
- Use shadows only for popovers, menus, and dialogs. Keep motion at 120–180ms and honor reduced motion.
- Complete mandatory Electron runtime visual verification before reporting the task done.

---

## File structure

| File | Responsibility |
| --- | --- |
| app/desktop/src/renderer/app/theme-preference.ts | Pure Theme helpers, safe local storage, and document-root attribute application. |
| app/desktop/src/renderer/app/ThemeProvider.tsx | Renderer-only React context exposing the selected theme. |
| app/desktop/src/renderer/app/DesktopApp.tsx and providers.tsx | Wrap the existing tree and make Sonner use the active theme. |
| app/desktop/src/renderer/features/settings/screens/SettingsScreen.tsx | Settings-only theme selector; diagnostics behavior remains intact. |
| app/desktop/src/renderer/styles.css | Dark/light semantic values, density/type/motion tokens, studio surface, and connected-panel utilities. |
| app/desktop/src/renderer/components/ui/*.tsx | Button, form, menu, dialog, card, tab, and tooltip visual contract. |
| app/desktop/src/renderer/features/workspace/components/*.tsx | Workspace rail, common headers, and empty-state hierarchy. |
| app/desktop/src/renderer/features/editor/* | Presentation-only Editor polish. |
| app/desktop/src/renderer/features/{projects,chapters,storyboard,characters,generation,voices,assets,production}/** | Presentation-only migration for remaining screens. |
| app/desktop/test/theme-preference.test.mjs and design-tokens.test.mjs | Theme behavior and semantic token regressions. |

### Task 1: Implement renderer-local theme preference

**Files:**
- Create: app/desktop/src/renderer/app/theme-preference.ts
- Create: app/desktop/src/renderer/app/ThemeProvider.tsx
- Create: app/desktop/test/theme-preference.test.mjs
- Modify: app/desktop/src/renderer/app/DesktopApp.tsx
- Modify: app/desktop/src/renderer/app/providers.tsx
- Modify: app/desktop/src/renderer/features/settings/screens/SettingsScreen.tsx

**Interfaces:**
- Produces Theme as dark or light, THEME_STORAGE_KEY, readThemePreference, persistThemePreference, applyTheme, and useTheme returning theme and setTheme.
- Consumes only browser Storage and HTMLElement; no preload or backend interface is introduced.

- [ ] **Step 1: Write the failing pure-helper test**

~~~
import assert from "node:assert/strict";
import test from "node:test";
import {
  THEME_STORAGE_KEY, applyTheme, persistThemePreference, readThemePreference,
} from "../src/renderer/app/theme-preference.ts";

test("theme preference accepts only dark and light", () => {
  assert.equal(readThemePreference({ getItem: () => "light" }), "light");
  assert.equal(readThemePreference({ getItem: () => "invalid" }), "dark");
  assert.equal(readThemePreference(null), "dark");
});
test("theme preference persists and applies data-theme", () => {
  let saved;
  persistThemePreference({ setItem: (key, value) => { saved = [key, value]; } }, "light");
  const values = new Map();
  applyTheme({ setAttribute: (key, value) => values.set(key, value) }, "light");
  assert.deepEqual(saved, [THEME_STORAGE_KEY, "light"]);
  assert.equal(values.get("data-theme"), "light");
});
~~~

- [ ] **Step 2: Run the focused test to confirm it fails**

Run: npm test -- theme-preference.test.mjs from app/desktop.
Expected: FAIL because theme-preference.ts does not exist.

- [ ] **Step 3: Implement minimal helpers and context**

~~~
export type Theme = "dark" | "light";
export const THEME_STORAGE_KEY = "narrativex.theme";
const isTheme = (value: string | null): value is Theme => value === "dark" || value === "light";

export function readThemePreference(storage: Pick<Storage, "getItem"> | null): Theme {
  const value = storage?.getItem(THEME_STORAGE_KEY) ?? null;
  return isTheme(value) ? value : "dark";
}
export function applyTheme(root: Pick<HTMLElement, "setAttribute">, theme: Theme) {
  root.setAttribute("data-theme", theme);
}
~~~

Implement a guarded provider hook that applies/persists valid changes. Wrap the existing app without altering provider/auth order. Make Sonner theme-aware. Add a labelled two-option Settings control that calls setTheme, leaving the executor-status effect untouched.

- [ ] **Step 4: Verify the task**

Run: npm test -- theme-preference.test.mjs and npm run type-check from app/desktop.
Expected: PASS.

- [ ] **Step 5: Commit**

~~~
git add app/desktop/src/renderer/app app/desktop/src/renderer/features/settings/screens/SettingsScreen.tsx app/desktop/test/theme-preference.test.mjs
git commit -m "feat(desktop): add persistent renderer theme preference"
~~~

### Task 2: Establish dark/light semantic tokens

**Files:**
- Modify: app/desktop/src/renderer/styles.css
- Modify: app/desktop/src/renderer/index.html
- Modify: app/desktop/test/design-tokens.test.mjs

**Interfaces:**
- Consumes data-theme from Task 1.
- Produces all existing Tailwind-compatible token names plus named base/surface/raised/hover/selected/border/disabled/control/spacing/motion tokens.
- Existing primary, primary-foreground, surface, border, and text references remain resolvable.

- [ ] **Step 1: Add a failing theme-token assertion**

~~~
test("renderer declares dark and light scopes with the accessible amber pair", () => {
  const styles = readFileSync(stylesPath, "utf8");
  assert.match(styles, /--primary:\s*#E6A057;/);
  assert.match(styles, /--primary-foreground:\s*#090D14;/);
  assert.match(styles, /\[data-theme="dark"\]\s*\{/);
  assert.match(styles, /\[data-theme="light"\]\s*\{/);
});
~~~

- [ ] **Step 2: Run the test before the token migration**

Run: npm test -- design-tokens.test.mjs from app/desktop.
Expected: FAIL because the legacy orange palette has no explicit light scope.

- [ ] **Step 3: Implement semantic values and utility contract**

Use dark root fallback plus explicit dark/light scopes. Define base/surface/raised/hover/selected, subtle/default/strong borders, disabled text, 4/8/12/16/20/24/32 spacing, 28/32/36px controls, 4/6/8px radii, and 120/160/180ms motion. Keep nx-studio-surface dark in both themes for preview/timeline. Replace ordinary global gradients/glows with semantic flat surfaces and overlay-only elevation. Update theme-color.

- [ ] **Step 4: Verify**

Run: npm test -- design-tokens.test.mjs and npm run build from app/desktop.
Expected: PASS; existing variables resolve.

- [ ] **Step 5: Commit**

~~~
git add app/desktop/src/renderer/styles.css app/desktop/src/renderer/index.html app/desktop/test/design-tokens.test.mjs
git commit -m "feat(desktop): add semantic light and dark theme tokens"
~~~

### Task 3: Normalize shared controls and workspace chrome

**Files:**
- Modify: app/desktop/src/renderer/components/ui/{button,input,textarea,select,tabs,dropdown-menu,tooltip,dialog,card}.tsx
- Modify: app/desktop/src/renderer/features/workspace/components/{WorkspaceShell,FeaturePage}.tsx
- Modify: app/desktop/src/renderer/main.tsx
- Modify: app/desktop/test/design-tokens.test.mjs

**Interfaces:**
- Consumes Task 2 tokens and all current exports/props.
- Produces unchanged public component APIs with complete focus, hover, pressed, and disabled treatment.

- [ ] **Step 1: Add a primitive regression test**

~~~
test("shared controls retain semantic foreground, focus, and disabled treatment", () => {
  const button = readFileSync(join(rendererRoot, "components", "ui", "button.tsx"), "utf8");
  const input = readFileSync(join(rendererRoot, "components", "ui", "input.tsx"), "utf8");
  assert.match(button, /text-primary-foreground/);
  assert.match(button, /focus-visible:ring-2/);
  assert.match(input, /disabled:cursor-not-allowed/);
});
~~~

- [ ] **Step 2: Run the focused test**

Run: npm test -- design-tokens.test.mjs from app/desktop.
Expected: PASS or a narrow failure identifying the pre-existing primitive gap.

- [ ] **Step 3: Migrate primitives without API changes**

Use shared control height/radius/surface/border/focus tokens. Retain dialog/tooltip accessible names and portals. Limit shadows to overlay primitives. Make workspace navigation active via amber tint, edge indicator, and weight rather than glow/card treatment. Update FeaturePage and EmptyState type roles/spacing while preserving headings, actions, and route links.

- [ ] **Step 4: Verify**

Run: npm test -- design-tokens.test.mjs editor-navigation.test.mjs and npm run type-check from app/desktop.
Expected: PASS.

- [ ] **Step 5: Commit**

~~~
git add app/desktop/src/renderer/components/ui app/desktop/src/renderer/features/workspace/components app/desktop/src/renderer/main.tsx app/desktop/test/design-tokens.test.mjs
git commit -m "refactor(desktop): unify controls and workspace chrome"
~~~

### Task 4: Polish the connected Editor workspace

**Files:**
- Modify: app/desktop/src/renderer/features/editor/EditorScreen.tsx
- Modify: app/desktop/src/renderer/features/editor/components/{EditorExplorerPanel,EditorPreviewViewport,EditorPlaybackSurface,EditorMultiTrackTimeline,EditorInspectorPanel}.tsx
- Modify: app/desktop/src/renderer/styles.css
- Verify: app/desktop/test/{editor-navigation,editor-timeline,preview-playback,preview-transition,render-smoothness}.test.mjs

**Interfaces:**
- Consumes and preserves every current editor prop, callback, timeline command, preview query, and nx-editor layout class.
- Produces visual-only Editor changes; playback, rendering, and timeline behavior do not change.

- [ ] **Step 1: Capture the behavior baseline**

Run: npm test -- editor-navigation.test.mjs editor-timeline.test.mjs preview-playback.test.mjs preview-transition.test.mjs render-smoothness.test.mjs from app/desktop.
Expected: PASS before visual changes.

- [ ] **Step 2: Replace local visual exceptions**

Replace ordinary raw background/border/shadow classes with semantic tokens or named nx utilities. Keep media overlays and waveform SVG content intact on nx-studio-surface. Use the same amber tint/border/indicator for selected clips, explorer rows, and inspector fields. Retain all callbacks, clips, playhead, seek behavior, menus, and responsive grid dimensions. Remove decorative glow rather than adding decoration.

- [ ] **Step 3: Verify behavior and runtime**

Run the Task 4 test command and npm run type-check. Start npm run dev; use supported automation to open Editor, select a beat, play/pause, seek, open inspector controls, switch themes in Settings, then return to Editor.
Expected: PASS; layout/behavior unchanged and all states are legible without console/API failures.

- [ ] **Step 4: Commit**

~~~
git add app/desktop/src/renderer/features/editor app/desktop/src/renderer/styles.css
git commit -m "refactor(desktop): polish editor workspace presentation"
~~~

### Task 5: Apply the foundation to every remaining feature screen

**Files:**
- Modify: app/desktop/src/renderer/features/projects/{screens/ProjectsScreen.tsx,components/{ProjectPicker,ProjectCard}.tsx}
- Modify: app/desktop/src/renderer/features/chapters/{screens/ChaptersScreen.tsx,components/{ChapterWorkspaceContext,ChapterListPanel,ChapterEditorPanel}.tsx}
- Modify: app/desktop/src/renderer/features/storyboard/{screens/StoryboardScreen.tsx,components/{StoryboardHeader,SceneRail,VisualBeatGrid,GeminiQueueBanner}.tsx}
- Modify: app/desktop/src/renderer/features/characters/{screens/CharactersScreen.tsx,components/{CharacterReferenceStudio,CharacterGeminiQueueBanner}.tsx}
- Modify: app/desktop/src/renderer/features/generation/screens/ImagesScreen.tsx
- Modify: app/desktop/src/renderer/features/voices/{screens/VoiceScreen.tsx,components/{VoiceWorkspaceContext,VoiceLibraryRail,VoiceFiltersBar,VoiceCard}.tsx}
- Modify: app/desktop/src/renderer/features/assets/screens/AssetsScreen.tsx
- Modify: app/desktop/src/renderer/features/production/{screens/RenderScreen.tsx,components/RenderDialog.tsx}
- Verify: app/desktop/test/{runtime-hardening,voice-feature-boundaries,storyboard-query-hooks,chapter-voice-contracts,render-smoothness,feature-boundaries}.test.mjs

**Interfaces:**
- Consumes existing props, query/mutation hooks, local asset workflows, queues, and production controller values unchanged.
- Produces presentation-only screens using Tasks 2–3 foundation.

- [ ] **Step 1: Run boundary baseline**

Run: npm test -- runtime-hardening.test.mjs voice-feature-boundaries.test.mjs storyboard-query-hooks.test.mjs chapter-voice-contracts.test.mjs render-smoothness.test.mjs feature-boundaries.test.mjs from app/desktop.
Expected: PASS.

- [ ] **Step 2: Migrate repeated visual patterns**

Replace card-on-card treatments, raw colors, excess radius, and unneeded shadows with connected panel separators, semantic status markers, shared controls, and established header roles. Preserve grids, order, action placement, copy, retry/error actions, query/mutation code, and every window.narrativex call. Keep empty states short and action-oriented.

- [ ] **Step 3: Verify all affected routes in both themes**

Run the Task 5 test command and npm run type-check. In the desktop app visit Projects, Chapters, Storyboard, Characters, Media, Voice, Assets, Render, and Settings; exercise safe primary actions plus available empty/error/loading/disabled states, long text, menus, dialogs, and tooltips. Capture dark and light screenshots.
Expected: PASS; no feature-boundary regression, mock data, console, or API failure.

- [ ] **Step 4: Commit**

~~~
git add app/desktop/src/renderer/features
git commit -m "refactor(desktop): align feature screens with visual foundation"
~~~

### Task 6: Complete quality gate and visual QA

**Files:**
- Modify only verified defects from Tasks 1–5.
- Verify: app/desktop/test/*.test.mjs and CONTRIBUTING.md desktop checks.

**Interfaces:**
- Consumes the completed renderer.
- Produces verified dark/light presentation with no scope expansion.

- [ ] **Step 1: Run desktop quality commands**

Run: npm test, npm run type-check, and npm run build from app/desktop.
Expected: all exit 0.

- [ ] **Step 2: Run the repository quality gate**

Run: pwsh -File scripts/verify-local.ps1 from repository root.
Expected: exit 0. If external infrastructure prevents completion, record exact output and distinguish it from desktop results.

- [ ] **Step 3: Perform final runtime inspection**

Inspect both themes at normal/narrow desktop widths: contrast, typography, spacing, border/elevation restraint, icon placement, long text, focus/selected/disabled/loading/error/empty states, dialogs, menus, tooltips, and console/API errors.
Expected: existing workflow/layout remains, but all screens read as one professional creative application.

- [ ] **Step 4: Commit verification fixes and report evidence**

~~~
git add app/desktop docs/superpowers
git commit -m "test(desktop): verify themed UI foundation"
git status --short
~~~
Expected: clean worktree apart from explicit user-owned changes.

## Plan self-review

- **Spec coverage:** Task 1 implements local theme choice; Task 2 implements dark/light semantics and approved contrast; Task 3 implements controls/panels/typography; Task 4 preserves and polishes Editor; Task 5 applies the foundation to every named feature route; Task 6 covers automated and mandatory runtime verification.
- **Placeholder scan:** No unowned interface, undecided value, or deferred implementation item remains.
- **Type consistency:** Task 1 defines Theme/useTheme; later tasks consume semantic CSS tokens and unchanged component contracts only.

