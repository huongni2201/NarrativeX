# Authentication and Ownership Workflow

## Purpose

Authenticate a user with Google OIDC, establish a server-managed session, and expose caller identity to business modules through an application port. Authentication remains a prerequisite for paid work; it is not a substitute for entitlement, rights, consent or moderation.

## Module boundary

```text
modules/auth
  api/controller
    CurrentUserController
    CsrfTokenController
  application
    port/in/CurrentUserId
    port/in/CurrentUserProfile
    query/*
    response/*
    usecase/*
  infrastructure
    configuration/SecurityConfig
    configuration/NonLocalSecurityConfigurationGuard
    security/SecurityContextCurrentUser
    security/ApiAuthenticationEntryPoint
    security/ApiAccessDeniedHandler

project / character / generation
  -> depend on auth.application.port.in.CurrentUserId only
```

This boundary is intentionally service-extraction friendly: business modules do not read `SecurityContextHolder`, OIDC principals or Spring Security configuration directly.

## Flow

```text
Browser
  -> GET /oauth2/authorization/google
  -> Google OIDC callback to Spring Security
  -> server session
  -> GET /api/auth/me
  -> CurrentUserController maps HTTP call to CurrentUserQuery
  -> GetCurrentUserUseCase
  -> CurrentUserProfile port
  -> SecurityContextCurrentUser adapter

Browser mutation
  -> GET /api/v1/auth/csrf
  -> CsrfTokenController maps CsrfToken to CsrfTokenQuery
  -> GetCsrfTokenUseCase
  -> ApiResponse<CsrfTokenResponse>
```

## State and security rules

1. Provider subject, not mutable display name/email alone, is the stable external identity key when identity persistence is implemented.
2. Provider tokens and secrets never enter frontend storage, logs or worker payloads.
3. Every project-scoped command/query resolves its owner/actor through the auth application port.
4. `local`/`test` may use the configured developer identity fallback; staging/production fail closed when OIDC is disabled.
5. Credentialed browser mutations include the session-bound CSRF header; CORS uses the configured explicit origin allowlist.
6. Logout invalidates the server session; durable work follows its own reconciliation policy.
7. Authorization failures use the shared error contract while Spring Security-specific handlers remain inside auth infrastructure.

## Current repository gap

The auth module now owns the Spring Security/OIDC/CSRF boundary and exposes application ports to other modules. Remaining work is durable User/ExternalIdentity persistence, workspace membership/roles, production session lifecycle and abuse/entitlement integration.
