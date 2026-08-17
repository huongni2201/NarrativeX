# NarrativeX Frontend Architecture

This frontend uses Next.js App Router with feature-oriented modules. Route files should compose features; they should not contain business logic.

## Dependency direction

```text
app/ -> features/ -> shared/
             \-> types/
```

Avoid reverse imports from `shared/` into a feature. Avoid feature-to-feature imports unless the imported module is explicitly a public API.

## Recommended feature shape

```text
features/<feature>/
├── api/          # HTTP endpoints for this domain
├── components/   # presentational UI
├── hooks/        # client orchestration / view-model hooks
├── model/        # pure functions, domain rules, selectors
├── fixtures/     # test / Storybook-only data when needed
└── index.ts      # optional public feature API
```

Not every feature needs every folder. Create a folder only when it has a real responsibility.

## App Router rules

- `src/app/**/page.tsx` should stay small and route-driven.
- URL params are the source of truth for navigable state such as `projectId`.
- Keep Server Components as the default. Add `"use client"` only at interactive boundaries.
- Lazy-load large client-only prototype/editor surfaces that are not required for initial render.
- Do not import one route `page.tsx` from another route.

## State ownership

Use the narrowest owner possible:

1. local component state for ephemeral UI;
2. URL/search params for shareable navigation/filter state;
3. TanStack Query for server state;
4. Zustand only for cross-screen client state that cannot naturally live in the URL or Query cache.

Do not copy API entities into Zustand just to render them.

## Data and UI separation

- API modules return contract data.
- `model/` contains pure transforms, filters, sorting, validation and indexing.
- hooks combine server data + local interaction state into a view model.
- components receive typed props and render UI.
- avoid `as any`; add an adapter or update the type instead.

## Performance rules

- Do not statically import Storybook/test fixtures from production entry paths.
- Pre-index repeated relations with `Map`/`Set` instead of calling `.find()` inside large render/filter loops.
- Prefer server pagination/search for unbounded collections.
- Use dynamic imports for large editor/prototype surfaces that are not needed in API mode.
- Prefer semantic buttons/links for clickable cards and preserve keyboard focus styles.

## API organization

```text
shared/api/client.ts                 # transport, CSRF, protocol/errors
features/auth/api/auth.api.ts        # auth endpoints
features/projects/api/projects.api.ts# project endpoints
```

`src/lib/api.ts` is currently a compatibility facade. New feature code should import its domain API directly.

## Fixture policy

Runtime application mode is API-backed. Mock/fixture data is allowed only in tests or Storybook. Keep fixtures behind a lazy boundary when a demo screen needs them so they are not part of the normal production client graph.
