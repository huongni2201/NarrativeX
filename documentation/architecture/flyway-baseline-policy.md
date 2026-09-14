# Flyway baseline policy

NarrativeX is still pre-production. The current Flyway migrations are therefore treated as a **clean development baseline**, not as immutable upgrade history.

## Current baseline

A new PostgreSQL database is built by applying exactly these responsibility-separated migrations in order:

1. `V1__identity_and_access.sql` — users, Desktop OAuth handoffs, Spring Session, guest continuity and local-device identity.
2. `V2__project_story_and_planning.sql` — projects, stories, chapters, storyboard, reusable entities, scenes and final media-planning schema.
3. `V3__generation_quota_and_media.sql` — generation execution, provider-operation lifecycle, non-monetary capacity/export quota state, media assets/validation and account voice-reference assets.
4. `V4__narration_notifications_and_artifacts.sql` — narration/alignment, notifications/outbox and render/final-artifact metadata.
5. `V5__catalog_generation_and_render_snapshots.sql` — catalogs, upload lifecycle, media generation/lineage, continuity/checkpoints, regeneration plans, storyboard-generation snapshots and immutable render snapshots.
6. `V6__database_logic_and_triggers.sql` — database functions, immutability guards, non-monetary quota settlement and generation notification/event triggers.
7. `V7__indexes.sql` — query/access-path, claim, covering and partial/unique indexes.
8. `V8__seed_catalog.sql` — deterministic system/catalog seed data only.

The former V9–V18 patch sequence has been folded into the owning V1–V8 migrations and is not part of the current baseline. A clean database must not create retired billing/pricing, credit-accounting or storage-compatibility schema and then remove it later.

The VoiceStudio default profile is seeded with `supportsSpeakingRate=true` and WAV output;
narration requests persist a positive `speaking_rate` value.

## Pre-release rule

Until the first production deployment:

- baseline migrations may be reorganized or rewritten when that produces a clearer final schema;
- do not preserve obsolete patch migrations merely to protect disposable development data;
- when a baseline rewrite changes checksums, filenames or version history, recreate the local/test database instead of repairing old development history;
- keep each table in its final form in the domain migration that owns it whenever dependency ordering permits;
- use an `ALTER` inside the baseline only for genuine dependency ordering, never as a compatibility cleanup for schema introduced earlier in the same baseline;
- keep indexes in V7 and deterministic catalog/system seed data in V8;
- never put application/user test content into Flyway seed migrations.

For Compose-managed disposable databases, a volume reset is acceptable only when the developer has confirmed that local data does not need to be preserved.

## Production freeze point

Immediately before the first production deployment, capture the accepted V1–V8 baseline and make it immutable. From that deployment onward:

- never edit an applied migration;
- add schema/index/backfill/seed evolution as new append-only migrations starting at V9;
- add a checksum/freeze guard only after that production baseline exists;
- preserve forward upgrade compatibility for every supported deployed database.

This separates two concerns cleanly: **pre-release schema design optimizes for clarity; post-release migration history optimizes for safe upgrades**.
