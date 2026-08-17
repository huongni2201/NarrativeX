# ADR-0007: Fail-closed OIDC profiles and browser CSRF protection

- Status: Accepted
- Date: 2026-08-17
- Scope: backend authentication, browser session security and frontend API access

## Context

The local scaffold permits API requests without authentication and resolves `X-User-Id` as a developer identity. That fallback is useful only on an explicitly local profile. The application also uses credentialed browser requests and an OIDC-backed server session, so disabling CSRF would leave state-changing endpoints exposed to cross-site requests.

## Decision

- `local` is the default profile and may use the local identity fallback. The permissive security chain is restricted to `local` and `test`.
- `staging`, `prod` and `production` refuse to start when `narrativex.security.oidc-enabled` is false or missing. OIDC authentication remains the only non-local identity source; `X-User-Id` is ignored when OIDC is enabled.
- Both security chains use a session-bound `CookieCsrfTokenRepository`. `GET /api/v1/auth/csrf` exposes the token metadata to the credentialed browser client, which sends the returned header on state-changing requests.
- CORS allows credentials only for the configured origin allowlist; wildcard origins and wildcard headers are not used.

## Consequences

Shared environments cannot silently fall back to impersonatable local identity. Browser mutations need a CSRF token, including local development, and the frontend API client owns that bootstrap. Deployments must configure OIDC and the allowed frontend origins explicitly.
