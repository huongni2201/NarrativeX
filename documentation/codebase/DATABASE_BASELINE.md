# NarrativeX Database Baseline

## Authority

- PostgreSQL is the authoritative business-state store.
- Redis is used for sessions and non-authoritative delivery/progress hints; it is not authoritative GenerationJob state.
- The backend owns Flyway and the relational schema.
- PostgreSQL + Flyway is the schema/release gate. H2-only success is not sufficient validation.
- The migration set defines the complete schema required by the current application version.
- Baseline tables must have an active application, worker, trigger or durable pipeline responsibility; speculative persistence is introduced only with the feature that consumes it.
- Published/applied Flyway migrations are append-only. Do not rewrite an already-shared migration merely to keep the file count small.

## Flyway layout

NarrativeX has a frozen three-file core baseline plus reviewed additive feature migrations:

| Migration | Responsibility |
|---|---|
| `V1__create_tables.sql` | Core PostgreSQL extension/function setup, tables, columns, primary/foreign/unique/check constraints, immutable-state functions and triggers |
| `V2__init_indexes.sql` | Core query/access-path indexes, partial indexes and partial unique indexes |
| `V3__seed_data.sql` | Deterministic system/catalog seed data only: plan entitlements, style presets and voice catalog |
| `V4__desktop_guest_installations.sql` | Stable Desktop guest-installation identity table and its feature-local access index |

V1-V3 are the frozen clean core baseline that was consolidated before additive feature migration history resumed. New schema evolution is introduced with the next versioned migration rather than by changing the checksum of V1-V3.

A clean database for the current version applies **V1 → V2 → V3 → V4**. `flyway_schema_history` must contain the canonical successful versioned migrations in order and leave no pending migration after application startup.

## Important schema decisions

- `auth_users` stores Google/OIDC user profiles plus internal stable guest principals used only for ownership/FK integrity. Internal guest rows have no Google subject and are not a second login provider.
- `desktop_guest_installations` maps one Desktop installation UUID to one stable guest principal and stores only a SHA-256 installation-secret hash. The plaintext secret remains Electron-local and encrypted with OS secure storage.
- `generation_jobs.job_id` is PostgreSQL `UUID`.
- `generation_jobs.idempotency_key` is `VARCHAR(512)`.
- `chapters.deleted_at` is part of the Chapter definition; current/owned Chapter queries enforce `deleted_at IS NULL` where appropriate.
- Active Chapter order uniqueness is the partial unique index `uq_chapters_story_order_active` in V2.
- `media_beat_plans.reuse_source_visual_beat_id` and its reuse-strategy invariants are part of V1.
- Project render snapshots and `CLOUD` / `LOCAL_DEVICE` execution routing are part of V1; their claim/access indexes are in V2.
- `local_media_materializations` records which paired desktop device has a local copy of a MediaAsset plus availability/checksum metadata. Absolute filesystem paths remain desktop-local and are not persisted by the backend.
- Generation completion notifications, generation SSE/`pg_notify`, quota finalization and immutable-snapshot enforcement are defined in V1.
- `story_versions` lifecycle state is `DRAFT`, `ACTIVE`, or `SUPERSEDED`.
- V3 contains system bootstrap data only. User/project/story content is created by application workflows, not Flyway.
- V4 starts append-only feature migration history. Feature migrations may contain the table/constraint/index changes required to make that feature atomic and deployable.

## Entity/schema matrix

| Domain | Tables | Notes |
|---|---|---|
| Authentication | `auth_users`, `desktop_guest_installations` | Google/OIDC identity plus stable installation-scoped guest continuity |
| Project | `projects`, `project_favorites` | ownership, archival and dashboard/query foundation |
| Story / Chapter | `story_versions`, `chapters`, `chapter_creation_idempotency`, `chapter_content_variants`, `language_detections` | versioned text, soft-delete, translation lineage and idempotent creation |
| Storyboard | `storyboard_revisions`, `scenes`, `scene_characters`, `visual_beats`, `visual_beat_characters` | durable storyboard and continuity boundary |
| Character continuity | `characters`, `character_versions`, `outfit_versions`, `character_appearances`, `project_characters`, `project_character_ai_identities` | reusable identities and project-local mappings |
| Locations / project assets | `project_locations`, `project_location_ai_identities`, `project_assets` | project-local location/media metadata |
| Media plan | `media_plans`, `media_scene_plans`, `media_beat_plans` | immutable backend-authoritative plan, prompt snapshots and reuse lineage |
| Generation execution | `generation_jobs`, `stage_attempts`, `provider_operations`, `operation_plans` | durable async state, leasing, provider reconciliation and billing evidence |
| Quota | `plan_entitlements`, `user_plan_assignments`, `usage_windows`, `quota_reservations` | admission reservation and terminal settlement |
| Media assets | `media_assets`, `local_media_materializations`, `media_asset_checksums`, `media_upload_sessions`, `media_validation_jobs`, `media_storage_cleanup_tasks` | canonical metadata, per-device local materialization state, validation and storage cleanup |
| Narration | `narration_requests`, `narration_operations`, `narration_assets`, `narration_alignments`, `narration_sets`, `narration_parts`, `narration_documents`, `narration_document_chapters`, `narration_alignment_runs` | generated and uploaded narration plus immutable alignment lineage |
| Media generation | `media_generation_items`, `media_asset_lineage` | per-beat execution/review and immutable result lineage |
| Chapter render | `render_input_snapshots`, `render_input_snapshot_beats`, `chapter_media_heads`, `render_manifests`, `final_artifacts` | immutable chapter render admission and durable output |
| Project render | `project_render_input_snapshots`, `project_render_input_chapters`, `project_render_input_beats` | immutable long-form render snapshot with cloud/local execution routing |
| Local execution | `local_device_pairing_codes`, `local_devices`, `local_device_capabilities` | paired desktop identity, capabilities and revocation |
| Shorts | `short_clip_requests` | durable trim/export requests against final artifacts |
| Notification delivery | `notifications`, `outbox_events` | durable notification feed and transactional event dispatch |
| Catalog | `style_presets`, `voice_catalog` | deterministic read-model data seeded by V3 |

## Durable execution contract

The persisted expensive-work chain is:

```text
OperationPlan
    -> GenerationJob
    -> StageAttempt
    -> ProviderOperation
```

A provider request is persisted before external submission:

```text
reserve durable operation
    -> RESERVED
    -> external submit
    -> SUBMITTED / RUNNING
    -> COMPLETED / FAILED / UNKNOWN
```

`UNKNOWN` is a reconciliation state for ambiguous provider acceptance. Workers reconcile before resubmitting work that may already have been accepted externally.

Mutable rows use `row_version`/CAS-style protection where the domain requires optimistic concurrency. Stale writes conflict instead of silently becoming last-write-wins.

## Core index boundary

Within the frozen V1-V3 baseline, V1 creates a relationally valid schema before V2 runs. Uniqueness required as an FK target is therefore expressed as a table `UNIQUE` constraint in V1. V2 owns indexes that exist for query performance, partial uniqueness or claim/access paths.

Examples:

```sql
-- V1: required relational invariant / FK target
CONSTRAINT uk_project_characters_project_id_id UNIQUE (project_id, id)

-- V2: query access path
CREATE INDEX idx_projects_active_owner_updated_id
ON projects(owner_id, updated_at DESC, id DESC)
WHERE archived_at IS NULL;
```

Additive V4+ migrations are feature-scoped deployable units. They may create a new table and the indexes required by that table in the same migration; they must not rewrite V1-V3 checksums.

## Verification gate

For schema changes:

1. Start an empty supported PostgreSQL instance.
2. Apply the complete canonical migration list through Flyway in version order.
3. Verify all canonical migrations are successful, the latest version matches the newest migration, and no migration remains pending.
4. Verify `auth_users` contains the Google/OIDC identity fields used by the authentication boundary.
5. Verify `desktop_guest_installations` references `auth_users`, stores a 64-character secret hash, and has its `last_seen_at` index after V4.
6. Verify `generation_jobs.idempotency_key` is `VARCHAR(512)` and `job_id` is `uuid`.
7. Verify `media_beat_plans.reuse_source_visual_beat_id` and reuse constraints exist.
8. Verify `project_render_input_snapshots.execution_target` and `assigned_local_device_id` exist with the routing constraint.
9. Verify `local_media_materializations` is device-scoped and retains only server-safe materialization metadata, not local filesystem paths.
10. Verify `uq_chapters_story_order_active`, local-render claim indexes and render artifact indexes exist after V2.
11. Verify V3 seeds plan/style/voice catalogs without inserting application user/project content.
12. Start the backend and run PostgreSQL/Testcontainers integration tests plus worker persistence tests.
13. Verify representative query plans for keyset pagination and job/device claim paths.
