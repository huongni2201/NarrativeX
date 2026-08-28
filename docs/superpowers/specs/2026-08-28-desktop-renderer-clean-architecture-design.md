# Desktop Renderer Feature-Boundary Design

Date: 2026-08-28
Status: Approved for implementation
Scope: `app/desktop/src/renderer`

## Authority

This refactor follows the current repository authority order:

1. current code, Flyway migrations and automated tests for AS-IS behavior;
2. accepted ADRs for intentional cross-cutting boundaries;
3. `documentation/source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`;
4. current implementation docs such as `documentation/codebase/DESKTOP_RENDERER_STRUCTURE.md`.

The current renderer structure document supersedes the earlier draft idea of mandatory `hooks/` and `services/` layers. Do not introduce layers merely to satisfy a theoretical architecture.

## Goal

Reduce coupling in the Storyboard, Editor and Chapters renderer hotspots while preserving current UI behavior, backend contracts, preload contracts and local-first media semantics.

The refactor should make server-state behavior and workflow sequencing easier to test without turning the renderer into a second backend or moving native capabilities out of Electron main.

## Canonical feature structure

Use the existing renderer feature structure:

```text
features/<feature>/
  api/         # raw backend transport for the feature
  queries/     # React Query hooks, query keys, mutations, polling, invalidation
  model/       # pure types, selectors, state transitions and presentation helpers
  components/  # feature-owned presentation components
  screens/     # route/page containers and orchestration
  store/       # optional client-only feature state/persistence
```

Not every feature needs every folder.

## Dependency direction

```text
screen
  -> queries
  -> components
  -> model
  -> store (only for client-only state)

queries
  -> api
  -> model
  -> typed preload capability when the workflow is explicitly Desktop-owned

components
  -> model
  -> components/ui

model
  -> pure libraries/shared contracts only
```

Avoid:

- `api` importing React, screens, components or stores;
- `queries` importing screens or layout components;
- `model` importing React Query, routing, network clients or Electron bridges;
- presentational components calling backend APIs or `queryClient`;
- screens containing raw backend transport calls when a feature query/mutation module can own them;
- screens embedding long multi-step provider/media workflows that can be isolated and tested independently;
- renderer code receiving unrestricted filesystem, process, CDP or credential access.

## Screen responsibilities

A screen may own:

- route/navigation integration;
- chapter/scene/beat selection;
- ephemeral form/filter state;
- composition of feature queries and mutations;
- user-facing notices and confirmation state;
- callback wiring between presentation components and commands.

A screen should not own:

- raw HTTP transport details;
- query-key construction duplicated inline;
- browser persistence parsing/serialization mixed with rendering;
- complete multi-step Gemini/media mutation sequences inline;
- large independent product panels that can be extracted as feature components.

There is no arbitrary line-count requirement. Split by responsibility.

## State ownership

```text
Backend/server state          -> TanStack Query
Ephemeral form/filter/select  -> local React state
Pure derived state            -> model selector / useMemo
Client-only persisted state   -> feature store/persistence adapter
Cross-screen client state     -> Zustand only when necessary
```

Do not mirror Storyboard, Chapter, Asset, Production or other backend-authoritative entities into Zustand.

## Storyboard server-state flow

Storyboard query keys and mutations move into `features/storyboard/queries/`.

```text
Screen action
  -> Storyboard query/mutation hook
  -> storyboardApi
  -> backend
  -> feature-owned query invalidation
  -> screen renders refreshed query data
```

Create/review/approve mutations keep row-version semantics unchanged.

## Gemini Web boundary

ADR-0021 is mandatory.

`GEMINI_WEB` remains a Desktop-only provider path with a renderer-owned serial queue. Chrome lifecycle, CDP, provider page automation and staged-file validation remain Electron-main-only.

Generation sequence:

```text
Storyboard action
  -> backend Gemini context/prompt
  -> renderer materializes referenced assets through typed preload capability
  -> typed preload Gemini generate capability
  -> Electron main returns metadata + sender-bound single-use selection token
  -> renderer registers LOCAL_ONLY asset metadata with backend
  -> renderer invokes trusted Gemini commit capability
  -> renderer persists Visual Beat media selection
  -> invalidate Storyboard/timeline/asset queries
```

The renderer never receives arbitrary paths or CDP/process APIs.

## Gemini All queue

The queue remains renderer-owned and serial, as required by ADR-0021.

Queue state/persistence should be removed from `StoryboardScreen.tsx` and isolated into feature-local pure model + persistence adapter code.

Required behavior to preserve:

- queue is keyed by project/chapter;
- it can start, pause/resume, skip and finish;
- a queue persisted as `RUNNING` restores as `PAUSED` after renderer restart;
- deleted/invalid beats are reconciled out of the queue;
- stopping between beats does not promise cancellation of a generation already running in Chrome;
- backend Storyboard/Asset entities are not persisted as a second source of truth.

## Storyboard media mutations

Manual image import and Gemini generated-image attachment should be expressed as feature query/mutation workflows instead of raw `assetsApi` / `productionApi` calls inside the screen.

Manual image attach remains:

```text
native selection token
  -> backend local asset registration
  -> trusted ProjectStorage commit
  -> persisted beat media selection
  -> query invalidation
```

Gemini generated image attach follows the ADR-0021 flow above.

## Editor media boundary

`EditorScreen.tsx` remains the cross-feature workspace container, but raw asset/production transport and preview resolution should move into focused editor query/mutation modules.

Preserve existing behavior:

```text
native selection
  -> register local asset
  -> trusted commit
  -> existing media-fit choice
  -> production beat-media update
  -> query invalidation
```

Remote preview URL resolution should not require direct `assetsApi.downloadUrl(...)` effects in the screen.

Existing stale-request protection must be preserved so an older async completion cannot overwrite newer editor state.

## Chapter analysis boundary

`ChaptersScreen.tsx` keeps authoring/list/form/filter state. Analyze submission, generation-job polling composition, terminal-state mapping and invalidation should move into Chapter/generation query modules.

Expose semantic state to the screen such as:

```text
isAnalyzing
canAnalyze
job
error
analyze()
```

Duplicate-submit protection remains required in UI in addition to backend idempotency.

## Error/loading ownership

- query fetch state -> React Query status;
- mutation pending -> mutation status;
- multi-step Desktop workflow phase -> feature query/mutation/local orchestration state;
- form state -> local form state;
- user-facing wording -> screen/component presentation layer.

Do not invent a global error framework as part of this refactor. Reuse existing error helpers unless at least two features demonstrably need the same semantic abstraction.

## Presentation extraction

`StoryboardScreen.tsx` currently contains independently understandable regions. Extract feature-owned components where doing so reduces reasoning size, while preserving the exact visual design and behavior.

Initial candidates:

- Storyboard header/status controls;
- scene rail;
- Visual Beat list/grid;
- Gemini queue status/actions.

Components receive props/callbacks and do not perform backend transport or cache orchestration.

## Testing strategy

This is a behavior-preserving refactor. Use characterization/TDD around each extraction.

Test priorities:

1. pure queue transitions and reconciliation;
2. query-key contracts and invalidation ownership;
3. source/workflow contracts for Gemini/manual media sequencing;
4. editor media mutation boundaries and stale request behavior;
5. Chapter analysis terminal-state derivation and polling boundaries;
6. source-level feature-boundary guards preventing raw API logic from drifting back into the refactored screens.

Desktop verification:

```text
npm test
npm run type-check
npm run build
```

Before merge, run the repository local gate when the environment supports it. UI changes/refactors also require runtime Electron verification before claiming full UI verification.

## Scope

### Phase 1 — Storyboard

- centralize query keys/query hooks/mutations;
- extract Gemini queue model + persistence;
- extract manual/Gemini media mutation workflow;
- split major presentation regions without redesign.

### Phase 2 — Editor

- extract raw asset/production mutation sequences;
- extract preview resolution;
- preserve stale-request protection and current timeline behavior.

### Phase 3 — Chapters

- extract Analyze mutation/job orchestration;
- centralize semantic analysis state;
- preserve authoring UI and current generation contracts.

Generation/Images, Characters, Voice and Projects are follow-up cleanup only after these three hotspots are stable.

## Acceptance criteria

1. `StoryboardScreen.tsx` no longer directly imports `assetsApi` or `productionApi` and no longer reads/writes `localStorage` directly.
2. Storyboard query keys/invalidation live in feature query modules.
3. Gemini queue transitions/persistence are testable outside the screen.
4. Gemini/manual image attachment sequence is testable outside the route-level screen and still follows ADR-0021/local-first contracts.
5. `EditorScreen.tsx` no longer directly performs raw asset/production API workflow or remote preview transport.
6. `ChaptersScreen.tsx` no longer directly owns `generationApi.analyze` + job polling/terminal orchestration.
7. Presentational components do not need backend/native mocks for ordinary interaction behavior.
8. No backend, database, route or preload contract changes are introduced.
9. Desktop tests, type-check and build pass in a capable environment.
10. Runtime Desktop UI verification is completed before claiming the affected UI flows fully verified, or any environment limitation is reported explicitly.
