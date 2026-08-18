# NarrativeX Frontend Web

## Purpose
The Frontend Web application provides the NarrativeX web client for project creation, story import, production workspace flows, character/assets/preset surfaces, and backend-driven generation workflows as those contracts become available.

## Technology Stack
- **Framework**: Next.js 16 (App Router)
- **UI Runtime**: React 19
- **Language**: TypeScript (strict mode)
- **Server State**: TanStack Query
- **Client State**: Zustand for transient editor/UI state only
- **Styling**: Tailwind CSS
- **Linting**: ESLint + architecture checks
- **Tests**: Node.js built-in test runner for zero-dependency architecture regression tests
- **Runtime / CI**: Node.js 22

## Development Commands

```bash
npm ci
npm run dev
npm test
npm run lint
npm run type-check
npm run build
npm start
```

Local dev is available at `http://localhost:3000` by default.

## Canonical routes

- `/` — redirect to `/projects` until a distinct backend-backed overview exists
- `/projects` — canonical project list
- `/projects/[projectId]` — project workspace
- `/characters` — character library
- `/assets` — asset library
- `/presets` — style/preset library
- `/auth` — auth entry
- `/dashboard` — legacy redirect to `/projects`

Project identity comes from the URL. Navigable chapter, scene and workspace-tab state must move to URL/search params as those backend-backed routes become available; Zustand is not the durable navigation source of truth.

## API boundary

`src/shared/api/client.ts` owns HTTP transport, envelope parsing, CSRF and typed transport errors. Feature code imports its domain API directly, for example:

```text
features/auth/api/auth.api.ts
features/projects/api/projects.api.ts
```

`src/lib/api.ts` remains a temporary compatibility facade for non-feature legacy callers only. `scripts/check-architecture.mjs` rejects new or remaining `@/lib/api` imports from `src/features/**`.

## Data mode and fixture policy

API mode is the runtime source of truth. `NEXT_PUBLIC_NX_DATA_MODE=mock` is reserved for test/Storybook-style demo runtimes allowed by `src/lib/data-mode.ts`.

Fixture modules must live behind a demo/test lazy boundary. Production/API-mode modules must not statically import `mock-data`, `*-mock` or `production-mock`. The project-creation result step follows this rule by dynamically loading `Step4DemoResults` only in mock mode; there is no architecture-check whitelist for production components.

When a backend feature is unavailable, API mode shows an explicit unavailable state. File import remains disabled until upload/storage/document-extraction contracts exist.

## Project creation workflow safety

Project creation currently spans Project + initial StoryVersion mutations. After ambiguous transport/protocol failure, the wizard blocks blind StoryVersion retry because the backend may already have committed the write. While the workflow is pending, modal close/back/step navigation is locked.

The long-term backend contract should provide an idempotent or transactional orchestration endpoint.

## Accessibility baseline

- Shared dialogs must have an accessible name through `title` or `ariaLabel`.
- Modal focus is trapped/restored and Escape/backdrop closing can be disabled during persisted mutations.
- Labels are programmatically associated with form controls.
- Validation errors use `aria-invalid`/`aria-describedby` through shared form controls.
- Choice groups such as aspect ratio and quality expose radio-group semantics.
- Non-essential animation uses `motion-safe`/reduced-motion-aware behavior.

## Feature ownership

Generic reusable primitives belong in `src/components/ui`; application-shell components belong in `src/components/layout`. Domain UI should be colocated under its owning `src/features/<feature>` module. Existing legacy domain folders under `src/components/assets`, `src/components/presets` and `src/components/production` are migration debt and must not be expanded; new domain components belong in their feature.

## Quality gates

Frontend changes must pass:

```bash
npm ci
npm test
npm run lint
npm run type-check
npm run build
```

`npm run lint` also executes `scripts/check-architecture.mjs`. `npm test` contains an architecture regression test so CI detects accidental removal/bypass of these boundaries.
