# W1-D5 — Authentication, Authorization and Ownership

## Objective

Replace permissive scaffolding with Google OIDC, a backend-managed HttpOnly session and reusable server-side workspace/project authorization. Authentication answers who the actor is; authorization and resource ownership are checked for every operation.

## Required boundary

```text
HTTP request
  -> account/session/IP abuse gate
  -> authenticated actor
  -> active workspace membership
  -> server-side entitlement (when applicable)
  -> resource ownership/role
  -> business use case
```

Week 1 implements authentication and ownership foundations. Full quota/cost enforcement is later, but no expensive endpoint may bypass the future gate contract.

## Security contract

- Authentication: Spring Security Google OIDC; no Keycloak in v1.7.
- Session: server-managed, HttpOnly, Secure outside HTTP localhost, explicit SameSite policy and rotation/fixation protection.
- Browser storage: no provider token, session token or provider credential in local/session storage.
- Authorization: backend workspace membership plus resource scope; hiding a button is not authorization.
- Production failure posture: missing OIDC/session configuration fails closed. Local identity fallback is allowed only under an explicit local profile and is visibly non-production.

## API contract

| Method | Path | Behavior |
|---|---|---|
| `GET` | `/oauth2/authorization/google` | Start Google login through Spring Security |
| `GET` | `/api/auth/me` | Return authenticated user and active workspace/session metadata |
| `POST` | `/api/auth/logout` | Invalidate server session and clear cookie |
| any | `/api/v1/projects/**` | Require actor plus ownership/membership policy |

Use stable `401` for no valid session. For a resource owned by another tenant, select and document a consistent `404` concealment or `403` policy; never leak the resource body or existence through timing/error detail.

## Backend tasks

### 1. Map OIDC identity to PostgreSQL

**Files:**

- Create: `modules/identity` or `modules/auth` API/application/domain/infrastructure packages
- Create: user/external-identity repositories and mappings following the accepted migration
- Modify: Spring Security success/user service configuration
- Create: unit and integration tests

- [ ] Validate issuer, audience/client, subject and required claims through Spring Security.
- [ ] Upsert identity by unique `(provider, subject)` inside a transaction.
- [ ] Store only needed identity/profile claims; do not persist Google access/refresh tokens unless a separately approved feature requires them.
- [ ] Provision or select a workspace membership using a deterministic, idempotent policy.
- [ ] Return an application actor ID independent of mutable email/display name.
- [ ] Test first login, repeat login, changed display/email claims and duplicate callback race.

### 2. Harden the session and CSRF model

**Files:**

- Modify: `configuration/SecurityConfig.java`
- Create: profile-specific security properties and validation
- Create/modify: Spring Security integration tests

- [ ] Use `SessionCreationPolicy.IF_REQUIRED` for OIDC browser sessions and protect against session fixation.
- [ ] Configure HttpOnly, path, max age/idle timeout, SameSite and Secure by environment.
- [ ] Do not globally disable CSRF for cookie-authenticated state-changing endpoints. Use a documented browser-compatible CSRF strategy.
- [ ] Restrict CORS to configured origins with credentials.
- [ ] Permit only health/liveness and the required OAuth endpoints anonymously; protect other API routes.
- [ ] Invalidate session and cookie on logout; define behavior for expired/invalid sessions.
- [ ] Test CSRF rejection, accepted request, cookie flags, logout and session expiration.

### 3. Introduce an authenticated actor boundary

**Files:**

- Replace or harden: `shared/security/CurrentUserId.java`
- Create: authenticated actor/session projection
- Modify: application-service commands that currently accept or infer the local user
- Create: denial-path tests

- [ ] Resolve actor identity from `SecurityContext`, never from a client-provided owner/user ID.
- [ ] Keep the local principal behind the `local` profile and reject it in staging/prod.
- [ ] Carry actor/workspace through application commands without giving controllers direct repository authorization logic.
- [ ] Add correlation ID to security denials without logging session cookies or sensitive claims.
- [ ] Test forged owner ID/input cannot change authorization outcome.

### 4. Enforce workspace/project resource ownership

**Files:**

- Modify: project/story application services and repository queries
- Create: authorization policy/service local to the owning module or a narrow shared security port
- Create: MockMvc and PostgreSQL integration tests

- [ ] Query project-scoped resources by both resource ID and authorized workspace/actor scope.
- [ ] Apply membership role/status before read, update, archive, story creation and analysis enqueue.
- [ ] Ensure nested resource IDs cannot escape the parent project scope.
- [ ] Reject suspended membership and archived/deleted ownership as defined by business rules.
- [ ] Do not trust frontend workspace headers without validating membership server-side.
- [ ] Test cross-tenant read, write, nested-resource and job-enqueue denial.

### 5. Frontend session integration

**Files:**

- Modify: `app/frontend-web/src/features/auth/**`
- Modify: `app/frontend-web/src/lib/api.ts`
- Modify: protected app routes/layout as needed
- Create/modify: frontend tests or documented manual smoke cases

- [ ] Login uses backend OIDC redirect; no Google token handling in browser code.
- [ ] `/api/auth/me` is the source of authenticated session/user state.
- [ ] All API requests use `credentials: include`; state-changing requests carry the accepted CSRF token mechanism.
- [ ] `401` sends the user to login while preserving a safe internal return path; `403/404` renders a non-leaking access state.
- [ ] Logout calls backend, clears client cache/state and redirects to auth.
- [ ] Prevent open redirects by accepting only validated internal return paths.

## Authorization test matrix

| Scenario | Expected |
|---|---|
| Anonymous -> `/api/auth/me` | `401` |
| Anonymous -> project API | `401` |
| Member -> own workspace project | permitted by role |
| Member -> other workspace project | documented `403` or concealed `404` |
| Suspended member -> project | denied |
| Forged `ownerId`/workspace header | ignored and denied |
| User A -> User B story/job under guessed ID | denied with no data leak |
| Missing CSRF on cookie-authenticated mutation | `403` |
| Local fallback under staging/prod | startup failure or authentication denial |
| Logout -> reuse old session | `401` |

## Logging and privacy

- Log stable internal actor/workspace IDs and correlation IDs only where needed.
- Never log OIDC authorization codes, ID/access tokens, cookies, raw claims, secrets or real-person identity templates.
- Authentication failures use stable error codes and safe user messages.
- Security events needed for abuse/audit are durable, minimal and retention-bound.

## Acceptance criteria

- [ ] OIDC first/repeat login maps to durable PostgreSQL user and external identity records.
- [ ] Browser receives a backend-managed HttpOnly session with environment-appropriate flags.
- [ ] CSRF and CORS are tested for the credentialed browser model.
- [ ] All existing project/story/job endpoints authenticate and enforce workspace/resource scope.
- [ ] Cross-tenant tests cover read, write and nested-resource access.
- [ ] Non-local profiles cannot start or silently fall back to permissive/local authentication.
- [ ] Frontend stores no Google/provider/session token in browser storage.
- [ ] Backend, frontend and full Week 1 verification gates pass.

