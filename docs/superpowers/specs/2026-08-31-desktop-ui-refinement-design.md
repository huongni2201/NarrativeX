# NarrativeX Desktop UI Refinement Design

Date: 2026-08-31
Status: Approved design direction, pending implementation-plan review
Scope: `app/desktop/src/renderer`

## 1. Purpose

Refine the existing NarrativeX Desktop interface so it feels like a mature, purpose-built creative application rather than a generic SaaS template or an AI-generated UI.

The implementation must preserve the existing product architecture, screen structure, routing, business logic, state management, API behavior, editor workflow, and working features. The redesign is intentionally presentation-first and incremental.

The target is a professional creative workstation: dense enough for real editing work, visually restrained, consistent across features, and recognizably NarrativeX through selective use of the existing orange accent.

## 2. Existing frontend architecture

NarrativeX has one editor client: `app/desktop`.

The renderer currently uses:

- React 19
- Electron + electron-vite
- React Router
- Zustand
- TanStack React Query
- Tailwind CSS v4
- Radix UI primitives
- Lucide icons
- shared UI components under `src/renderer/components/ui`
- global semantic CSS variables and Tailwind theme mappings in `src/renderer/styles.css`

Project feature screens are routed through `ProjectWorkspaceRoute` and rendered inside `WorkspaceShell`. The editor is already decomposed into Explorer, Preview/Playback, Inspector, and Timeline components. That structure is retained.

## 3. Audit summary

The current codebase already contains the beginnings of a shared visual foundation, but the visual language has drifted across features.

Primary issues:

1. `styles.css` mixes core semantic tokens, feature-specific color families, gradients, glows, shadows, and compatibility aliases.
2. Some components still hard-code colors or arbitrary shadow values in JSX instead of using semantic tokens.
3. Shared primitives do not fully encode the application's actual density. Screens frequently override input/button heights and font sizes locally.
4. Similar page headers, empty states, status messages, and action groups are implemented differently across screens.
5. Typography relies heavily on arbitrary 8-11 px sizes, which creates density but weakens hierarchy and readability.
6. Editor panels use a mix of different surface treatments, shadows, accents, and state styling even though they belong to one workstation.
7. Cards, badges, borders, glow, and rounded containers are used more often than necessary in some areas.
8. Loading, error, empty, selected, disabled, and focus states are not expressed through one common visual grammar.

## 4. Design principles

The implementation follows these priorities:

1. Consistency over decoration.
2. Hierarchy over effects.
3. Usability over novelty.
4. Product identity over generic trends.
5. Refinement over redesign.
6. Existing workflow over designer preference.

The UI should resemble a professional desktop creative tool, not a landing page or startup dashboard.

## 5. Visual direction

### Personality

The design direction is a restrained professional creative workstation with subtle cinematic/editorial character.

Reference qualities may be learned from products such as DaVinci Resolve, Lightroom, Linear, Figma, Framer, Raycast, and Notion Calendar, but no interface should be copied directly.

NarrativeX should remain visually identifiable through its dark graphite/navy foundation, compact workstation density, and selective orange accent.

### Surfaces

Use adjacent, edge-to-edge panels and subtle separators rather than floating cards.

Surface hierarchy should primarily come from small luminance differences:

- base application background
- panel surface
- raised control/toolbar surface
- selected/hover surface
- overlay surface for dialogs, menus, popovers, and tooltips

Shadows are reserved for overlays, drag states, and genuinely floating elements.

### Accent

Orange remains the primary NarrativeX accent.

Use it for:

- primary actions
- selected navigation state
- active timeline/playhead state
- focus treatment
- progress and important interactive feedback

Do not use orange glow, gradient, or highlighted borders as general decoration.

Secondary semantic colors remain available for success, warning, danger, and information states, but should not become feature branding.

## 6. Foundation changes

### 6.1 Semantic tokens

Refine `styles.css` around a smaller semantic model.

Core groups:

- background/surface/elevated/hover/selected
- subtle/default/strong borders
- primary/secondary/muted/disabled text
- accent
- success/warning/danger/info
- focus ring
- overlay shadow
- spacing scale
- control heights
- typography roles
- radii
- motion durations

Existing feature aliases may remain temporarily only when required for safe migration. New JSX should not introduce new arbitrary visual values when an existing semantic token can represent the intent.

Target radii:

- small controls: 4 px
- standard controls: 6 px
- exceptional larger surfaces: 8 px

Target motion:

- 120-160 ms for hover, selection, menus, buttons, tooltips, and subtle panel state changes

Target control density:

- compact: 28 px
- standard: 32 px
- larger controls only when interaction requires it

### 6.2 Typography

Replace arbitrary per-screen text sizing with a small hierarchy.

Target roles:

- page title: approximately 16 px
- section/component title: approximately 13-14 px
- body/control text: approximately 12-13 px
- metadata/label/caption: approximately 10-11 px

Very small 8-9 px text should be removed except where a genuinely low-priority technical label requires it.

Hierarchy should come from weight, color, spacing, and grouping in addition to size.

### 6.3 Shared controls

Update existing shared primitives rather than creating a parallel component system.

Priority components:

- Button
- Input
- Textarea
- Select
- Tabs
- Dialog
- Dropdown Menu
- Tooltip

Add or normalize shared patterns only when they are reused across features, such as:

- icon-only action treatment
- page/section header
- status message
- empty state
- compact toolbar group

Avoid abstractions that have only one consumer.

## 7. Workspace shell

Retain the current workspace structure and routing.

The left activity rail remains in the same location and preserves the same navigation destinations.

Refinement goals:

- remove hard-coded selected background colors and arbitrary glow
- make active state clear through semantic selected background, accent text/icon, and restrained indicator treatment
- use consistent icon sizing and label typography
- preserve compact desktop density
- keep separators subtle
- maintain accessible focus and hover states

The workspace error banner should use the same semantic status treatment as other feature-level messages.

## 8. Shared page pattern

`FeaturePage` should become the canonical page frame where appropriate.

The pattern contains:

- compact page header
- optional restrained eyebrow/context label
- page title
- concise description where useful
- action area
- scrollable content region

Screens that intentionally use a specialized editor layout do not need to use this frame.

The Projects screen should adopt the same header hierarchy rather than maintaining a visually separate duplicate pattern.

## 9. Projects and non-editor feature screens

Projects, Chapters, Storyboard, Characters, Media, Voice, Assets, Render, and Settings should use the same visual grammar for:

- headers
- toolbars
- controls
- section separators
- selected rows/items
- empty states
- loading states
- error states
- badges/statuses when they are genuinely useful
- context actions

Cards should only remain where the content itself is naturally card-like, such as a project thumbnail or media asset. Sections and rows should not automatically become cards.

Content density should remain desktop-first.

## 10. Editor

The current editor layout remains unchanged:

- Project Explorer
- Preview/Playback
- Inspector
- Timeline

No workflow or panel-position redesign is part of this task.

### Explorer

Refine hierarchy, indentation, selected state, hover state, truncation, action alignment, and information density.

Do not make every chapter, scene, or beat a floating card.

### Preview

Keep preview as the main visual focus without adding decorative framing.

Refine:

- canvas/background relationship
- playback toolbar
- media loading/empty/error states
- active/focus states
- surrounding separator hierarchy

### Inspector

Normalize field spacing, labels, inputs, selects, destructive/reset actions, notices, and section separation.

Avoid nested card containers for normal property groups.

### Timeline

The timeline should read as an editing tool rather than a row of cards.

Refine:

- track headers
- clip boundaries
- selected clips
- playhead
- timestamps
- transition visualization
- hover and snapping states where already supported
- toolbar controls

Do not introduce new timeline behavior as part of the visual refactor.

## 11. Interaction states

Every shared interactive component affected by the refactor should provide coherent states for:

- default
- hover
- focus-visible
- pressed/active
- selected
- disabled
- loading
- error where applicable

Focus treatment must remain keyboard-visible and use semantic focus tokens.

Long text, narrow widths, truncation, overflow, and disabled async actions must be reviewed during visual QA.

## 12. Loading, error, and empty states

Empty states should be direct and application-like.

Preferred pattern:

- short factual title
- one short useful explanation when necessary
- one clear action when an action exists

Avoid marketing-style copy.

Loading states must avoid layout jumps where practical. Use skeletons only when they improve perceived continuity; do not add skeleton complexity everywhere.

Async buttons should preserve disabled/loading behavior already provided by feature logic.

## 13. Scope boundaries

This refactor must not:

- change API contracts
- change state management
- change routing
- change business logic
- change project workflow
- change editor data flow
- change permissions or validation
- change render behavior
- replace the component library
- replace Tailwind
- introduce a second theme/design-token system
- introduce a mobile-first editor redesign
- add decorative glassmorphism, neon, uncontrolled gradients, or excessive shadow

If a presentation improvement appears to require behavior changes, that change must be separately justified and kept minimal.

## 14. Migration strategy

Use a foundation-first incremental migration.

Order:

1. Refine semantic tokens and base styles.
2. Normalize shared controls.
3. Normalize shared page/status/empty-state patterns.
4. Refine `WorkspaceShell`.
5. Migrate Projects and standard workspace screens.
6. Refine editor Explorer, Preview, Inspector, and Timeline.
7. Remove obsolete visual aliases and duplicated styles only after confirming they have no remaining consumers.
8. Perform whole-application visual consistency review.

This ordering avoids manually fixing the same pattern in many screens and reduces regression risk.

## 15. Testing and verification

Source-level verification must include the existing Desktop checks:

- dependency-lock verification
- Desktop tests
- TypeScript type-check
- production build
- full Desktop `npm run check`

For UI changes, repository guidance also requires runtime UI verification.

Runtime verification should:

1. Start or reuse the Electron/Vite development environment.
2. Navigate to every affected screen.
3. Exercise the affected user flows.
4. Inspect console errors and failed API requests.
5. Check loading, error, empty, selected, disabled, hover, focus, overflow, and long-text states.
6. Capture screenshots when supported.
7. Review spacing, hierarchy, alignment, unnecessary borders, excessive radius, excessive accent, and density.

If runtime UI automation cannot be performed in the available environment, the implementation must be reported as runtime-verification blocked rather than visually verified.

## 16. Completion criteria

The refactor is complete only when:

- major feature screens feel like parts of the same product
- shared controls no longer require routine per-screen density overrides
- hard-coded visual values are materially reduced and replaced by semantic intent
- arbitrary glow/shadow/gradient usage is removed except where functionally justified
- editor layout and workflow remain unchanged
- interactive and async states remain functional
- lint/type-check/tests/build and repository checks pass
- runtime UI verification passes, or the exact runtime-verification blocker is explicitly reported

The final result should feel like the existing NarrativeX product after a careful senior product-design and frontend polish pass, not like a new template applied on top of it.
