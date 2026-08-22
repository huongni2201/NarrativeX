# ADR-0004: Authentication, runtime security and test credentials

- Status: Accepted
- Date: 2026-08-18 (consolidated and updated: 2026-08-22)
- Scope: Backend user identity, Spring Security server-managed session persistence, Redis session storage, abuse limiting, frontend security boundaries, and secret scanning.
- Consolidated from: former ADR-0004 and ADR-0013.

## Context

Credentialed browser requests require strong session management, CSRF protection, and robust defense against account takeover. NarrativeX supports native email/password authentication as well as Google OIDC login.

Business ownership and aggregate boundaries must always use an authoritative internal identifier (`user_id` stored in PostgreSQL) rather than relying on client-controlled headers or raw external provider claims. In addition, session management across multiple backend instances requires centralized persistence that avoids exposing JWTs to browser localStorage vulnerabilities.

Furthermore, automated End-to-End (E2E) testing requires valid credentials, but committing test accounts or passwords into source code, documentation, or logs creates severe credential exposure risks.

---

## Decision

### 1. Internal User Identity & Authentication Contract

- **Internal Identity:** NarrativeX assigns a stable internal UUID `user_id` stored in PostgreSQL. All business tables (Projects, Stories, Assets, Jobs) link strictly to this internal identifier.
- **Server-Managed Session Contract:** The browser authentication contract uses **server-managed session cookie (`NX_SESSION`) + CSRF (`XSRF-TOKEN`)**:
  - No JWT access tokens, refresh tokens, token rotation, or JWKS endpoints exist in the browser runtime contract.
  - Opaque session cookie `NX_SESSION` is persisted in Redis under `narrativex:session:*` via Spring Session.
  - Cookie security defaults to `HttpOnly`, `Secure`, and `SameSite=Lax` (in `local` profile, `Secure=false` is permitted for HTTP localhost).
- **Passwords:** Salted and hashed using Spring Security `PasswordEncoder`. Raw passwords are never stored.
- **Google OIDC Login:** Requires verified Google email and maps Google `sub`. To prevent account takeover, unlinked password accounts with the same email are rejected rather than auto-linked.
- **SecurityContextHolder Authority:** Domain and application services extract authenticated identity strictly from `SecurityContextHolder`. Application APIs strictly reject client-controlled identity headers (such as `X-User-Id`).

### 2. Abuse Prevention & Fail-Open Rate Limiting

- **Rate Limiting:** Login and registration endpoints are protected by Redis-backed fixed-window rate limiters across IP and identity+IP buckets.
- **Fail-Open Policy:** If Redis encounters a temporary failure during a rate check, the rate limiter fails open so infrastructure glitches do not lock out legitimate users.
- **Session Logout:** `POST /logout` invalidates the session in Redis, clears security context, removes cookies, and returns `204 No Content`.

### 3. Out-of-Band E2E Test Credentials & Secret Scanning

- **Environment-Provided Test Credentials:** Automated E2E testing reads credentials strictly out-of-band via environment variables:
  ```bash
  E2E_TEST_EMAIL
  E2E_TEST_PASSWORD
  ```
- **Local & CI Isolation:**
  - Local developers supply credentials in `.env.e2e.local` (which is in `.gitignore`).
  - CI environments supply credentials via GitHub Actions Secrets.
- **Strict Prohibition in Repository Content:** Test credentials, passwords, private keys, or API tokens must never be committed to source code, documentation, test files, logs, or screenshots.
- **Automated Secret Scanning:** CI runs `scripts/check-secrets.py` on every commit and pull request to detect inline credentials, private keys, and token patterns.

---

## Invariants

1. All aggregate ownership checks use the authenticated `user_id` resolved from `SecurityContextHolder`.
2. Browser authentication relies solely on the opaque `NX_SESSION` cookie and CSRF protection; no JWT tokens are stored in browser storage.
3. Production builds reject unauthenticated or client-controlled identity headers (`X-User-Id`).
4. Redis failure during authentication rate limiting fails open; Redis loss signs users out but does not lose PostgreSQL business state.
5. Test credentials are supplied strictly through environment variables and must never appear in repository source or documentation.

---

## Consequences

- Sessions survive backend restarts and horizontal scaling without requiring complex JWT token refresh logic.
- Browser clients are protected against XSS-based token theft because session cookies are `HttpOnly`.
- E2E test runs remain secure across local and CI environments without exposing production or test account passwords.
