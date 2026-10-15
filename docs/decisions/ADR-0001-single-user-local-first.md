# ADR-0001: Single-user, local-first installation with Project as the business boundary

- **Status:** Accepted
- **Date:** 2026-10-15 (consolidated)
- **Replaces:** former ADR-0020 and the earlier account, session and quota decisions (Git history)

## Context

NarrativeX began with a multi-user design: Google OAuth backend login, guest Desktop sessions, plan entitlements and per-user quota reservations. Identity tokens (`userId`, `accountId`, `ownerId`, `tenantId`, `NX_SESSION`, CSRF) ran through domain models, repositories, schemas and IPC channels. The target deployment is one Desktop installation working on local-first data, so that machinery added cost without protecting anything.

## Decision

1. One installation serves exactly one local user. `Project` is the highest domain and business boundary.
2. The domain, application, persistence and IPC layers have no `User`, `Account`, `Session`, `JWT`, `Tenant`, `ownerId`, `userId` or `accountId`. No synthetic identity (`defaultUser`, `localUser`, `systemUser`) replaces them. An entity that belongs to the installation has no owner attribute.
3. Provider credentials (agy session, worker machine credential, provider API keys) are runtime configuration and stay separate from application identity. A provider sign-in never creates a NarrativeX identity.
4. Load is limited by system capacity configuration (concurrent GPU work, long-form export) rather than per-user quotas, plans, credits or monetary accounting.
5. Desktop boots straight into the project workspace. It has no auth guard, login modal, OAuth hand-off or per-user profile storage.

## Invariants

1. A new feature never introduces per-user ownership, login or tenant scoping without a new ADR.
2. Capacity reservations are non-monetary (`CAPACITY`, `LONGFORM_EXPORT`).
3. The `account` wording in the Desktop analysis tab refers to a provider session (ADR-0009), not an application account.

## Consequences

- Security dependencies (`spring-boot-starter-security`, OAuth2 client, session-jdbc) are absent from the backend.
- The pre-production schema contains no auth or session tables (see ADR-0002 for the baseline policy).
- Multi-user collaboration, if it is ever needed, would arrive as an explicit sharing or sync extension rather than as user scoping inside the core domain.

## Related

- [ADR-0002](ADR-0002-system-topology-and-control-plane.md) · [ADR-0009](ADR-0009-chapter-analysis-agy-cli.md) · [Database](../architecture/database.md)
