# Authentication and Ownership Workflow

## Purpose

Let NarrativeX Desktop open directly into a usable workspace, keep guest ownership stable across application and server-session restarts, then require Google OIDC only when the user invokes account-bound or paid production actions. Authentication remains server-managed and business modules obtain caller identity through application ports.

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

## Stable desktop guest identity

Electron Main owns a per-installation credential:

```text
<userData>/guest-device-identity.json
  deviceId          # random UUID, stable for this installation
  encryptedSecret   # 32 random bytes encrypted with Electron safeStorage
```

The plaintext secret never enters React, browser storage, logs or worker payloads. `DesktopBackendApiService` injects it only when calling `POST /api/v1/auth/desktop/guest`.

The backend stores only the SHA-256 hash in `desktop_guest_installations`. The table maps one `device_id` to one stable internal `guest_user_id`. A matching internal `auth_users` row exists only to satisfy ownership/FK invariants; it is not a password account and cannot be used as an OAuth identity.

`NX_SESSION` remains a normal session cookie. Session expiry does not destroy the guest identity: Desktop simply presents the installation credential again and the backend issues a new `ROLE_GUEST` session for the same `guest_user_id`.

## Desktop guest-first flow

```text
Desktop starts
  -> GET /api/v1/auth/me
  -> if the server session is still valid: reuse it
  -> otherwise renderer requests POST /api/v1/auth/desktop/guest
  -> Electron Main injects deviceId + installation secret
  -> backend verifies/creates desktop_guest_installations
  -> backend restores the same stable guest_user_id
  -> server creates a fresh ROLE_GUEST session
  -> renderer opens Projects / Editor normally

Guest uses free workspace mutations
  -> create project/story/chapter
  -> batch import/edit/delete chapter content
  -> create character/reference metadata
  -> register/delete local assets

Guest invokes a gated production/account action
  -> backend role gate requires ROLE_USER
  -> 403 code=AUTHENTICATION_REQUIRED
  -> renderer opens LoginModal over the current route
  -> no navigation to a dedicated login screen

LoginModal
  -> Electron main opens /api/v1/auth/desktop/start in system browser
  -> Google OIDC
  -> narrativex://auth/callback?code=<one-time-code>
  -> POST /api/v1/auth/desktop/exchange
  -> transfer guest-owned workspace data to Google account in one auth use-case transaction
  -> replace ROLE_GUEST session with ROLE_USER session
  -> close modal + invalidate/refetch queries
  -> current project ID, route and editor context remain unchanged
```

`CurrentUserResponse.guest` tells Desktop whether the active server session represents the installation guest identity or a signed-in Google account.

## Gated production actions

Guest users may inspect the app, create/edit project content, import local assets and request non-consuming reads. A signed-in account is required before starting operations that consume provider/cloud resources or account-only state, including:

- story/chapter AI analysis;
- chapter translation;
- narration/TTS generation;
- image/media generation;
- cloud upload intents;
- chapter/project production render or export when the endpoint is account-gated;
- account-only preferences such as project favorites.

Security uses explicit guest CRUD allowlists before the generic mutation rule. Generation routes under the same `/projects/...` namespace are not covered by those allowlists and remain `ROLE_USER` only.

## Guest ownership transfer

The stable guest ID has the form `guest-<uuid-v7>`. It is an internal principal associated with one installation credential, not a second end-user login method.

During rollout, if an old ephemeral `guest-<uuid>` session is present when the stable installation is first established, the backend transfers its owned workspace rows to the stable guest ID first.

On successful Desktop Google exchange, the auth application transfers only guest-created mutable workspace ownership before replacing the session identity:

```text
projects.owner_id
characters.owner_id
chapter_creation_idempotency.owner_id
media_assets.account_id
media_asset_checksums.account_id / canonical rows
```

Cloud/account-bound state such as `media_upload_sessions`, generation jobs, provider operations, quota/billing rows and account preferences is not claimed by the guest transfer. Those workflows require `ROLE_USER` before creation.

Checksum collisions are deduplicated before `media_asset_checksums.account_id` is moved. Project IDs, chapter IDs, character IDs and asset IDs do not change, so the renderer does not need to redirect or reconstruct the editor route after login.

The `desktop_guest_installations` row remains associated with the installation after a Google claim. If the user later logs out, the same installation guest can resume and create new guest-only work; previously transferred Google-owned projects remain owned by the account. A later login transfers only new guest-owned rows.

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

1. Google remains the only end-user login provider. The internal guest row exists for ownership/FK integrity, not as a password/OAuth account.
2. The installation secret is generated in Electron Main, encrypted at rest with `safeStorage`, never exposed to renderer code, and only its SHA-256 hash is persisted server-side.
3. A server session may expire independently; possession of the installation credential is required to resume the same stable guest identity.
4. The Google provider subject is persisted as the stable external identity key in `auth_users.google_subject` for signed-in accounts.
5. Provider tokens/secrets never enter frontend storage, logs or worker payloads.
6. Paid/account-bound mutations are enforced by backend authorization (`ROLE_USER`), not only by renderer state.
7. Free guest mutations are explicit endpoint allowlists; broad mutation wildcards remain `ROLE_USER` only.
8. Project-scoped commands/queries resolve owner/actor through the auth application port.
9. Guest local execution does not activate the user-bound device identity; device pairing resumes only after a real user session exists.
10. `local`/`test` may use the configured developer identity fallback; staging/production fail closed when OIDC is disabled.
11. Credentialed Desktop mutations include the session-bound CSRF header; CORS uses an explicit origin allowlist.
12. OAuth completion updates session/query state in place. It must not redirect the renderer to Home or discard the active editor route.
13. Logout invalidates the server session but does not delete local projects or the encrypted installation guest credential.

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
