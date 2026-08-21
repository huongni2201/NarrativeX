# ADR-0004: Authentication, session persistence and runtime security

- Status: Accepted
- Date: 2026-08-18 (consolidated and updated: 2026-08-21)
- Scope: Backend user identity, Spring Security server-managed session persistence, Redis session storage, abuse limiting, and frontend runtime security boundaries.
- Consolidated from: former ADR-0004 and ADR-0008.

## Context

Credentialed browser requests require robust session and CSRF protection. NarrativeX supports first-party email/password authentication as well as Google OIDC login. Business ownership and aggregate boundaries must always use an authoritative internal identifier (`user_id` stored in PostgreSQL) rather than relying on client-controlled headers or raw external provider claims.

In addition, process-local servlet container sessions break when multiple backend instances are deployed or when an instance restarts. NarrativeX uses Spring Session backed by Redis to persist authenticated `HttpSession` state across instances while keeping the browser contract simple: **server-managed session cookie (`NX_SESSION`) + CSRF**.

Public credential-entry endpoints (login and registration) also require application-layer abuse protection. Redis is used to track fixed-window request limits, failing open during Redis outages so users are not completely locked out.

The frontend must also preserve clean URL-driven navigation (`/projects/[projectId]`), use TanStack Query for server state, isolate transient UI state in Zustand, and ensure fixture mock data is confined strictly to test and Storybook environments.

## Decision

### 1. Internal Identity & Authentication Strategy

- **Internal Identity:** NarrativeX assigns a stable internal UUID `user_id` stored in PostgreSQL. All business tables (Projects, Stories, Assets, Jobs) link to this internal identifier.
- **Session-Based Contract:** The current browser authentication contract is strictly **server-managed session + CSRF**. No JWT access tokens, refresh tokens, token rotation, or JWKS endpoints are part of the current runtime contract.
- **Passwords:** Stored strictly as salted one-way hashes via Spring Security `PasswordEncoder`. Raw passwords are never persisted.
- **Google OIDC:** Requires a verified Google email and maps Google `sub` as the external provider key. Unlinked existing password accounts with matching emails are rejected rather than silently auto-linked to prevent account takeover.
- **User Identity Extraction:** Domain and application code obtain user identity strictly from Spring Security `SecurityContextHolder`. Application APIs must never accept identity through `X-User-Id` or equivalent client headers.

### 2. Redis-Backed HTTP Sessions

- **Spring Session Redis:** Authenticated `HttpSession` state is persisted into Redis under the namespace `narrativex:session` via `spring-boot-starter-session-data-redis`.
- **Session Cookie:** The browser receives an opaque session cookie named `NX_SESSION`. Default timeout is 7 days (configurable via `NARRATIVEX_SESSION_TIMEOUT`).
- **Cookie Security:** Defaults to `HttpOnly`, `Secure`, and `SameSite=Lax`. In explicit `local` and `test` profiles, `Secure=false` is permitted for localhost development.
- **Session Attribute Serialization:** Principals stored in session are Java-serializable. Password hash fields are marked `transient` and erased from memory before session persistence.
- **Logout:** `POST /logout` invalidates the session in Redis, clears authentication, clears `NX_SESSION` and `XSRF-TOKEN`, and returns `204 No Content`.

### 3. Abuse Prevention & Fail-Open Rate Limiting

- **Rate Limiting:** Password login and registration endpoints are protected by Redis-backed fixed-window rate limiters.
- **Buckets:** Maintains separate IP and identity+IP buckets using SHA-256 hashed keys in Redis.
- **Fail-Open Policy:** If Redis data-access encounters an error during rate check, the limiter fails open so Redis infrastructure glitches do not block user login.

### 4. Frontend Runtime Security & Routing

- **Same-Origin Proxy:** Browser API and auth traffic uses same-origin routes (`/api/*`, `/oauth2/*`, `/login`, `/logout`).
- **Route Boundaries:** `/auth` is an entry route only. Once authenticated, the frontend redirects to `/projects`.
- **State Separation:** TanStack Query owns persisted server state; URL parameters own navigable filters/pagination; Zustand owns only ephemeral cross-screen editor state. Mock fixtures are strictly forbidden in production runtime.

## Invariants

1. All aggregate ownership checks use the authenticated `user_id` from `SecurityContextHolder`.
2. Browser authentication is opaque cookie `NX_SESSION` + CSRF (`X-XSRF-TOKEN`).
3. Redis session keys are isolated under `narrativex:session:*` and expire after the configured TTL.
4. Redis failure during authentication rate limiting fails open; Redis loss signs users out but does not lose PostgreSQL business state.
5. Production builds reject unauthenticated client identity headers (`X-User-Id`).

## Consequences

- Horizontal scaling and rolling deployments of the backend service do not invalidate user sessions.
- Browser security avoids storing JWT access/refresh tokens in localStorage.
- Local development works seamlessly over HTTP while staging and production enforce secure HTTPS cookies.
