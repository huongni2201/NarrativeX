# ADR-0004: Authentication and frontend runtime security

- Status: Accepted
- Date: 2026-08-18
- Scope: backend identity/session security and frontend API-versus-fixture runtime boundaries
- Consolidated from the former authentication and fixture-isolation decisions.

## Context

Credentialed browser requests require session and CSRF protection. NarrativeX supports both first-party email/password login and Google login, while business ownership must remain stable regardless of which login method a user chooses. The frontend also contains prototype screens whose local fixture state must never be mistaken for canonical business data in development, staging or production. A shared backend artifact must also never silently start under a developer identity when deployment configuration is incomplete.

## Decision

- NarrativeX owns a stable internal user identifier stored in PostgreSQL. Business tables use that internal identifier, not an email address or an external provider subject.
- Email/password authentication and Google OIDC both resolve to the same NarrativeX account and create a server-managed Spring Security session.
- Passwords are stored only as one-way hashes produced by Spring Security `PasswordEncoder`; raw passwords are never persisted.
- Google accounts are linked by verified email when no Google subject is linked yet. After linking, the Google subject is the external-provider identity key. A conflicting Google subject for the same email fails closed.
- Shared environments require Google OIDC to be enabled. OIDC may be disabled only when every active Spring profile is explicitly `local` or `test`.
- The shared `application.yml` must not declare `local` as the default profile. No active profile, unknown profiles, staging and production-like profiles fail startup when OIDC is disabled.
- `local` and `test` may opt into a configured developer identity fallback through `narrativex.security.local-dev-identity-enabled`; the fallback is disabled by default. All other environments fail closed instead of assigning `local-dev-user`.
- Application identity is resolved from Spring Security `SecurityContextHolder`. Client-controlled headers such as `X-User-Id` are not trusted browser identity sources.
- Credentialed mutations use the CSRF token from `GET /api/v1/auth/csrf`; CORS uses an explicit credentialed origin allowlist without wildcard production origins.
- Unauthenticated access is limited to health, CSRF bootstrap, password login/registration, and the OAuth2/OIDC authorization/callback endpoints.
- API is the default frontend runtime mode. `mock` is allowed only in tests or Storybook; unsupported API capabilities render an explicit disconnected/coming-soon state.
- TanStack Query owns persisted server state. Zustand owns navigation, filters, selection, modal/editor and transient UI state. Fixture-backed business data is isolated behind the test/Storybook boundary.

## Account linking invariant

- A password registration creates one internal NarrativeX user ID.
- Logging in with Google using the same verified email links Google to that existing user ID.
- A Google-first user receives an internal NarrativeX user ID and may later gain another supported credential without changing business ownership.
- External provider subjects and email addresses are never used directly as project ownership identifiers.

## Startup invariant

With `narrativex.security.oidc-enabled=false`:

- `local` -> allowed;
- `test` -> allowed;
- `local,test` -> allowed;
- no active profile -> startup failure;
- `prod`, `production`, `staging`, `qa`, `uat`, preview or any unknown profile -> startup failure.

With OIDC enabled, this developer-identity guard does not apply; normal OIDC/client-registration validation remains responsible for the shared environment.

## Consequences

- Users can sign in with email/password or Google without splitting their projects across separate identities.
- Shared environments cannot silently fall back to a common local identity.
- A missing `SPRING_PROFILES_ACTIVE` no longer makes production behave as local development.
- The central frontend transport owns credentials, CSRF bootstrap, envelope parsing and error handling.
- Character, storyboard, render, asset and other screens remain visibly incomplete until their backend contracts exist, rather than reporting fake success.

## Consolidation note

This file is the canonical replacement for the former OIDC/CSRF and runtime fixture-isolation records.
