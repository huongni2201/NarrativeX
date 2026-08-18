# ADR-0004: Authentication and frontend runtime security

- Status: Accepted
- Date: 2026-08-18
- Scope: backend identity/session security and frontend API-versus-fixture/runtime-routing boundaries
- Consolidated from the former authentication and fixture-isolation decisions.

## Context

Credentialed browser requests require session and CSRF protection. NarrativeX supports both first-party email/password login and Google login, while business ownership must always use an internal identity rather than credentials controlled by a client or external provider. The frontend also contains prototype screens whose local fixture state must never be mistaken for canonical business data in development, staging or production. A shared backend artifact must also never silently start under a developer identity when deployment configuration is incomplete.

Frontend runtime safety also depends on preserving canonical URLs and same-origin browser auth/API traffic. Rendering authenticated application content under `/auth`, assigning navigable filters to transient Zustand state, or baking an invalid backend proxy target into a standalone frontend image can create routing, session or deployment inconsistencies even when backend authentication itself is correct.

Password login and registration are public credential-entry endpoints and therefore require application-layer abuse protection in addition to any edge/gateway controls. Redis is already available as shared infrastructure, but an outage of Redis must not become a total authentication outage.

A JWT/access-token/refresh-token migration is intentionally outside this decision's current implementation scope. Introducing token authentication would change browser storage/cookie strategy, CSRF implications, logout/revocation semantics, provider-login handoff and frontend transport behavior, so it must be handled as a separate migration rather than mixed into unrelated bug fixes.

## Decision

- NarrativeX owns a stable internal user identifier stored in PostgreSQL. Business tables use that internal identifier, not an email address or an external provider subject.
- Email/password authentication and Google OIDC both create a server-managed Spring Security session and resolve application identity to a NarrativeX user ID.
- The current browser authentication contract remains **server-managed session + CSRF**. No JWT access token, refresh token, refresh-token persistence, rotation or revocation flow is part of the current implementation.
- Any future JWT/token migration requires a separate accepted design covering access-token TTL/signing, refresh-token storage, rotation/reuse detection, revocation/logout, cookie-versus-browser-storage policy, OIDC callback exchange and frontend compatibility.
- Passwords are stored only as one-way hashes produced by Spring Security `PasswordEncoder`; raw passwords are never persisted.
- Google login requires a verified Google email and persists the Google `sub` claim as the external-provider identity key.
- A Google identity is not implicitly attached to an existing password account merely because the email strings match. Password registration does not yet verify mailbox ownership, so implicit email-based provider linking would create an account-takeover path. Cross-provider linking requires a future authenticated linking or verified-email flow.
- The normalized email remains unique across NarrativeX accounts. If Google returns an email already owned by an unlinked account, login fails closed instead of creating a duplicate identity or silently linking it.
- Shared environments require Google OIDC to be enabled. OIDC may be disabled only when every active Spring profile is explicitly `local` or `test`.
- The shared `application.yml` must not declare `local` as the default profile. No active profile, unknown profiles, staging and production-like profiles fail startup when OIDC is disabled.
- `local` and `test` may opt into a configured developer identity fallback through `narrativex.security.local-dev-identity-enabled`; the fallback is disabled by default. All other environments fail closed instead of assigning `local-dev-user`.
- Application identity is resolved from Spring Security `SecurityContextHolder`. Client-controlled headers such as `X-User-Id` are not trusted browser identity sources.
- Credentialed mutations use the CSRF token from `GET /api/v1/auth/csrf`; CORS uses an explicit credentialed origin allowlist without wildcard production origins.
- Password login/registration remain under `/api/auth/*` for the current session-based contract. Route-version normalization is deferred to the separate auth/API migration rather than mixed into this bug-fix branch.
- Unauthenticated access is limited to health, CSRF bootstrap, password login/registration, and the OAuth2/OIDC authorization/callback endpoints.
- Password login and registration are protected by Redis-backed fixed-window abuse limits before authentication/account creation.
- The limiter maintains separate IP and identity+IP buckets and stores SHA-256-derived bucket subjects rather than raw email/IP values in Redis keys.
- The Redis increment+expiry operation is atomic. When a bucket is exceeded, the API returns `429 Too Many Requests` with `Retry-After` and the standard structured error envelope.
- The auth limiter fails open on Redis data-access failure so Redis downtime does not deny all authentication. Shared environments still require monitoring and may layer stricter edge/gateway protection independently.
- Rate-limit thresholds are configuration, not domain invariants. The current defaults are login 30/IP/5m and 10/identity+IP/5m; register 10/IP/hour and 5/identity+IP/hour.
- Browser API/auth traffic uses same-origin paths by default. The frontend proxy forwards `/api`, `/oauth2`, `/login` and `/logout` to the backend without exposing provider/backend credentials to the browser.
- `/auth` is an authentication entry route only. Once session bootstrap resolves authenticated, the frontend replaces navigation to canonical `/projects`; it must not render authenticated project content while retaining `/auth` in the address bar.
- API is the default frontend runtime mode. `mock` is allowed only in tests or Storybook; unsupported API capabilities render an explicit disconnected/coming-soon state.
- TanStack Query owns persisted server state. URL/search params own navigable/shareable route state such as project identity and list filters. Zustand owns only transient cross-screen/editor/wizard/demo state that cannot naturally live in the URL or Query cache. Local component state may absorb high-frequency input before debounced URL synchronization.
- Fixture-backed business data is isolated behind the test/Storybook boundary.
- Shared API transport owns credentials, CSRF bootstrap, envelope parsing and typed transport/protocol errors; malformed successful JSON is normalized to the API error model rather than leaking raw parsing exceptions.
- Dynamically imported heavy overlays are mounted only while active so closed modal state does not defeat lazy-loading boundaries.

## Identity invariant

- A password registration creates one internal NarrativeX user ID.
- A Google-first account creates one internal NarrativeX user ID associated with the verified Google subject.
- The same normalized email cannot create a second NarrativeX identity.
- Until an authenticated provider-linking flow exists, an existing password account and a new Google subject with the same email are rejected rather than auto-linked.
- External provider subjects and email addresses are never used directly as project ownership identifiers.

## Startup invariant

With `narrativex.security.oidc-enabled=false`:

- `local` -> allowed;
- `test` -> allowed;
- `local,test` -> allowed;
- no active profile -> startup failure;
- `prod`, `production`, `staging`, `qa`, `uat`, preview or any unknown profile -> startup failure.

With OIDC enabled, this developer-identity guard does not apply; normal OIDC/client-registration validation remains responsible for the shared environment.

The PostgreSQL Testcontainers migration suite runs with explicit `test` profile so the startup invariant remains active in CI while datasource/dialect settings are overridden back to PostgreSQL for authoritative migration validation.

## Frontend routing and proxy invariant

- `/projects` is the canonical project collection route.
- `/projects/[projectId]` owns project identity.
- `/dashboard` is redirect-only compatibility behavior.
- Authenticated `/auth` resolves to `/projects` using route replacement.
- Project list filters/search remain shareable through URL params; responsive text entry may use local state with bounded debounce before URL synchronization.
- Browser session/API/auth calls stay same-origin unless a deliberate deployment contract replaces that behavior.
- In the current standalone Next.js Docker build, rewrite destination configuration is resolved during build. The image build must therefore receive a backend network destination valid for the deployed topology; frontend-container `localhost:8080` is not another container.
- If a single immutable frontend image must be promoted across environments that have different backend destinations, runtime routing must move to an environment-neutral reverse proxy/BFF layer instead of environment-specific build-time rewrites.

## Consequences

- Users can authenticate with either email/password or Google while project ownership remains based on an internal NarrativeX user ID.
- Password credential endpoints have application-layer brute-force/account-creation abuse throttling without changing their success response/session contract.
- A Redis outage temporarily removes this application-layer throttle rather than causing a total login outage; observability/edge controls are therefore still important in production.
- Cross-provider account linking is intentionally deferred until it can prove control of both sides; conflicting identities fail closed.
- Shared environments cannot silently fall back to a common local identity.
- A missing `SPRING_PROFILES_ACTIVE` no longer makes production behave as local development.
- Auth/session state does not create alternate canonical application URLs.
- The central frontend transport owns credentials, CSRF bootstrap, envelope parsing and error handling.
- URL-owned state remains bookmarkable/shareable without forcing a route replacement on every search keystroke.
- JWT/access-token/refresh-token migration remains a separate future compatibility/security change; this ADR must not be read as implying that token auth already exists.
- Character, storyboard, render, asset and other screens remain visibly incomplete until their backend contracts exist, rather than reporting fake success.
- Frontend deployment configuration must treat backend proxy destination as an explicit artifact/runtime contract rather than relying on an implicit localhost fallback.

## Consolidation note

This file is the canonical replacement for the former OIDC/CSRF and runtime fixture-isolation records. Frontend codebase details and current implementation evidence are maintained in `documentation/codebase/FRONTEND_CODEBASE.md` and `documentation/codebase/FRONTEND_API_INTEGRATION_MATRIX.md`.
