# NarrativeX Frontend API Integration Matrix

This matrix records the current UI-to-backend wiring and the next backend contracts needed. API mode is authoritative; unavailable backend capabilities must remain explicit rather than falling back to fixture data.

| Screen/Feature | Route | Current Data Source | State | Existing Client Function | Required / Current Backend API | Missing Work |
|---|---|---|---|---|---|---|
| Auth | `/auth`, app shell | session bootstrap + password auth + Google OIDC + logout; authenticated `/auth` replaces to `/projects` | API FOUNDATION | `authApi.getCurrentUser`, `authApi.login`, `authApi.register`, `authApi.logout`, `authApi.googleLoginUrl` | `GET /api/auth/me`, `POST /api/auth/login`, `POST /api/auth/register`, `/oauth2/authorization/google`, `POST /logout` | server-side bootstrap can be considered later to reduce auth hydration wait |
| Project list | `/projects` and overview entry | TanStack Query cursor pages | API | `projectsApi.list` | `GET /api/v1/projects?limit=<n>&cursor=<opaque>` | backend search/status query if filters must cover the entire unbounded collection |
| Project filters/search | `/projects?status=...&q=...` | URL-owned filter state; responsive local text input with 300 ms URL debounce | CLIENT/URL | `projectsApi.list` supplies loaded pages | same project-list API today | server-side `q`/`status` query contract for filtering the full collection |
| Project detail/workspace | `/projects/[projectId]` | direct entity query by route ID | API FOUNDATION | `projectsApi.getById` | `GET /api/v1/projects/{projectId}` | richer project/story/chapter DTOs as production workspace expands |
| Create project | project wizard | TanStack Query mutation; wizard modal mounted only while open | API | `projectsApi.create` | `POST /api/v1/projects` | metadata-only creation; idempotency contract remains recommended |
| Story input | project/chapter workflow | Zustand draft until submit, then StoryVersion + first Chapter persisted through backend APIs | API | `projectsApi.createStoryVersion`, `chaptersApi.create` | `POST /api/v1/projects/{id}/stories`, `POST /api/v1/projects/{projectId}/chapters` | richer import/chapter-splitting workflow can evolve independently of persistence contract |
| AI analysis start | chapter workspace | disabled production capability; user explicitly analyzes a persisted Chapter | NOT AVAILABLE | `projectsApi.enqueueAnalysis(projectId, chapterId)` | `POST /api/v1/projects/{projectId}/chapters/{chapterId}/analysis-jobs`, feature-gated off by default | enable only after durable enqueue/outbox/stage/worker/reconciliation invariant exists |
| Analysis progress/result | chapter workspace | explicit pending/unavailable state | PENDING API | none | job query/event replay + chapter analysis result resources | polling/SSE/reconnect/UNKNOWN/failed UI and result mapping |
| Characters | `/characters` | explicit API-not-connected state; Character Bible overlay mounted only when selected | PENDING API | none | character/version/reference/lock APIs | query/mutations and canonical identity/project-usage mapping |
| Chapter source | `/projects/[projectId]/chapters/[chapterId]` | TanStack Query server state + local dirty editor draft | API | `chaptersApi.list`, `chaptersApi.getById`, `chaptersApi.create`, `chaptersApi.update` | `GET/POST /api/v1/projects/{projectId}/chapters`, `GET/PUT /api/v1/projects/{projectId}/chapters/{chapterId}` with `ETag`/`If-Match` | delete/reorder and Scene/VisualBeat editing remain separate follow-up contracts |
| Chapter storyboard | chapter child routes defined by ADR-0002 | explicit pending state in API runtime | PENDING API | none | scene/visual-beat resources and commands | persisted Scene/VisualBeat public API + URL-owned deep links |
| Render/export | project workspace | explicit API-not-connected state | PENDING API | none | render job create/status/events + signed artifact URL | mutation/job/download flow |
| Assets | `/assets` | explicit API-not-connected state | PENDING API | none | asset list/detail/upload/delete/review APIs | replace pending state with Query/mutations when contract lands |
| Presets | `/presets` | explicit API-not-connected state | PENDING API | none | preset CRUD APIs | replace pending state with Query/mutations when contract lands |
| Notifications / credits / plan / settings / jobs | shell | hidden/disabled until real contract exists | PENDING API | none | notification, entitlement/usage and settings/job-list APIs | render real values only after contracts exist |

## Route and state rules

- `/projects` is the canonical project-list route; `/dashboard` only redirects to `/projects`.
- `/auth` is not an alternate project-list URL. When the session bootstrap resolves authenticated, `AuthEntry` uses route replacement to `/projects`.
- `/projects/[projectId]` owns project identity. The workspace never discovers a project by loading a collection and calling `.find()`.
- `/projects/[projectId]/chapters/[chapterId]` is the persisted Chapter source editor route. It loads Chapter detail by route ID, keeps unsaved text local, and saves with the server `rowVersion` through `If-Match`.
- Target Chapter child routes continue to follow ADR-0002 as Scene/VisualBeat APIs land.
- Navigable project-list filters live in URL search params (`status`, `q`). Search typing is kept in local component state and URL synchronization is debounced by 300 ms to avoid one App Router navigation per keystroke.
- Current filtering applies to cursor pages already loaded by the client; server-wide filtering requires a backend query contract.
- TanStack Query owns persisted server state. Zustand is reserved for transient wizard/editor state.

## Transport rules

- `src/shared/api/client.ts` owns request transport, credentials, CSRF, envelope validation and typed errors.
- A successful HTTP response with an invalid/empty JSON payload is surfaced as `ApiProtocolError`, keeping transport failures inside the typed API error model.
- Shared transport has no dependency on Zustand or feature/app state. A 401 is surfaced to the app boundary, where `AppProviders` updates session UI.
- Foundation utilities and new feature code import the canonical shared client/domain API directly instead of extending or depending on the compatibility facade in `src/lib/api.ts`.

## Same-origin proxy contract

- Browser API/auth paths remain same-origin by default so session cookies, CSRF and OAuth navigation share the frontend origin.
- Next.js rewrites proxy `/api`, `/oauth2`, `/login` and `/logout` to `BACKEND_INTERNAL_URL` (or the configured fallback).
- The current standalone Docker image resolves this rewrite configuration during `next build`. Container/image builds must therefore supply the correct backend network destination when `http://localhost:8080` is not valid.
- If one immutable frontend image must be promoted between environments with different backend hosts, adopt a runtime reverse proxy/BFF destination instead of environment-specific build-time routing.

## Runtime safety rules

- Creating a Project is metadata-only. The project-creation flow may persist StoryVersion/Chapter source as explicit follow-up API calls, but `POST /api/v1/projects` itself must not create AI/media work.
- Saving Chapter source never triggers analysis. Analysis is an explicit Chapter action after persisted source exists.
- `POST /api/v1/projects/{projectId}/chapters/{chapterId}/analysis-jobs` remains feature-gated off by default and must not persist queued work while disabled.
- API mode must never show fake analysis progress/results, fake notification counts, fake credits/plan data or fixture-backed persisted entities.

## Frontend verification gate

Frontend CI must run:

```bash
npm ci
npm test
npm run lint
npm run type-check
npm run build
```

The current `npm test` suite protects architecture/tooling regressions. It is not yet a substitute for behavioral component and end-to-end tests.
