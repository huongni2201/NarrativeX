# NarrativeX W1-D1 Frontend API Integration Matrix

This matrix maps the existing UI to the smallest backend contracts required for later wiring. It does not propose new screens or visual changes.

| Screen/Feature | Route | UI Action | Current Data Source | State | Existing Client Function | Required Backend API | Auth/Workspace Scope | Missing FE Wiring | Missing BE Contract | Week Target |
|---|---|---|---|---|---|---|---|---|---|---|
| Auth | `/auth`, root `auth` | submit login / Google | Zustand `isLoggedIn`, local timer | MOCK | none | backend OIDC redirect/session + session/current-user query | authenticated session; no provider token in browser | replace `login()` with redirect and session bootstrap | fail-closed auth, callback/session endpoint and CSRF decision | W1-D5 |
| Dashboard | `/`, `ProjectsDashboard` | load/filter/search projects | `MOCK_PROJECTS` in `useStudioStore` | MOCK | `api.listProjects` exists but unused | `GET /api/v1/projects` with pagination/filter fields | authenticated user + workspace membership | query on screen mount; map numeric IDs/response fields; loading/error/empty/forbidden | stable list contract with counts/cover/progress or FE mapping DTO | W2-D1 |
| Create project | `/`, wizard / `ProjectWizardModal` | confirm project | `confirmAndCreateProject()` creates `proj-${Date.now()}` | MOCK | `api.createProject` is used only by unreachable `StudioDashboard` | `POST /api/v1/projects` with idempotency key | authenticated workspace owner/editor | submit wizard draft through client; retain returned ID; mutation states | idempotency and response fields needed by cards | W2-D1 |
| Story input | `/`, `Step2ImportStory` | save pasted story and rights attestation | Zustand `wizardDraft.storyText`; sample preset | MOCK | `api.createStoryVersion` exists but unused | `POST /api/v1/projects/{id}/stories` | authenticated project editor; rights/consent required | call API after project creation; surface validation/rights errors | story read/update and version/If-Match contract still missing | W2-D1 |
| Story reload/edit | project workspace (no real project route) | reopen and edit story | local draft/mock production store | MOCK | none | `GET /api/v1/projects/{id}/story`, `PUT /api/v1/projects/{id}/story` | project/workspace scoped | route-param project identity, query cache, conflict handling | both endpoints, row version/If-Match and canonical content response | W2-D1 |
| AI analysis start | `/`, `Step3AiAnalysis` | advance/start analysis | wizard step and hard-coded checklist | MOCK | `api.enqueueAnalysis` exists but unused | `POST /api/v1/projects/{id}/analysis-jobs` | project editor + entitlement/abuse/cost checks | send story/version ID; store returned job ID; prevent duplicate submit | reservation/idempotency/operation plan and real delivery handoff | W2-D3 |
| Analysis progress | `/`, `Step3AiAnalysis` | observe progress/result | `setInterval` from 80 to 100 | MOCK | none for polling/SSE | `GET /api/v1/jobs/{jobId}` plus `GET /api/v1/jobs/{jobId}/events` SSE/replay | job owner/workspace scoped | query/poll/SSE, reconnect, failed/UNKNOWN/paused states | event stream, transitions and durable worker updates | W2-D4 |
| Analysis result | wizard step 4 | inspect characters/chapters/beats | hard-coded counts + mock characters | MOCK | none | `GET /api/v1/projects/{id}/analysis/{jobId}` or result resources | project/workspace scoped; safety review | map response into existing cards/tabs | result DTOs and moderation/review state | W2-D4 |
| Upload reference | chapter/project/asset UI | upload story/asset file | visual dropzone; no file input | MOCK | none | `POST /api/v1/uploads/intents`, presigned upload, `POST /api/v1/uploads/{id}/complete` | workspace/project scoped; rights/consent and MIME/size checks | file selection, upload progress, retry/cancel | upload intent/complete, private object storage, immutable asset metadata | W2-D2 |
| Characters | `/characters` and Character Bible | filter/open/create/edit/lock | `MOCK_CHARACTERS`, local modal | MOCK | none | character list/version/reference/lock APIs | project/workspace scoped; real-person consent if applicable | query/mutations and server version mapping | character/version/reference resources absent | W2-D2+ |
| Chapter add | production workspace | add chapter/import | `useProductionStore.addChapter()` local | MOCK | none | `POST /api/v1/projects/{id}/chapters` | project editor + rights attestation | submit and reconcile returned chapter | chapter API absent | W2-D2+ |
| Storyboard/visual review | production views | approve/reject/generate visuals | local visual beat array and mutations | MOCK | none | storyboard read/update + visual generation job APIs | project/workspace scoped; entitlement/safety | replace local mutations with optimistic API + conflict states | scene/visual-beat endpoints and generation command | W2-D3+ |
| Render/export | production view 06/07 | render now / preview/download | 1.2s timer then local preview | MOCK | none | render job create, job status/events, signed download URL | server-side entitlement/watermark/export policy | mutation/job/download handling | render/export APIs absent | W2-D3+ |
| Assets/presets | root screen switcher via sidebar | open/upload/edit/delete preset | local mock stores rendered by `app/page.tsx` | MOCK | none | asset list/detail/delete and preset CRUD | workspace scoped | keep prototype state explicit; wire stores in a later scoped task | asset/preset endpoints absent | later |

## Contract notes

- Existing backend routes are inventoried in `BACKEND_CODEBASE.md`; only six routes exist.
- The matrix intentionally separates “existing client function” from “visible caller”: the client is not integration evidence.
- No D1 code changes were made to wire these rows.

## W1-D2 foundation corrections

- The current API client now owns credentials, JSON negotiation, ProblemDetail parsing and `ApiClientError`; API DTOs are separate from presentation models.
- TanStack Query is available through the root `AppProviders` foundation, but no visible Week 2 flow was migrated early.
- Mock state is gated by `NEXT_PUBLIC_NX_DATA_MODE`; this is a safety boundary, not evidence that any visible flow is API-backed.
