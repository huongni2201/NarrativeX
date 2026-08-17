# NarrativeX W1-D1 Frontend Integration Baseline

## Framework/runtime

- Package manifest: Next.js `^16.3.1`, React `^19.2.8`, TypeScript `^5.8.2`, Zustand `^5.0.15`, TanStack Query `^5.101.4`.
- Runtime verified: Node `v26.4.0`, npm `11.17.0`.
- App Router routes: `/`, `/auth`, `/dashboard`, `/characters`; the root page is a client-side screen switcher rather than a route-param project shell. The root screen switcher currently renders overview, project workspace, characters, Assets and Style Presets surfaces. The target chapter-first route contract is recorded in ADR-0006 and is deliberately deferred beyond W1-D2.
- The frontend README now matches the Next.js 16.3.1 package manifest.

## Routes and existing UI/features

| Feature | Component(s) | Current data source | State |
|---|---|---|---|
| Auth/login/register | `AuthScreen` | Zustand boolean + local form state + 600ms timer | MOCK |
| Dashboard/project list | `ProjectsDashboard`, `ProjectCard` | React Query `queryKeys.projects` → `api.listProjects` | API |
| Create project wizard | `ProjectWizardModal`, steps 1-4 | React Query mutation: create project → story version → analysis job | API |
| Story input | `Step2ImportStory` | Zustand draft until submit; rights attestation; API story-version mutation | PARTIAL API |
| AI analysis | `Step3AiAnalysis`, `Step4Results` | API enqueue is real; progress/result polling contract still pending | PARTIAL API |
| Characters/Character Bible | `CharacterLibrary`, `CharacterBibleModal` | explicit API-not-connected state; fixtures only in test/Storybook | PENDING API |
| Production overview/chapter | `ProductionShell`, Screens 01-03 | backend project query; fixture screens only in test/Storybook | PARTIAL API |
| Storyboard/visual review | Screens 04-05 | explicit API-not-connected state; fixture mutations only in test/Storybook | PENDING API |
| Render/preview | Screens 06-07 | explicit API-not-connected state in application mode; fixture timer only in test/Storybook | PENDING API |
| Assets/presets | current sidebar plus asset/preset stores/components | local mocks rendered by `app/page.tsx` | MOCK |
| Notifications/settings/upgrade | sidebar controls | hard-coded badge/credits and no-op handlers | DEAD |

## State ownership and API client

- `src/store/useStudioStore.ts` owns navigation, auth state, filters, selection and the unsaved wizard draft; it does not own persisted project data.
- `src/store/useProductionStore.ts` owns UI navigation and fixture-only prototype state; its project is `null` in API mode and business-data actions fail closed.
- `src/lib/api.ts` is the single fetch owner with API base URL, credentials, JSON negotiation, RFC 9457 parsing, safe non-JSON fallback and typed `ApiClientError`. It exports `listProjects`, `createProject`, `createStoryVersion` and `enqueueAnalysis` against API DTO types in `src/types/api.ts`.
- `ProjectsDashboard` now calls `api.listProjects` through React Query, and the visible wizard calls `createProject`, `createStoryVersion` and `enqueueAnalysis` through one mutation workflow. `StudioDashboard` remains a legacy unrendered shell.
- TanStack Query owns the visible project server state with conservative 4xx retry behavior and centralized query keys; SSE, upload, auth redirect and analysis-result queries remain pending contracts.

## W1-D2 state ownership and mock mode

- TanStack Query is the future owner of persisted server state; Zustand remains UI/editor/transient and explicitly gated prototype state until W2 integrations land.
- `NEXT_PUBLIC_NX_DATA_MODE=mock|api` is documented and validated. All application runtimes default to API when omitted; mock mode is accepted only by test or Storybook runtimes.
- In API mode, local project/character/asset/preset stores start empty and Production/Character Library surfaces render explicit connection states. Mock production screens are available only in test/Storybook runtimes. See ADR-0008.
- Character UI types keep canonical identity separate from project usage: `Character` owns identity/version fields, while `ProjectCharacter` owns role, importance, aliases, groups and pinned version. Project filtering resolves assignments by `characterId`/`projectId`; it does not filter a `projectName` field on Character.

## Real, partial and mock integrations

The project overview and creation/analysis submission workflow are real FE-to-BE integrations. Character, chapter, storyboard, render, asset and preset surfaces remain pending/placeholder flows because their backend contracts are not present yet. The project list has backend loading/error/empty states; analysis progress/result polling and other durable workflow states remain pending.

## Integration risks

- Backend IDs are numeric (`Long`/`entityId`), while studio `Project.id` and production IDs are strings such as `proj-1` and `ch-06`.
- Backend `ProjectResponse` has no description/cover/progress/count fields required by `ProjectsDashboard` and `ProjectCard`.
- Backend `StoryVersionResponse` omits story content, while the frontend type expects `content`.
- Visible wizard `quality` values are `Standard|High`, while backend accepts enum names such as `STANDARD`.
- Story upload is a visual dropzone without an `<input type="file">` or upload client.
- Login form and Google button call `login()` locally; no backend OIDC redirect is wired.

## Missing API wiring by flow

Exact rows and target contracts are in `FRONTEND_API_INTEGRATION_MATRIX.md`. The required sequence is project query/create, story create/read/update, upload intent/complete, analysis job creation, job polling/SSE, then asset/character/storyboard APIs. No replacement UI is proposed in D1.

## P0/P1 gaps

- P0: visible app assumes a local authenticated identity while backend local mode permits arbitrary `X-User-Id`; see security audit.
- P1: visible dashboard, wizard, story, analysis progress, production and assets are not connected to durable backend state.
- P1: API/error contracts are not yet compatible with the full visible UI model.
