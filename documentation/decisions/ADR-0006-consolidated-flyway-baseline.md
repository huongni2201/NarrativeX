# ADR-0006: Consolidated Flyway PostgreSQL baseline

- Status: Accepted
- Date: 2026-08-18
- Scope: backend PostgreSQL schema bootstrap and migration ownership

## Context

The repository consolidated its unreleased initial schema into
`V1__initial_schema.sql`. Once forward migrations exist, V1 is immutable and the
normal runtime must never silently mark an arbitrary non-empty database as
compatible with that baseline.

Using `baseline-on-migrate=true` globally is unsafe because Flyway can create a
baseline marker for a non-empty schema whose actual tables, constraints, or
column types do not match V1. H2/create-drop tests also cannot prove PostgreSQL
features such as JSONB, partial indexes, or PostgreSQL constraint behavior.

## Decision

- Keep `app/backend-service/src/main/resources/db/migration/V1__initial_schema.sql`
  immutable after its initial shared/released use.
- All subsequent schema changes use forward-only migrations. The current sequence is
  `V1__initial_schema.sql`, `V2__scene_status.sql`, `V3__auth_accounts.sql`, then
  `V4__story_version_active_invariant.sql`.
- Set `spring.flyway.baseline-on-migrate=false` in the normal application
  configuration. An unknown non-empty schema must fail migration instead of
  being silently accepted.
- Allow baselining only through the explicit `legacy-migration` Spring profile,
  and only as part of an operator-reviewed migration of a known compatible
  legacy schema.
- Do not hard-code a Hibernate dialect in normal configuration; Hibernate
  derives it from the configured datasource.
- Keep fast H2 tests where useful, but add PostgreSQL Testcontainers coverage for
  the authoritative migration path: empty database -> Flyway migrations ->
  Spring/Hibernate `ddl-auto=validate`.
- PostgreSQL remains the authoritative store; Redis does not replace any state
  represented by these migrations.

## StoryVersion invariant rollout

`V4__story_version_active_invariant.sql` adds a PostgreSQL partial unique index
that permits at most one `ACTIVE` story version per project. The migration first
checks for historical duplicates and fails loudly if any exist. It deliberately
does not choose a winning version or silently mutate business history; operators
must reconcile duplicate ACTIVE rows before retrying V4.

## Consequences

- Fresh databases have a deterministic, fail-fast migration path.
- Accidental connection to an incompatible non-empty schema fails instead of
  being silently baselined.
- PostgreSQL-only behavior is exercised in automated integration tests rather
  than inferred from H2 compatibility mode.
- Legacy baselining becomes an explicit operational exception instead of a
  normal startup behavior.

## Verification

- Apply all migrations to an empty supported PostgreSQL instance.
- Start the backend with Hibernate `ddl-auto=validate`.
- Verify JSONB columns and foreign keys on PostgreSQL.
- Verify `uq_story_versions_one_active_per_project` rejects a second ACTIVE story
  version for the same project.
- Verify a non-empty unknown schema fails normal Flyway startup unless the
  controlled `legacy-migration` profile is explicitly selected.
