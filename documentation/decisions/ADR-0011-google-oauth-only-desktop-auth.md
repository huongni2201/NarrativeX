# ADR-0011: Google OAuth-only identity with Desktop system-browser handoff

**Status:** Accepted  
**Date:** 2026-08-24  
**Updated:** 2026-08-26 — guest-first Desktop entry, in-place sign-in gate and OAuth failure handoff

**Supersedes:** password-authentication behavior described by earlier runtime documentation. The Spring Security server-managed session model remains authoritative.

## Context

NarrativeX uses Electron as the primary editor. Maintaining password login/register, Google OIDC and a separate Electron user-token model would create multiple identity paths and unnecessary credential risk.

The Desktop app also owns a device credential for local execution. That machine credential has a different purpose from the end-user session and must remain a separate boundary.

Requiring Google login before the renderer mounts also creates unnecessary friction. Users should be able to open the app, create/edit workspace content and understand the product before an account is required. Login should be requested at the point an account-bound or paid production action is invoked, without navigating away from the current editor route.

## Decision

### 1. Google OIDC is the only end-user login method

Password login, registration and forgot-password flows are not part of the runtime target and must not be reintroduced in Desktop or legacy web UI.

The final clean database baseline reflects this decision directly: `auth_users` stores user identity/profile and Google subject data but has **no password hash column**. Test fixtures must use the same Google-only user shape rather than synthetic password fields.

### 2. Desktop may use a temporary guest workspace principal before login

A guest session is **not** a second account/login method and is not inserted into `auth_users`. When Desktop has no application session it may establish a server-managed `ROLE_GUEST` session with an opaque `guest-<uuid-v7>` identity.

The guest principal may own ordinary draft workspace data such as projects, chapters, characters and local media registrations. Backend authorization still requires `ROLE_USER` before provider-consuming or production actions start. Guest local execution must not activate a user-bound device credential.

When a guest reaches a gated action, the backend returns `AUTHENTICATION_REQUIRED`. The renderer opens a modal over the current editor instead of routing to a login screen. Dismissing the modal leaves the workspace untouched.

### 3. Desktop OAuth runs in the system browser

Electron must not embed Google OAuth in an application `BrowserWindow`.

```text
Electron main
  -> GET /api/v1/auth/desktop/start?redirect_uri=narrativex://auth/callback&code_challenge=<S256 challenge>
  -> system browser
  -> Spring Security Google OIDC
```

The backend strictly validates the NarrativeX Desktop redirect structure before entering Google OIDC.
Electron main generates a random 32-byte verifier for each login attempt, retains it only in
memory, and sends only its unpadded base64url SHA-256 challenge to the backend. A new login
replaces the pending verifier; failed, expired, successful and logout flows clear it.

OAuth failures do not use Spring's browser-oriented `/login` fallback because Desktop has no
browser login page. The backend records the provider exception with the request correlation id,
clears the pending session attributes, and redirects to the validated Desktop callback with the
controlled error `narrativex://auth/callback?error=authentication_failed`. Electron consumes this
error without exposing provider details to the renderer.

### 4. OAuth completion uses a short-lived one-time handoff code

After successful Google authentication, the backend redirects to:

```text
narrativex://auth/callback?code=<one-time-code>
```

The custom protocol handler extracts only the handoff code. Google access and refresh tokens never enter the deep link or renderer state.

The handoff payload also contains the initiating app instance's `code_challenge`. The Redis
payload never contains the raw verifier. Electron main performs the exchange and sends only the
parsed exchange response across preload to the renderer; the verifier and exchange request never
enter renderer state, URLs or logs.

Handoff codes are:

- cryptographically random;
- stored in Redis under a hash-derived key rather than persisted as raw codes;
- limited to a short TTL;
- consumed atomically with one-time semantics.

Redis-backed handoff storage avoids binding the OAuth callback and Desktop exchange to the same backend instance.

### 5. Exchange upgrades the guest session in place

Desktop exchanges the handoff code through:

```text
POST /api/v1/auth/desktop/exchange
{ "code": "<one-time-code>", "codeVerifier": "<main-process-only-verifier>" }
```

The backend atomically obtains and deletes the short-lived handoff, derives
`BASE64URL(SHA256(codeVerifier))`, and compares it with the stored challenge before reconstructing
the NarrativeX user principal. A wrong verifier therefore cannot authenticate and the consumed
handoff cannot be retried.

If the Electron backend session currently carries `ROLE_GUEST`, guest-owned workspace rows are transferred to the authenticated Google account before the server session is replaced with `ROLE_USER`. Stable project/chapter/asset identifiers are preserved.

The renderer then updates current-user/query state and closes the modal. It must not navigate to Home or recreate the router, so the active project, route and editor context remain in place.

The resulting authentication is the normal server-managed NarrativeX session model used by backend authorization. Desktop does not persist a long-lived Google bearer/refresh token.

Logout invalidates the application session and clears its session/CSRF cookies.

### 6. Electron main owns backend session transport

The packaged renderer is a `file://` origin and does not own raw backend session-cookie transport. Backend HTTP calls cross the narrow preload boundary and execute through Electron main using the Electron session/network stack.

Renderer code may supply request data and CSRF response tokens through the allowed bridge contract, but it does not receive or manage session cookies directly.

### 7. Device execution identity is separate and user-bound

Local rendering uses a revocable device token for pairing, heartbeat, render claim and lease APIs. The token:

- identifies an authorized execution device rather than replacing the user OAuth session;
- is persisted only through Electron protected storage (`safeStorage`);
- is not placed in OAuth/deep-link URLs;
- is not exposed wholesale to renderer code;
- remains independently revocable;
- is bound to the authenticated NarrativeX user before local execution is activated.

After a valid user session exists, Desktop may create a short-lived pairing code through that session and enroll its local executor automatically. A stored device credential is not considered active until the authenticated user id matches its owner. Guest sessions and logout suspend local execution; switching accounts clears/re-pairs a mismatched device identity.

## Security constraints

1. Never place Google access or refresh tokens in a deep-link URL.
2. Desktop handoff codes must remain random, short-lived and single-use.
3. Desktop exchanges must use the initiating instance's PKCE-style verifier; intercepting only the deep-link code is insufficient.
4. Persist only hashed/derived handoff identifiers and the challenge; never persist or log raw handoff codes or verifiers.
5. Custom-protocol callbacks must match the exact NarrativeX scheme/host/path contract and must not carry a verifier.
6. A guest principal is temporary authorization state, not a persisted login identity and not a substitute for Google OIDC.
7. Provider-consuming/account-bound actions must be protected by backend `ROLE_USER` authorization; renderer gating alone is insufficient.
8. User-session and device-execution credentials remain separate concepts.
9. Device tokens must be protected at rest, revocable and absent from renderer application state.
10. Renderer IPC/network capabilities must be allow-listed and sender-validated; auth verifiers remain in main memory.
11. Password authentication/schema fields must not silently return through fallback UI, fixtures or production code.
12. Successful login from a guest editor must preserve the active renderer route/context rather than redirecting to Home.

## Consequences

### Positive

- Users can open and explore NarrativeX without an up-front login wall.
- Login occurs at the moment account/paid functionality is needed and appears as an in-place modal.
- Guest work can survive account upgrade because ownership is transferred without changing workspace IDs.
- One persisted end-user identity provider remains authoritative: Google OIDC.
- No embedded Google login surface in Electron.
- No password credential persistence in the final database baseline.
- Google credentials remain outside Desktop application state.
- Intercepted deep-link codes cannot be exchanged without the initiating instance's verifier.
- OAuth handoff works across multiple backend instances through Redis.
- Server-managed NarrativeX authentication remains compatible with backend ownership/policy checks.
- Local execution can be revoked independently and cannot silently cross user accounts.

### Negative

- Guest-to-account ownership transfer becomes part of the auth exchange transaction and requires coverage.
- Account-only actions must remain explicitly role-gated as new paid features are added.
- Desktop packaging must register the custom protocol correctly on each OS.
- Redis availability is required for the production OAuth handoff path, consistent with server-side session infrastructure.
- Deep-link, session-cookie transport and device-pairing lifecycle require integration coverage.

## Related decisions

- [ADR-0004: Authentication, runtime security and test credentials](./ADR-0004-authentication-runtime-security-and-test-credentials.md)
- [ADR-0010: Electron desktop editor client boundary](./ADR-0010-desktop-editor-client-boundary.md)
- [ADR-0012: Desktop local-first media and render execution](./ADR-0012-desktop-local-first-media-and-render-execution.md)
