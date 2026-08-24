# ADR-0011: Google OAuth-only identity with a desktop authentication transport

**Status**: Accepted  
**Date**: 2026-08-24

**Supersedes**: The password-authentication mode described in ADR-0004; the session/CSRF and
Google OIDC security baseline remains applicable to browser flows.

## Context

NarrativeX is migrating the primary editor from the browser studio to Electron Desktop. The
current backend still exposes password login/register alongside Google OIDC, while the separate
Local Agent uses pairing codes and an encrypted device token. Keeping all three user-facing paths
would leave two authentication models and two Electron runtimes to maintain.

## Decision

- Google is the only user-facing authentication provider. Password login and registration are
  removed from runtime routes and web auth UI; the existing `password_hash` column remains only as
  a staged data-migration concern until a separately reviewed cleanup migration proves it is safe
  to drop.
- Browser web sessions continue to use Spring Security OIDC + `NX_SESSION` + CSRF.
- Desktop authentication uses the system browser, not an embedded OAuth BrowserWindow. The backend
  completes Google OIDC, issues a short-lived one-time desktop authorization code, and redirects
  to `narrativex://auth/callback?code=...`.
- Electron main receives only the one-time handoff code through the custom protocol and forwards it
  over the narrow preload bridge. The renderer exchanges the code with Spring, which creates the
  server-managed `NX_SESSION` cookie. Google access/refresh tokens never enter Electron.
- Desktop API calls use the desktop credential transport. The backend remains authoritative for
  user identity, ownership, entitlements, device registration, jobs and render policy.
- The Local Agent is ported into `app/desktop/src/main` as device, heartbeat, storage and local
  execution capabilities. Pairing codes remain available only for future headless/remote nodes;
  the primary Desktop install auto-registers its local device after authentication.

## Migration sequence

1. Remove password auth controllers, DTOs, providers, frontend inputs and password-only rate-limit
   consumers while preserving Google OIDC and local/test-only identity fixtures.
2. Add desktop OAuth start/exchange/refresh/logout contracts with state, PKCE, one-time code
   expiry/consumption and refresh-token rotation/revocation.
3. Port secure device identity, registration and heartbeat into the single Desktop main process.
4. Move Desktop renderer API calls from cookie/CSRF-only assumptions to the desktop credential
   bridge while keeping CSRF for browser session mutations.
5. Split the Desktop renderer into feature modules and shared API/domain packages.

## Consequences

### Positive

- One user identity model backed by Google OIDC.
- No embedded OAuth login surface in Electron.
- OS-protected desktop credentials and automatic local-device registration.
- Web and Desktop can use different transports without duplicating users or policy.

### Negative

- Desktop auth requires a custom protocol registration and a short-lived handoff lifecycle.
- Existing password-auth test fixtures and legacy password hashes need a staged cleanup.
- The repository temporarily supports browser sessions and desktop tokens until web editor
  deprecation is complete.

## Security constraints

- Never put access or refresh tokens in the deep-link URL.
- One-time desktop auth codes expire quickly, are single-use, are bound to the pending OAuth state
  and are stored hashed when persisted.
- Handoff codes are cryptographically random, hashed at rest in the handoff store, expire quickly,
  and are single-use. The session cookie remains opaque to renderer application code.
- Device tokens are never logged or exposed through preload wholesale APIs.

## Related decisions

- [ADR-0004: Authentication, runtime security and test credentials](./ADR-0004-authentication-runtime-security-and-test-credentials.md)
- [ADR-0010: Establish the Electron desktop editor client boundary](./ADR-0010-desktop-editor-client-boundary.md)
