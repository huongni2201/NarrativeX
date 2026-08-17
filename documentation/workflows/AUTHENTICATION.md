# Authentication and Ownership Workflow

## Purpose

Authenticate a user with Google OIDC, establish a server-managed session, and make ownership/role and abuse checks available to every project-scoped operation. Authentication is a prerequisite for paid work; it is not a substitute for entitlement, rights, consent or moderation.

## Flow

```text
Browser
  -> GET /oauth2/authorization/google
  -> Google OIDC callback to Spring Security
  -> upsert User + ExternalIdentity in PostgreSQL
  -> create Secure/HttpOnly/SameSite server session
  -> redirect to app
  -> GET /api/auth/me
  -> project ownership/role + account/IP abuse checks on every scoped command
```

## State and security rules

1. Google identity claims are mapped to a local user and `external_identities` row. Provider subject, not a mutable display name/email alone, is the stable identity key.
2. The session cookie is server-managed, Secure/HttpOnly/SameSite and environment-scoped. Provider tokens and secrets never enter local storage, frontend bundles, logs or worker payloads.
3. Every project-scoped endpoint loads the current user and checks owner/role. A guessed project ID must not reveal metadata, signed URLs, job status, notifications or cost history.
4. Account/session/IP/route/resource-class abuse limiting runs before entitlement/quota and before creating a paid `OperationPlan`. Provider limiters/circuit breakers remain a separate outbound layer.
5. Logout invalidates the server session. Reconnect to SSE re-authenticates and only reads authorized events.
6. Authentication events, authorization failures, admin overrides and support actions are auditable without logging OIDC tokens or sensitive identity data.
7. `local` is the only profile allowed to use the developer identity fallback. `staging` and production profiles fail during startup unless OIDC is enabled.
8. Credentialed browser mutations include the session-bound CSRF header obtained from `GET /api/v1/auth/csrf`; CORS uses an explicit configured origin allowlist.

## Error and retry behavior

- OIDC denial or invalid callback: no local session; return an actionable login error without creating a project/job.
- Unknown/disabled user: deny project access and signed URLs; do not retry provider work.
- Abuse throttle: return a structured retry-after response; do not turn it into a generic provider error or let the frontend spam retries.
- Session expiry during an operation: existing durable work may finish according to policy, but new user commands require re-authentication and ownership checks.

## Current repository gap

The remaining work is the full Google identity-to-PostgreSQL actor mapping, workspace membership and production session lifecycle. The profile guard, credentialed CORS and CSRF transport are now in place.
