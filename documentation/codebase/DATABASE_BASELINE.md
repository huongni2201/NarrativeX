# NarrativeX Database Baseline

## Authority

PostgreSQL is the authoritative business/control-state store. The backend owns Flyway and the relational schema.

NarrativeX is still pre-production, so the Flyway history is intentionally maintained as a **squashed baseline** rather than as a historical upgrade chain. A clean database must create the current schema directly. We do not keep temporary migrations whose only purpose is to create a column/table and then rename, rewrite, or drop it in a later migration.

Until the first production schema is frozen, schema changes should be folded into the migration that owns the final table/constraint/index and development databases should be recreated from the baseline. After production launch, already-applied migrations become immutable and future schema evolution must use forward-only migrations.

## Canonical Flyway set

| Migration | Responsibility |
|---|---|
| `V1__identity_and_access.sql` | identity, Desktop auth, sessions and local-device state |
| `V2__project_story_and_planning.sql` | Projects, Stories, Chapters, Storyboard/Scene/VisualBeat entities and final MediaPlan shape |
| `V3__generation_billing_and_media.sql` | durable jobs/provider operations, non-monetary capacity/export quota reservations, final project MediaAsset schema and account voice-reference assets |
| `V4__narration_notifications_and_artifacts.sql` | final narration/alignment contracts, notifications/outbox and artifact metadata |
| `V5__catalog_generation_and_render_snapshots.sql` | catalogs, voice-reference upload lifecycle, media generation/lineage, continuity/checkpoints, regeneration plans, Storyboard generation snapshots and immutable project-render snapshots |
| `V6__database_logic_and_triggers.sql` | immutable-state guards, non-monetary quota settlement, completion notifications and generation events |
| `V7__indexes.sql` | all current query/access-path and partial/unique indexes |
| `V8__seed_catalog.sql` | deterministic plan/style/voice catalog seed data |

A clean database applies **V1 → V8** and is already at the current schema. There are no V9+ cleanup migrations in the pre-production baseline.

In particular, the baseline does **not** create monetary provider-operation fields and later null/drop them; it does not create image/regeneration pricing fields and later remove them; it does not create `storage_mode`, `media_asset_checksums`, or `local_media_materializations` and later delete them. Those retired shapes simply do not exist in a fresh database.

## Current storage decisions

```text
Generated/imported project media       -> project-owned media_assets
Account custom voice reference         -> voice_reference_assets (R2-backed)
Final project MP4                       -> Desktop filesystem; backend metadata only
```

Project ownership is represented directly by `media_assets.project_id`. There is no persisted project-media storage-mode discriminator. Account-owned custom voice references are intentionally separate from project media.

`final_artifacts` does not contain remote final-video provider IDs or public web links. Final project-video rows persist identity/checksum/size/duration/video metadata and an opaque local artifact key only.

## Current render schema

The supported final-render path is project render through an assigned local Desktop device.

Current render snapshot tables:

```text
project_render_input_snapshots
project_render_input_chapters
project_render_input_beats
```

Each render chapter snapshot may pin the immutable `continuity_plan_id` and its latest `continuity_report_revision` for the same chapter/source hash at admission time. This provenance is audit metadata; render-cache identity is derived from effective encoded inputs rather than continuity/job/revision identity.

The former server-side Chapter-render admission tables `render_input_snapshots` and `render_input_snapshot_beats` are absent. There is no `execution_target` cloud/local discriminator; `assigned_local_device_id` is required and defines the executor.

Render-profile schema v3 contains the explicit watermark policy. Schema v2 remains accepted only as a valid persisted snapshot contract; the baseline does not create a v2-only constraint and patch it later.

## Storyboard direction schema

`visual_beats.visual_direction_json` is the single persisted camera/composition representation. Worker materialization, backend prompt compilation, media planning and Desktop Storyboard UI consume that structured payload directly. The baseline never creates `visual_beats.camera_angle` or `visual_beats.camera_movement`.

The production timeline may expose a derived `cameraMovement` value for render execution, but it is projected from `visual_direction_json`; it is not a second storyboard source of truth.

## VisualBeat timing

`visual_beats` persists source-text anchors (`text_start`/`text_end`), not duplicate audio offsets. Exact runtime beat audio ranges are derived from the current narration alignment through `NarrationTextClockMapper`. `audio_start_ms`/`audio_end_ms` remain valid where they represent narration-alignment spans or immutable derived media/render snapshots, but they are not persisted on VisualBeat rows.

## Media preview identity

`visual_beats.preview_media_asset_id` is the canonical generated/default preview identity and references `media_assets`. V2 defines VisualBeat; V3 adds the pointer once the referenced final `media_assets` table exists. This is an ordering dependency inside the baseline, not a compatibility migration followed by a cleanup migration.

## Continuity and regeneration

The final baseline contains:

```text
chapter_continuity_plans
scene_continuity_states
visual_beat_continuity_states
continuity_reports
analysis_checkpoints
regeneration_plans
storyboard_generation_batches
storyboard_generation_beat_snapshots
```

Continuity and regeneration rows are immutable snapshots. `regeneration_plans` contains no monetary `estimated_cost` or `currency` fields. Analysis checkpoints retain durable provider-operation identity and reconciliation state without provider pricing metadata.

## Quotas

Quota reservations are non-monetary. Supported kinds are:

```text
CAPACITY
LONGFORM_EXPORT
```

The schema does not contain active `CREDIT` reservations, `credits_used`, `monthly_credits`, reservation cost/currency columns, or provider-operation billing snapshots. Completion consumes reservations and settles export units; failure/cancellation releases reservations.

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

## Pre-production migration policy

- keep the canonical baseline small and organized by ownership/domain;
- create each table directly in its current shape whenever dependency ordering allows it;
- do not preserve a migration whose only role is to rename/drop/rewrite schema introduced by another baseline migration;
- fold new pre-production columns, constraints, triggers and indexes into V1–V8 and recreate development/test databases;
- use later migration files only for genuine dependency ordering that cannot be expressed in an earlier owning migration, not as historical compatibility patches;
- keep sample/application data out of Flyway except deterministic catalog seed data in V8;
- before the first production release, a baseline rewrite intentionally invalidates existing development Flyway checksums and requires a clean database/reset;
- after the first production release, stop rewriting applied migrations and use append-only forward migrations.

## Verification

A supported clean PostgreSQL instance must:

1. apply V1 through V8 successfully with no pending migration;
2. contain no V9+ baseline patch requirement;
3. contain no removed server Chapter-render snapshot tables;
4. contain no remote final-video artifact fields;
5. contain `visual_beats.preview_media_asset_id` and its index;
6. preserve IMAGE/VIDEO analysis preference constraints;
7. allow project render assignment only through a paired local device snapshot;
8. enforce continuity scope/immutability, analysis checkpoint identity/lease fencing and immutable regeneration-plan lineage;
9. preserve render continuity provenance without using logical continuity/job/revision IDs as effective segment-cache dependencies;
10. contain `visual_direction_json` but no standalone VisualBeat camera/audio columns, no `preview_asset_id`, and no `short_clip_requests` table;
11. constrain the current production mode to `IMAGE_MOTION`;
12. contain no active MediaPlan/regeneration/provider-operation monetary cost, currency, pricing snapshot or pricing fingerprint fields;
13. accept `CAPACITY` and `LONGFORM_EXPORT` reservations while having no legacy `CREDIT` accounting columns;
14. contain no `storage_mode`, `media_asset_checksums` or `local_media_materializations` compatibility schema;
15. pass backend Testcontainers/Flyway/MyBatis tests and worker persistence tests.
