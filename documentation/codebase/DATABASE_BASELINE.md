# NarrativeX Database Baseline

## Authority

PostgreSQL is the authoritative business/control-state store. The backend owns Flyway and relational schema evolution. NarrativeX is still pre-production, so the repository maintains a clean baseline rather than compatibility migrations for disposable development data.

## Canonical Flyway set

| Migration | Responsibility |
|---|---|
| `V1__identity_and_access.sql` | identity, Desktop auth, sessions, local-device state |
| `V2__project_story_and_planning.sql` | Projects, Stories, Chapters, continuity, Scene/VisualBeat and MediaPlan foundations |
| `V3__generation_billing_and_media.sql` | durable jobs/provider operations, quota, MediaAsset storage identity and production media selection |
| `V4__narration_notifications_and_artifacts.sql` | narration/alignment, notifications/outbox, artifact metadata |
| `V5__catalog_generation_and_render_snapshots.sql` | catalogs, upload lifecycle, media generation/lineage and immutable **project** render snapshots |
| `V6__database_logic_and_triggers.sql` | immutable-state guards, quota settlement, completion notifications and generation events |
| `V7__indexes.sql` | query/access-path and partial/unique indexes |
| `V8__seed_catalog.sql` | deterministic plan/style/voice catalog seed data |

A clean database applies **V1 → V8** and has no patch-only V9 migration.

## Current storage decisions

```text
Generated project image/audio   -> PROJECT_LOCAL
Native Desktop-only media       -> LOCAL_ONLY
Account voice reference/custom voice -> REMOTE/HYBRID when R2-backed
Final project MP4               -> Desktop filesystem; backend metadata only
```

`final_artifacts` does not contain remote final-video provider IDs or web links. Final project video rows persist identity/checksum/size/duration/video metadata and an opaque local artifact key only.

## Current render schema

The supported final-render path is project render through an assigned local Desktop device.

Current render snapshot tables:

```text
project_render_input_snapshots
project_render_input_chapters
project_render_input_beats
```

The former server-side Chapter-render admission tables `render_input_snapshots` and `render_input_snapshot_beats` are removed. There is no `execution_target` cloud/local discriminator; `assigned_local_device_id` is required and defines the executor.

## Media preview identity

`visual_beats.preview_media_asset_id` is the canonical generated/default preview identity and references `media_assets`. The former project-asset preview pointer is removed. This final state is folded into the V1–V8 baseline; there is no preview-media patch migration.

## Job types

Current durable generation job types are:

```text
CHAPTER_ANALYZE
NARRATION_GENERATE
CHAPTER_GENERATE
RENDER_PROJECT
```

Stage names such as `SHOT_IMAGE_GENERATE` and `RENDER_PROJECT_LOCAL` are stage identities, not separate JobType values.

`analysis_visual_generation_mode` intentionally allows `IMAGE` and `VIDEO`; VIDEO is preserved for web/browser generation workflows and is independent of removed Python I2V runtime code.

## Pre-release migration policy

Until first production deployment:

- keep tables/constraints in their final owning migration;
- fold patch-only history back into V1–V8;
- remove columns/tables/indexes whose runtime producer/executor has been removed;
- recreate disposable local/test databases after baseline changes;
- keep sample/application data out of Flyway.

At first production deployment, freeze the accepted baseline. After that, all schema changes are append-only.

## Verification

A supported empty PostgreSQL instance must:

1. apply V1 through V8 successfully;
2. expose no pending migration;
3. contain no removed server Chapter-render snapshot tables;
4. contain no remote final-video artifact fields;
5. contain `visual_beats.preview_media_asset_id` and its V7 index;
6. preserve IMAGE/VIDEO analysis preference constraints;
7. allow project render assignment only through a paired local device snapshot;
8. pass backend Testcontainers/Flyway/MyBatis tests and worker persistence tests.
