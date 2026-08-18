# NarrativeX Frontend Architecture

NarrativeX Frontend uses Next.js App Router with feature-oriented modules. Route files compose features and stay free of business logic.

## Dependency direction

```text
app/ -> features/ -> shared/
             \-> types/
```

- `shared/` must never depend on feature modules or Zustand stores.
- Features may depend on `shared/` and `types/`.
- Avoid feature-to-feature imports unless the imported feature exposes an intentional public API.
- `src/lib/api.ts` is a compatibility facade only. New feature code should import its domain API directly.

## Canonical routes

```text
/                         redirect -> /projects until a distinct overview exists
/projects                 project list
/projects/[projectId]     project workspace
/characters               character library
/assets                   asset library
/presets                  style/preset library
/auth                     auth entry
/dashboard                legacy redirect -> /projects
```

Do not introduce a second navigation entry or route that renders the same project-list screen without an explicit product requirement. A distinct `/` overview may be reintroduced only when it has its own backend-backed content. A project workspace always derives its project identity from `/projects/[projectId]`; do not infer it from a Zustand selection.

## Recommended feature shape

```text
features/<feature>/
├── api/          # HTTP endpoints for this domain
├── components/   # feature-owned UI
├── hooks/        # client orchestration / view-model hooks
├── model/        # pure transforms, validation, selectors
├── fixtures/     # test / Storybook-only data when needed
└── index.ts      # optional narrow public feature API
```

Generic primitives belong in `components/ui`; app shell components belong in `components/layout`. Domain-specific components should live under their owning feature instead of creating parallel `components/<domain>` and `features/<domain>` trees.

## App Router rules

- `src/app/**/page.tsx` stays small and route-driven.
- Never import one route `page.tsx` from another route.
- URL params/search params are the source of truth for navigable state such as `projectId`, chapter/scene identity, tabs that must deep-link, and shareable filters.
- Server Components are the default. Add `"use client"` only at interactive boundaries.
- Lazy-load large client-only editor/demo surfaces not required for the initial render.
- Legacy URLs use redirects rather than rendering an ambiguous workspace without required route state.

## State ownership

Use the narrowest owner possible:

1. local component state for ephemeral UI;
2. URL/search params for shareable navigation/filter state;
3. TanStack Query for server state;
4. Zustand only for cross-screen client state that cannot naturally live in URL or Query cache.

Do not copy API entities into Zustand merely to render them. Wizard drafts and transient editor selections may remain client state until a backend contract owns them.

## Server data

- Collection screens for unbounded data use cursor/server pagination.
- Entity workspaces fetch by stable entity ID (`GET /api/v1/projects/{projectId}` for projects), not by loading a collection and calling `.find()`.
- Query keys represent server resources and are invalidated after successful mutations.
- Search/filtering that must cover the complete unbounded collection belongs on the backend when that contract becomes available. Client filtering must be labelled/implemented only over loaded pages.

## API organization

```text
shared/api/client.ts                  # transport, CSRF, envelopes, typed errors
features/auth/api/auth.api.ts         # auth endpoints
features/projects/api/projects.api.ts # project endpoints
app/providers.tsx                     # app-level auth/session reaction to HTTP 401
```

The transport layer must not import React, Zustand, app routes, or feature state. It can expose typed errors/events; the app boundary decides how a 401 changes session UI.

## Data and UI separation

- API modules return contract data.
- `model/` contains pure transforms, filters, sorting, validation and indexing.
- hooks combine server data + local interaction state into a view model.
- components receive typed props and render UI.
- avoid `as any`; update the type or add a typed adapter.
- user-visible plan, credit, notification, job, asset or entitlement values must come from a real API contract. Until then, hide/disable the control or show an explicit unavailable state rather than fake persisted data.
- unsupported file import must remain visibly disabled until upload, storage and document-extraction contracts exist; do not render a drag/drop surface that has no real action behind it.

## Multi-step mutation safety

Project creation currently spans two persisted mutations: create Project, then create the initial StoryVersion.

- Do not treat an in-memory `useRef` as idempotency.
- After a definitive HTTP error from StoryVersion creation, reusing the already-created Project may be safe because the server returned an explicit failure.
- After an ambiguous transport/protocol failure, the client must not blindly retry StoryVersion creation because the backend may already have committed it.
- In an ambiguous state, block retry and direct the user to inspect the created Project before taking another write action.
- While a persisted multi-step workflow is pending, close/back/step-change actions that can orphan UI state must be locked.
- Reset local wizard/error/workflow state after a non-pending close.

The long-term backend contract should expose either an idempotent orchestration endpoint or a transactional create-project-with-initial-story command. Client-side safeguards reduce duplication risk but do not replace backend idempotency.

## Accessibility baseline

- All form errors connect to fields using `aria-invalid`/`aria-describedby`.
- Icon-only controls have accessible names.
- Tabs support ArrowLeft/ArrowRight/Home/End keyboard navigation.
- Modals trap focus while open, close on Escape, restore previous focus and restore the previous body scroll state.
- A modal may intentionally ignore Escape/backdrop close while a persisted mutation is pending; the close control must communicate its disabled state.
- Menus/dialogs return focus to their trigger when dismissed by keyboard.
- Small secondary text should use a contrast-safe token/value; avoid low-contrast placeholder/body text.
- Motion must respect `prefers-reduced-motion` for non-essential animation.

## Responsive shell

- Desktop sidebar is rendered at `lg` and above.
- Mobile uses the bottom studio navigation and reserves safe-area/content padding so controls are not covered.
- Do not hide horizontal overflow to compensate for a non-responsive fixed-width navigation layout.

## Fixture policy

Runtime application mode is API-backed. Mock/fixture data is allowed only in tests or Storybook. Fixtures must stay behind lazy/dynamic boundaries so API-mode production chunks do not statically import large mock modules.

## Performance rules

- Do not statically import Storybook/test fixtures from production entry paths.
- Pre-index repeated relations with `Map`/`Set` instead of `.find()` inside large render/filter loops.
- Prefer server pagination/search for unbounded collections.
- Use dynamic imports for large editor/prototype surfaces that are not needed in API mode.
- Keep `"use client"` boundaries as narrow as practical.

## Quality gates

Frontend CI must run, at minimum:

```bash
npm ci
npm run lint
npm run type-check
npm run build
```

A frontend architecture/refactor PR is not complete if any of these gates fail.
