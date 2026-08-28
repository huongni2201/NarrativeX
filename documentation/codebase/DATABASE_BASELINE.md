# NarrativeX Database Baseline

## Authority

- PostgreSQL is the authoritative business/control-state store and the only application state service required by the MVP runtime.
- Spring Session JDBC and one-time Desktop OAuth handoffs use PostgreSQL; Redis is not required.
- Generation jobs/provider operations/outbox state are durable PostgreSQL rows. Workers discover queue work with PostgreSQL polling/claim SQL.
- The backend owns Flyway and the relational schema.
- PostgreSQL + Flyway is the schema/release gate. H2-only success is not sufficient validation.
- NarrativeX is still pre-production, so the current V1-V8 set is a clean baseline and may be reorganized while development databases remain disposable. See `documentation/architecture/flyway-baseline-policy.md`.

## Flyway layout

| Migration | Responsibility |
|---|---|
| `V1__identity_and_access.sql` | User identity, Desktop OAuth handoffs, Spring Session, guest continuity, local-device pairing/device/capability state |
| `V2__project_story_and_planning.sql` | Projects, stories, Chapters, storyboard revisions, reusable Characters/Locations/assets, Scenes/VisualBeats and media plans |
| `V3__generation_billing_and_media.sql` | Generation jobs/stage attempts/provider operations, plan/quota state, media assets, materializations and validation |
| `V4__narration_notifications_and_artifacts.sql` | Narration requests/assets/alignment, notifications/outbox, render manifests, final artifact metadata and short clips |
| `V5__catalog_generation_and_render_snapshots.sql` | Catalog tables, upload lifecycle, media generation/lineage, Chapter/Project render snapshots and subtitle snapshots |
| `V6__database_logic_and_triggers.sql` | Immutable-state guards, quota settlement, completion notifications and generation event triggers |
| `V7__indexes.sql` | Query/access-path, claim, covering and partial-unique indexes |
| `V8__seed_catalog.sql` | Deterministic plan/style/voice catalog bootstrap data; VieNeu voices advertise speaking-rate support |

A clean database applies **V1 → V2 → V3 → V4 → V5 → V6 → V7 → V8** and leaves no pending migration after application startup.

The baseline deliberately contains no patch-only migration for project-render subtitles, the Chapter Workspace generation lookup, or VieNeu speaking-rate capability. Those final states are folded into V5, V7 and V8 respectively.

## Pre-release migration policy

Until the first production deployment:

- keep tables in their final form inside their owning domain migration;
- reorganize the baseline when doing so materially improves clarity or removes patch history;
- recreate disposable local/test databases when migration checksums or version history change;
- do not add compatibility migrations solely to preserve test/development data;
- keep application/user sample data out of Flyway.

Immediately before the first production release, freeze the accepted baseline. After that point every schema/index/backfill/seed change must be append-only from the next version and already-applied migrations must not be edited.

## Important schema decisions

- `auth_users` stores Google/OIDC user profiles plus internal stable guest principals used only for ownership/FK integrity.
- `desktop_guest_installations` stores only a SHA-256 installation-secret hash.
- `desktop_auth_handoffs` stores only the hash of a random one-time code plus PKCE/user snapshot/expiry data; consumption is atomic and single-use.
- `SPRING_SESSION` / `SPRING_SESSION_ATTRIBUTES` persist server-managed `NX_SESSION` state.
- `chapters.source_text`, `source_hash` and row version are the authoritative saved Chapter source identity; there is no duplicate content-variant/translation lineage layer.
- `characters`, `project_characters`, `character_versions` and `character_appearances` separate reusable identity, Project assignment, versioned bible/visual prompt and timeline appearance state.
- `scene_characters` and `visual_beat_characters` store explicit ProjectCharacter participation. `visual_beat_characters.role` is `PRIMARY`, `SECONDARY`, or `BACKGROUND`.
- `visual_beats.text_start/text_end` and `audio_start_ms/audio_end_ms` are nullable schema fields. **Column presence does not mean current Chapter analysis populates exact source/audio timing.** At the audited code checkpoint, deterministic VisualBeat source-offset materialization and narration timing reconciliation remain TARGET/PARTIAL.
- `visual_beats.aspect_ratio_override` and `quality_tier_override` are nullable overrides. `NULL` means inherit the applicable Project/default policy; it is not missing required AI analysis output.
- `generation_jobs`, `stage_attempts`, `provider_operations` and related work tables are the worker queue/lifecycle authority.
- `outbox_events` preserves transactional enqueue evidence. Generation/media-validation outbox rows are finalized after commit without Redis or another broker; workers do not consume the outbox as their queue.
- `narration_requests.speaking_rate` is required and positive. The seeded VieNeu catalog advertises `supportsSpeakingRate=true` so clients can expose the control for those voices.
- `narration_alignments` persists source-hash-bound text/audio spans. This alignment persistence is implemented foundation but does not automatically populate exact VisualBeat audio timing.
- `production_beat_media_selections` stores durable non-destructive VisualBeat media selection plus supported fit/trim state.
- Absolute Desktop filesystem paths remain local and are never backend identities.
- Final project rendering executes in Electron main; backend final-artifact persistence is metadata-only.
- `project_render_input_chapters.subtitle_text` and `subtitle_spans_json` are immutable render inputs; subtitle spans must be a JSON array when present.

## Entity/schema matrix

| Domain | Main tables | Notes |
|---|---|---|
| Authentication | `auth_users`, `desktop_guest_installations`, `desktop_auth_handoffs`, `SPRING_SESSION`, `SPRING_SESSION_ATTRIBUTES` | Google account identity, guest continuity and PostgreSQL session/handoff state |
| Project | `projects`, `project_favorites` | ownership, archival and dashboard/query foundation |
| Story / Chapter | `story_versions`, `chapters`, `chapter_creation_idempotency` | saved source text/hash, soft-delete and idempotent creation |
| Character continuity | `characters`, `project_characters`, `character_versions`, `character_appearances`, `outfit_versions` | reusable identity, Project assignment, pinned/versioned state and appearance context |
| Storyboard | `storyboard_revisions`, `scenes`, `scene_characters`, `visual_beats`, `visual_beat_characters` | durable storyboard/continuity boundary; timing columns are nullable and not proof of current exact materialization |
| Generation execution | `generation_jobs`, `stage_attempts`, `provider_operations`, `operation_plans`, `outbox_events` | durable async state, leasing, reconciliation and enqueue evidence |
| Media assets | `media_assets`, `local_media_materializations`, checksum/upload/validation/cleanup tables | canonical metadata and materialization state |
| Production selection | `production_beat_media_selections` | explicit selected beat media plus fit/trim state |
| Narration | narration request/operation/asset/alignment/set/part/document tables | generated/uploaded narration, source-to-audio alignment lineage and speaking rate |
| Render | render input/snapshot/manifest/final-artifact tables | immutable render admission/output metadata including subtitle snapshots; final MP4 bytes stay local |
| Local execution | pairing/device/capability tables | Desktop identity, capabilities and revocation |
| Notifications | `notifications`, `outbox_events` | durable notification/feed and transactional event evidence |
| Catalog | `style_presets`, `voice_catalog` | deterministic read-model data seeded by V8 |

## Durable execution contract

```text
OperationPlan
    -> GenerationJob
    -> StageAttempt
    -> ProviderOperation
```

Provider requests are persisted before external submission. Ambiguous acceptance is preserved as `UNKNOWN` and reconciled before resubmission. Mutable state uses row-version/CAS protection where required.

## Timing schema versus implementation

The database deliberately has enough shape for exact VisualBeat source/audio timing, but implementation status is separate:

```text
schema available
  visual_beats.text_start/text_end
  visual_beats.audio_start_ms/audio_end_ms
  narration_alignments.spans_json

implemented foundation
  semantic VisualBeat materialization
  narration alignment persistence
  immutable MediaPlan timing
  generic production-timeline fallback timing

not yet complete
  deterministic source segment -> VisualBeat UTF-16 offsets
  VisualBeat source span -> narration alignment reconciliation
  exact draft storyboard audio timing before MediaPlan
```

Do not upgrade `TARGET/PARTIAL` timing work to IMPLEMENTED merely because the columns exist.

## Verification gate

For the current pre-release baseline:

1. Start an empty supported PostgreSQL instance using the repository-supported/Testcontainers version.
2. Apply V1 through V8 in version order.
3. Verify all eight migrations are successful and none remain pending.
4. Verify `chapter_content_variants` and `language_detections` do not exist and generation/storyboard tables expose no translation lineage columns.
5. Verify hashed Desktop installation/handoff secrets and single-use handoff behavior.
6. Verify Spring Session JDBC can create/read/invalidate `NX_SESSION` across backend restart.
7. Verify generation/media jobs remain claimable from PostgreSQL when no Redis/broker exists.
8. Verify Character/ProjectCharacter/CharacterVersion/CharacterAppearance and `visual_beat_characters` constraints/relations match MyBatis/materializer expectations.
9. Verify nullable VisualBeat timing/override constraints are present without assuming those fields are filled by current analysis.
10. Verify narration alignment JSON array/source-hash constraints and render subtitle JSON-array constraints.
11. Verify the Chapter Workspace covering lookup index exists in V7.
12. Verify all enabled VieNeu catalog rows report `supportsSpeakingRate=true` and narration requests accept positive `speaking_rate` values.
13. Run backend PostgreSQL/Testcontainers migration/persistence tests, MyBatis schema-reference tests and worker persistence tests.
14. Before the first production deployment, freeze this baseline; after deployment, use only new append-only versions.
