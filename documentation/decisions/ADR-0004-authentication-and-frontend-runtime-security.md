# ADR-0004: Authentication and frontend runtime security

- Status: Accepted
- Date: 2026-08-18
- Scope: backend identity/session security and frontend API-versus-fixture runtime boundaries
- Consolidated from the former authentication and fixture-isolation decisions.

## Context

Credentialed browser requests require session and CSRF protection. The frontend also contains prototype screens whose local fixture state must never be mistaken for canonical business data in development, staging or production.

## Decision

- Google OIDC with a server-managed session is the shared-environment identity source. `local` and `test` may use a configured developer identity fallback; staging/production fail closed when OIDC is disabled or missing.
- Application identity is resolved from Spring Security `SecurityContextHolder`. Client-controlled headers such as `X-User-Id` are not trusted browser identity sources.
- Credentialed mutations use a session-bound CSRF token from `GET /api/v1/auth/csrf`; CORS uses an explicit credentialed origin allowlist without wildcard production origins.
- API is the default frontend runtime mode. `mock` is allowed only in tests or Storybook; unsupported API capabilities render an explicit disconnected/coming-soon state.
- TanStack Query owns persisted server state. Zustand owns navigation, filters, selection, modal/editor and transient UI state. Fixture-backed business data is isolated behind the test/Storybook boundary.

## Consequences

- Shared environments cannot silently fall back to impersonatable local identity.
- The central frontend transport owns credentials, CSRF bootstrap, envelope parsing and error handling.
- Character, storyboard, render, asset and other screens remain visibly incomplete until their backend contracts exist, rather than reporting fake success.

## Consolidation note

This file is the canonical replacement for the former OIDC/CSRF and runtime fixture-isolation records.
