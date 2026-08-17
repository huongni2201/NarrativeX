# Frontend Codebase and Client Boundary

## Current implementation

`app/frontend-web` is a Next.js App Router application using React 19, TypeScript and Tailwind CSS. The current repository contains a v1.7-oriented studio shell:

- `src/app/layout.tsx`: root metadata and dark layout.
- `src/app/page.tsx`: Studio dashboard entry point.
- `src/app/globals.css`: Tailwind directives and base colors.
- `src/lib/api.ts`: typed project/story API boundary and error handling.
- `src/features/StudioDashboard.tsx`: project/story/settings/job planning surface with empty states.
- `src/features/auth/`, `src/store/`, `src/components/layout/` and `src/components/ui/`: auth/session shell, client state, navigation and reusable UI primitives.
- `src/types/`: project, storyboard and studio domain types.

The frontend still does not claim production OIDC, full storyboard editing or durable SSE/job ownership; those remain backend-integrated work. The package build file is the version authority (`next` `^16.3.1`).

## Target feature slices

```text
src/features/
├── auth/               # OIDC redirect, current user, logout
├── projects/           # project/story/chapter lifecycle
├── characters/         # Bible/version/reference/consent review
├── storyboard/         # scene/shot/visual beat editing and prompts
├── generation/         # image/motion actions, attempts and identity QA
├── jobs/               # durable job status, SSE reconnect and cancel
├── cost/entitlements/  # estimate, reservation confirmation, usage limits
├── render/             # animatic, render profile and final artifacts
├── shorts/             # candidates, 9:16 plan and exports
└── notifications/      # in-app center and preferences
```

## Client/server rules

- The browser talks only to the Spring Boot API and SSE endpoints.
- Google OIDC is a backend redirect/session flow. The browser does not store provider tokens or credentials in local storage.
- Project-scoped actions rely on server ownership/role checks. UI hiding is not authorization.
- Long-running actions show persisted job/stage progress; SSE reconnect is read-only and must not create a new job. Polling is a fallback.
- Expensive actions show estimate range, confidence, affected scope and max authorized spend before confirmation. Client credit counters never replace server-side reservation/entitlement enforcement.
- Optimistic `row_version`/`If-Match` conflicts surface as `409` with reload/diff/re-submit UX; complex prompt/narration edits are not silently merged.
- Asset URLs are short-lived signed URLs from the backend. The client never assumes a public bucket.

## Safety and review UX

The UI must distinguish `SAFE`, `REVIEW` and `BLOCK`, show actionable error catalog entries, and require human approval at character/storyboard/visual/publish gates. Prompt preview and overrides are explicit structured data. Real-person reference flows expose consent and retention implications. A review state cannot be treated as publishable by client code.

## Localization

Baseline locales are `vi-VN` and `en-US`. Backend state uses stable enums/codes/message keys; the frontend resolves presentation copy by locale. Story source, narration and metadata languages remain separate settings.
