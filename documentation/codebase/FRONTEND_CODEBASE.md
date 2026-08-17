# NarrativeX W1-D1 Frontend Integration Baseline

## Framework/runtime

- Package manifest: Next.js `^16.3.1`, React `^19.2.8`, TypeScript `^5.8.2`, Zustand `^5.0.15`, TanStack Query `^5.101.4`.
- Runtime verified: Node `v26.4.0`, npm `11.17.0`.
- App Router routes: `/`, `/auth`, `/dashboard`, `/characters`; the root page is a client-side screen switcher rather than a route-param project shell. The root screen switcher currently renders overview, project workspace, characters, Assets and Style Presets surfaces.
- The frontend README now matches the Next.js 16.3.1 package manifest.

## Routes and existing UI/features

| Feature | Component(s) | Current data source | State |
|---|---|---|---|
| Auth/login/register | `AuthScreen` | Zustand boolean + local form state + 600ms timer | MOCK |
| Dashboard/project list | `ProjectsDashboard`, `ProjectCard` | `useStudioStore.projects` initialized from `lib/mock-data.ts` | MOCK |
| Create project wizard | `ProjectWizardModal`, steps 1-4 | Zustand `wizardDraft`; confirm creates a local object | MOCK |
| Story input | `Step2ImportStory` | Zustand text; sample preset; upload tab has no file input | MOCK |
| AI analysis | `Step3AiAnalysis`, `Step4Results` | hard-coded counts/checklist + `setInterval` progress | MOCK |
| Characters/Character Bible | `CharacterLibrary`, `CharacterBibleModal` | `MOCK_CHARACTERS`, local filters/modal | MOCK |
| Production overview/chapter | `ProductionShell`, Screens 01-03 | `useProductionStore` initialized from `production-mock.ts` | MOCK |
| Storyboard/visual review | Screens 04-05 | local visual-beat array and local status mutations | MOCK |
| Render/preview | Screens 06-07 | local settings + 1.2s timer; no export call | MOCK |
| Assets/presets | current sidebar plus asset/preset stores/components | local mocks rendered by `app/page.tsx` | MOCK |
| Notifications/settings/upgrade | sidebar controls | hard-coded badge/credits and no-op handlers | DEAD |

## State ownership and API client

- `src/store/useStudioStore.ts:55-160` owns navigation, auth state, project mocks, characters and wizard draft.
- `src/store/useProductionStore.ts:37-153` owns production project, chapters, beats, review mutations and local continuation logic.
- `src/lib/api.ts` is the single fetch owner with API base URL, credentials, JSON negotiation, RFC 9457 parsing, safe non-JSON fallback and typed `ApiClientError`. It exports `listProjects`, `createProject`, `createStoryVersion` and `enqueueAnalysis` against API DTO types in `src/types/api.ts`.
- Only `StudioDashboard.tsx:18-36` calls `api.createProject`; `rg` found no rendered/imported caller for `StudioDashboard`. The visible wizard therefore does not use the client.
- TanStack Query now has an `AppProviders`/`QueryClientProvider` foundation, conservative 4xx retry behavior and centralized query keys. No visible screen is wired to Query yet; there is still no SSE, upload or auth redirect client.

## W1-D2 state ownership and mock mode

- TanStack Query is the future owner of persisted server state; Zustand remains UI/editor/transient and explicitly gated prototype state until W2 integrations land.
- `NEXT_PUBLIC_NX_DATA_MODE=mock|api` is documented and validated. Development defaults to mock when omitted; non-development defaults to API and rejects mock mode.
- In API mode, local project/character/asset/preset stores start empty and the production shell does not render mock production data. This prevents fake business state from masquerading as persisted production state without redesigning local prototype screens.

## Real, partial and mock integrations

The only real FE-to-BE call is an unreachable legacy create-project shell. API client functions for list/story/analysis are present but unused. All visible Week 1–2 workflows are `MOCK` or local state. UI loading exists for a few timers/buttons, but there are no backend-driven error, forbidden, conflict, upload, persisted-progress or reconnect states.

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
