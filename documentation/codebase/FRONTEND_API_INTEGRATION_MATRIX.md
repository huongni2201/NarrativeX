# NarrativeX Frontend API Integration Matrix

This matrix records the current UI-to-backend wiring and the next backend contracts needed. API mode is authoritative; unavailable backend capabilities must remain explicit rather than falling back to fixture data.

| Screen/Feature | Route | Current Data Source | State | Existing Client Function | Required / Current Backend API | Missing Work |
|---|---|---|---|---|---|---|
| Auth | `/auth`, app shell | server session bootstrap + Google OIDC + logout | API FOUNDATION | `authApi.getCurrentUser`, `authApi.logout`, `authApi.googleLoginUrl` | `GET /api/auth/me`, `/oauth2/authorization/google`, `POST /logout` | server-side bootstrap can be considered later to reduce auth hydration wait |
| Project list | `/projects` and overview entry | TanStack Query cursor pages | API | `projectsApi.list` | `GET /api/v1/projects?limit=<n>&cursor=<opaque>` | backend search/status query if filters must cover the entire unbounded collection |
| Project detail/workspace | `/projects/[projectId]` | direct entity query by route ID | API FOUNDATION | `projectsApi.getById` | `GET /api/v1/projects/{projectId}` | richer project/story/chapter DTOs as production workspace expands |
| Create project | project wizard | TanStack Query mutation | API | `projectsApi.create` | `POST /api/v1/projects` | idempotency contract remains recommended |
| Story input | project wizard | Zustand draft until submit, then backend create | API FOUNDATION | `projectsApi.createStoryVersion` | `POST /api/v1/projects/{id}/stories` | read/update/version conflict contract |
| AI analysis start | wizard/workspace | disabled production capability | NOT AVAILABLE | `projectsApi.enqueueAnalysis` exists but normal create flow does not call it | `POST /api/v1/projects/{id}/analysis-jobs`, feature-gated off by default | enable only after durable enqueue/outbox/stage/worker/reconciliation invariant exists |
| Analysis progress/result | workspace | explicit pending/unavailable state | PENDING API | none | job query/event replay + result resources | polling/SSE/reconnect/UNKNOWN/failed UI and result mapping |
| Characters | `/characters` | explicit API-not-connected state | PENDING API | none | character/version/reference/lock APIs | query/mutations and canonical identity/project-usage mapping |
| Chapter/storyboard | project workspace | explicit pending state in API runtime | PENDING API | none | chapter/scene/visual-beat resources and commands | URL-owned chapter/scene deep links once backend IDs/contracts exist |
| Render/export | project workspace | explicit API-not-connected state | PENDING API | none | render job create/status/events + signed artifact URL | mutation/job/download flow |
| Assets | `/assets` | explicit API-not-connected state; demo fixtures lazy in mock runtime | PENDING API | none | asset list/detail/upload/delete/review APIs | replace demo store with Query/mutations when contract lands |
| Presets | `/presets` | explicit API-not-connected state; demo fixtures lazy in mock runtime | PENDING API | none | preset CRUD APIs | replace demo store with Query/mutations when contract lands |
| Notifications / credits / plan / settings / jobs | shell | hidden/disabled until real contract exists | PENDING API | none | notification, entitlement/usage and settings/job-list APIs | render real values only after contracts exist |

## Route and state rules

- `/projects` is the canonical project-list route; `/dashboard` only redirects to `/projects`.
- `/projects/[projectId]` owns project identity. The workspace never discovers a project by loading a collection and calling `.find()`.
- Navigable project-list filters live in URL search params (`status`, `q`). They currently filter loaded cursor pages only; server-wide filtering requires a backend query contract.
- TanStack Query owns persisted server state. Zustand is reserved for transient wizard/editor/demo state.

## Transport rules

- `src/shared/api/client.ts` owns request transport, credentials, CSRF, envelope validation and typed errors.
- Shared transport has no dependency on Zustand or feature/app state. A 401 is surfaced to the app boundary, where `AppProviders` updates session UI.
- New feature code imports domain APIs directly instead of extending the compatibility facade in `src/lib/api.ts`.

## Runtime safety rules

- The project-creation wizard deliberately does **not** call analysis enqueue while durable execution is unavailable.
- `POST /api/v1/projects/{id}/analysis-jobs` remains feature-gated off by default and must not persist queued work while disabled.
- API mode must never show fake analysis progress/results, fake notification counts, fake credits/plan data or fixture-backed persisted entities.
- Mock modules are lazy-loaded only in validated test/Storybook-style mock runtimes.
