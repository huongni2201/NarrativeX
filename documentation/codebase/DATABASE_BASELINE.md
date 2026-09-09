# NarrativeX Database Baseline

## Authority

PostgreSQL is the authoritative business/control-state store. The backend owns Flyway and relational schema evolution. NarrativeX is still pre-production, so disposable development schemas are not compatibility targets: the Flyway set describes only the current contract.

## Canonical Flyway set

| Migration | Responsibility |
|---|---|
| `V1__identity_and_access.sql` | identity, Desktop auth, sessions, local-device state |
| `V2__project_story_and_planning.sql` | Projects, Stories, Chapters, Scene/VisualBeat and MediaPlan foundations, including the current structured VisualBeat direction contract |
| `V3__generation_billing_and_media.sql` | durable jobs/provider operations, quota, MediaAsset storage identity, canonical VisualBeat preview identity and production media selection |
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
| `V14__storyboard_generation_snapshots.sql` | immutable Storyboard/Gemini generation batches, beat snapshots, references and attempt evidence |
| `V15__export_quota_reservations.sql` | durable long-form export reservations and exactly-once monthly settlement |
| `V16__render_profile_watermark_policy.sql` | render-profile v3 watermark policy while retaining explicit v2 legacy snapshots |
| `V17__remove_image_billing_metadata.sql` | removes image-generation cost/pricing metadata from media/regeneration plans while preserving generic billable-operation accounting |

A clean database applies **V1 → V17**. Compatibility-only migrations are not retained before first production deployment. The current baseline therefore never exposes image-generation monetary metadata through active MediaPlan/regeneration contracts, and it never creates the retired standalone VisualBeat camera/audio columns, the old `preview_asset_id`, or the unowned `short_clip_requests` queue.

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

## Storyboard direction schema

`visual_beats.visual_direction_json` is the single persisted camera/composition representation. Worker materialization, backend prompt compilation, media planning and Desktop Storyboard UI consume that structured payload directly. The baseline never creates `visual_beats.camera_angle` or `visual_beats.camera_movement`.

The production timeline may expose a derived `cameraMovement` value for render execution, but it is projected from `visual_direction_json`; it is not a second storyboard source of truth.

## VisualBeat timing

`visual_beats` persists source-text anchors (`text_start`/`text_end`), not duplicate audio offsets. Exact runtime beat audio ranges are derived from the current narration alignment through `NarrationTextClockMapper`. `audio_start_ms`/`audio_end_ms` remain valid where they represent narration-alignment spans or immutable derived media/render snapshots, but they are not persisted on VisualBeat rows.

## Media preview identity

`visual_beats.preview_media_asset_id` is the canonical generated/default preview identity and references `media_assets`. V2 does not create an older project-asset preview pointer; V3 adds the canonical media pointer after `media_assets` exists.

## Production modes

The implemented production mode is:

```text
IMAGE_MOTION
```

Generic `VIDEO` analysis/editor intent and `IMAGE_TO_VIDEO` motion vocabulary may exist for deferred/browser workflows, but the current backend/worker/database production-mode contract does not advertise `HYBRID_LOCAL_I2V` as executable.

## Job types

Current durable generation job types are:

```text
CHAPTER_ANALYZE
NARRATION_GENERATE
CHAPTER_GENERATE
RENDER_PROJECT
```

Stage names such as `SHOT_IMAGE_GENERATE`, `SHOT_IMAGE_REGENERATE` and `RENDER_PROJECT_LOCAL` are stage identities, not separate JobType values.

`analysis_visual_generation_mode` intentionally allows `IMAGE` and `VIDEO`; VIDEO is independent of the current production-mode enum.

## Pre-release migration policy

Until first production deployment:

- keep each table/constraint in a clear owning migration or cohesive baseline slice;
- do not retain compatibility-only migrations, columns, aliases or tables for disposable development data;
- do not create fractional migration names such as `V6_1` for new subsystem work;
- recreate disposable local/test databases after baseline changes;
- keep defensive validation for malformed current data, while rejecting unsupported schema versions;
- keep sample/application data out of Flyway.

At first production deployment, freeze the accepted baseline. After that, all schema changes are append-only.

## Verification

A supported empty PostgreSQL instance must:

1. apply V1 through V17 successfully;
2. expose no pending migration;
3. contain no removed server Chapter-render snapshot tables;
4. contain no remote final-video artifact fields;
5. contain `visual_beats.preview_media_asset_id` and its established index;
6. preserve IMAGE/VIDEO analysis preference constraints;
7. allow project render assignment only through a paired local device snapshot;
8. enforce continuity scope/immutability, analysis checkpoint identity/lease fencing and immutable regeneration-plan lineage;
9. preserve render continuity provenance without using logical continuity/job/revision IDs as effective segment-cache dependencies;
10. contain `visual_direction_json` but no standalone VisualBeat camera/audio columns, no `preview_asset_id`, and no `short_clip_requests` table;
11. constrain the current production mode to `IMAGE_MOTION`;
12. contain no active image MediaPlan/regeneration cost, currency, pricing snapshot or pricing fingerprint columns after V17;
13. pass backend Testcontainers/Flyway/MyBatis tests and worker persistence tests.
