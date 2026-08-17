# NarrativeX Week 1 Security Audit

Status: OPEN  
Audit date: 2026-08-17  
Scope: repository configuration and reachable application paths; no external penetration test

## Executive result

The most urgent security issue is the default local security mode. OIDC is disabled by default, API routes are permitted to everyone in that mode, and the effective user ID can be supplied through `X-User-Id`. This is acceptable only as a tightly isolated developer shortcut; it must not be reachable from a shared or production environment. It is tracked as `NX-W1-D1-002` and blocks the next phase.

No confirmed provider key, bearer token, private key, or populated secret value was found during the repository scan. The root `.env` is tracked but empty; this is still a repository hygiene concern because tracked environment files are easy to populate accidentally.

## Configuration inventory (names only)

Observed configuration keys include:

- `NARRATIVEX_DB_URL`, `NARRATIVEX_DB_USERNAME`, `NARRATIVEX_DB_PASSWORD`
- `NARRATIVEX_REDIS_URL`
- `NARRATIVEX_MINIO_ENDPOINT`, `NARRATIVEX_MINIO_ACCESS_KEY`, `NARRATIVEX_MINIO_SECRET_KEY`, `NARRATIVEX_MINIO_BUCKET`
- `NARRATIVEX_OIDC_ENABLED`, `NARRATIVEX_OIDC_ISSUER_URI`, `NARRATIVEX_OIDC_CLIENT_ID`, `NARRATIVEX_OIDC_CLIENT_SECRET`, `NARRATIVEX_OIDC_SCOPES`
- `NARRATIVEX_LOCAL_USER_ID`
- Compose defaults for PostgreSQL and MinIO credentials

No values are reproduced here.

## Findings

### NX-W1-D1-002 — P0 — fail-open identity and authorization

`SecurityConfig` disables CSRF and, in the local chain, permits `/api/v1/**` and all other requests. `CurrentUserId` trusts `X-User-Id` whenever OIDC is disabled. `NARRATIVEX_OIDC_ENABLED` defaults to `false`. The server must fail closed outside an explicit local profile and must derive identity from a verified principal.

Closure evidence is defined in `WEEK_1_TECHNICAL_DEBT.md`: anonymous/invalid-token/forged-header tests, ownership tests, and production-profile startup checks.

### NX-W1-D1-007 — P1 — local dependency defaults and host exposure

Compose publishes database, cache, and object-storage ports and supplies local defaults. The README describes local use, but the configuration does not itself prevent exposure on a non-local network. Production-like deployments need injected credentials, restricted bindings, and explicit secret management.

## Control review

| Control | Result | Evidence |
|---|---|---|
| OIDC integration present | PARTIAL | Spring Security OIDC dependencies/config exist, but disabled by default. |
| Server-side identity authority | FAIL in local mode | `X-User-Id` is accepted when OIDC is disabled. |
| API authorization | FAIL in local mode | `/api/v1/**` is `permitAll`. |
| CSRF posture | REVIEW | Disabled for both chains; verify API-only assumptions and browser session behavior before enabling shared auth. |
| CORS policy | UNKNOWN | No explicit CORS policy was found in the audited backend configuration. |
| Actuator exposure | REVIEW | Health/info/metrics are included; verify network exposure and authorization in deployed profiles. |
| Tenant isolation | FAIL in local mode | Owner filters exist in services, but the caller identity is forgeable in default local mode. |
| Secret scan | PASS with hygiene note | No confirmed populated secret; tracked empty `.env` should remain empty/untracked. |
| Provider safety | PARTIAL | Disabled provider fails closed; no real provider call was made, and durable reservation/reconciliation is not implemented. |

## Required follow-up

Close `NX-W1-D1-002` before shared-environment testing. Close `NX-W1-D1-007` before any non-local deployment. Add automated checks so the security defaults cannot silently regress.
