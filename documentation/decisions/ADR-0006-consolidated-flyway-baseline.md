# ADR-0006: Two-file Flyway PostgreSQL baseline

- Status: Accepted
- Date: 2026-08-19
- Scope: backend PostgreSQL schema bootstrap and migration ownership

## Context

The repository is still using a development database baseline. The schema had
grown into one consolidated schema file, one deterministic seed file, and three
small follow-up migrations. That split made the fresh-database path harder to
inspect and caused the implementation-facing migration documentation to drift.

PostgreSQL remains the authoritative business-state store and the backend
remains the only Flyway/schema owner. Flyway must still fail on an unknown
non-empty database; `baseline-on-migrate` must not be used to silently accept an
incompatible schema.

## Decision

- Keep exactly two migrations under
  `app/backend-service/src/main/resources/db/migration/`:
  `V1__initial_schema.sql` and `V2__seed_demo_data.sql`.
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
  canonical execution check constraints, and all baseline indexes.
- `V2__seed_demo_data.sql` contains deterministic local/demo data for every table
  in V1, including required columns for continuity, media plans, quota
  reservations, narration, uploaded audio, favorites, and final artifacts.
- Keep `spring.flyway.baseline-on-migrate=false`. No `ignore-migration-patterns`
  or checksum bypass is added to hide an old migration history.
- Existing databases created with any former migration split require an
  operator-reviewed recreation or explicit re-baselining. The application must
  not delete a PostgreSQL volume or rewrite `flyway_schema_history` at startup.

## Consequences

- A fresh supported PostgreSQL database has a concise, deterministic two-step
  path: schema V1, then seed V2.
- The final schema is easier to compare with JPA validation and implementation
  documentation.
- Existing development databases are not transparently compatible with the
  rewritten migration set. This is intentional: silently ignoring missing or
  changed migrations could accept a partially migrated schema and lose durable
  business-state guarantees.
- Future shared/released databases must use forward-only migrations. This
  two-file consolidation must not be repeated after the baseline is released.

## Verification

- Apply V1 and V2 to an empty PostgreSQL instance and verify Flyway latest
  version is 2.
- Start the backend with Hibernate `ddl-auto=validate`.
- Verify JSONB columns, foreign keys, enum checks, partial indexes, chapter
  source hashes, generation-job snapshot columns, and project overview fields.
- Verify no legacy StoryVersion rights columns or
  `content_rights_attestations` table exists.
- Verify the PostgreSQL migration integration test and `mvn clean verify` pass.
