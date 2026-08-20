# NarrativeX Frontend API Integration Matrix

This matrix records **frontend wiring** separately from **backend API availability**. API mode is authoritative; the UI must not fall back to fixture data when a backend capability is unavailable or not yet connected.

> V1.10 note: Chapter Analyze, Storyboard read/review, Project Overview and core Chapter APIs are connected foundations. Character, Location, Asset, Job History, Quota and Notification backend APIs exist, but several corresponding frontend surfaces are still pending wiring.

| Screen/Feature | Route | Frontend state | Existing client wiring | Backend API availability | Missing work |
|---|---|---|---|---|---|
| Auth | `/auth`, app shell | CONNECTED FOUNDATION | `authApi.getCurrentUser`, `login`, `register`, `logout`, Google login URL | current-user/password/OIDC/logout APIs exist | optional server bootstrap improvements |
| Project list | `/projects` | CONNECTED | `projectsApi.list` | `GET /api/v1/projects` | server-side `q`/`status` filtering for unbounded collection |
| Project detail | `/projects/[projectId]` | CONNECTED FOUNDATION | `projectsApi.getById` | `GET /api/v1/projects/{projectId}` | richer workspace DTOs as needed |
| Project Overview | `/projects/[projectId]` | CONNECTED FOUNDATION | `projectsApi.getOverview` | `GET /api/v1/projects/{projectId}/overview` | keep UI derived only from response metrics |
| Create Project | project wizard | CONNECTED | `projectsApi.create` | `POST /api/v1/projects` | metadata-only by contract; no implicit Analyze |
| StoryVersion | project/chapter flow | CONNECTED FOUNDATION | `projectsApi.createStoryVersion`, latest-story query | create/latest StoryVersion APIs exist | broader version-management UI |
| Chapter source | `/projects/[projectId]/chapters/[chapterId]` | CONNECTED | `chaptersApi.list/getById/create/update/getWorkspace` | Chapter list/create/get/workspace/update with ETag/If-Match | delete/reorder and broader mutations |
| Chapter batch import | project workflow | CONNECTED FOUNDATION | `projectsApi.batchImportChapters` (multipart in `ProductionShell`) | multipart `POST /api/v1/projects/{projectId}/chapters/batch-import`; `.txt/.docx/.pdf` | upload progress and granular line import error UX |
| AI analysis start | Chapter editor/workspace | CONNECTED FOUNDATION | `chaptersApi.analyze` | `POST /api/v1/projects/{projectId}/chapters/{chapterId}/analysis-jobs` | full production billing/safety hardening only; admission/provider durability already exist |
| Analysis progress | Chapter editor/workspace | CONNECTED FOUNDATION | `chaptersApi.getAnalysisJob` | `GET /api/v1/generation-jobs/{jobId}`; compatibility `/api/v1/jobs/{jobId}` | optional SSE/reconnect UX |
| Chapter Storyboard | Chapter workspace | CONNECTED FOUNDATION | `storyboardApi.get/createVisualBeat/updateReviewStatus` | Storyboard GET + VisualBeat create/review-status APIs exist | broader Scene/VisualBeat editing and deep-linking |
| Analysis materialization | backend/worker | BACKEND FOUNDATION | Storyboard can read Scene/VisualBeat output | Character/ProjectCharacter/CharacterVersion + Scene/VisualBeat persisted | Location and Scene continuity relations |
| Characters | `/characters`, project character views | CONNECTED FOUNDATION | `charactersApi.list/getById/create/update`, `projectsApi.getProjectCharacters` | `GET /api/v1/characters?cursor=&limit=`, `POST /api/v1/characters`, project characters APIs exist | version diff/lock and reference asset management |
| Project Locations | project `locations` tab | CONNECTED FOUNDATION | `projectsApi.getLocations` (cursor paginated) | `GET /api/v1/projects/{projectId}/locations?cursor=&limit=` exists | AI Location auto-materialization |
| Project Assets | `/assets`, project assets tab | CONNECTED FOUNDATION | `assetsApi.list/getById/create`, `projectsApi.getAssets` (cursor paginated) | `GET /api/v1/projects/{projectId}/assets?cursor=&limit=` exists | upload/finalize/delete/review workflows |
| Job History | jobs/history surface | FE PENDING | none verified | `GET /api/v1/jobs/history` exists | add cursor/list UI and filters |
| User Quota | shell/account surface | FE PENDING | none verified | `GET /api/v1/users/me/quota` exists; Chapter Analyze admission also enforces quota server-side | render real quota/credit data |
| Notifications | shell/notification center | FE PENDING | none verified | `GET /api/v1/notifications`, `PATCH /{id}/read`, `POST /read-all` exist | notification center wiring; broader delivery/email lifecycle remains |
| Presets | `/presets` | PENDING | none | preset CRUD not established in current baseline | backend contract + FE integration |
| Render/export | project workspace | PENDING | none | media/render pipeline not in current vertical slice | image/TTS/render/export implementation |
| Settings | project/account settings | PARTIAL/PENDING | local/project settings only where already available | no complete settings contract verified | define persisted settings boundaries |

## Chapter Analyze UI contract

```text
edit Chapter
  -> dirty=true
  -> Analyze disabled

Save
  -> backend persists sourceText
  -> backend calculates sourceHash
  -> rowVersion returned
  -> dirty=false

Analyze
  -> backend reloads persisted Chapter
  -> admission: safety + entitlement + quota + cost
  -> durable enqueue
  -> poll GenerationJob
  -> QUEUED/RUNNING/... -> COMPLETED | FAILED | CANCELED
```

Rules:

- The client does not send arbitrary current `sourceText` as analysis authority.
- API runtime must not synthesize fake progress/results, credits, notifications or persisted resources.
- `COMPLETED`, `FAILED`, `CANCELED` are terminal.
- `QUEUED`, `RUNNING`, `UNKNOWN`, `STALLED`, `PAUSED_COST_LIMIT` are non-terminal for polling behavior.
- On completion, Storyboard can load persisted Scene/VisualBeat rows; completion does not imply every backend resource has already been connected to frontend UI.

## Backend available does not mean frontend connected

The matrix intentionally distinguishes three states:

- **CONNECTED**: a current FE client/query/mutation consumes the backend contract.
- **BACKEND AVAILABLE / FE PENDING**: endpoint exists, but no production FE wiring is verified.
- **PENDING**: required backend capability itself is not complete.

This prevents documentation from overstating frontend readiness merely because a controller exists.

## Continuity limitation visible to FE

The AI schema can return Locations and per-Scene character/location references, but current worker persistence drops those continuity fields. Until the P1 continuity slice is implemented, FE must not imply that Scene character/location assignments are durable just because analysis completed.

## State ownership

- URL/search params own navigable filters and route identity.
- TanStack Query owns persisted server state.
- Zustand is reserved for transient editor/wizard state.
- Shared HTTP transport remains independent from Zustand and feature state.

## Frontend verification gate

```bash
npm ci
npm test
npm run lint
npm run type-check
npm run build
```

Behavioral browser verification should additionally cover saved-source Analyze, job polling and Storyboard refresh with real backend data.
