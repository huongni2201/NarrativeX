# ADR-0017: Source-owned Desktop renderer UI component stack

## Status

Accepted

## Date

2026-08-25

## Context

The Electron Desktop renderer had a large set of hand-written controls and
feature-specific CSS selectors. This made keyboard behavior, focus states and
variant consistency depend on each screen implementation. NarrativeX also needs
to preserve a distinctive dense editor surface rather than adopt a generic
browser UI kit.

## Decision

Adopt Tailwind CSS 4, source-owned shadcn/ui-style components, Radix UI
primitives, and CVA + clsx + tailwind-merge for the Desktop renderer.

Components live in `app/desktop/src/renderer/components/ui` and are committed
source, not consumed as an opaque runtime library. Radix is used for behavior
and accessibility; NarrativeX owns the styling, tokens and component API.

The migration is incremental. Button, Dialog, Tabs, Tooltip and Select are the
first shared primitives. Timeline geometry, preview art, dense editor panels
and other domain-specific compositions can retain focused CSS until their
layout contracts are migrated safely.

## Decision drivers

- Preserve the custom dark editor visual language and semantic design tokens.
- Improve keyboard navigation, focus management and modal/select accessibility.
- Keep styling build-time with no Tailwind runtime cost.
- Keep component source local so the API and visual details remain editable.
- Avoid introducing a second browser editor or a provider-specific UI layer.

## Considered options

### Continue with feature-local CSS controls

This avoids dependency work, but keeps accessibility behavior and variants
duplicated across editor and auth screens.

### Adopt a complete runtime UI library

This provides ready-made controls, but risks generic styling, API lock-in and
visual conflicts with the desktop editor surface.

### Adopt Tailwind + source-owned shadcn/Radix primitives

This adds a small dependency and build configuration cost, while giving the
renderer shared behavior, typed variants and full control of the final CSS.

## Consequences

### Positive

- Shared controls get Radix keyboard and focus behavior.
- Semantic CSS variables can be reused by utility classes and component
  variants.
- Component source can be adjusted to the editor's compact density without
  waiting for an upstream library release.
- Migration can proceed screen by screen without changing domain/API behavior.

### Negative

- The repository owns updates and compatibility for copied component source.
- Tailwind utility conventions now coexist with legacy editor CSS during the
  incremental migration.
- Dependency and build configuration become slightly larger.

## Implementation notes

- Tailwind is registered only in the Electron Vite renderer plugin.
- The `@/*` alias resolves to `src/renderer` for component imports.
- `TooltipProvider` is mounted once at the renderer root.
- Do not move filesystem, Electron, session or backend transport behavior into
  renderer components.

## Related decisions

- [ADR-0010: Establish the Electron desktop editor client boundary](./ADR-0010-desktop-editor-client-boundary.md)
- [ADR-0012: Desktop local-first project media and local render execution](./ADR-0012-desktop-local-first-media-and-render-execution.md)
