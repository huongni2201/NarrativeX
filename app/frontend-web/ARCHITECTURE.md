# NarrativeX Frontend Architecture

NarrativeX Frontend uses Next.js App Router with feature-oriented modules. Route files compose features and stay free of business logic.

## Dependency direction

```text
app/ -> features/ -> shared/
             \-> types/
```

- `shared/` must never depend on feature modules or Zustand stores.
- Features may depend on `shared/`, `types/` and intentional public APIs from another feature.
- Feature code must import its domain API directly; `src/features/**` must not import the compatibility facade `@/lib/api`.
- `src/lib/api.ts` remains temporary compatibility only for legacy non-feature callers and should shrink over time.

## Canonical routes and navigation state

```text
/                         redirect -> /projects until a distinct overview exists
/projects                 project list
/projects/[projectId]     project workspace
/characters               character library
/assets                   asset library
/presets                  style/preset library
/auth                     auth entry
/dashboard                legacy redirect -> /projects
```

Project identity comes from `/projects/[projectId]`. Any production chapter, scene or workspace-tab state that users must deep-link, refresh or share belongs in URL params/search params. The existing Zustand chapter/scene/tab state is scoped to `ProductionDemoWorkspace` only and must not be reused as the production navigation contract when chapter/storyboard APIs arrive.

## Feature shape and component ownership

```text
features/<feature>/
├── api/          # domain HTTP endpoints
├── components/   # feature-owned UI
├── hooks/        # client orchestration / view-model hooks
├── model/        # pure transforms, validation, selectors
├── fixtures/     # test/Storybook-only fixtures
└── index.ts      # optional narrow public API
```

Generic primitives belong in `components/ui`; app-shell components belong in `components/layout`. Domain implementations belong under their feature.

The asset, preset and production implementations now live in:

```text
features/assets/components/
features/presets/components/
features/production/components/
```

The old `components/assets`, `components/presets` and `components/production` files exist only as compatibility re-exports while older demo imports are migrated. They must contain no implementation. `check-architecture.mjs` enforces this.

## State ownership

Use the narrowest owner possible:

1. component state for ephemeral UI;
2. URL/search params for shareable navigation/filter state;
3. TanStack Query for server entities and collections;
4. Zustand only for transient state that cannot naturally live in URL or Query cache.

Do not copy persisted API entities into Zustand merely for rendering. Collection screens use cursor/server pagination; entity workspaces fetch by stable ID.

## API organization

```text
shared/api/client.ts                  # transport, CSRF, envelopes, typed errors
features/auth/api/auth.api.ts         # auth endpoints
features/projects/api/projects.api.ts # project endpoints
app/providers.tsx                     # app-level session reaction to HTTP 401
```

The shared transport layer must not import React, Zustand, app routes or feature state. Feature modules consume domain APIs and shared transport errors directly. `scripts/check-architecture.mjs` rejects feature imports from `@/lib/api`.

## Fixture policy

API mode is the runtime source of truth. Fixtures are allowed only behind demo/test boundaries.

- Production/API-mode entry paths must not statically import `@/lib/mock-data`, `*-mock` or `production-mock`.
- A component with real/API-mode behavior must never be whitelisted to bypass this rule.
- Demo modules use an explicit `Demo` filename and are dynamically imported by the API-mode boundary.
- `Step4Results` contains only API-mode/unavailable UI; `Step4DemoResults` owns mock analysis preview data and is loaded only in mock mode.
- Unsupported backend functionality renders an explicit unavailable state rather than fake persisted data.

## Multi-step mutation safety

Project creation currently spans Project + initial StoryVersion writes.

- Do not treat in-memory state as backend idempotency.
- Definitive HTTP failure may permit retry against the already-created Project.
- Ambiguous transport/protocol failure blocks blind StoryVersion retry because the previous write may have committed.
- Persisted mutation workflows lock close/back/step actions while pending.
- The long-term backend contract should expose an idempotent orchestration endpoint or transactional create-project-with-initial-story command.

### Render request idempotency

The chapter render hook keeps the `Idempotency-Key` in a ref for the lifetime of one render intent.

- Retry reuses the same key after an ambiguous transport/protocol failure or a 5xx response so a committed job can be reconciled.
- A definitive 4xx rejection or a terminal `FAILED`/`CANCELED` render clears the key before retry.
- The explicit render action starts a new intent and therefore gets a new key; changing the project/chapter context also clears the ref.

## Accessibility baseline

- Every dialog has an accessible name through `title`/`aria-labelledby` or `ariaLabel`.
- Shared Modal traps/restores focus and restores body scroll state.
- Escape/backdrop close may be disabled during persisted mutations; close controls expose disabled state.
- Form labels are programmatically associated with controls.
- Shared form errors connect through `aria-invalid` and `aria-describedby`.
- Mutually exclusive visual options use radio/radiogroup semantics.
- Icon-only controls have accessible names.
- Non-essential motion respects reduced-motion preferences through `motion-safe` or equivalent behavior.

## Performance and media rules

- Keep mock/test fixtures out of API production chunks.
- Pre-index repeated relations with `Map`/`Set` instead of repeated `.find()` in render loops.
- Prefer server pagination/search for unbounded collections.
- Lazy-load large demo/editor surfaces not required for initial render.
- Keep `"use client"` boundaries as narrow as practical.
- Use `next/image` for local branding, known trusted remote hosts and demo imagery so layout dimensions, responsive `sizes` and image optimization are explicit.
- Only allow trusted optimization hosts in `next.config.mjs`; do not add broad wildcard remote-image hosts to make arbitrary URLs pass.
- Backend media URLs may come from Cloudflare R2/CDN hosts that vary by environment. Until the storage contract provides a stable trusted media hostname, use native `<img loading="lazy" decoding="async">` for those arbitrary runtime URLs instead of weakening `remotePatterns`.
- Once a stable media host is part of configuration, add the narrow `remotePatterns` entry and migrate that media path to `next/image`.
- Above-the-fold brand/hero images may use `priority`; card/grid imagery should remain lazy by default and provide responsive `sizes` when rendered through `next/image`.
- Decorative motion uses reduced-motion-aware utilities (`motion-safe:*`), while essential state indicators and spinners use `animate-spin` to communicate ongoing progress.

## Architecture enforcement

`scripts/check-architecture.mjs` enforces:

- shared boundary (`shared` cannot import store/features/app);
- route page isolation;
- fixture imports only from Demo/test/spec/story modules;
- no `@/lib/api` imports from feature code;
- legacy domain-component paths are compatibility re-exports only.

Architecture enforcement must not use one-off production-component whitelists to silence violations. Fix the dependency boundary instead.

## Quality gates

Frontend CI and local validation must run:

```bash
npm ci
npm test
npm run lint
npm run type-check
npm run build
```

`npm test` uses the Node.js built-in test runner and includes an architecture regression test. `npm run lint` also runs the architecture checker. A frontend architecture/refactor change is not complete if any gate fails.
