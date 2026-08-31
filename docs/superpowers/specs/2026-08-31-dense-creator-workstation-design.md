# NarrativeX Desktop — Dense Creator Workstation Design

Date: 2026-08-31
Status: Approved direction, pending implementation-plan review
Branch: `feat/desktop-ui-refinement`
PR: #413
Scope: second-pass UX/layout refinement for `app/desktop/src/renderer`

## 1. Purpose

The first UI refinement pass improved semantic styling, shared controls, active states, color usage, and visual consistency. The remaining problem is spatial: several screens still feel sparse, card-heavy, and dashboard-like because content is wrapped in large padded containers, toolbars consume vertical space, and information is distributed across disconnected panels.

This second pass turns NarrativeX into a denser creator workstation without changing product behavior, APIs, routing, generation logic, narration logic, rendering logic, or core editor workflows.

The objective is not to fill empty space decoratively. Empty space is reduced by:

- tighter pane geometry
- stronger information hierarchy
- adaptive content grids
- compact toolbars
- meaningful contextual information placed near the active object
- fewer nested cards
- more edge-to-edge work surfaces

## 2. Design direction

The product should feel closer to a mature desktop creative tool than a SaaS dashboard.

Target qualities:

- Figma / DaVinci Resolve / Premiere-style workstation density
- Linear-like command clarity
- Lightroom-like contextual inspectors
- restrained NarrativeX orange accent
- functional rather than decorative surfaces

The desktop should feel "occupied" by useful work surfaces while still breathing enough for readability.

## 3. Core spatial principles

### 3.1 Panes instead of page cards

Top-level workspace layouts should use adjacent panes separated by 1 px borders rather than floating cards separated by outer padding and large gaps.

Preferred structure:

- navigation / library pane
- primary workspace pane
- contextual inspector pane

Panels may retain local padding internally, but the application should not resemble several independent cards floating on a background.

### 3.2 Compact command surfaces

Toolbars should generally be 40–44 px tall.

Primary action stays visible. Secondary actions should be grouped, collapsed, or moved to contextual menus when appropriate.

Long rows of same-weight buttons should be avoided.

### 3.3 Information density from hierarchy

The UI should display more useful information per viewport without reducing everything to tiny text.

Density should come from:

- fewer wrappers
- smaller vertical gaps
- row-based metadata
- inline status indicators
- collapsible secondary details
- adaptive grids
- inspector placement

### 3.4 Empty-state behavior

Empty states should live inside the active work region rather than taking an entire screen-height canvas when possible.

The surrounding workspace should still provide navigation, context, and next actions.

## 4. Shared workstation primitives

Introduce only reusable structural primitives that have multiple consumers.

Candidate components:

### `WorkspaceToolbar`

Compact horizontal command strip with:

- title/context slot
- optional status summary
- secondary controls
- primary action

### `WorkspacePane`

Edge-to-edge pane shell that provides:

- border ownership
- min-height/overflow contract
- optional header slot

### `PaneHeader`

Compact pane heading with:

- title
- count/status
- optional controls

### `MetricStrip`

Inline metrics rather than separate cards.

Example:

`12 scenes · 48 beats · 39 approved`

### `PropertyRow`

Inspector-style property display:

- label on left
- value/control on right

### `StatusIndicator`

Small semantic dot/icon + label used for readiness, job state, local/remote status, review state, etc.

### `InlineNotice`

Compact status/error/warning strip. Avoid large padded notice cards unless the state needs real attention.

These components should wrap the existing semantic token system rather than introduce another design layer.

## 5. Storyboard redesign

Storyboard is the highest-priority screen in this pass.

### 5.1 Current problem

The current layout uses three columns:

- narrow Chapter column
- wide Scene rail
- Visual Beat workspace

Chapters and scenes both use vertical card lists, while the Visual Beat workspace contains tall cards with many stacked sections. This consumes too much horizontal and vertical space.

### 5.2 New layout

Use two primary regions:

`Storyboard Navigator | Visual Beat Workspace`

Target navigator width: approximately 280–300 px.

The navigator groups scenes under their chapter instead of dedicating separate full-height columns to chapter and scene navigation.

#### Navigator behavior

- chapter acts as a compact group/header
- scenes appear nested below the active/expanded chapter
- selected scene gets a restrained accent indicator
- each scene row shows useful compact metadata, such as approved/total beats
- chapter switching retains existing selection/reset behavior
- loading/error states remain within the navigator

No API or data-model changes are required.

### 5.3 Storyboard top bar

Replace the large header + metric cards + action-heavy secondary header with a single denser hierarchy:

Top product/page context:

- `Storyboard`
- inline metrics (`Scenes`, `Visual Beats`, `Approved`)

Scene toolbar:

- active scene title
- review filter
- Gemini All status/action
- Approve All
- Add Visual Beat as the primary action

Avoid giving every action an equally strong filled button treatment.

### 5.4 Gemini queue

The Gemini queue should render as a compact status strip when active.

It should communicate:

- progress
- current beat
- paused/running state
- resume/skip/stop actions

It should not occupy a large banner unless an error requires attention.

### 5.5 Visual Beat presentation

Move from text-first tall cards to media-first compact cards.

Desktop target:

- medium width: 2 columns
- wide width: 3 columns
- narrow workspaces: 1 column

Each card should prioritize:

1. image preview
2. beat title
3. review/generation status
4. timing
5. compact metadata
6. primary contextual action

Prompt text should be collapsed by default or moved behind a lightweight details affordance. The full prompt remains accessible and copyable.

#### Proposed beat card structure

- 16:9 preview
- small overlay/edge status indicator where appropriate
- title row
- compact `Beat N · timing · camera/motion` metadata line
- one or two primary actions
- overflow/secondary action area for copy prompt/import/reset review
- expandable prompt/detail region

Remove badge chains such as `Gemini Web`, `Generate New`, review status, and queue state when the same information can be represented through smaller status treatments.

### 5.6 Beat creation

The existing inline create form may remain inline, but it should be rendered as a compact composer attached to the workspace toolbar rather than a large card pushed into the content stack.

Use shared `Input`, `Textarea`, and `Button` primitives.

## 6. Chapters redesign

### 6.1 New layout

Use three adjacent panes without outer card gaps:

`Chapter Navigator (~300 px) | Writing Workspace (flex) | Context Inspector (~280 px)`

The overall screen keeps the existing functional model.

### 6.2 Chapter Navigator

Compact the list header.

Preferred order:

- pane title + count
- search
- compact filter/sort row
- bulk actions grouped in a small command area or overflow
- chapter rows
- pagination footer

Chapter rows should read like document/navigation rows, not cards.

Selected chapter uses a subtle accent edge or background.

### 6.3 Writing Workspace

The editor should use more of the viewport.

- minimize wrapper cards
- keep source text large enough to write comfortably
- keep save state visible
- position Save / Analyze / Audio actions in a stable command bar
- unsaved-change state should be obvious without adding a large banner

### 6.4 Context Inspector

Convert metric cards and status blocks into inspector sections and property rows.

Suggested groups:

- Project
- Chapter readiness
- Analysis
- Audio
- Scene/beat counts
- Render readiness

The inspector should continue using currently available data only.

## 7. Characters redesign

Use a three-region creator layout:

`Character Library | Character Studio | Character Inspector`

### Library

- compact searchable list/grid
- portrait thumbnail + name + key state
- selected row treatment

### Studio

Primary focus is the selected character's visual representation/reference.

If a character has generated or imported media, give it enough visual space to matter.

### Inspector

Use tabs or sections such as:

- Identity
- Appearance
- Reference/Version
- Prompt/Generation data

Only expose data already present in current contracts/store.

Character creation should not permanently consume a large top-of-page block. Prefer a compact create row or existing dialog pattern if it does not change workflow semantics.

## 8. Assets redesign

Assets should feel like a media browser.

### Layout

Preferred:

- compact toolbar
- optional type/filter rail when enough controls exist
- adaptive thumbnail/list grid
- optional detail inspector when an asset is selected, if existing state allows it without behavior changes

Improve density by:

- reducing excessive card padding
- using preview area efficiently
- moving filenames/status/size/type into structured metadata rows

Do not invent new asset metadata.

## 9. Image Generation redesign

Convert the current stacked dashboard-like layout into a review workflow.

Preferred layout:

`Visual Beat Navigator | Generation / Review Workspace | Job Context`

If a full third pane is unnecessary with existing data, use a right-side inspector region inside the main workspace rather than introducing new behavior.

Provider, quality, style, chapter, cost and job status should read like controls/status, not independent cards.

The visual hierarchy should make these actions obvious:

1. select chapter/provider
2. analyze if necessary
3. estimate/generate when applicable
4. review generated media

Gemini Web manual behavior remains unchanged.

## 10. Voice redesign

Voice already has a useful three-column architecture, so this pass refines rather than restructures it.

Changes:

- reduce header height
- reduce filter-bar height
- compact VoiceCard height and metadata
- keep preview interaction obvious
- emphasize selected voice in context pane
- reduce empty space below short voice libraries through better grid sizing
- use property rows in VoiceWorkspaceContext where possible

No narration or reference-upload behavior changes.

## 11. Render redesign

Render should feel like a finishing workspace rather than a vertical settings page.

Preferred layout:

`Render Settings | Render / Preflight Workspace`

### Settings pane

- edit style
- resolution
- subtitle state
- destination
- primary render action

### Main workspace

- readiness summary
- blocker list when present
- auto-edit summary
- preflight assets
- current render progress/job

Metrics/statuses should use rows/strips rather than isolated cards.

`useRenderController` behavior remains unchanged.

## 12. Settings

Settings is low priority compared with workflow screens.

Keep the current diagnostic information but use denser rows/groups. Do not add settings that do not already exist.

## 13. Projects

Projects should stay visually simpler than creator workspaces.

Use the available page width better:

- denser adaptive project grid
- compact top actions
- project cards keep natural media/project-card semantics

Avoid introducing dashboard metrics only to fill space.

## 14. Editor

The main Editor geometry is already structurally appropriate after Pass 1 and should not be broadly redesigned in this pass.

Allowed refinements:

- minor pane density changes
- toolbar alignment
- inspector grouping
- explorer row density
- timeline header/track density

Do not change Explorer / Preview / Inspector / Timeline placement or workflow.

## 15. Responsive desktop behavior

This is a desktop application, not a mobile redesign.

Still, workstation geometry should tolerate narrower windows.

Guidelines:

- use `minmax()` layouts rather than fixed full-screen assumptions
- allow secondary inspector widths to compress within safe limits
- collapse 3-column content grids to 2 then 1 column
- avoid horizontal overflow in command bars by allowing secondary actions to wrap or collapse
- truncate long titles and filenames where appropriate
- maintain access to full values through existing tooltip/title patterns when useful

## 16. Interaction hierarchy

Each workspace should have one clearly dominant action at a time.

Examples:

- Storyboard: Add Visual Beat or current Gemini action depending state
- Chapter editor: Save / Analyze depending dirty/readiness state
- Render: Choose folder & render

Secondary controls should use outline/ghost/icon treatments.

Avoid multiple same-weight colored buttons in one toolbar.

## 17. UX state requirements

Review each migrated workspace for:

- loading
- empty
- error
- selected
- hover
- focus-visible
- disabled
- async pending
- long text
- narrow width
- partial data

State changes must remain obvious even after visual simplification.

## 18. Scope boundaries

This pass must not:

- modify backend/API contracts
- alter routing
- change business rules
- change generation queue semantics
- change chapter persistence
- change narration behavior
- change image-generation providers
- change render behavior
- change media storage behavior
- invent new metrics/data
- add analytics/dashboard content to fill whitespace
- introduce new workflow steps solely for visual reasons

Any necessary behavior adjustment discovered during implementation must be separately justified and kept minimal.

## 19. Implementation priority

Recommended order:

1. shared workstation primitives
2. Storyboard navigator + toolbar + compact Visual Beat grid
3. Chapters pane layout
4. Characters creator layout
5. Voice density pass
6. Render workspace
7. Image Generation
8. Assets
9. Projects/Settings cleanup
10. editor micro-density review
11. whole-app visual consistency sweep

Storyboard and Chapters should receive the largest spatial redesign because they currently waste the most viewport area.

## 20. Testing and verification

Source verification continues to require Desktop `npm run check`, covering:

- dependency lock
- tests
- type-check
- production build

Add source-contract tests for structural UI assumptions only where stable and useful, such as ensuring obsolete large multi-column Storyboard geometry is not reintroduced accidentally.

Runtime verification remains mandatory under repository guidance.

Visually review at minimum:

- Projects
- Chapters
- Storyboard
- Characters
- Editor
- Image Generation
- Voice
- Assets
- Render
- Settings

Check both normal and constrained window widths where practical.

If Electron runtime verification remains unavailable in the execution environment, report `runtime-verification blocked`; do not claim visual completion.

## 21. Completion criteria

Pass 2 is complete when:

- workflow screens use significantly more of the viewport for useful content
- major top-level card gaps are replaced with pane geometry where appropriate
- Storyboard shows materially more Visual Beats per viewport
- Chapters feels like a writing workstation rather than three cards
- Characters has a clear library/studio/inspector hierarchy
- Render feels like a finishing workspace
- Voice/Assets/Image Generation have reduced vertical and horizontal dead space
- primary actions are clearer than secondary actions
- no new decorative cards/gradients/glows were introduced to fill space
- business logic and workflows remain unchanged
- Desktop checks pass
- runtime UI verification passes, or the blocker is explicitly reported

The final application should look richer because it organizes existing information better, not because it adds visual noise.