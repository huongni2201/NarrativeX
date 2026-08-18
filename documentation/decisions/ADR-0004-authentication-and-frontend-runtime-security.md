# ADR-0004: Authentication and frontend runtime security

- Status: Accepted
- Date: 2026-08-18
- Scope: backend identity/session security and frontend API-versus-fixture runtime boundaries
- Consolidated from the former authentication and fixture-isolation decisions.

## Context

Credentialed browser requests require session and CSRF protection. The frontend also contains prototype screens whose local fixture state must never be mistaken for canonical business data in development, staging or production. A shared backend artifact must also never silently start under a developer identity when deployment configuration is incomplete.

## Decision

- Google OIDC with a server-managed session is the shared-environment identity source.
- OIDC may be disabled only when every active Spring profile is explicitly `local` or `test`.
- The shared `application.yml` must not declare `local` as the default profile. No active profile, unknown profiles, staging and production-like profiles fail startup when OIDC is disabled.
- `local` and `test` may use a configured developer identity fallback; all other environments fail closed instead of assigning `local-dev-user`.
- Application identity is resolved from Spring Security `SecurityContextHolder`. Client-controlled headers such as `X-User-Id` are not trusted browser identity sources.
- Credentialed mutations use a session-bound CSRF token from `GET /api/v1/auth/csrf`; CORS uses an explicit credentialed origin allowlist without wildcard production origins.
- API is the default frontend runtime mode. `mock` is allowed only in tests or Storybook; unsupported API capabilities render an explicit disconnected/coming-soon state.
- TanStack Query owns persisted server state. Zustand owns navigation, filters, selection, modal/editor and transient UI state. Fixture-backed business data is isolated behind the test/Storybook boundary.

## Startup invariant

With `narrativex.security.oidc-enabled=false`:

- `local` -> allowed;
- `test` -> allowed;
- `local,test` -> allowed;
- no active profile -> startup failure;
- `prod`, `production`, `staging`, `qa`, `uat`, preview or any unknown profile -> startup failure.

With OIDC enabled, this developer-identity guard does not apply; normal OIDC/client-registration validation remains responsible for the shared environment.

## Consequences

- Shared environments cannot silently fall back to a common local identity.
- A missing `SPRING_PROFILES_ACTIVE` no longer makes production behave as local development.
- The central frontend transport owns credentials, CSRF bootstrap, envelope parsing and error handling.
- Character, storyboard, render, asset and other screens remain visibly incomplete until their backend contracts exist, rather than reporting fake success.

## Consolidation note

This file is the canonical replacement for the former OIDC/CSRF and runtime fixture-isolation records.
