# NarrativeX Frontend API Integration Matrix

This matrix maps the existing UI to the smallest backend contracts required for later wiring. It does not propose new screens or visual changes.

| Screen/Feature | Route | UI Action | Current Data Source | State | Existing Client Function | Required Backend API | Auth/Workspace Scope | Missing FE Wiring | Missing BE Contract | Week Target |
|---|---|---|---|---|---|---|---|---|---|---|
| Auth | `/auth`, root `auth` | submit login / Google / logout | server session via `GET /api/auth/me` | API | `api.getCurrentUser`, `api.logout`, `api.googleLoginUrl` | backend OIDC redirect/session + current-user query + Spring logout | authenticated session; no provider token in browser | implemented: bootstrap gate, OIDC redirect, real logout, global 401 → auth state | password auth intentionally not exposed until a backend contract exists | W1-D5 |
| Dashboard | `/`, `ProjectsDashboard` | load/filter/search projects | React Query `queryKeys.projectsPage(batchIndex, batchSize)` | API | `api.listProjects` | `GET /api/v1/projects?limit=20&cursor=<opaque>` | authenticated user + workspace membership | cursor page, loading/error/empty states wired | filter/count/cover/progress fields remain optional | W2-D1 |
| Create project | `/`, wizard / `ProjectWizardModal` | confirm project | React Query mutation calls `api.createProject` | API | `api.createProject` | `POST /api/v1/projects` | authenticated workspace owner/editor | returned ID retained and query invalidated | idempotency contract still recommended | W2-D1 |
| Story input | `/`, `Step2ImportStory` | save pasted story | Zustand draft until submit, then backend create | API FOUNDATION | `api.createStoryVersion` | `POST /api/v1/projects/{id}/stories` | authenticated project editor | story creation wired; reload/edit pending | story read/update and version/If-Match contract still missing | W2-D1 |
| Story reload/edit | project workspace | reopen and edit story | local draft/prototype state | PENDING API | none | `GET/PUT` story/version resources | project/workspace scoped | route-param project identity, query cache, conflict handling | read/update contract + row version | W2-D1 |
| AI analysis start | project creation/workspace | start analysis | **disabled production capability** | NOT AVAILABLE | client function may exist but wizard does not call it | `POST /api/v1/projects/{id}/analysis-jobs` | project editor + abuse/safety/entitlement/idempotency/cost gates | only wire after backend advertises durable support | durable enqueue transaction, StageAttempt/outbox dispatch, worker lease, provider reconciliation | W2-D3+ |
| Analysis progress | workspace | observe progress/result | none in API runtime | PENDING API | none for polling/SSE | `GET /api/v1/jobs/{jobId}` + events/replay | job owner/workspace scoped | polling/SSE, reconnect, failed/UNKNOWN/paused states | durable worker transitions/event stream | W2-D4+ |
| Analysis result | workspace | inspect characters/chapters/beats | explicit unavailable state | PENDING API | none | result resources derived from completed analysis | project/workspace scoped; safety review | map real result into UI | result DTOs + moderation/review state | W2-D4+ |
| Upload reference | chapter/project/asset UI | upload story/asset file | visual dropzone only | MOCK/PENDING | none | upload intent + complete | workspace/project scoped; MIME/size checks; real-person consent where applicable | file selection, upload progress, retry/cancel | private storage + immutable asset metadata | W2-D2 |
| Characters | `/characters` and Character Bible | filter/open/create/edit/lock | explicit API-not-connected state | PENDING API | none | character/version/reference/lock APIs | project/workspace scoped | query/mutations and server version mapping | public resources absent | W2-D2+ |
| Chapter add | production workspace | add chapter/import | disabled in API mode | PENDING API | none | `POST /api/v1/projects/{id}/chapters` | project editor | submit and reconcile returned chapter | chapter API absent | W2-D2+ |
| Storyboard/visual review | production views | approve/reject/generate visuals | explicit API-not-connected state | PENDING API | none | storyboard read/update + generation APIs | project/workspace scoped; entitlement/safety | optimistic API + conflict states | scene/visual-beat commands | W2-D3+ |
| Render/export | production view 06/07 | render now / preview/download | explicit API-not-connected state | PENDING API | none | render job create, status/events, signed download URL | server-side entitlement/watermark/export policy | mutation/job/download handling | render/export APIs absent | W2-D3+ |
| Assets/presets | root screen switcher | open/upload/edit/delete preset | local prototype stores | MOCK | none | asset list/detail/delete and preset CRUD | workspace scoped | keep prototype state explicit | asset/preset endpoints absent | later |

## Contract notes

- Normal JSON routes use `ApiResponse<T>` and failures use `ErrorResponse`.
- The project and StoryVersion create flows are real API foundations.
- The project-creation wizard deliberately **does not call** `enqueueAnalysis` while durable execution is unavailable.
- `POST /api/v1/projects/{id}/analysis-jobs` is feature-gated off by default and returns `503 FEATURE_NOT_AVAILABLE`; when disabled it must not persist an `OperationPlan` or `GenerationJob`.
- Enabling the endpoint requires a single durable enqueue transaction covering operation authorization/reservation, `GenerationJob`, required `StageAttempt` rows and an outbox event, followed by post-commit dispatch and a real worker claim/lease path.
- Story creation no longer contains a per-story copyright/rights checkbox. Real-person consent remains a separate reference/identity concern.

## Runtime safety corrections

- The API client owns credentials, JSON negotiation, `ErrorResponse` parsing and `ApiClientError`; it unwraps `ApiResponse.data` centrally.
- TanStack Query owns persisted server state; fixture data remains isolated to tests/Storybook.
- API mode must never report fake analysis progress or fake analysis success.
