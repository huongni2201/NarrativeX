# ADR-0008: Runtime API mode and fixture isolation

## Status

Accepted

## Date

2026-08-17

## Context

The frontend had production-looking screens backed by `useProductionStore`,
including a mock project, chapters and visual beats. The main application could
therefore display business data that was not persisted by the backend. The
backend does not yet expose the chapter, character, storyboard, render or
export contracts required by those screens.

This is especially risky for mutations: adding a chapter or approving a visual
beat could appear successful while changing only browser memory.

## Decision

- API is the only default application runtime mode.
- Production and staging never initialize production business state from
  fixtures.
- Storybook and test runtimes may use fixture-backed prototype screens.
- In API mode, unsupported capabilities render an explicit `Not connected` or
  `Coming soon` state until their backend contract exists.
- TanStack Query owns persisted server state. Zustand owns navigation, filters,
  selection, modal state and other UI/editor state; fixture-backed prototype
  state is permitted only in the test/Storybook boundary.
- React Query uses a conservative default `staleTime`; job queries must add
  explicit polling only when a durable job-status contract is available.

## Consequences

### Positive

- The main application cannot silently present a fake production project.
- Unsupported writes are not represented as successful persisted actions.
- Backend/API gaps are visible to product and engineering instead of being
  hidden behind local state.
- Query freshness and rerender behavior have safe defaults for future API
  resources.

### Negative

- Production workspace and Character Library capabilities remain visibly
  incomplete until their APIs are implemented.
- Existing prototype screens need an explicit test/Storybook runtime to be
  exercised.
- Server-side character search, cursor pagination and job polling remain
  separate API implementation tasks.

## Implementation notes

- `useProductionStore.project` is `null` outside mock mode and its business-data
  actions fail closed.
- `ProductionShell` and `CharacterLibrary` show connection status instead of
  falling back to fixtures in API mode.
- `data-mode.ts` remains the single runtime-mode guard.

## Related decisions

- [ADR-0002: PostgreSQL authoritative state and durable provider operations](./ADR-0002-durable-state-and-provider-operations.md)
- [ADR-0007: Fail-closed OIDC profiles and browser CSRF protection](./ADR-0007-fail-closed-oidc-and-browser-csrf.md)
