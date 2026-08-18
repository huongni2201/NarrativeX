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
  `V1__initial_schema.sql`, `V2__scene_status.sql`, `V3__auth_accounts.sql`,
  `V4__story_version_active_invariant.sql`, `V5__drop_redundant_auth_indexes.sql`,
  `V6__drop_legacy_story_rights_columns.sql`, then
  `V7__drop_legacy_content_rights_attestations.sql`.
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

## Auth index cleanup

`V3__auth_accounts.sql` declared `email` and `google_subject` as `UNIQUE`, which
already causes PostgreSQL to create backing unique indexes. The additional
`idx_auth_users_email` and `idx_auth_users_google_subject` indexes duplicated the
same leading columns and added unnecessary write/storage overhead.

Because V3 may already be applied, it remains immutable. V5 drops only those two
redundant non-unique indexes. The unique constraints and their PostgreSQL-owned
backing indexes remain intact, so lookup behavior and uniqueness guarantees do
not change.

## Legacy story rights cleanup

The initial schema carried five copyright/rights attestation columns on
`story_versions`: `rights_attested`, `rights_policy_version`, `rights_basis`,
`rights_attested_at`, and `rights_attested_by`. It also carried the legacy
`content_rights_attestations` table and its supporting index.

The active product/domain contract does **not** require a blanket per-story
copyright/rights attestation or checkbox before Analyze/Generate. Moderation,
report/review/takedown and real-person consent remain separate concerns and are
not modeled through StoryVersion rights fields.

Because V1 is immutable, cleanup is forward-only:

- V6 removes the five legacy `story_versions` rights columns.
- V7 removes the remaining `content_rights_attestations` table; dependent indexes
  disappear with the table.

The Java domain model, JPA mapping, API response, persistence mapper and tests are
aligned with the post-V7 schema. No active StoryVersion or product invariant may
reference these removed fields/table.

## Test-profile migration invariant

The PostgreSQL migration integration test must run with the explicit `test`
profile so the non-local OIDC startup guard is satisfied in CI. Because the
shared test profile normally configures H2, the Testcontainers test overrides the
datasource and Hibernate dialect back to PostgreSQL before validating Flyway and
`ddl-auto=validate`.

This keeps both invariants active: security still requires an explicit test
profile, while schema validation still exercises real PostgreSQL semantics.

## Consequences

- Fresh databases have a deterministic, fail-fast migration path through V7.
- Accidental connection to an incompatible non-empty schema fails instead of
  being silently baselined.
- PostgreSQL-only behavior is exercised in automated integration tests rather
  than inferred from H2 compatibility mode.
- Legacy baselining becomes an explicit operational exception instead of a
  normal startup behavior.
- Auth writes no longer maintain duplicate secondary indexes that provide no
  additional query or constraint value.
- StoryVersion persistence no longer carries obsolete copyright/rights columns.
- The legacy rights-attestation table is also removed; documentation and product
  rules must not describe it as an active or compatibility schema component.

## Verification

- Apply all migrations to an empty supported PostgreSQL instance and verify the
  latest successful Flyway version is 7.
- Start the backend with Hibernate `ddl-auto=validate`.
- Verify JSONB columns and foreign keys on PostgreSQL.
- Verify `uq_story_versions_one_active_per_project` rejects a second ACTIVE story
  version for the same project.
- Verify `idx_auth_users_email` and `idx_auth_users_google_subject` are absent
  after V5 while the `UNIQUE` constraints on both columns remain effective.
- Verify all five legacy StoryVersion rights columns are absent after V6.
- Verify `content_rights_attestations` is absent after V7.
- Verify a non-empty unknown schema fails normal Flyway startup unless the
  controlled `legacy-migration` profile is explicitly selected.
