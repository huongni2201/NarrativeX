# NarrativeX Database Baseline

## Authority

- PostgreSQL is the authoritative business-state store.
- Redis is used for sessions and non-authoritative delivery/progress hints; it is not authoritative GenerationJob state.
- The backend owns Flyway and the relational schema.
- PostgreSQL + Flyway is the schema/release gate. H2-only success is not sufficient validation.
- Published/applied Flyway migrations are append-only.

## Flyway layout

NarrativeX has a frozen three-file core baseline followed by additive feature migrations:

| Migration | Responsibility |
|---|---|
| `V1__create_tables.sql` | Core extensions/functions, tables, columns, keys/checks, execution/render/storage structures and core triggers |
| `V2__init_indexes.sql` | Core query/access-path, claim and partial-unique indexes |
| `V3__seed_data.sql` | Deterministic system/catalog seed data such as plan entitlements, styles and voice catalog |
| `V4__desktop_guest_installations.sql` | Stable installation-scoped Desktop guest identity |
| `V5__production_beat_media_selections.sql` | Persisted production-timeline beat media selections/overrides used by the Desktop editor and render input flow |

V1-V3 are the frozen clean core baseline. V4+ are reviewed append-only feature migrations. New schema evolution must use the next migration version rather than rewriting a published checksum.

A clean database for the current version applies **V1 → V2 → V3 → V4 → V5** and leaves no pending migration after application startup.

## Important schema decisions

- `auth_users` stores Google/OIDC user profiles plus internal stable guest principals used only for ownership/FK integrity. Guest rows are not a second sign-in provider.
- `desktop_guest_installations` maps one Desktop installation UUID to one stable guest principal and stores only a SHA-256 installation-secret hash. The plaintext secret remains Electron-local and protected by OS secure storage.
- `generation_jobs.job_id` is PostgreSQL `UUID`; idempotency keys are durable business identities rather than UI-only values.
- `chapters.deleted_at` is part of active Chapter semantics; owned/current queries filter deleted rows where appropriate.
- `media_beat_plans.reuse_source_visual_beat_id` and reuse invariants are part of the frozen core schema.
- Project render snapshots and `CLOUD` / `LOCAL_DEVICE` execution routing are part of the core schema.
- `local_media_materializations` records device-scoped local availability/integrity metadata. Absolute filesystem paths remain Desktop-local and are never persisted as backend identity.
- Narration, generation, render snapshot/final-artifact, quota, notification/outbox and local-device execution tables are part of the durable control plane.
- `production_beat_media_selections` is introduced by V5 so explicit editor media choices survive reload and can feed authoritative production/render reads without storing local machine paths.
- `story_versions` lifecycle state is `DRAFT`, `ACTIVE`, or `SUPERSEDED`.
- V3 contains deterministic bootstrap/catalog data only; user/project/story content is created by application workflows.

## Entity/schema matrix

| Domain | Main tables | Notes |
|---|---|---|
| Authentication | `auth_users`, `desktop_guest_installations` | Google account identity plus stable installation guest continuity |
| Project | `projects`, `project_favorites` | ownership, archival and dashboard/query foundation |
| Story / Chapter | `story_versions`, `chapters`, `chapter_creation_idempotency`, `chapter_content_variants`, `language_detections` | versioned text, soft-delete, translation lineage and idempotent creation |
| Storyboard | `storyboard_revisions`, `scenes`, `scene_characters`, `visual_beats`, `visual_beat_characters` | durable storyboard and continuity boundary |
| Character continuity | character/version/appearance/project-character tables | reusable identities and project-local mappings |
| Locations / project assets | project location/identity/asset tables | project-local location/media metadata |
| Media planning | `media_plans`, scene/beat plan tables | backend-authoritative plan, prompt snapshots and reuse lineage |
| Production editor | `production_beat_media_selections` | explicit per-beat production media choice introduced by V5 |
| Generation execution | `generation_jobs`, `stage_attempts`, `provider_operations`, `operation_plans` | durable async state, leasing and provider reconciliation |
| Quota | entitlement/assignment/window/reservation tables | admission reservation and terminal settlement |
| Media assets | `media_assets`, `local_media_materializations`, checksum/upload/validation/cleanup tables | canonical metadata and local/cloud materialization state |
| Narration | narration request/operation/asset/alignment/set/part/document tables | generated and uploaded narration plus alignment lineage |
| Media generation | generation-item and asset-lineage tables | per-beat execution/review and immutable result lineage |
| Chapter render | render input/head/manifest/final-artifact tables | immutable render admission and output metadata |
| Project render | project render snapshot/chapter/beat tables | immutable long-form render snapshot with cloud/local routing |
| Local execution | pairing/device/capability tables | desktop identity, capabilities and revocation |
| Shorts | `short_clip_requests` | durable trim/export requests |
| Notifications | `notifications`, `outbox_events` | durable feed and transactional dispatch |
| Catalog | `style_presets`, `voice_catalog` | deterministic read-model data seeded by V3 |

## Durable execution contract

```text
OperationPlan
    -> GenerationJob
    -> StageAttempt
    -> ProviderOperation
```

Provider requests are persisted before external submission. Ambiguous acceptance is preserved as `UNKNOWN` and reconciled before resubmission. Mutable state uses row-version/CAS protection where the domain requires optimistic concurrency; stale writes conflict instead of silently winning.

## Verification gate

For schema changes:

1. Start an empty supported PostgreSQL instance.
2. Apply the complete canonical Flyway list in version order.
3. Verify V1 through the latest additive migration are successful and none remain pending.
4. Verify `desktop_guest_installations` references `auth_users` and stores only the secret hash.
5. Verify V5 `production_beat_media_selections` constraints/indexes and mapper references match the application read/write paths.
6. Verify local-media/materialization and render tables contain server-safe identities/integrity metadata only, never absolute Desktop paths.
7. Run backend PostgreSQL/Testcontainers migration/persistence tests and worker persistence tests.
8. Run architecture/schema-reference tests that protect the frozen baseline and MyBatis mappings.
