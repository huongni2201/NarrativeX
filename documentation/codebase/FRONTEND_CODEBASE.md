# NarrativeX Frontend Codebase

## Framework/runtime

- Package manifest: Next.js `^16.3.1`, React `^19.2.8`, TypeScript `^5.8.2`, Zustand `^5.0.15`, TanStack Query `^5.101.4`.
- CI/runtime baseline: Node.js 22.
- Canonical App Router routes: `/`, `/auth`, `/projects`, `/projects/[projectId]`, `/characters`, `/assets`, `/presets`. `/dashboard` is a legacy redirect to `/projects`.
- Project identity is route-owned. The project workspace fetches `GET /api/v1/projects/{projectId}` directly and never infers the project from a Zustand selection or a bounded project list.

## Routes and existing UI/features

| Feature | Component(s) | Current data source | State |
|---|---|---|---|
| Auth/login/logout | `AuthScreen`, `AuthBootstrap`, `StudioHeader` | backend current-user session + Google OIDC redirect/logout | PARTIAL API |
| Project list | `ProjectsDashboard`, `ProjectCard` | TanStack Query cursor pagination via `projectsApi.list` | API |
| Project filters/search | `ProjectsDashboard` | URL search params `status` and `q`; filtering applies to loaded cursor pages | CLIENT/URL |
| Project workspace | `ProductionShell` | `projectsApi.getById(projectId)` | API FOUNDATION |
| Create project wizard | `ProjectWizardModal`, steps 1-4 | mutation: create project -> story version; analysis enqueue remains feature-gated | API FOUNDATION |
| Story input | `Step2ImportStory` | transient Zustand wizard draft until submit, then story create API | PARTIAL API |
| AI analysis | `Step3AiAnalysis`, `Step4Results` | explicit unavailable/pending state in API runtime until durable execution is enabled | PENDING API |
| Characters/Character Bible | `CharacterLibrary`, `CharacterBibleModal` | explicit API-not-connected state; fixtures only behind test/Storybook demo boundaries | PENDING API |
| Production/chapter/storyboard/review | `ProductionShell` plus demo/editor surfaces | project metadata real; chapter/storyboard domain APIs pending | PARTIAL/PENDING |
| Render/preview | production demo/editor surfaces | explicit API-not-connected state in application mode | PENDING API |
| Assets | `AssetLibraryScreen` | explicit disconnected state in API mode; typed demo store only in mock/test runtime | PENDING API |
| Presets | `StylePresetsScreen` | explicit disconnected state in API mode; typed demo store only in mock/test runtime | PENDING API |
| Plan/credits/notifications/jobs | app shell | not rendered until backed by real contracts | PENDING API |

## State ownership

Frontend state follows this order:

1. component state for ephemeral interaction;
2. URL/search params for navigable/shareable state;
3. TanStack Query for persisted server state;
4. Zustand only for transient cross-screen/editor state that cannot naturally live in URL or Query cache.

`useStudioStore` no longer owns project-list filters/search. `useProductionStore`, `useAssetStore` and `usePresetStore` are prototype/editor stores and load fixture data only through dynamic imports when the validated mock runtime is active.

## API transport boundary

- `src/shared/api/client.ts` owns HTTP transport, credentials, CSRF, response-envelope validation and typed errors.
- The shared transport does not import Zustand, app routes or feature state.
- HTTP 401 is exposed as a transport event/error; `src/app/providers.tsx` owns the session/UI reaction.
- Feature APIs live under `features/<feature>/api`. `src/lib/api.ts` remains compatibility-only and should not gain new feature consumers.

## P1/P2 corrections now applied

- `/projects` is the canonical project-list route; `/dashboard` redirects.
- Route files do not import another route's `page.tsx`.
- Project detail loads by ID instead of `list(limit=100)` + `.find()`.
- Project collections use cursor pagination rather than a hard first-100 limit.
- Large fixture modules are lazy-loaded only in mock/test/Storybook mode.
- Desktop navigation is replaced by a mobile bottom navigation below `lg`.
- Shared Input/Textarea errors use ARIA relationships; Tabs support arrow/Home/End keyboard navigation; Modal traps/restores focus and body scroll state.
- Fake Creator Pro/credits/notification counts and the misleading Jobs route are removed.
- Asset demo counts and sorting are data-driven and typed; `as any` was removed from sort handling.
- Project filter/search state is URL-owned.
- Reduced-motion behavior is defined globally and low-contrast secondary text tokens use the safer slate-400 range.
- Legacy `StudioDashboard.tsx` and the broad `features/index.ts` barrel were removed to prevent accidental use of obsolete UI/source-of-truth.

## Quality gates

Frontend CI runs:

```bash
npm ci
npm run lint
npm run type-check
npm run build
```

`npm run lint` also runs `scripts/check-architecture.mjs`, which fails CI when:

- `src/shared` imports app/feature/Zustand state;
- a route `page.tsx` imports another route page;
- a production module statically imports fixture/mock modules outside an allowed demo/test boundary.

## Remaining backend-dependent gaps

Analysis progress/results, chapter/storyboard commands, render/export, persisted asset/preset APIs, notifications, entitlements/credits and settings remain backend-contract work. API mode must keep these explicit rather than substituting fixtures.

Search/filter across the entire unbounded project collection also requires a backend query contract; the current `q`/`status` URL state filters the cursor pages already loaded by the client.
