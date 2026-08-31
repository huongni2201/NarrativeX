# Desktop UI foundation and themes design

**Date:** 2026-08-31  
**Status:** Approved design; pending implementation-plan review

## Purpose

Polish the existing NarrativeX Electron renderer into a coherent, professional creative-tool interface without changing the established product layout, routing, API calls, state management, desktop security boundary, or user workflows.

The renderer remains a React 19 + Tailwind 4 application using Radix primitives, Lucide icons, and the current shared UI component directory. This work is presentation-focused.

## Scope and invariants

- Keep the workspace rail and all existing routes.
- Keep the Editor's explorer, preview, timeline, and inspector composition.
- Keep existing event handlers, async flows, validation, data queries, API calls, and state stores.
- Do not add a browser editor, provider integration, renderer Node.js access, or new business state.
- Preserve dark mode as the default; add a persistent user-selectable light theme.
- Continue using Lucide as the only icon set.

## Design direction

NarrativeX is a dense, cinematic but restrained desktop creative tool. It uses connected workspace surfaces, hairline separators, compact controls, and intentional typography rather than rounded floating cards, decorative gradients, or persistent glows.

The brand accent is a burnished amber:

- Primary: `#E6A057`
- Primary hover: `#F0B66E`
- Primary foreground: `#090D14`
- Primary tint/selection: `rgba(230, 160, 87, 0.14)`
- Primary focus ring: `rgba(230, 160, 87, 0.55)`

The dark foreground on amber provides an 8.83:1 contrast ratio. White or light text is not used on the primary amber surface because it fails normal-text contrast.

## Theme and token architecture

The renderer root uses `data-theme="dark"` or `data-theme="light"`. Dark is the initial fallback. A setting control writes the selected theme to local storage and applies the root attribute at startup. This is local presentation preference only and does not introduce backend or session state.

Existing Tailwind-compatible semantic variables remain the single source of styling values and are expanded where needed for:

- base, panel, raised, input, hover, and selected surfaces;
- subtle, default, and strong borders;
- primary, secondary, muted, disabled, success, warning, danger, and info text/states;
- radii, spacing, control heights, shadows, and motion durations.

The light theme supplies equivalent semantic values. Media canvases and timelines may retain a dark studio surface in either theme for legibility and visual focus; surrounding app surfaces adapt to the selected theme.

Raw color values are removed from component JSX when an equivalent semantic token exists. Legacy aliases are retired only after their callers have migrated.

## Shared component system

Shared components are updated before feature screens:

- **Buttons:** primary, outline/secondary, ghost, destructive, and icon-only variants share height, radius, focus, pressed, disabled, and loading behavior.
- **Forms:** input, textarea, select, menus, and tabs share surface, border, hover, focus, disabled, and error conventions.
- **Overlays:** menus, tooltips, and dialogs use the only elevated shadow scale; permanent workspace panels remain flat.
- **Panels:** adjacent editor panels use separators and consistent headers. Independent tiles, media items, and form groups may use a restrained card treatment.
- **Typography:** establish compact desktop roles for page title, section title, body, label, metadata, and caption. Metadata may remain compact; core body text and controls no longer depend on arbitrary 9–10px values.

Icon-only controls keep an accessible name and tooltip, with non-color hover, pressed, focus, and disabled feedback.

## Screen application

- **Workspace rail:** retain current navigation and labels; clarify active state with amber tint, indicator, weight, and hover without a card or glow treatment.
- **Editor:** retain grid geometry. Improve canvas framing, explorer rows, inspector controls, timeline tracks/clips/playhead, toolbars, selected state, and overflow handling. Remove non-semantic gradients and glows.
- **Projects, Chapters, Storyboard, Characters, Images, Voice, Assets, Render, Settings:** reuse the foundation for headers, action hierarchy, spacing, panels, form controls, lists/grids, notices, and status markers. No screen changes routing or workflow.
- **Async and absent data:** retain existing data behavior but ensure loading space is reserved, async buttons communicate pending state, errors contain recovery actions where one already exists, and empty states are concise and action-oriented.

## Interaction and accessibility

- Use 120–180ms transform/color/opacity transitions only for feedback with a cause.
- Respect the existing reduced-motion rule.
- Keep visible keyboard focus indicators with sufficient contrast and offset.
- Do not rely only on color for status or selection.
- Maintain semantic labels, `aria-live` feedback, and existing dialog focus management.
- Preserve desktop density while keeping controls operable at narrower widths; the existing Editor breakpoints continue to constrain rails/panels rather than changing the application into a mobile-first layout.

## Verification

1. Run the desktop unit tests, TypeScript check, and production build.
2. Launch the Electron/Vite development environment and navigate through all affected routes.
3. Exercise theme selection/persistence and core affected interactions, including hover, focus, selected, disabled, loading, error, empty, long text, dialogs, and menus.
4. Inspect console errors, failed API calls, and ensure no mock runtime data is selected.
5. Capture screenshots in both themes for representative editor and management screens.
6. Re-audit spacing, typography, border/elevation use, alignment, hierarchy, overflow, and contrast before completion.

## Out of scope

- Any rearchitecture of renderer state, feature flow, backend contracts, API, or authentication.
- New design-system package or a replacement UI library.
- Layout restructuring of existing workspace/editor screens.
- A complete visual rewrite or decorative branding treatment.
