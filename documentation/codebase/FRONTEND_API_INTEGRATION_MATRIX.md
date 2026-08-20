# NarrativeX Frontend API Integration Matrix

This matrix records frontend wiring separately from backend/API availability. API mode is authoritative; production UI must not substitute fixtures for unavailable data.

| Screen/Feature | Frontend status | Backend/runtime status | Remaining work |
|---|---|---|---|
| Auth | IMPLEMENTED | password/OIDC/session/logout APIs | optional bootstrap/UX hardening |
| Project list/detail/create | IMPLEMENTED | Project APIs | server-side unbounded search/filter improvements |
| Project Overview | IMPLEMENTED | overview API | richer metrics only when contracts require |
| StoryVersion | IMPLEMENTED foundation | create/latest contracts | broader version-management UI |
| Chapter source | IMPLEMENTED | list/get/create/update/workspace + ETag/If-Match | delete/reorder and broader commands |
| Chapter batch import | IMPLEMENTED foundation | multipart `.txt/.docx/.pdf` import | progress/granular import UX |
| Chapter Analyze | IMPLEMENTED foundation | durable admission/enqueue/provider pipeline | production hardening, real-provider E2E |
| Analysis progress | IMPLEMENTED foundation | GenerationJob read API | optional SSE/reconnect UX |
| Storyboard | IMPLEMENTED foundation | Storyboard + VisualBeat read/review contracts | broader Scene/VisualBeat editing/deep links |
| Analysis continuity | IMPLEMENTED backend foundation | Character + Location materialization; Scene character/location relations persisted | expose richer continuity/review data as UI needs it |
| Characters | IMPLEMENTED foundation | Character/project-character APIs | version diff/lock/reference management |
| Project Locations | IMPLEMENTED foundation | Location read API + AI Location materialization | richer edit/reference workflows |
| Project Assets | IMPLEMENTED foundation | Asset read/create foundations | upload/finalize/delete/review lifecycle |
| Job History | PENDING frontend | backend read exists | history UI/filters |
| User Quota | PENDING frontend | backend read/admission exists | render real quota/credit state |
| Notifications | PENDING frontend | backend read/mark-read exists | notification-center wiring + delivery lifecycle |
| Presets | PENDING | complete backend CRUD not established | backend contract + integration |
| Render/export | PENDING | media pipeline not implemented end-to-end | image/TTS/render/export |
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
  -> backend reloads persisted Chapter
  -> safety + entitlement + quota + cost admission
  -> durable enqueue
  -> poll GenerationJob
  -> COMPLETED | FAILED | CANCELED
```

`QUEUED`, `RUNNING`, `UNKNOWN`, `STALLED` and `PAUSED_COST_LIMIT` remain non-terminal for polling behavior.

## Continuity visible to frontend

The worker now persists AI-returned project Location identities plus Scene -> ProjectCharacter and Scene -> Location continuity relations. Frontend code may therefore treat these relations as durable backend state when exposed by the relevant read contract.

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

Behavioral browser verification should additionally cover saved-source Analyze, job polling, Storyboard refresh and continuity views using real backend data.
