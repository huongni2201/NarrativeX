# Desktop Renderer Clean Architecture Design

Date: 2026-08-28
Status: Approved design, pending implementation plan
Scope: `app/desktop/src/renderer`

## Context

The desktop renderer is already organized primarily by feature and already contains good examples of feature-local API and query modules. However, several large screens currently mix rendering, local UI state, TanStack Query orchestration, backend calls, Electron bridge calls, persistence, multi-step workflows, cache invalidation, and error handling.

The highest-priority hotspots are Storyboard, Editor, and Chapters. This design standardizes the renderer around the architecture that already fits the repository instead of introducing a separate global Clean Architecture hierarchy or a new global state framework.

## Goals

1. Make screens composition-focused and easy to understand.
2. Separate UI, server-state orchestration, multi-step workflows, transport, and pure domain/view logic.
3. Make business/workflow behavior testable without rendering entire screens.
4. Keep backend data authoritative through TanStack Query.
5. Preserve the existing Electron/backend ownership boundaries.
6. Preserve current UI, API contracts, IPC contracts, and user-visible behavior during the refactor.
7. Establish dependency rules that prevent future screens from accumulating API, native, and workflow logic again.

## Non-goals

- No backend API redesign.
- No database/schema changes.
- No Electron IPC contract redesign unless an existing call cannot be represented safely behind an adapter.
- No Redux migration.
- No replacement of TanStack Query.
- No broad UI redesign in the architecture-cleanup phase.
- No attempt to refactor every renderer feature in one pull request.

## Chosen Architecture

Use feature-oriented architecture with explicit feature-local layers:

```text
features/<feature>/
  screens/        # route-level composition
  components/     # presentation and focused interaction
  hooks/          # controller/view-model orchestration
  queries/        # TanStack Query keys, queries, mutations, polling, invalidation
  services/       # multi-step application workflows/use cases
  api/            # pure backend transport
  model/          # types, selectors, reducers/state machines, pure logic
```

A feature may omit folders that it does not need. The folder layout is a boundary guide, not a requirement to create empty abstractions.

### Dependency direction

```text
screens
  -> components
  -> hooks

hooks
  -> queries
  -> services
  -> model

queries
  -> api
  -> model

services
  -> api
  -> native adapters
  -> model

components
  -> model/types

model
  -> no React, transport, or native runtime dependencies
```

The following dependencies are prohibited in newly refactored code:

```text
component -> backend API
component -> queryClient
component -> window.narrativex workflow
screen -> backend API
screen -> queryClient cache orchestration
screen -> multi-step native/backend workflow
api -> React
model -> React
model -> backend/native transport
```

A screen may invoke actions exposed by a controller hook and render query-derived state exposed by that controller. It must not know how cache invalidation, native materialization, asset registration, or workflow retries are implemented.

## Layer Responsibilities

### Screens

Screens are route-level composition roots for a feature. They may:

- obtain route/project/chapter identifiers,
- invoke one feature controller hook,
- compose major feature components,
- bind controller state/actions to components.

Screens should not directly call feature APIs, `queryClient`, `localStorage`, or multi-step Electron bridge workflows.

Target guideline: approximately 150-300 lines for large feature screens. This is a guideline, not an absolute rule; responsibility is more important than line count.

### Components

Components receive data and callbacks through props. They should focus on rendering and local interaction behavior.

A component can own ephemeral presentation state that does not affect other feature units, such as whether a popover is open. It should not own backend entities or hidden workflow state.

### Controller hooks

Controller hooks act as feature view models. They combine:

- query/mutation state,
- feature-local selection state,
- derived selectors,
- application service actions,
- user-facing busy/progress/error state.

Controllers expose a stable shape that screens/components consume. They do not implement raw HTTP requests or native bridge details.

### Query modules

Query modules own server-state behavior:

- query keys,
- `useQuery` and `useMutation`,
- polling rules,
- invalidation and refetch policy,
- optimistic updates only when justified,
- normalization of transport errors into application-facing errors when appropriate.

Query keys must be centralized per feature instead of duplicated as array literals across screens.

### API modules

API modules are pure backend transport adapters. They may:

- build request paths and payloads,
- call the shared renderer HTTP client,
- parse/guard transport responses.

They must not import React, TanStack Query, toast/notice code, browser persistence, or Electron native workflows.

### Services

Services own application workflows that span more than one transport/native step.

Examples:

- Gemini visual-beat generation,
- beat media upload/commit/attach,
- reference materialization before native generation,
- asset registration followed by production attachment.

Services must expose explicit input/output contracts and be testable with transport/native dependencies mocked or injected at module boundaries.

### Model

Model modules contain pure code:

- types,
- selectors,
- sorting/filtering,
- derived status,
- small reducers/state machines,
- validation that does not perform I/O.

Model code should have the highest unit-test coverage because it is cheap and deterministic to test.

## State Ownership

Use the smallest appropriate owner for each state category.

```text
Backend/server state          -> TanStack Query
Form state                    -> local component/form hook
Ephemeral presentation state  -> local component state
Feature orchestration state   -> controller hook or feature store
Cross-screen persistent state -> Zustand only when truly needed
Pure derived state            -> selectors/useMemo
```

Backend entities such as chapters, characters, assets, storyboard data, and timeline/production data must not be duplicated into Zustand as a second authority.

The existing project-session store remains appropriate for true cross-screen client session state.

## Standard Data Flow

```text
User action
  -> Component callback
  -> Screen/controller action
  -> Mutation or application service
  -> API adapter and/or typed Electron bridge
  -> Backend/native result
  -> Query invalidation/refetch
  -> Controller derives new view state
  -> UI re-renders
```

Server mutations should converge back through the query cache instead of manually patching multiple local copies of the same backend entity.

## Storyboard / Gemini Workflow

The current Gemini generation flow is a primary example of logic that belongs outside the screen.

Target flow:

```text
VisualBeatCard.onGenerate(beatId)
  -> useStoryboardController.generateBeat(beatId)
  -> useGenerateGeminiBeat mutation
  -> gemini-generation.service
       1. fetch Gemini/storyboard context
       2. resolve and materialize reference assets
       3. invoke typed Electron Gemini generation
       4. register generated asset with backend
       5. commit/move the generated local file as required
       6. attach generated asset to the visual beat
       7. return result
  -> invalidate storyboard/production/asset queries
  -> UI updates from query data
```

The service owns the sequence and cleanup/error mapping. The controller owns which beat is active and which user-facing progress state to expose. The screen only binds actions and state to UI.

## Gemini Batch Queue

Batch generation requires explicit workflow state rather than multiple unrelated booleans.

Queue state:

```text
idle -> running -> paused -> running
running -> completed
running -> failed
failed -> running     # retry/resume
```

Item state:

```text
pending
materializing
generating
saving
completed
failed
skipped
```

If queue resume across renderer restarts is required, persistence must be hidden behind a feature abstraction such as `gemini-queue.persistence.ts` or a small feature store. Screens must not read/write browser `localStorage` directly.

Persist only information needed to resume safely. Backend asset/storyboard entities remain backend-owned and are reloaded through queries.

## Editor Media Workflow

Editor media operations follow the same separation.

Target flow for an upload/attach operation:

```text
Editor UI
  -> editor controller
  -> beat-media service
       1. invoke native asset picker
       2. register selected asset
       3. commit selected asset into managed storage
       4. compute/choose media fit using existing production logic
       5. update visual beat media
  -> invalidate relevant production/assets queries
  -> controller updates preview state from query result
```

Remote preview URL resolution should move to a query/helper boundary rather than having the screen directly call asset transport APIs inside effects.

Retry and stale-request protection should be implemented in the service/controller layer and covered by tests.

## Chapters Workflow

Chapter CRUD should continue to use feature query hooks. Analysis/generation job orchestration should move out of `ChaptersScreen` into chapter/generation-specific query/controller hooks.

The controller should expose semantic state such as:

- `isAnalyzing`,
- `analysisProgress` when available,
- `analysisError`,
- `canAnalyze`,
- `analyzeChapter()`.

Polling termination, query invalidation, and mapping of terminal job states belong in the query/application layer rather than the screen.

## Loading and Progress State

Each source of loading has a single owner:

```text
Initial/fetch loading  -> query status
Mutation pending       -> mutation status
Workflow progress      -> controller/store state machine
Form submission        -> form/mutation state
Native operation busy  -> workflow/controller state
```

Avoid parallel booleans such as `busy`, `loading`, `generating`, and `saving` for one workflow. Prefer a semantic phase/status where the workflow has multiple steps.

The controller maps internal phases into UI-friendly properties. Components receive simple props such as `isGenerating`, `progressLabel`, `canRetry`, and `error`.

## Error Handling

Introduce a small renderer application error shape or equivalent helper:

```ts
type AppError = {
  code: string;
  message: string;
  retryable: boolean;
  cause?: unknown;
};
```

This does not require rewriting every existing error immediately. Refactored workflows should normalize backend/native errors at query/service boundaries so UI code does not parse exception strings or native error structures.

Error responsibilities:

- API/native adapter: preserve actionable transport/runtime details.
- Service/query layer: map errors into semantic application errors and retryability.
- Controller: decide which error applies to which feature action/beat.
- UI: decide presentation only (inline message, banner, toast, retry button).

Expected errors must not be silently swallowed. Cleanup/rollback behavior for partially completed workflows must be explicit in the relevant service tests.

## Testing Strategy

This refactor is behavior-preserving. Characterization tests should be added or strengthened before extracting logic where existing coverage is insufficient.

Testing pyramid:

```text
Runtime/E2E verification
Component interaction tests
Controller/query tests
Service workflow tests
Pure model unit tests
```

### Model tests

Test selectors, sorting/filtering, status derivation, and state-machine transitions without React or I/O mocks.

### Service tests

Test multi-step workflows by mocking API/native boundaries. Important cases include:

- successful Gemini generation and attachment,
- failure during materialization,
- native generation failure,
- asset registration failure,
- commit failure after registration,
- beat attachment failure,
- retryable vs non-retryable errors,
- stale request protection where applicable.

### Query tests

Verify:

- correct query keys,
- API invocation,
- invalidation/refetch behavior,
- polling stop conditions,
- terminal generation/analysis job state mapping.

### Controller tests

Verify orchestration and UI-facing state:

- selection changes,
- action enable/disable rules,
- workflow progress mapping,
- error/retry exposure,
- batch queue transitions.

### Component tests

Test visual behavior and callbacks with data/actions passed as props. Backend and Electron bridge details should not be required for ordinary component tests.

### Screen tests

Keep screen tests light: composition/smoke tests and a small number of critical integration flows. Do not recreate all service logic through giant screen tests.

### Verification gates

For each refactored phase:

1. targeted tests for touched feature code,
2. desktop test suite,
3. TypeScript type-check,
4. desktop production build,
5. repository verification script when appropriate,
6. runtime desktop UI verification for affected screens as required by repository guidance.

A phase is not considered fully verified if required runtime UI verification cannot be performed; that limitation must be reported explicitly.

## File and Complexity Guidelines

Use responsibility rather than line count as the primary split criterion. Suggested guardrails:

- route-level screen: target 150-300 lines,
- controller hook: target below roughly 300 lines,
- focused UI component: target below roughly 250 lines,
- service: one coherent application workflow/use case,
- API module: one backend resource/domain boundary,
- model module: pure, side-effect-free responsibility.

If a file exceeds these ranges but still has one clear responsibility and is easy to test, splitting is optional. Conversely, a smaller file that mixes unrelated responsibilities should still be split.

## Migration Plan and Scope

Implementation will be incremental to minimize regressions.

### Phase 1: Storyboard

Refactor the highest-coupling workflow first.

Expected extractions:

```text
storyboard/
  screens/StoryboardScreen.tsx
  components/
  hooks/useStoryboardController.ts
  hooks/useGeminiQueue.ts or equivalent feature store adapter
  queries/storyboard.keys.ts
  queries/storyboard.queries.ts
  queries/storyboard.mutations.ts
  services/gemini-generation.service.ts
  services/beat-media.service.ts where storyboard-specific operations belong
  model/storyboard-selectors.ts
  model/storyboard-review.ts
```

Existing files may be retained/renamed when they already fit the target responsibility. Avoid churn for naming alone.

### Phase 2: Editor

Extract direct asset/production/native workflows and preview resolution from `EditorScreen` into controller/query/service boundaries. Preserve the current editor UI and planner behavior.

### Phase 3: Chapters

Move analysis-job mutation/polling/terminal-state orchestration from `ChaptersScreen` into feature queries/controllers while preserving existing chapter CRUD hooks.

### Follow-up phases

After Phase 1-3 are stable and verified, apply the same boundary rules to:

1. Generation/Images,
2. Characters,
3. Voice,
4. Projects.

These follow-up phases should reuse the pattern proven by the first three features and should not be bundled into the initial architecture-cleanup pull request unless their changes are trivial and necessary for shared abstractions.

## Shared Abstractions

Do not create a generic abstraction until at least two features need the same behavior and the common contract is clear.

Good candidates after duplication is proven:

- shared `AppError`/error normalization helper,
- typed native bridge wrapper helpers,
- shared query invalidation helpers only for truly shared resources.

Avoid generic `BaseService`, `BaseController`, or repository-pattern wrappers around the existing HTTP client. They add indirection without solving a current problem.

## Compatibility and Behavior Preservation

During architecture cleanup:

- keep current route behavior,
- keep current visual layout and controls,
- keep backend request/response contracts,
- keep asset storage semantics,
- keep existing Electron main/preload responsibility boundaries,
- keep current generation/retry semantics unless an existing behavior is demonstrably incorrect and fixed in a separately documented change.

If a hidden bug is discovered during refactoring, prefer adding a characterization/regression test and fixing it in a separately identifiable commit or follow-up change rather than silently changing behavior inside structural moves.

## Acceptance Criteria

Phase 1-3 architecture cleanup is successful when:

1. Storyboard, Editor, and Chapters screens no longer directly orchestrate backend/native multi-step workflows.
2. Feature APIs are transport-only.
3. Query keys and invalidation are feature-local and centralized.
4. Gemini generation and editor media workflows can be unit tested without rendering the route-level screen.
5. Components do not need backend/native mocks for ordinary interaction tests.
6. Backend entities remain TanStack Query-owned rather than copied to global client state.
7. Persisted Gemini queue behavior, when needed, is behind a feature abstraction instead of direct screen `localStorage` access.
8. Existing UI behavior and API/IPC contracts remain compatible.
9. Targeted tests, desktop tests, type-check, and build pass.
10. Affected desktop screens receive required runtime UI verification, or any verification limitation is explicitly reported.

## Implementation Principle

The refactor should improve boundaries before aesthetics:

```text
same UI
same API
same user-visible behavior
better ownership
better testability
smaller reasoning units
```

Do not combine this architecture cleanup with unrelated UI redesign or feature expansion.
