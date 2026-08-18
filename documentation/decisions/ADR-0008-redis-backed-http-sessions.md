# ADR-0008: Redis-backed HTTP sessions

- Status: Accepted
- Date: 2026-08-18
- Scope: server-managed authentication session storage
- Refines: ADR-0004

## Context

ADR-0004 established the NarrativeX browser authentication contract as Spring Security server-managed sessions plus CSRF for both email/password and Google OIDC. The backend already uses Redis for shared infrastructure, but authenticated `HttpSession` state was still backed by the servlet container and therefore tied to one backend process.

That process-local session store becomes incorrect once more than one backend instance is deployed or an instance is restarted. NarrativeX does not currently need JWT access/refresh tokens; the missing capability is durable shared session state for the existing browser contract.

Spring Session can transparently replace the servlet container `HttpSession` with a Redis-backed implementation while keeping the existing Spring Security `SecurityContext`, local login, Google OIDC, CSRF and frontend `credentials: include` contract unchanged.

## Decision

- Add Spring Boot's `spring-boot-starter-session-data-redis` and use Spring Session's Redis-backed `HttpSession` implementation.
- Keep `spring-boot-starter-data-redis` because Redis is also used by non-session infrastructure such as authentication abuse limiting.
- Store session keys under the configurable namespace `narrativex:session` by default.
- Use a seven-day default session timeout, configurable through `NARRATIVEX_SESSION_TIMEOUT`.
- Expose only an opaque session identifier to the browser through the `NX_SESSION` cookie. Authentication data remains server-side.
- The shared/default cookie policy is `HttpOnly`, `Secure` and `SameSite=Lax`. The explicit `local` profile overrides only `Secure=false` so HTTP localhost development remains usable. Tests use the same non-Secure override.
- Local password and Google OIDC principals must be Java-serializable because the default Redis session repository serializes session attributes. Password credentials are erased and the password-hash field is transient so password hashes are not persisted in session state.
- Logout remains `POST /logout`, invalidates the server session, clears authentication, deletes `NX_SESSION` and `XSRF-TOKEN`, and returns `204 No Content`. CSRF protection still applies to logout.
- Ordinary unit/application tests exclude Redis session auto-configuration so the existing test suite does not silently acquire an external Redis dependency. Session-principal serialization is covered directly; deployed integration validation uses the Docker Compose Redis service or environment Redis.
- JWT access tokens, refresh tokens, JWKS and refresh-token persistence remain out of scope. Any future migration still requires a separate accepted ADR as specified by ADR-0004.

## Availability and security consequences

- Multiple backend instances can resolve the same authenticated browser session through Redis without sticky sessions.
- Backend restarts no longer invalidate all active sessions as long as Redis session data remains available and has not expired.
- Redis becomes an availability dependency for authenticated session reads and writes. This differs from the auth rate limiter in ADR-0004, which intentionally fails open on Redis data-access errors. A Redis outage may therefore prevent authenticated requests or new logins even though rate limiting itself is fail-open.
- Production Redis must be private to the application network, access-controlled, monitored, backed up according to the deployment recovery objective, and must not expose its port publicly.
- The browser never receives a NarrativeX bearer access token or refresh token under this architecture.

## Operational notes

- Local Docker Compose already starts Redis and the backend depends on its health check.
- The default session namespace can be changed with `NARRATIVEX_SESSION_REDIS_NAMESPACE` if multiple NarrativeX environments share a Redis deployment.
- Shared HTTPS environments use the default `Secure=true` cookie setting. They must not activate the `local` profile.
- Rotating or clearing the Redis session namespace intentionally signs users out without touching PostgreSQL user identities.
