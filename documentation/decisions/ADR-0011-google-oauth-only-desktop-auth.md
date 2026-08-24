# ADR-0011: Google OAuth-only identity with Desktop system-browser handoff

**Status:** Accepted  
**Date:** 2026-08-24

**Supersedes:** password-authentication behavior described by earlier runtime documentation. The Spring Security server-managed session model remains authoritative.

## Context

NarrativeX is migrating the primary editor to Electron Desktop. Maintaining password login/register, Google OIDC and a separate Electron user-token model would create multiple user identity paths and unnecessary credential risk.

The Desktop app also has a device credential for local execution. That credential has a different purpose and must not be confused with end-user authentication.

## Decision

### 1. Google is the only end-user login method

Password login, registration and forgot-password flows are not part of the product/runtime target and must not be reintroduced in Desktop or legacy web UI.

Existing legacy database fields related to password authentication may remain temporarily only as a separately reviewed schema-cleanup concern.

### 2. Desktop OAuth runs in the system browser

Electron must not embed Google OAuth in an application BrowserWindow.

The implemented start flow is:

```text
Electron main
  -> GET /api/v1/auth/desktop/start?redirect_uri=narrativex://auth/callback
  -> system browser
  -> Spring Security Google OIDC
```

The backend validates the Desktop redirect URI and redirects to Google OIDC.

### 3. OAuth completion uses a one-time handoff code

After successful Google authentication, the backend creates a short-lived single-use Desktop handoff code and redirects to:

```text
narrativex://auth/callback?code=<one-time-code>
```

Electron main registers/handles the `narrativex` protocol, extracts only the handoff code and forwards that code through the narrow preload/event boundary.

Google access tokens and refresh tokens never enter Electron.

### 4. The one-time code establishes a server-managed NarrativeX session

Desktop exchanges the handoff code through:

```text
POST /api/v1/auth/desktop/exchange
```

The backend consumes the code and saves an authenticated Spring Security context using the configured `SecurityContextRepository`. The resulting NarrativeX authentication is a server-managed application session, not a long-lived OAuth token stored by the Desktop application.

Logout clears that server-managed session through the backend.

### 5. Device token is a separate machine credential

Local project execution uses a device identity/token for pairing, heartbeat, render claim and lease APIs. That token:

- identifies an authorized execution device, not the user OAuth session;
- is stored through Electron protected storage (`safeStorage` boundary);
- is never placed in OAuth deep-link URLs;
- is never exposed wholesale to renderer application code;
- must be revocable independently of the user's Google identity/session.

Current code supports explicit pairing-code enrollment for local execution. Automatic device registration after successful user authentication is a TARGET optimization, not an AS-IS guarantee.

## Current implementation checkpoint

At `main` commit `751f006634218efb2c398fc00c2cbfecd25e1eac`:

- Electron `DesktopAuthService` opens `/api/v1/auth/desktop/start` in the system browser;
- Electron registers the `narrativex` custom protocol and handles first/second-instance callback delivery;
- only the handoff code is delivered to renderer-side application code;
- backend `/api/v1/auth/desktop/start` redirects into Google OIDC;
- backend `/api/v1/auth/desktop/exchange` consumes the one-time code and establishes the authenticated server-side security context;
- Desktop logout endpoints clear the server-managed context;
- local execution still has a separate explicit pairing/device-token lifecycle.

Do not describe Desktop user authentication as a bearer-token/refresh-token model unless the implementation is deliberately changed by a later ADR.

## Security constraints

1. Never place Google access or refresh tokens in a deep-link URL.
2. Handoff codes are cryptographically random, short-lived and single-use.
3. Persisted handoff codes are stored hashed where persistence is required.
4. Custom-protocol callbacks are allow-listed to the NarrativeX scheme/path.
5. User session credentials and device execution credentials remain separate concepts.
6. Device tokens are protected at rest and not logged.
7. Renderer code receives only the minimum auth/device status it requires.
8. Password authentication must not silently return through fallback UI or test-only code paths in production.

## Consequences

### Positive

- One user identity provider: Google OIDC.
- No embedded Google login surface in Electron.
- Google credentials remain outside Desktop application state.
- Server-managed NarrativeX authentication remains compatible with backend ownership/policy checks.
- Device execution can be revoked independently from user authentication.

### Negative

- Desktop packaging must register the custom protocol correctly on each OS.
- One-time handoff lifecycle and session-cookie transport require integration testing.
- Explicit device pairing remains an extra step until a reviewed auto-registration flow is implemented.

## Related decisions

- [ADR-0004: Authentication, runtime security and test credentials](./ADR-0004-authentication-runtime-security-and-test-credentials.md)
- [ADR-0010: Electron desktop editor client boundary](./ADR-0010-desktop-editor-client-boundary.md)
- [ADR-0012: Desktop local-first media and render execution](./ADR-0012-desktop-local-first-media-and-render-execution.md)
