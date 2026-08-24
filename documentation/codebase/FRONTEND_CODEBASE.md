# NarrativeX Frontend Codebase

## Runtime

- Next.js 16 App Router, React 19, TypeScript strict mode.
- Node.js 22 CI/runtime baseline.
- TanStack Query owns persisted server state.
- Zustand is reserved for transient editor/wizard state.
- URL/search params own navigable route/filter state.

Canonical routes include `/auth`, `/projects`, `/projects/[projectId]`, `/characters`, `/assets` and `/presets`; `/dashboard` is a legacy redirect to `/projects`.

## Current integration state

| Surface | Status |
|---|---|
| Auth/session | IMPLEMENTED foundation |
| Project list/detail/create | IMPLEMENTED |
| Project Overview | IMPLEMENTED foundation |
| StoryVersion | IMPLEMENTED foundation |
| Chapter source/workspace | IMPLEMENTED |
| Chapter batch import | IMPLEMENTED foundation |
| Chapter Analyze | IMPLEMENTED foundation |
| GenerationJob polling | IMPLEMENTED foundation |
| Storyboard/VisualBeat | IMPLEMENTED foundation |
| Character library/project characters | IMPLEMENTED foundation |
| Project Locations | IMPLEMENTED foundation |
| Job History UI | IMPLEMENTED foundation |
| Quota details UI | IMPLEMENTED foundation |
| Notification center | IMPLEMENTED foundation |
| Chapter Narration TTS | IMPLEMENTED foundation |
| Presets catalog reads | IMPLEMENTED foundation |
| Image/render/export | IMPLEMENTED foundation; real API mode, durable job polling, review and artifact preview/download |

See `FRONTEND_API_INTEGRATION_MATRIX.md` for the backend-available versus frontend-connected distinction.

## Analysis/continuity boundary

The Chapter Analyze flow operates on a saved Chapter, not unsaved editor text. On completion, backend/worker state includes Storyboard plus Character/Location continuity foundations. Frontend code may consume those relations through backend read contracts; it must not recreate continuity from display names or fixture data.

Character version locking/reference management remains incomplete even though analysis-time Character/Location/Scene relations are now durable.

## State ownership

Use this priority:

1. component state for ephemeral interaction;
2. URL/search params for navigable/shareable state;
3. TanStack Query for persisted server state;
4. Zustand for transient cross-screen/editor state that does not naturally belong in URL or server cache.

Project identity comes from the route, not from a bounded project list or global selection store.

## API transport boundary

`src/shared/api/client.ts` owns credentials, CSRF, envelope validation and typed transport/protocol errors. Feature APIs live under their owning feature. Shared transport must not depend on Zustand or feature UI state.

API mode is authoritative. Production/API-mode code must not silently fall back to fixture/mock state when a backend capability is missing.

## Deployment boundary

Browser API calls are same-origin by default. Next.js rewrites forward backend routes to the configured internal backend destination. Container builds must not assume that frontend `localhost:8080` points at the backend container.

## Accessibility/performance foundations

Current frontend architecture includes lazy overlay boundaries, keyboard/focus handling for shared UI primitives, reduced-motion behavior, typed data handling and architecture checks preventing production fixture imports.

## Quality gates

```bash
npm ci
npm test
npm run lint
npm run type-check
npm run build
```

Architecture regression checks protect shared/feature dependency boundaries and mock/fixture isolation. Passing these gates is not equivalent to complete browser/E2E coverage.

## Remaining frontend work

- Deeper Job History filtering/details beyond the current paginated table.
- Richer quota usage/billing UX beyond the current quota details modal.
- Broader notification message catalog/deep links; the shell now exposes an unread badge and a live “Bạn có … thông báo mới” summary beside the notification bell, refreshed by generation SSE events with polling fallback.
- Broader Character version/reference/lock UX.
- Broader Storyboard editing/deep-link/review workflows.
- Asset upload/finalize/review lifecycle.
- Preset write/assignment workflows.
- Richer image review/reuse/reframe/edit UX and uploaded-audio render slicing/stitching.
- Server-side project search/filter contract for the full unbounded collection.
