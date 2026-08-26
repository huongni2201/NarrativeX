# NarrativeX Database Baseline

## Authority

- PostgreSQL is the authoritative business/control-state store and the only application state service required by the MVP runtime.
- Spring Session JDBC and one-time Desktop OAuth handoffs use PostgreSQL; Redis is not required.
- Generation jobs/provider operations/outbox state are durable PostgreSQL rows. `NOTIFY`, when emitted, is a lossy hint only.
- The backend owns Flyway and the relational schema.
- PostgreSQL + Flyway is the schema/release gate. H2-only success is not sufficient validation.
- Published/applied Flyway migrations are append-only.

## Flyway layout

The current repository has a frozen three-file core baseline plus append-only runtime-state migration:

| Migration | Responsibility |
|---|---|
| `V1__create_tables.sql` | Core extensions/functions, tables, columns, keys/checks, execution/render/storage structures and core triggers |
| `V2__init_indexes.sql` | Core query/access-path, claim and partial-unique indexes |
| `V3__seed_data.sql` | Deterministic system/catalog bootstrap data such as plan entitlements, styles and voice catalog |
| `V4__postgres_runtime_state.sql` | Spring Session JDBC tables and hash-only, short-lived Desktop OAuth handoff state |

A clean database applies **V1 → V2 → V3 → V4** and leaves no pending migration after application startup.

V1-V3 are frozen. V4 is the first append-only post-baseline schema change; future changes must use V5+ and must not rewrite an applied migration.

## Consolidated V1 feature structures

Several Desktop-era features were folded into V1 before the baseline was frozen. In particular, V1 already creates:

- `desktop_guest_installations` for stable installation-scoped guest identity;
- `production_beat_media_selections` for durable per-VisualBeat media choice;
- local-device pairing/device/capability structures;
- local media materialization/integrity metadata;
- render snapshot/final-artifact metadata structures.

These remain part of V1. V4 adds only runtime session/handoff storage needed to remove Redis.

## Important schema decisions

- `auth_users` stores Google/OIDC user profiles plus internal stable guest principals used only for ownership/FK integrity. Guest rows are not a second sign-in provider.
- `desktop_guest_installations` maps one Desktop installation UUID to one stable guest principal and stores only a SHA-256 installation-secret hash. The plaintext secret remains Electron-local and protected by OS secure storage.
- `desktop_auth_handoffs` stores only the SHA-256/base64url hash of a random one-time code, its PKCE challenge/user snapshot and expiry. Consumption is atomic and single-use.
- `SPRING_SESSION` / `SPRING_SESSION_ATTRIBUTES` persist server-managed `NX_SESSION` state through Spring Session JDBC.
- `generation_jobs.job_id` is PostgreSQL `UUID`; idempotency keys are durable business identities rather than UI-only values.
- `chapters.deleted_at` is part of active Chapter semantics; owned/current queries filter deleted rows where appropriate.
- `media_beat_plans.reuse_source_visual_beat_id` and reuse invariants are part of the frozen core schema.
- `local_media_materializations` records device-scoped local availability/integrity metadata. Absolute filesystem paths remain Desktop-local and are never persisted as backend identity.
- `production_beat_media_selections` is part of V1 so explicit editor media choices survive reload and feed authoritative production/render reads without storing local machine paths.
- Narration, generation, render snapshot/final-artifact, quota, notification/outbox and local-device execution tables are part of the durable control plane.
- Historical render-routing columns/defaults embedded in frozen V1 do not imply that a retired cloud/server executor still exists. Current runtime code is authoritative; final project rendering executes in Electron main and backend final-artifact persistence is metadata-only.
- `story_versions` lifecycle state is `DRAFT`, `ACTIVE`, or `SUPERSEDED`.
- V3 contains deterministic bootstrap/catalog data only; user/project/story content is created by application workflows.

## Entity/schema matrix

| Domain | Main tables | Notes |
|---|---|---|
| Authentication | `auth_users`, `desktop_guest_installations`, `desktop_auth_handoffs`, `SPRING_SESSION`, `SPRING_SESSION_ATTRIBUTES` | Google account identity, stable installation guest continuity and PostgreSQL-backed session/handoff state |
| Project | `projects`, `project_favorites` | ownership, archival and dashboard/query foundation |
| Story / Chapter | `story_versions`, `chapters`, `chapter_creation_idempotency`, `chapter_content_variants`, `language_detections` | versioned text, soft-delete, translation lineage and idempotent creation |
| Storyboard | `storyboard_revisions`, `scenes`, `scene_characters`, `visual_beats`, `visual_beat_characters` | durable storyboard and continuity boundary |
| Character continuity | character/version/appearance/project-character tables | reusable identities and project-local mappings |
| Locations / project assets | project location/identity/asset tables | project-local location/media metadata |
| Media planning | `media_plans`, scene/beat plan tables | backend-authoritative plan, prompt snapshots and reuse lineage |
| Production editor | `production_beat_media_selections` | explicit per-beat production media choice consolidated into V1 |
| Generation execution | `generation_jobs`, `stage_attempts`, `provider_operations`, `operation_plans` | durable async state, leasing and provider reconciliation |
| Quota | entitlement/assignment/window/reservation tables | admission reservation and terminal settlement |
| Media assets | `media_assets`, `local_media_materializations`, checksum/upload/validation/cleanup tables | canonical metadata and local/remote generated-media materialization state |
| Narration | narration request/operation/asset/alignment/set/part/document tables | generated and uploaded narration plus alignment lineage |
| Media generation | generation-item and asset-lineage tables | per-beat execution/review and immutable result lineage |
| Render | render input/snapshot/manifest/final-artifact tables | immutable render admission and output metadata; final MP4 bytes stay local |
| Local execution | pairing/device/capability tables | Desktop identity, capabilities and revocation |
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
2. Apply V1, V2, V3 and V4 in version order.
3. Verify all four migrations are successful and none remain pending.
4. Verify `desktop_guest_installations` references `auth_users` and stores only the installation-secret hash.
5. Verify `desktop_auth_handoffs` stores hashed codes and expired/successful/wrong-verifier exchanges cannot replay the code.
6. Verify Spring Session JDBC can create/read/invalidate `NX_SESSION` rows across a backend restart.
7. Verify `production_beat_media_selections` constraints/indexes and mapper references match the application read/write paths.
8. Verify local-media/materialization and render tables contain server-safe identities/integrity metadata only, never absolute Desktop paths.
9. Run backend PostgreSQL/Testcontainers migration/persistence tests and worker persistence tests.
10. Run architecture/schema-reference tests that protect the frozen baseline and MyBatis mappings.
11. Add future schema evolution as `V5__*.sql` or later; never rewrite V1-V4.
