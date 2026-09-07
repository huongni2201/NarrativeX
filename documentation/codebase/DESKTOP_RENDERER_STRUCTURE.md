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

## Storyboard Gemini execution boundary

Storyboard Gemini Web generation uses the normal feature layers but has an additional authority split that must remain explicit:

```text
storyboard/api
  -> prepare/read immutable backend generation batch

storyboard/model
  -> queue transition helpers
  -> checksum-aware reference materialization dedupe

storyboard/store
  -> local execution-progress cache only

storyboard/queries
  -> verify prepared batch + materialize refs + invoke typed preload + persist output

StoryboardScreen
  -> prepare one/batch scope
  -> coordinate bounded parallel work
  -> pause/resume/reconcile attempts

preload/main
  -> validate provenance and reference checksums
  -> own Chrome/CDP and attempt journal
```

The renderer must not persist prompt/reference payloads as a competing source of truth. A queue stores `batchId`, batch fingerprint, per-beat `snapshotId` and attempt identity. Before dispatch, the renderer re-reads the same prepared backend batch only to verify stale/fingerprint state; it never replaces the snapshot prompt with a live `beat.prompt` or `gemini-context` read.

Attempt transitions are deliberately conservative. Once a beat is reserved for external dispatch, local queue state is persisted as `SUBMITTING`; restart restores ambiguous work as `UNKNOWN`. Resume asks Electron main's local attempt journal before creating another attempt. `UNKNOWN`, `SUBMITTING`, or a main-side `COMPLETED` result that has not been safely attached pauses the queue rather than blindly resubmitting.

Reference materialization is keyed by project, stable asset ID and expected SHA-256 so concurrent slots can share one materialization operation only when they expect the same bytes. Electron main hashes the resolved local file again immediately before browser upload. Renderer success cannot weaken main-process integrity validation.

A late generated output whose prepared batch became stale is allowed to become a local asset for review, but it must not attach to the current Visual Beat/timeline. Attaching a new generated preview resets beat review status to `NEEDS_REVIEW`; generation completion and creator approval are separate states.

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
- A local queue may cache execution progress, but immutable generation inputs and stale authority remain server-owned.

## Electron boundary

Renderer refactoring must preserve the existing Electron security boundary:

- no unrestricted Node.js, filesystem or process access in renderer code;
- native actions go through the narrow typed preload bridge;
- Electron main owns native filesystem, protected credentials, system-browser/deep-link behavior and FFmpeg execution;
- renderer state must not expose or persist absolute local project paths;
- browser generation requests crossing preload must carry only typed, validated provenance and stable asset identities, never arbitrary filesystem paths.

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

For Gemini Storyboard changes, runtime verification additionally needs one one-beat generation and one bounded-parallel batch with submitted provenance visible in Prompt & details. Edit canon/source while a batch is active and confirm pending work becomes stale while a late output is retained without attaching. A real-image consistency comparison is a quality gate separate from deterministic code correctness.
