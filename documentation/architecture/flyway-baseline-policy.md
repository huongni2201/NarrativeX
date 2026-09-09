# Flyway baseline policy

NarrativeX is still pre-production. The current Flyway migrations are therefore treated as a **clean development baseline**, not as immutable upgrade history.

## Current baseline

A new PostgreSQL database is built by applying these responsibility-separated migrations in order:

1. `V1__identity_and_access.sql` — users, Desktop OAuth handoffs, Spring Session, guest continuity and local-device identity.
2. `V2__project_story_and_planning.sql` — projects, stories, chapters, storyboard, reusable entities, scenes and media planning.
3. `V3__generation_billing_and_media.sql` — generation execution, provider operations, plans/quota and media assets/validation.
4. `V4__narration_notifications_and_artifacts.sql` — narration/alignment, notifications/outbox and render/final-artifact metadata.
5. `V5__catalog_generation_and_render_snapshots.sql` — catalog tables, upload lifecycle, media generation/lineage and immutable render snapshots, including subtitle snapshots.
6. `V6__database_logic_and_triggers.sql` — database functions, immutability guards, quota settlement and generation notification/event triggers.
7. `V7__indexes.sql` — query/access-path, claim, covering and partial-unique indexes.
8. `V8__seed_catalog.sql` — deterministic system/catalog seed data only.
9. `V9__chapter_continuity_and_analysis_checkpoints.sql` — continuity plans and durable analysis checkpoints.
10. `V10__chapter_continuity_guards.sql` — continuity and checkpoint invariants.
11. `V11__chapter_continuity_indexes.sql` — continuity access paths and idempotent checkpoint identity.
12. `V12__continuity_regeneration_plans.sql` — selective regeneration plans and job lineage.
13. `V13__render_continuity_provenance.sql` — immutable render continuity provenance.
14. `V14__storyboard_generation_snapshots.sql` — immutable storyboard generation batches and attempt evidence.
15. `V15__export_quota_reservations.sql` — durable long-form export reservations and exactly-once settlement.
16. `V16__render_profile_watermark_policy.sql` — compatible immutable watermark policy for render-profile v3.

VieNeu voices are seeded with `supportsSpeakingRate=true`; narration requests persist a positive `speaking_rate` value.

## Pre-release rule

Until the first production deployment:

- baseline migrations may be reorganized or rewritten when that produces a clearer final schema;
- do not preserve obsolete patch migrations merely to protect disposable development data;
- when a baseline rewrite changes checksums or version history, recreate the local/test database instead of repairing old development history;
- keep each table in its final form in the domain migration that owns it;
- keep indexes in V7 and deterministic catalog/system seed data in V8;
- never put application/user test content into Flyway seed migrations.

For Compose-managed disposable databases, a volume reset is acceptable only when the developer has confirmed that local data does not need to be preserved.

## Production freeze point

Immediately before the first production deployment, capture the accepted baseline and make it immutable. From that deployment onward:

- never edit an applied migration;
- add schema/index/backfill/seed evolution as new append-only migrations starting at the next version;
- add a checksum/freeze guard only after that production baseline exists;
- preserve forward upgrade compatibility for every supported deployed database.

This separates two concerns cleanly: **pre-release schema design optimizes for clarity; post-release migration history optimizes for safe upgrades**.
