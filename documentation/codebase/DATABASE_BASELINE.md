# NarrativeX Database Baseline

## Authority

PostgreSQL is the authoritative business/control-state store. The backend owns Flyway and relational schema evolution. NarrativeX is still pre-production, so the repository maintains a clean baseline rather than compatibility migrations for disposable development data.

## Canonical Flyway set

| Migration | Responsibility |
|---|---|
| `V1__identity_and_access.sql` | identity, Desktop auth, sessions, local-device state |
| `V2__project_story_and_planning.sql` | Projects, Stories, Chapters, Scene/VisualBeat and MediaPlan foundations |
| `V3__generation_billing_and_media.sql` | durable jobs/provider operations, quota, MediaAsset storage identity and production media selection |
| `V4__narration_notifications_and_artifacts.sql` | narration/alignment, notifications/outbox, artifact metadata |
| `V5__catalog_generation_and_render_snapshots.sql` | catalogs, upload lifecycle, media generation/lineage and immutable **project** render snapshots |
| `V6__database_logic_and_triggers.sql` | established immutable-state guards, quota settlement, completion notifications and generation events |
| `V7__indexes.sql` | established query/access-path and partial/unique indexes |
| `V8__seed_catalog.sql` | deterministic plan/style/voice catalog seed data |
| `V9__chapter_continuity_and_analysis_checkpoints.sql` | chapter continuity plans/states/reports plus durable analysis subcall checkpoints |
| `V10__chapter_continuity_guards.sql` | continuity/checkpoint immutability and terminal-state guards |
| `V11__chapter_continuity_indexes.sql` | continuity/checkpoint access paths and idempotent checkpoint identity |
| `V12__continuity_regeneration_plans.sql` | immutable selective-regeneration plans, expiry/fingerprint scope and generation-job lineage |
| `V13__render_continuity_provenance.sql` | continuity plan/report provenance pinned into immutable project-render chapter snapshots |

A clean database applies **V1 → V13**. V9–V13 are cohesive continuity/render slices rather than temporary compatibility patches: they keep the already-large earlier baseline files from absorbing another cross-cutting subsystem while NarrativeX remains pre-production.

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

Each render chapter snapshot may pin the immutable `continuity_plan_id` and its latest `continuity_report_revision` for the same chapter/source hash at admission time. This provenance is audit metadata; render-cache identity is derived from effective encoded inputs rather than continuity/job/revision identity.

The former server-side Chapter-render admission tables `render_input_snapshots` and `render_input_snapshot_beats` are removed. There is no `execution_target` cloud/local discriminator; `assigned_local_device_id` is required and defines the executor.

## Media preview identity

`visual_beats.preview_media_asset_id` is the canonical generated/default preview identity and references `media_assets`. The former project-asset preview pointer is removed. This final state is represented directly in the current baseline; there is no preview-media compatibility patch migration.

## Job types

Current durable generation job types are:

```text
CHAPTER_ANALYZE
NARRATION_GENERATE
CHAPTER_GENERATE
RENDER_PROJECT
```

Stage names such as `SHOT_IMAGE_GENERATE`, `SHOT_IMAGE_REGENERATE` and `RENDER_PROJECT_LOCAL` are stage identities, not separate JobType values.

`analysis_visual_generation_mode` intentionally allows `IMAGE` and `VIDEO`; VIDEO is preserved for web/browser generation workflows and is independent of removed Python I2V runtime code.

## Pre-release migration policy

Until first production deployment:

- keep each table/constraint in a clear owning migration or cohesive baseline slice;
- prefer a new sequential migration (`V9`, `V10`, `V11`, ...) when a subsystem addition would make an existing large migration materially harder to maintain or review;
- do not create fractional migration names such as `V6_1` for new subsystem work;
- do not add temporary compatibility migrations whose only purpose is to bridge disposable development schemas;
- remove columns/tables/indexes whose runtime producer/executor has been removed;
- recreate disposable local/test databases after baseline changes;
- keep sample/application data out of Flyway.

V9–V13 are the canonical continuity/render baseline slices and are not transitional migrations. At first production deployment, freeze the accepted baseline. After that, all schema changes are append-only.

## Verification

A supported empty PostgreSQL instance must:

1. apply V1 through V13 successfully;
2. expose no pending migration;
3. contain no removed server Chapter-render snapshot tables;
4. contain no remote final-video artifact fields;
5. contain `visual_beats.preview_media_asset_id` and its established index;
6. preserve IMAGE/VIDEO analysis preference constraints;
7. allow project render assignment only through a paired local device snapshot;
8. enforce continuity scope/immutability, analysis checkpoint identity/lease fencing and immutable regeneration-plan lineage;
9. preserve render continuity provenance without using logical continuity/job/revision IDs as effective segment-cache dependencies;
10. pass backend Testcontainers/Flyway/MyBatis tests and worker persistence tests.
