# ADR-0016: UUID policy for public and operational identifiers

## Status

Accepted

## Context

The PostgreSQL baseline already uses UUID columns and UUIDv7 defaults for the
public/domain aggregates used by the Desktop and API contracts. Some
operational tables still use numeric identities, including final artifacts,
notifications, style presets, language detections, and related internal rows.
The Phase 3 contract audit found no invariant that requires every table to use
UUIDs, and a universal conversion would require a separate compatibility and
backfill release.

## Decision

NarrativeX uses UUIDv7 for external, public, and domain-aggregate identities
only. Internal operational identities may remain numeric when they are not
serialized as public resource IDs or used as cross-device business identity.

- Public/domain IDs are stored as PostgreSQL `uuid` and serialized as canonical
  UUID strings in API and Desktop contracts.
- IDs that must remain stable across devices are persisted PostgreSQL IDs for
  the owning aggregate; local filesystem paths and registry records are not
  substitutes for those IDs.
- Correlation IDs and durable idempotency identities remain explicit contract
  values. An idempotency key is not silently converted into a database row ID.
- UUIDv7 is the default generator for new public/domain IDs. Timestamp ordering
  is an index locality optimization, not the API's ordering contract; cursor
  queries continue to use their explicit timestamp/ID ordering.
- No universal UUID migration is added in the bug-fix phase. Numeric internal
  IDs are converted only through a future, separately versioned migration with
  API/backward-compatibility and backfill planning.

## Consequences

Positive:

- Desktop/backend contracts have one stable public identity policy.
- Existing operational numeric keys avoid an unnecessary breaking migration.
- PostgreSQL UUID indexes and explicit cursor ordering remain predictable.

Negative:

- The schema contains both UUID and numeric identities, so mapper/DTO reviews
  must keep the public/internal boundary explicit.
- A future universal-UUID requirement would still need a dedicated migration,
  backfill, and compatibility window.

## Implementation notes

- Keep UUID type/cast and generated-key behavior covered by PostgreSQL contract
  tests.
- Do not add a UUID migration solely to make the schema visually uniform.
- When a numeric identifier becomes public, write a new ADR or superseding
  decision before changing its API boundary.
