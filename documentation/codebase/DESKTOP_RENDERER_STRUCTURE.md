# Desktop Renderer Structure

This document defines the implementation structure for the NarrativeX Electron renderer. It is an implementation guideline for the existing Desktop boundary, not a new runtime or product architecture decision.

## Goals

The renderer should remain easy to change as Chapter, Voice, Image, Editor and Render workflows grow. The structure favors feature ownership, explicit dependency direction and small presentation components without moving backend policy or native Desktop responsibilities into React.

## Directory ownership

```text
app/desktop/src/renderer/
  app/
    DesktopApp.tsx
    DesktopRouter.tsx
    providers.tsx

  api/
    client.ts
    guards.ts
    pagination.ts
    ...cross-feature transport only

  components/
    ui/
      ...domain-free UI primitives

  features/
    <feature>/
      api/
        ...transport adapters for this feature
      queries/
        ...React Query hooks, query keys and cache invalidation
      model/
        ...pure types, selectors, derived state and presentation helpers
      components/
        ...feature-owned presentation components
      screens/
        ...route/page containers and orchestration
      store/
        ...client-only feature state when durable server state is not appropriate

  lib/
    ...small utilities that are genuinely shared by unrelated features
```

Not every feature needs every folder. Create a layer only when it has a real responsibility.

## Dependency direction

Use this dependency direction inside a feature:

```text
screen
  -> queries
  -> components
  -> model

queries
  -> api
  -> model (only when a pure helper is needed)

components
  -> model
  -> components/ui

model
  -> shared contracts / pure libraries only
```

Avoid these dependencies:

- `api` importing React components, screens or stores.
- `queries` importing screens or feature layout components.
- `model` importing React Query, routing, Electron bridges or network clients.
- `components/ui` importing any NarrativeX feature.
- one feature reaching into another feature's `screens/` directory.

Cross-feature workflow composition belongs in a workspace/editor container rather than by importing another feature's screen.

## Screen responsibilities

A screen is a route-level container. It may:

- own route/navigation integration;
- compose feature queries and mutations;
- coordinate optimistic/local form state;
- translate server state into view-model props;
- coordinate confirmation and navigation guards;
- connect presentational callbacks to commands.

A screen should not contain an entire multi-panel product surface inline. When a screen contains independently understandable areas such as a list panel, editor panel, inspector/context panel, filter bar or media card, extract those areas into feature-owned components.

The goal is not an arbitrary line-count limit. The goal is one reason to change per component and an obvious place to add behavior.

## Model responsibilities

`model/` contains deterministic code that can be understood without React lifecycle knowledge, for example:

- status-to-label or status-to-style mapping;
- display-state derivation;
- filtering and sorting rules that are presentation concerns;
- duration/count/format helpers that are feature-specific;
- feature UI types such as filters and sort modes.

Business authorization, entitlement, cost policy and durable lifecycle rules remain authoritative on the backend. Renderer model helpers only present or derive already-authorized state.

## Shared utilities

Do not move a helper into `lib/` merely because it is small. A helper belongs in `lib/` when unrelated features have the same semantic need and the helper has no feature knowledge.

Examples:

- good shared utility: converting an unknown caught error into a fallback UI message;
- keep feature-local: Chapter pipeline status labels;
- keep feature-local: Voice language badge formatting unless another unrelated feature needs the exact same semantic representation.

This keeps `lib/` and `components/ui/` from becoming catch-all folders.

## UI and styling rules

- Use the semantic CSS variables and Tailwind theme tokens defined in `styles.css`.
- Prefer reusable UI primitives in `components/ui` for buttons, inputs, dialogs and similar domain-free controls.
- Keep feature-specific compositions in the owning feature.
- Preserve keyboard focus and visible focus states for every interactive control.
- Do not create nested interactive elements such as a clickable `div` containing another button.
- Important form actions should remain reachable when a long panel scrolls; use a stable panel footer when appropriate.
- Design multi-column workspace layouts for compact Desktop widths as well as large monitors. Prefer graceful wrapping or explicit overflow over clipped controls.
- Every data surface must account for loading, empty, error and busy states.
- Runtime renderer code must use real data contracts; mock data is test/fixture-only.

## State rules

- React Query owns server state, invalidation and polling.
- Local `useState` is appropriate for ephemeral form/filter/selection state scoped to a screen.
- Zustand is for client state that must survive component boundaries and is not server-authoritative; do not mirror React Query data into Zustand without a concrete need.
- Avoid storing derived state when it can be calculated from source state with a pure selector or `useMemo`.
- Long-running jobs need an explicit busy/processing state and duplicate-submit protection in UI in addition to backend idempotency.

## Electron boundary

Renderer refactoring must preserve the existing Electron security boundary:

- no unrestricted Node.js, filesystem or process access in renderer code;
- native actions go through the narrow typed preload bridge;
- Electron main owns native filesystem, protected credentials, system-browser/deep-link behavior and FFmpeg execution;
- renderer state must not expose or persist absolute local project paths.

## Verification

For Desktop changes, run the narrow quality gate during iteration:

```powershell
cd app/desktop
npm ci
npm test
npm run type-check
npm run build
```

Before merge, run the repository local gate documented in `CONTRIBUTING.md`.

UI changes additionally require runtime verification: launch the Electron/Vite environment, exercise affected flows, inspect console/network failures and visually verify loading/error/empty/overflow states. Source review and build success alone are not sufficient to claim UI verification.
