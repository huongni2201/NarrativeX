# ADR-0030: Single-User Local-First Architecture

## Status

Accepted (Supersedes ADR-0004, ADR-0011, and the user-quota portions of ADR-0025)

## Context

NarrativeX was originally designed with a multi-user, Google OAuth-authenticated backend paired with a desktop Electron client and guest fallback sessions. This introduced unnecessary complexity across all architectural layers:
- User, Account, Session, and Tenant identity tokens (`userId`, `accountId`, `ownerId`, `tenantId`, `NX_SESSION`, CSRF) threaded through domain models, use cases, repositories, database schemas, and IPC channels.
- Redundant authorization checks for an application whose target deployment topology is a single desktop installation operating on local-first data.
- Complex desktop startup rituals: OAuth deep-link listeners, PKCE code verifiers, guest session handoffs, per-user desktop preferences, and user-swapping teardown logic.
- Plan entitlements, usage windows, and credit/quota reservation accounting in a pre-production local application.

## Decision

Re-architect NarrativeX as a strictly **single-user local-first** application:

1. **Top-level Boundary**: `Project` is the highest domain and business boundary. One application instance represents exactly one local user.
2. **Identity Removal**: Completely eliminate `User`, `Account`, `Authentication`, `Authorization`, `Session`, `JWT`, `Tenant`, `ownerId`, `userId`, and `accountId` from domain models, application use cases, controllers, and persistence layers.
3. **No Fake Identity**: Do not leave mock or synthetic users (e.g., `defaultUser`, `guestUser`, `localUser`, or `systemUser`). If an entity belongs to the single installation, it does not carry an owner attribute.
4. **Provider Secrets**: External provider credentials (e.g., OpenAI API key, ComfyUI/RunPod endpoint, VoiceStudio API key) remain as `ProviderCredential`, `RuntimeConfiguration`, or `ApplicationSecret`, cleanly separated from application authentication.
5. **Runtime Limits over User Quotas**: Replace database-backed user plan assignments, usage windows, and quota reservations with system-level configuration (`narrativex.limits` / runtime limits) for GPU concurrency and export capacity.
6. **Desktop Streamlining**: Remove `AuthGuard`, login modals, OAuth handoffs, and per-user profile storage in Electron. The desktop application loads application settings and boots immediately into the project workspace.

## Consequences

- The codebase is significantly simplified across Domain, Application, Infrastructure, Desktop Main, Desktop Renderer, and Database layers.
- Cross-cutting security dependencies (`spring-boot-starter-security`, `spring-boot-starter-oauth2-client`, `spring-boot-starter-session-jdbc`) are removed from the backend service.
- The Flyway baseline is squashed and cleaned: schema migrations reflect a pure single-user structure without residual drop/cleanup migrations.
- Future multi-user or cloud collaboration (if ever required) would be introduced as an explicit project-sharing or sync extension, not through pervasive user-scoping in the core domain.

## References

- `documentation/architecture/DATABASE.md`
- `documentation/architecture/SYSTEM_ARCHITECTURE.md`
- `AGENTS.md`
