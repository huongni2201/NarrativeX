# Authentication and Ownership Workflow

## Purpose

Authenticate a user with Google OIDC, establish a server-managed session, and expose caller identity to business modules through application ports.

## Module boundary

```text
feature/auth/
  api/
    controller/
    response/
  application/
    port/in/
    query/
    usecase/
  infrastructure/
    configuration/
    security/

feature/common/
  api/        # generic ErrorResponse/correlation/error writer
  response/   # generic ApiResponse/cursor-page response

project / character / generation
  -> depend on auth.application.port.in.CurrentUserId
```

Business modules do not read `SecurityContextHolder`, OIDC principals or Spring Security configuration directly.

## Flow

```text
Browser -> Google OIDC -> server session
  -> GET /api/auth/me
  -> CurrentUserController
  -> CurrentUserQuery
  -> GetCurrentUserUseCase
  -> CurrentUserProfile
  -> SecurityContextCurrentUser
  -> ApiResponse<CurrentUserResponse>

Browser mutation
  -> GET /api/v1/auth/csrf
  -> CsrfTokenController
  -> CsrfTokenQuery
  -> GetCsrfTokenUseCase
  -> ApiResponse<CsrfTokenResponse>
```

`CurrentUserResponse` and `CsrfTokenResponse` live in `auth/api/response`. Generic envelope/error infrastructure lives in `feature/common`; Spring Security-specific entry-point/access-denied handlers stay in auth infrastructure.

## Security rules

1. The Google provider subject is persisted as the stable external identity key in `auth_users.google_subject`.
2. Provider tokens/secrets never enter frontend storage, logs or worker payloads.
3. Project-scoped commands/queries resolve owner/actor through the auth application port.
4. `local`/`test` may use the configured developer identity fallback; staging/production fail closed when OIDC is disabled.
5. Credentialed browser mutations include the session-bound CSRF header; CORS uses an explicit origin allowlist.
6. Logout invalidates the server session; durable work follows its own reconciliation policy.

## Notification Outbox & Event Dispatch

NarrativeX uses an outbox pattern for durable event dispatch and an in-app notification feed:

```text
Durable Event (job completed / quota event)
  -> outbox_events table when transactional dispatch is required
  -> OutboxDispatcher / delivery adapter
  -> notifications table
  -> Client Notification Feed / SSE
```

`notifications` stores the current durable notification contract: `user_id`, optional `project_id`, unique `event_key`, `type`, `channel_state_json`, `title_key`, `message_key`, creation time and `read_at`. External delivery channels are implemented by application delivery adapters when a concrete workflow requires them; no separate preference table is part of the current database baseline.
