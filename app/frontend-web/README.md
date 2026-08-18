# NarrativeX Frontend Web

## Purpose
The Frontend Web application provides the NarrativeX web client for project creation, story import, production workspace flows, character/assets/preset surfaces, and backend-driven generation workflows as those contracts become available.

## Technology Stack
- **Framework**: Next.js 16 (App Router)
- **UI Runtime**: React 19
- **Language**: TypeScript (strict mode)
- **Server State**: TanStack Query
- **Client State**: Zustand for transient cross-screen/editor state only
- **Styling**: Tailwind CSS
- **Linting**: ESLint
- **Runtime / CI**: Node.js 22

## Local Prerequisites
- Node.js 22
- npm compatible with the checked-in lockfile

## Development Commands

```bash
npm ci
npm run dev
npm run lint
npm run type-check
npm run build
npm start
```

Local dev is available at `http://localhost:3000` by default.

## Docker

```bash
docker build -t narrativex-frontend-web .
docker run -p 3000:3000 narrativex-frontend-web
```

## Canonical routes

- `/` — redirect to `/projects` until a distinct backend-backed overview dashboard exists
- `/projects` — canonical project list
- `/projects/[projectId]` — project workspace
- `/characters` — character library
- `/assets` — asset library
- `/presets` — style/preset library
- `/auth` — auth entry
- `/dashboard` — legacy redirect to `/projects`

Do not expose two navigation entries that render the same project-list screen. Project identity comes from the URL. The workspace must not depend on a selected-project value in Zustand.

## Application Boundaries

The frontend owns UI composition, presentation logic, route/search-param state, transient client/editor state, client validation, and rendering backend contracts.

The frontend must not own direct AI-provider communication, direct database access, background job execution, secret storage, or fake persisted account/business data.

## Data mode and fixture policy

API mode is the runtime source of truth. `NEXT_PUBLIC_NX_DATA_MODE=mock` is reserved for test/Storybook-style demo runtimes allowed by `src/lib/data-mode.ts`.

Mock modules must be lazy-loaded behind demo boundaries. Production/API-mode entry paths must not statically import fixture modules such as project, production, asset, character, preset, job, entitlement, or account fixtures.

When a backend feature is not available yet, the API-mode UI must show an explicit unavailable/coming-soon state rather than silently using local fake data. In particular, story file import remains disabled until the backend exposes a document-upload/extraction/storage contract; the UI must not present a fake drag-and-drop uploader.

## Project creation workflow safety

Project creation currently spans two persisted resources: the Project and its initial StoryVersion. The frontend may reuse the already-created Project after a definitive HTTP error from StoryVersion creation, but it must not blindly retry after an ambiguous transport/protocol failure because the backend may already have committed the StoryVersion.

When StoryVersion commit state is uncertain, the wizard blocks retry and directs the user to inspect the created project first. This is a client-side safety guard, not a substitute for backend idempotency. The long-term backend contract should provide an idempotent or transactional orchestration endpoint for creating a project together with its initial story.

While the create workflow is pending, the wizard must not close via the close button, backdrop, Escape, step navigation, or back actions. Local workflow/error state must be reset when the wizard closes after the request is no longer pending.

## State ownership

Use this order:

1. component state for ephemeral interaction;
2. URL/search params for navigable/shareable state and filters;
3. TanStack Query for server entities and collections;
4. Zustand only for transient cross-screen state that does not naturally belong to the URL or Query cache.

Do not copy persisted API entities into Zustand simply for rendering. Project collections use cursor pagination and project workspaces load the project directly by ID.

## HTTP/auth boundary

`src/shared/api/client.ts` is transport infrastructure only. It owns request/envelope/CSRF/error mechanics and must not import Zustand or feature state. App-level session reactions to HTTP 401 are wired at the provider boundary.

New feature code should import domain APIs (`features/<feature>/api`) rather than adding new dependencies on the compatibility facade in `src/lib/api.ts`.

## Accessibility baseline

Shared form controls expose field errors through ARIA relationships. Tabs support keyboard navigation. Modals trap and restore focus. Mobile uses a dedicated bottom navigation below the desktop breakpoint. User-visible plan, credit, notification and entitlement values are hidden until backed by an API contract.

## CI quality gates

Frontend CI runs:

```bash
npm ci
npm run lint
npm run type-check
npm run build
```

All four gates must pass before merging frontend architecture/refactor changes.
