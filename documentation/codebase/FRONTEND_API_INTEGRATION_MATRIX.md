# NarrativeX Frontend API Integration Matrix

This matrix records frontend wiring separately from backend/API availability. API mode is authoritative; production UI must not substitute fixtures for unavailable data.

| Screen/Feature | Frontend status | Backend/runtime status | Remaining work |
|---|---|---|---|
| Auth | IMPLEMENTED | password/OIDC/session/logout APIs | optional bootstrap/UX hardening |
| Project list/detail/create | IMPLEMENTED | Project APIs | server-side unbounded search/filter improvements |
| Project dashboard/favorite | IMPLEMENTED foundation | `/api/v1/projects/dashboard` + favorite commands | richer dashboard filters/metrics only as contracts grow |
| Project Overview | IMPLEMENTED | overview API | richer metrics only when contracts require |
| StoryVersion | IMPLEMENTED foundation | create/latest contracts | broader version-management UI |
| Chapter source | IMPLEMENTED | list/get/create/update/workspace + ETag/If-Match | delete/reorder and broader commands |
| Chapter Workspace pipeline | IMPLEMENTED foundation | workspace projection maps analysis, image jobs, narration assets and render artifacts | visual-beat image asset linkage and complete render commands |
| Chapter batch import | IMPLEMENTED foundation | multipart `.txt/.docx/.pdf` import | progress/granular import UX |
| Chapter Analyze | IMPLEMENTED foundation | durable admission/enqueue/provider pipeline | production hardening, real-provider E2E |
| Analysis progress | IMPLEMENTED foundation | GenerationJob read API | optional SSE/reconnect UX |
| Storyboard | IMPLEMENTED foundation | Storyboard + VisualBeat read/review contracts | broader Scene/VisualBeat editing/deep links |
| Analysis continuity | IMPLEMENTED backend foundation | Character + Location materialization; Scene character/location relations persisted | expose richer continuity/review data as UI needs it |
| Project Characters | IMPLEMENTED foundation | project-scoped list/detail read APIs backed by MyBatis | version diff/lock/reference management; richer authoritative relationships/assets/scene details |
| Global Character library | IMPLEMENTED foundation | Character library APIs | richer global-library management |
| Project Locations | IMPLEMENTED foundation | Location read API + AI Location materialization | richer edit/reference workflows |
| Project Assets | IMPLEMENTED foundation | Asset read/create foundations | upload/finalize/delete/review lifecycle |
| Job History | IMPLEMENTED foundation | backend read (`/api/v1/jobs/history`) | history table/filters/pagination |
| User Quota | IMPLEMENTED foundation | backend read (`/api/v1/users/me/quota`) | quota details modal & usage breakdown |
| Notifications | IMPLEMENTED foundation | backend read/mark-read (`/api/v1/notifications`) | notification drawer, page & unread badges |
| Chapter Narration | IMPLEMENTED foundation | backend narration jobs (`/narration-jobs`) | voice catalog modal & TTS generation UX |
| Provider Health | IMPLEMENTED foundation | backend read (`/api/v1/provider-health`) | status indicator badge & model info |
| Presets | PENDING | complete backend CRUD not established | backend contract + integration |
| Render/export | PENDING | media pipeline not implemented end-to-end | image generation/VisualScenePlanner/render/export |
| Settings | PARTIAL | partial/local contracts | define persisted settings boundaries |

## Chapter Analyze UI contract

```text
edit Chapter
  -> dirty
  -> Analyze disabled

Save
  -> persisted sourceText/sourceHash/rowVersion
  -> clean

Analyze
  -> backend locks/reloads persisted Chapter
  -> safety + entitlement + quota + cost admission
  -> durable enqueue
  -> poll GenerationJob
  -> COMPLETED | FAILED | CANCELED
```

`QUEUED`, `RUNNING`, `UNKNOWN`, `STALLED` and `PAUSED_COST_LIMIT` remain non-terminal for polling behavior.

## Project Character UI contract

Project Character list/detail uses:

```text
GET /api/v1/projects/{projectId}/characters
GET /api/v1/projects/{projectId}/characters/{characterId}
```

These reads are project-scoped and owner-authorized. Current authoritative fields include canonical/project aliases, role, importance, groups, pinned CharacterVersion information, appearance state and scene count.

The frontend must not fabricate avatar, asset count, relationship graphs or detailed scene metrics when those fields are not provided by an authoritative read model. Missing data is rendered as unavailable/empty state instead.

## Continuity visible to frontend

The worker persists AI-returned project Location identities plus Scene -> ProjectCharacter and Scene -> Location continuity relations. Frontend code may therefore treat these relations as durable backend state when exposed by the relevant read contract.

This does not imply that Character version locking/reference management is complete. Media generation must eventually consume reviewed/versioned identity/reference snapshots rather than raw analysis names.

## State ownership

- URL/search params own navigable filters and route identity.
- TanStack Query owns persisted server state.
- Zustand is reserved for transient editor/wizard state.
- Shared HTTP transport remains independent from Zustand and feature state.

## Verification gate

```bash
npm ci
npm test
npm run lint
npm run type-check
npm run build
```

Behavioral browser verification should additionally cover saved-source Analyze, job polling, Storyboard refresh, project dashboard/favorite behavior and Project Character list/detail using real backend data.
