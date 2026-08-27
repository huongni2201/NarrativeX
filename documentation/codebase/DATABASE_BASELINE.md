# NarrativeX Database Baseline

## Authority

- PostgreSQL is the authoritative business/control-state store and the only application state service required by the MVP runtime.
- Spring Session JDBC and one-time Desktop OAuth handoffs use PostgreSQL; Redis is not required.
- Generation jobs/provider operations/outbox state are durable PostgreSQL rows. Workers discover queue work with PostgreSQL polling/claim SQL; there is no broker or notification dependency.
- The backend owns Flyway and the relational schema.
- PostgreSQL + Flyway is the schema/release gate. H2-only success is not sufficient validation.
- V1-V3 are the frozen consolidated baseline. V4 and V5 are append-only runtime refinements already present in the current repository; future migrations remain append-only.

## Flyway layout

| Migration | Responsibility |
|---|---|
| `V1__create_tables.sql` | Complete relational/runtime schema: extensions/functions, tables, columns, keys/checks, execution/render/storage structures, Spring Session, Desktop OAuth handoffs and core triggers |
| `V2__init_indexes.sql` | Complete query/access-path, claim, runtime-state and partial-unique indexes |
| `V3__seed_data.sql` | Deterministic system/catalog bootstrap data such as plan entitlements, styles and voice catalog |
| `V4__project_render_subtitles.sql` | Immutable narration subtitle text and alignment spans captured in project render input chapters |
| `V5__chapter_workspace_generation_lookup.sql` | Covering lookup index for Chapter Workspace generation status projection |

A clean database applies **V1 → V2 → V3 → V4 → V5** and leaves no pending migration after application startup. Spring Session JDBC and Desktop OAuth handoffs are already in V1/V2; V4 is not a session migration. Translation/content-variant schema is not part of the current baseline. Future schema changes begin with append-only `V6__*.sql` migrations.

## Important schema decisions

- `auth_users` stores Google/OIDC user profiles plus internal stable guest principals used only for ownership/FK integrity.
- `desktop_guest_installations` stores only a SHA-256 installation-secret hash.
- `desktop_auth_handoffs` stores only the SHA-256/base64url hash of a random one-time code, its PKCE challenge/user snapshot and expiry; consumption is atomic and single-use.
- `SPRING_SESSION` / `SPRING_SESSION_ATTRIBUTES` persist server-managed `NX_SESSION` state.
- `chapters.source_text` and `chapters.source_hash` are the authoritative saved chapter source; there is no duplicate content-variant/translation lineage layer.
- `generation_jobs`, `stage_attempts`, `provider_operations` and related work tables are the worker queue/lifecycle authority.
- `outbox_events` preserves transactional enqueue evidence. Generation/media-validation outbox rows are finalized after commit without Redis, `NOTIFY`, or another broker; workers do not consume the outbox as their queue.
- Absolute Desktop filesystem paths remain local and are never backend identities.
- Final project rendering executes in Electron main; backend final-artifact persistence is metadata-only.
- `project_render_input_chapters.subtitle_text` and `subtitle_spans_json` are immutable render snapshots used to build local subtitle cues; the JSON value must be an array when present.

## Entity/schema matrix

| Domain | Main tables | Notes |
|---|---|---|
| Authentication | `auth_users`, `desktop_guest_installations`, `desktop_auth_handoffs`, `SPRING_SESSION`, `SPRING_SESSION_ATTRIBUTES` | Google account identity, guest continuity and PostgreSQL session/handoff state |
| Project | `projects`, `project_favorites` | ownership, archival and dashboard/query foundation |
| Story / Chapter | `story_versions`, `chapters`, `chapter_creation_idempotency` | saved source text/hash, soft-delete and idempotent creation |
| Storyboard | `storyboard_revisions`, `scenes`, `scene_characters`, `visual_beats`, `visual_beat_characters` | durable storyboard and continuity boundary |
| Generation execution | `generation_jobs`, `stage_attempts`, `provider_operations`, `operation_plans`, `outbox_events` | durable async state, leasing, reconciliation and enqueue evidence |
| Media assets | `media_assets`, `local_media_materializations`, checksum/upload/validation/cleanup tables | canonical metadata and materialization state |
| Narration | narration request/operation/asset/alignment/set/part/document tables | generated/uploaded narration plus alignment lineage |
| Render | render input/snapshot/manifest/final-artifact tables | immutable render admission/output metadata including subtitle snapshots; final MP4 bytes stay local |
| Local execution | pairing/device/capability tables | Desktop identity, capabilities and revocation |
| Notifications | `notifications`, `outbox_events` | durable notification/feed and transactional event evidence |
| Catalog | `style_presets`, `voice_catalog` | deterministic read-model data seeded by V3 |

## Durable execution contract

```text
OperationPlan
    -> GenerationJob
    -> StageAttempt
    -> ProviderOperation
```

Provider requests are persisted before external submission. Ambiguous acceptance is preserved as `UNKNOWN` and reconciled before resubmission. Mutable state uses row-version/CAS protection where required.

## Verification gate

For this final baseline and later schema/runtime-state changes:

1. Start an empty supported PostgreSQL instance.
2. Apply V1 through V5 in version order.
3. Verify all five migrations are successful and none remain pending.
4. Verify `chapter_content_variants` and `language_detections` do not exist and generation/storyboard tables expose no translation lineage columns.
5. Verify hashed Desktop installation/handoff secrets and single-use handoff behavior.
6. Verify Spring Session JDBC can create/read/invalidate `NX_SESSION` across backend restart.
7. Verify generation/media jobs remain claimable from PostgreSQL when no Redis/broker/notification service exists.
8. Verify outbox acknowledgement failure leaves the event retryable after reservation expiry.
9. Run backend PostgreSQL/Testcontainers migration/persistence tests and worker persistence tests.
10. Run architecture/schema-reference tests.
11. Verify render subtitle spans are JSON arrays when present and are included in the immutable render input snapshot.
12. After the current V5 migration, add future schema evolution as `V6__*.sql` or later; do not rewrite V1-V5.
