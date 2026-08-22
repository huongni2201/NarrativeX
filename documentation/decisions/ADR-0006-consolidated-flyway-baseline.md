# ADR-0006: Production-safe Flyway PostgreSQL baseline with local seed

- Status: Accepted
- Date: 2026-08-19
- Scope: backend PostgreSQL schema bootstrap and migration ownership

## Context

The repository uses one consolidated schema baseline and a deterministic local
seed. The seed must not be reachable from a production bootstrap, while schema
hardening must remain a normal forward-only production migration.

PostgreSQL remains the authoritative business-state store and the backend
remains the only Flyway/schema owner. Flyway must still fail on an unknown
non-empty database; `baseline-on-migrate` must not be used to silently accept an
incompatible schema.

PostgreSQL remains the authoritative business-state store and the backend
remains the only Flyway/schema owner. Flyway must still fail on an unknown
non-empty database; `baseline-on-migrate` must not be used to silently accept an
incompatible schema.

## Decision

- Keep the production baseline under
  `app/backend-service/src/main/resources/db/migration/` with `V1__initial_schema.sql`.
  Development-only seed data lives under
  `app/backend-service/src/main/resources/db/local-migration/` with `V2__seed_demo_data.sql` and is enabled only
  by `application-local.yml`.
- `V1__initial_schema.sql` contains the final consolidated schema, including
  split motion fields (`motion_mode`, `camera_movement`), storyboard revisions (`storyboard_revisions`),
  scene & location continuity identities (`scene_characters`, `project_character_ai_identities`, `project_location_ai_identities`),
  project dashboard favorites (`project_favorites`), visual-beat character links
  (`visual_beat_characters`), immutable render inputs/outputs
  (`render_manifests`, `final_artifacts`),
  backend-authoritative media plans (`media_plans`, `media_scene_plans`, `media_beat_plans`),
  durable provider operations with billing reconciliation & result fingerprints,
  quota reservation lifecycle (`quota_reservations`), full-chapter TTS narration (`narration_requests`, `narration_assets`, `narration_alignments`),
  multi-part uploaded narration pipeline (`media_assets`, `narration_sets`, `narration_parts`, `narration_documents`, `narration_alignment_runs`),
  media upload sessions, media storage cleanup tasks (`media_storage_cleanup_tasks`), style/voice catalogs, media lifecycle hardening,
  generation-item review state, asset lineage, render ownership pins, owner-scoped generation idempotency,
  canonical execution check constraints, and all baseline indexes.
- `db/local-migration/V2__seed_demo_data.sql` contains deterministic local/demo
  data for supported development fixtures, including continuity, media plans,
  quota reservations, narration, uploaded audio, favorites, final artifacts,
  and catalog entries. It must never run as part of a production bootstrap.
- Keep `spring.flyway.baseline-on-migrate=false`. No `ignore-migration-patterns`
  or checksum bypass is added to hide an old migration history.
- Existing databases created with any former migration split require an
  operator-reviewed recreation or explicit re-baselining. The application must
  not delete a PostgreSQL volume or rewrite `flyway_schema_history` at startup.

## Consequences

- A fresh production PostgreSQL database starts with schema V1. A local profile additionally applies seed V2 from the local-only migration location.
- The final schema is easier to compare with JPA validation and implementation
  documentation.
- Existing development databases are not transparently compatible with the
  rewritten migration set. This is intentional: silently ignoring missing or
  changed migrations could accept a partially migrated schema and lose durable
  business-state guarantees.
- Future shared/released databases must use forward-only migrations. Local seed
  data must never be introduced into the production migration location.

## Verification

- Apply production V1 to an empty PostgreSQL instance and verify that no
  seeded account or demo business rows exist. Apply the `local` profile and
  verify that local V2 adds only the development fixture and its quota repair.
- Start the backend with Hibernate `ddl-auto=validate`.
- Verify JSONB columns, foreign keys, enum checks, partial indexes, chapter
  source hashes, generation-job snapshot columns, and project overview fields.
- Verify no legacy StoryVersion rights columns or
  `content_rights_attestations` table exists.
- Verify the PostgreSQL migration integration test and `mvn clean verify` pass.
