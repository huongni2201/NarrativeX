# Authentication and Ownership Workflow

## Purpose

Let NarrativeX Desktop open directly into a usable workspace, then require Google OIDC only when the user invokes account-bound or paid production actions. Authentication remains server-managed and business modules obtain caller identity through application ports.

## Module boundary

```text
feature/auth/
  api/
    controller/
    response/
  application/
    port/in/
    port/out/
    query/
    usecase/
  infrastructure/
    configuration/
    persistence/
    security/

feature/common/
  api/        # generic ErrorResponse/correlation/error writer
  response/   # generic ApiResponse/cursor-page response

project / character / generation
  -> depend on auth.application.port.in.CurrentUserId
```

Business modules do not read `SecurityContextHolder`, OIDC principals or Spring Security configuration directly.

## Desktop guest-first flow

```text
Desktop starts
  -> GET /api/v1/auth/me
  -> if no server session: POST /api/v1/auth/desktop/guest
  -> server creates ROLE_GUEST session
  -> renderer opens Projects / Editor normally

Guest uses ordinary workspace CRUD
  -> project / story / chapter / character / local asset APIs
  -> allowed through authenticated guest principal

Guest invokes a gated production action
  -> backend role gate requires ROLE_USER
  -> 403 code=AUTHENTICATION_REQUIRED
  -> renderer opens LoginModal over the current route
  -> no navigation to a dedicated login screen

LoginModal
  -> Electron main opens /api/v1/auth/desktop/start in system browser
  -> Google OIDC
  -> narrativex://auth/callback?code=<one-time-code>
  -> POST /api/v1/auth/desktop/exchange
  -> transfer guest-owned workspace data to Google account
  -> replace ROLE_GUEST session with ROLE_USER session
  -> close modal + invalidate/refetch queries
  -> current project ID, route and editor context remain unchanged
```

`CurrentUserResponse.guest` tells Desktop whether the active server session is a temporary guest workspace identity or a signed-in account.

## Gated production actions

Guest users may inspect the app, create/edit project content, import local assets and request non-consuming estimates. A signed-in account is required before starting operations that consume provider resources or production execution, including:

- story/chapter AI analysis;
- chapter translation;
- narration/TTS generation;
- image/media generation;
- chapter/project render or export;
- account-only preferences such as project favorites.

The backend is authoritative. UI buttons do not provide the security boundary; role-gated endpoints return `AUTHENTICATION_REQUIRED`, which the renderer translates into the in-place sign-in modal.

## Guest ownership transfer

Guest IDs are temporary server-session principals (`guest-<uuid-v7>`). They are not Google accounts and are not persisted as password/login identities.

On successful Desktop exchange, the auth application transfers guest-scoped mutable workspace ownership before replacing the session identity:

```text
projects.owner_id
characters.owner_id
chapter_creation_idempotency.owner_id
media_assets.account_id
media_asset_checksums.account_id / canonical rows
```

Project IDs, chapter IDs and asset IDs do not change, so the renderer does not need to redirect or reconstruct the editor route after login.

## Current-user and CSRF flow

```text
GET /api/v1/auth/me
  -> CurrentUserController
  -> CurrentUserQuery
  -> GetCurrentUserUseCase
  -> CurrentUserProfile
  -> SecurityContextCurrentUser
  -> ApiResponse<CurrentUserResponse>

Desktop mutation
  -> GET /api/v1/auth/csrf
  -> CsrfTokenController
  -> CsrfTokenQuery
  -> GetCsrfTokenUseCase
  -> ApiResponse<CsrfTokenResponse>
```

`CurrentUserResponse` and `CsrfTokenResponse` live in `auth/api/response`. Generic envelope/error infrastructure lives in `feature/common`; Spring Security-specific entry-point/access-denied handlers stay in auth infrastructure.

## Security rules

1. Google remains the only persisted end-user login provider. A guest session is a temporary workspace principal, not a second login method.
2. Provider subject is the stable external identity key for signed-in accounts.
3. Provider tokens/secrets never enter frontend storage, logs or worker payloads.
4. Paid/account-bound mutations are enforced by backend authorization (`ROLE_USER`), not only by renderer state.
5. Project-scoped commands/queries resolve owner/actor through the auth application port.
6. Guest local execution does not activate the user-bound device identity; device pairing resumes only after a real user session exists.
7. `local`/`test` may use the configured developer identity fallback; staging/production fail closed when OIDC is disabled.
8. Credentialed Desktop mutations include the session-bound CSRF header; CORS uses an explicit origin allowlist.
9. OAuth completion updates session/query state in place. It must not redirect the renderer to Home or discard the active editor route.
10. Logout invalidates the server session; durable work follows its own reconciliation policy.

## Notification Outbox & Event Dispatch

NarrativeX uses an outbox pattern for guaranteed in-app and email notification delivery:

```text
Durable Event (Job completed / Quota alert)
  -> outbox_events table (committed in same DB transaction)
  -> OutboxDispatcher polling / Redis notification hints
  -> notifications table / notification_preferences check
  -> Client Notification Feed & SSE/Email dispatch
```

- Notifications are persisted durably with `user_id`, `type`, `title`, `message`, `data_json`, and read status.
- Preference rules (`IN_APP_ONLY`, `EMAIL_DIGEST`, `IMMEDIATE_EMAIL`) filter external delivery while preserving in-app audit history.

## Repository Governance & Branch Protection

- Main branch protection requires pull request reviews and linear git history.
- Critical workflow execution uses deterministic test baselines ([ADR-0005](../decisions/ADR-0005-deterministic-mvp-e2e-render-storage.md)) to validate queue, persistence, and worker execution in CI without external vendor dependencies.
