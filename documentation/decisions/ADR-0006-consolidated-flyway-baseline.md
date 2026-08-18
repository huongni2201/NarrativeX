# ADR-0006: Consolidated Flyway PostgreSQL baseline

- Status: Accepted
- Date: 2026-08-18
- Scope: backend PostgreSQL schema bootstrap and migration ownership

## Context

The repository had six Flyway SQL files (`V1` through `V6`) for the same initial
schema foundation. No data or Flyway history had been created in a shared
environment, so the split did not provide a compatibility benefit yet and made
the bootstrap schema harder to inspect as one contract.

## Decision

- Consolidate the former V1–V6 contents into
  `app/backend-service/src/main/resources/db/migration/V1__initial_schema.sql`.
- Keep the original dependency order inside that file: baseline marker, core
  domain, control plane, character identity/assignments, appearance invariant,
  and project keyset index.
- Remove the former V2–V6 files from the Flyway location.
- Treat the consolidated V1 as immutable after the first shared or released
  deployment. All later schema changes must use a new forward migration.
- PostgreSQL remains the authoritative store; Redis does not replace any state
  represented by this baseline.

## Consequences

- A new empty database now has one migration version to apply and audit.
- The baseline is easier to review against the JPA mappings and implementation
  documentation.
- A future release must not repeat this consolidation. Once V1 is applied in a
  shared environment, compatibility requires additive/forward-only migrations.

## Verification

- Confirm the Flyway directory contains only `V1__initial_schema.sql`.
- Apply V1 to an empty supported PostgreSQL instance.
- Start the backend with Hibernate `ddl-auto=validate`.
- Re-run the migration/bootstrap and backend checks to prove idempotent startup.
