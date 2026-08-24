# ADR-0011: Google OAuth-only identity with Desktop system-browser handoff

**Status:** Accepted  
**Date:** 2026-08-24

**Supersedes:** password-authentication behavior described by earlier runtime documentation. The Spring Security server-managed session model remains authoritative.

## Context

NarrativeX uses Electron as the primary editor. Maintaining password login/register, Google OIDC and a separate Electron user-token model would create multiple identity paths and unnecessary credential risk.

The Desktop app also owns a device credential for local execution. That machine credential has a different purpose from the end-user session and must remain a separate boundary.

## Decision

### 1. Google OIDC is the only end-user login method

Password login, registration and forgot-password flows are not part of the runtime target and must not be reintroduced in Desktop or legacy web UI.

The final clean database baseline reflects this decision directly: `auth_users` stores user identity/profile and Google subject data but has **no password hash column**. Test fixtures must use the same Google-only user shape rather than synthetic password fields.

### 2. Desktop OAuth runs in the system browser

Electron must not embed Google OAuth in an application `BrowserWindow`.

```text
Electron main
  -> GET /api/v1/auth/desktop/start?redirect_uri=narrativex://auth/callback
  -> system browser
  -> Spring Security Google OIDC
```

The backend strictly validates the NarrativeX Desktop redirect structure before entering Google OIDC.

### 3. OAuth completion uses a short-lived one-time handoff code

After successful Google authentication, the backend redirects to:

```text
narrativex://auth/callback?code=<one-time-code>
```

The custom protocol handler extracts only the handoff code. Google access and refresh tokens never enter the deep link or renderer state.

Handoff codes are:

- cryptographically random;
- stored in Redis under a hash-derived key rather than persisted as raw codes;
- limited to a short TTL;
- consumed atomically with one-time semantics.

Redis-backed handoff storage avoids binding the OAuth callback and Desktop exchange to the same backend instance.

### 4. Exchange establishes the normal server-managed application session

Desktop exchanges the handoff code through:

```text
POST /api/v1/auth/desktop/exchange
```

The backend consumes the code, reconstructs the NarrativeX user principal and persists authentication through the configured Spring Security `SecurityContextRepository`.

The resulting authentication is the same server-managed NarrativeX session model used by backend authorization. Desktop does not persist a long-lived Google bearer/refresh token.

Logout invalidates the application session and clears its session/CSRF cookies.

### 5. Electron main owns backend session transport

The packaged renderer is a `file://` origin and does not own raw backend session-cookie transport. Backend HTTP calls cross the narrow preload boundary and execute through Electron main using the Electron session/network stack.

Renderer code may supply request data and CSRF response tokens through the allowed bridge contract, but it does not receive or manage session cookies directly.

### 6. Device execution identity is separate and user-bound

Local rendering uses a revocable device token for pairing, heartbeat, render claim and lease APIs. The token:

- identifies an authorized execution device rather than replacing the user OAuth session;
- is persisted only through Electron protected storage (`safeStorage`);
- is not placed in OAuth/deep-link URLs;
- is not exposed wholesale to renderer code;
- remains independently revocable;
- is bound to the authenticated NarrativeX user before local execution is activated.

After a valid user session exists, Desktop may create a short-lived pairing code through that session and enroll its local executor automatically. A stored device credential is not considered active until the authenticated user id matches its owner. Logout suspends local execution; switching accounts clears/re-pairs a mismatched device identity.

## Security constraints

1. Never place Google access or refresh tokens in a deep-link URL.
2. Desktop handoff codes must remain random, short-lived and single-use.
3. Persist only hashed/derived handoff identifiers; never log raw handoff codes.
4. Custom-protocol callbacks must match the exact NarrativeX scheme/host/path contract.
5. User-session and device-execution credentials remain separate concepts.
6. Device tokens must be protected at rest, revocable and absent from renderer application state.
7. Renderer IPC/network capabilities must be allow-listed and sender-validated.
8. Password authentication/schema fields must not silently return through fallback UI, fixtures or production code.

## Consequences

### Positive

- One end-user identity provider: Google OIDC.
- No embedded Google login surface in Electron.
- No password credential persistence in the final database baseline.
- Google credentials remain outside Desktop application state.
- OAuth handoff works across multiple backend instances through Redis.
- Server-managed NarrativeX authentication remains compatible with backend ownership/policy checks.
- Local execution can be revoked independently and cannot silently cross user accounts.

### Negative

- Desktop packaging must register the custom protocol correctly on each OS.
- Redis availability is required for the production OAuth handoff path, consistent with server-side session infrastructure.
- Deep-link, session-cookie transport and device-pairing lifecycle require integration coverage.

## Related decisions

- [ADR-0004: Authentication, runtime security and test credentials](./ADR-0004-authentication-runtime-security-and-test-credentials.md)
- [ADR-0010: Electron desktop editor client boundary](./ADR-0010-desktop-editor-client-boundary.md)
- [ADR-0012: Desktop local-first media and render execution](./ADR-0012-desktop-local-first-media-and-render-execution.md)
