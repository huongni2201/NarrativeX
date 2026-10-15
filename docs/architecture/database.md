# NarrativeX Database Architecture and Baseline Policy

**Status:** maintained database contract  
**Authority:** Spring Boot backend Flyway migrations (current worktree inventory V1–V7), integration tests, and current ADRs (ADR-0001, ADR-0002, ADR-0003, ADR-0006, ADR-0007, ADR-0008, ADR-0010, ADR-0002)

## PostgreSQL Authority and Flyway Ownership

PostgreSQL is the single authoritative store for business state, admission control, durable generation jobs, device leases, and artifact metadata. The Spring Boot backend owns Flyway and manages the relational schema. `app/generation-service` and Electron Desktop have zero direct access to PostgreSQL.

## Current Migration Inventory (V1–V7)

The pre-production baseline is squashed into seven responsibility-separated migrations. The former incremental files V8–V15 (async compute orchestration, video-first production, character voice profiles, native render cuts, subtitle settings, Chapter Analysis local execution, prompt settings, and the Antigravity CLI execution mode) are folded into the owning V1–V7 files. The interim V16 indexes are folded into V6. This inventory does not establish which versions are applied to an installed database or declare any runtime capability complete.

| Migration | Responsibility |
|---|---|
| V1__project_story_and_planning.sql | Projects, StoryVersions, Chapters, Scenes, StoryBeats, AudioCues, VisualBeats (dramatic intent and retention role), Characters with typed visual profiles/reference policies, character voice profiles and pinned voice pointers, and media plans |
| V2__generation_and_media.sql | Generation jobs (including async compute attempt handles, callback metadata and reconciliation state), Stage attempts, Provider operations, compute event receipts and target assignments, Media assets, and canonical character-reference slots |
| V3__narration_and_artifacts.sql | Narration and alignment contracts, durable outbox events, local device render leases, and final artifact metadata |
| V4__catalog_generation_and_render_snapshots.sql | Catalogs, upload lifecycle, video-first shot production (hook plans, retention maps, shots, takes), media lineage, local devices, Chapter Analysis runtime (Desktop configuration, redacted credential metadata, immutable execution and prompt snapshots, fenced attempts, usage/provenance), immutable render snapshots including native take cuts, and project subtitle settings ([ADR-0010](../decisions/ADR-0010-installation-wide-prompt-settings.md), Proposed) |
| V5__database_logic_and_triggers.sql | Immutability guards (media plans, lineage, takes, analysis snapshots), database functions, and after-commit generation event triggers |
| V6__indexes.sql | Access-path, covering, partial, and unique indexes for every table, including active video batches, pending outbox events, compute orchestration, and Chapter Analysis runtime |
| V7__seed_catalog.sql | Deterministic system and catalog seed data only, including the singleton Chapter Analysis runtime configuration row |

A clean database should apply the current **V1 through V7** inventory. Runtime configuration, execution snapshots and run provenance permit only `ANTIGRAVITY_CLI`. `analysis_provider_credentials` has at most one opaque session slot per Desktop device; there is no account pool, rotation, enable list or API fallback. Chapter-analysis runs store the adapter revision without provider tokens, OAuth state, email or profile paths. The previous V1–V7 revision was compared with the former V1–V15 chain on temporary PostgreSQL 16 and applied in focused PostgreSQL 18 checks. Those checks predate the current CLI-only/single-slot cleanup and do **not** verify the current migration files. No installed database upgrade path has been tested; audit its applied Flyway history before changing it. Chapter Analysis execution snapshots do not store story text. Runtime capability remains gated separately from the presence of these schema tables.

Continuity review reports, selective-regeneration plans, StoryBeat continuity JSON, and shard-based Chapter Analysis checkpoints were removed from the baseline because the current workflow has no writers or consumers for them. Character and canon context remains in the source/beat models used by prompt composition.

### Character visual profiles and reference slots (V1–V2)

`character_versions` stores `reference_policy`, an optional validated `visual_profile`, and optional same-character version lineage. Existing rows default to `LEGACY_IDENTITY_V1`; `MULTI_VIEW_V1` requires a typed profile. Reference-asset rows may store one of eight canonical face/body slots. Review and lock require the complete slot set. The active image/video executors still ignore these reference bytes, so persistence does not establish generation conditioning.

## Project Subtitle Preferences (V4)

`project_subtitle_settings` stores one validated settings object per Project, with a cascading Project foreign key. The backend validates position, preset, curated font, weight, normalized size/margins, six-digit colors and opacity. Absent rows resolve to the default appearance.

GET/PUT `/api/v1/projects/{projectId}/production/subtitle-settings` read/save preferences through Project access checks; archived Projects cannot be changed. Admission copies the validated request style into immutable `render_profile_json.subtitles.style`, independently of subsequent preference edits; legacy requests omitting style resolve saved preferences. Explicit style also participates in the render request fingerprint, so a reused key with changed style conflicts. Preferences are metadata only; Electron still owns media bytes and FFmpeg execution.

## Video-First Retention Production Schema (V1, V4)

The baseline contains the tables required for video-first, retention-driven production (`visual_beats` columns in V1; hook, retention, shot, take and reference tables in V4):

1. **`visual_beats` additions**:
   - `dramatic_intent` (VARCHAR(32), default `'SETUP'`): Dramatic function of the beat.
   - `retention_role` (VARCHAR(32)): Pacing/retention function (`HOOK`, `INCITING`, `ESCALATION`, `CLIMAX`, etc.).

2. **`hook_plans`**:
   - Pre-generation hook architecture for the opening 30 seconds of an episode.
   - Fields: `promise`, `conflict`, `curiosity_question`, `visual_hook`, `dialogue_hook`, `withheld_information`, and `payoff_beat_id` (FK to `visual_beats`).

3. **`retention_maps` & `attention_events`**:
   - `retention_maps`: Maintains the episode's `tension_curve_json`, `open_questions_json`, `resolved_questions_json`, and `pacing_warnings_json`.
   - `attention_events`: Tracks sensory and dramatic shifts (`event_type`, `time_offset_ms`, `description`, `severity`).

4. **`shot_sequences` & `shots`**:
   - `shot_sequences`: Container attaching 1..N shots to a dramatic `visual_beat_id`.
   - `shots`: The atomic unit for generation, GPU leasing, Video QA, and editing. Contains full kinetic specifications (`start_state_json`, `action_json`, `end_state_json`), camera plans (`composition_json`, `camera_json`), motions (`subject_motion_json`, `camera_motion_json`, `environment_motion_json`), `generation_strategy` (`TEXT_TO_VIDEO`, `IMAGE_TO_VIDEO`, etc.), and `status`.

5. **`takes` & `selected_takes`**:
   - `takes`: Immutable candidate generation attempts produced by video foundation models (LTX-2.5). Records generation metrics, `validation_status`, `validation_failure_category`, and targeted retry recommendations.
   - `selected_takes`: Decouples raw clip duration from the timeline edit. Stores `source_in_ms` and `source_out_ms` trim points for the approved take on each shot.

6. **`generation_references`**:
   - Stores auxiliary conditioning assets (`reference_type` in `CHARACTER_REFERENCE`, `LOCATION_REFERENCE`, `START_FRAME`, `END_FRAME`, `KEYFRAME`, `THUMBNAIL`, `POSTER`) attached to a shot with attention `weight`.

Post-publish audience analytics (`production_insights`) is retired from the current workflow.

## Removed from the baseline

Under the pre-production policy in [ADR-0002](../decisions/ADR-0002-system-topology-and-control-plane.md), items with no writer or consumer were removed from V1–V7 and from persistence, API and client contracts. This list replaces the former per-cleanup ADRs:

| Removed | Notes |
|---|---|
| `chapters.generation_progress` | Progress is derived from durable job and shot state |
| Scene `summary`, `mood`, `lighting`, `time_of_day` | Always null in responses |
| VisualBeat `emotion` | Visual direction remains in `visual_direction_json` |
| Project `metadata_language`, Location `reference_image_url` | Source/narration languages and asset reference models remain |
| `production_insights` | Post-publish analytics is outside the current workflow |
| Continuity review reports, continuity/selective-regeneration plan APIs, StoryBeat continuity JSON, shard-based analysis checkpoints | See ADR-0006 §11 |
| Duplicate unique constraint on `scenes.id` | The primary key is authoritative |
| `execution_mode` values other than `ANTIGRAVITY_CLI`; OAuth/API credential data | See ADR-0009 |

Kept on purpose: Scene's optional ProjectLocation link (prompt context; the composite FK uses `ON DELETE SET NULL (project_location_id)` so deleting a Location keeps the Scene's Project), `estimated_duration_ms`, Scene narration/duration, source anchors, and the hook-plan, retention-map and attention-event tables that analysis output populates.

These changes are folded into V1–V7. They provide no upgrade path for an already migrated installation and have not reset any installed database.

## Pre-Production Rewrite Rule

Until the first production deployment:

- The baseline is treated as a development contract optimized for final schema clarity.
- Schema modifications are folded directly into the owning migration: V1–V4 for the domains (V1 project/story/characters/voice, V2 generation and async compute orchestration, V3 narration and artifacts, V4 catalog, shot production, Chapter Analysis runtime, and render snapshots) and V5 for functions and triggers. All indexes belong to V6. V7 contains deterministic seed data.
- Do not create patch migrations that alter or drop schema introduced earlier in the same baseline.
- Recreate a development database only after its data has explicitly been confirmed disposable. Source inventory is not evidence that an installed database can be reset.
- Never place application test content or non-deterministic data in Flyway migrations.

## Post-Production Append-Only Rule

Immediately prior to the first production release, freeze the complete baseline present at that release. The current repository inventory is V1–V7; this does not establish the applied versions or freeze status of any installed database. From the freeze point forward:

- Applied migrations must never be modified or deleted.
- All future schema, index, backfill, and catalog changes must be append-only forward migrations after the last frozen version (**V8** if the current V1–V7 inventory is frozen).
- Forward migrations must preserve backward compatibility for active installations.

## Critical Schema Invariants

1. **Single-User Local-First (ADR-0001):**
   - No `auth_users`, `desktop_guest_installations`, `desktop_auth_handoffs`, application sessions, roles, or tenant IDs exist.
   - Project is the root business boundary.

2. **Non-Monetary Capacity Limits:**
   - Only CAPACITY and LONGFORM_EXPORT reservation kinds exist.
   - Standalone shot jobs use GPU_HEAVY/VIDEO_FIRST without a MediaPlan pointer; planned media/image jobs still require the complete MediaPlan pointer. Queue admission and the single active video execution slot are separate checks under the shared advisory lock.
   - No user credit balances, pricing tables, cost estimations, monetary ledger columns, or per-user quota state exist.

3. **Storyboard hierarchy:**
   - `scenes` contain ordered `story_beats`.
   - `audio_cues.story_beat_id` is required and ordered within its StoryBeat.
   - `visual_beats.story_beat_id` is nullable for legacy/manual compatibility rows; canonical new planning attaches VisualBeats to StoryBeats. The read model exposes unassigned rows through a compatibility container.
   - StoryBeat source ranges and VisualBeat source anchors remain source-text references, not a second audio clock.

4. **Local Project Media:**
   - Media assets belong to projects (`media_assets.project_id`).
   - Reusable voice references are managed locally (PROJECT or GLOBAL_LOCAL).
   - No absolute machine filesystem paths are persisted in PostgreSQL.
   - `final_artifacts` stores video metadata, checksums, and opaque project-relative artifact keys only. Electron owns durable media bytes; backend local-media capability endpoints may stage or serve authorized local files without making PostgreSQL a byte store.

5. **Compute event durability (ADR-0003):**
   - `generation_jobs` and compute attempts persist state, handles, sequence, callback metadata, and reconciliation fields.
   - `compute_event_receipts.event_id` is the idempotency key for signed worker events.
   - Receipt processing is monotonic by attempt sequence and terminal states are immutable.
   - Remote provider I/O is not performed inside the local receipt/finalization transaction; reconciliation queries the execution plane outside a database transaction and persists the observation in a short local transaction.
   - `compute_target_assignments` pins one opaque target ID and executor to each `(task_id, attempt_id)` before submit. Reconciliation and cancellation resolve that same target; machine credentials and base URLs are not stored with the assignment.

6. **Immutable Snapshots:**
   - `project_render_input_snapshots`, media plans and take input snapshots are immutable once written.
   - Take admission stores typed job/task/attempt/OperationPlan links and a frozen input snapshot/fingerprint; a trigger rejects changes to that identity or snapshot. PENDING takes have no fabricated source duration. V2 OperationPlans carry the shot scope and fingerprint. Take uniqueness (`uk_takes_shot_attempt`, `uk_takes_generation_job`, `uk_takes_compute_attempt`) is declared with the table in V4.
   - Project render admission requires a paired `assigned_local_device_id`; there is no server-side Chapter render or cloud render fallback.

## Verification Commands

Validate the Flyway migration baseline and PostgreSQL schema integrity:

```powershell
# From app/backend-service
./mvnw.cmd test -Dtest=FlywayBaselineStructureTest,PostgreSqlMigrationIntegrationTest
```
