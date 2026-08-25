# Flyway baseline freeze

The current clean baseline is now frozen at:

- `V1__create_tables.sql` — Git blob `b535f9f98d8c8950663af3c425840f73d57d1560`
- `V2__init_indexes.sql` — Git blob `1c5c480858a5643a8db60f13291b3c58dfa630b7`
- `V3__seed_data.sql` — Git blob `183160e21d911ea51eb8bd784e601ea2155ecc9c`

## Rule

Do not edit V1-V3 after this freeze point. Every schema, index, seed, cleanup, rename, or backfill change must be added as a new versioned migration (`V4__...`, `V5__...`, and so on).

This prevents Flyway checksum mismatches on databases that have already applied the baseline and avoids silently diverging persistent developer or production schemas from a clean install.

## Existing local databases

A database created from an older pre-freeze baseline can still report a checksum mismatch because those migration files were previously rewritten while the project was treated as disposable.

If the local database contains no data you need to keep, recreate it from the frozen baseline. `docker compose down -v` is destructive and removes Compose-managed volumes, so only use it after confirming the local data is disposable.

If the database contains data that must be preserved, do not repair Flyway checksums blindly. First compare the live schema with the frozen baseline and create an explicit forward migration for the difference.

## Enforcement

`FlywayBaselineFreezeTest` computes the Git blob hash of V1-V3 from the test classpath. Any accidental edit fails the backend test suite with an instruction to create a new V4+ migration instead.
