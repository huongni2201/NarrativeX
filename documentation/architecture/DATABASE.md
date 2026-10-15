# NarrativeX Database Architecture and Baseline Policy

**Status:** maintained database contract  
**Authority:** Spring Boot backend Flyway migrations (current worktree inventory V1–V7), integration tests, and active ADRs (ADR-0020, ADR-0021, ADR-0025, ADR-0026 to ADR-0032)

## PostgreSQL Authority and Flyway Ownership

PostgreSQL is the single authoritative store for business state, admission control, durable generation jobs, device leases, and artifact metadata. The Spring Boot backend owns Flyway and manages the relational schema. `app/generation-service` and Electron Desktop have zero direct access to PostgreSQL.

## Current Migration Inventory (V1–V7)

The pre-production baseline is squashed into seven responsibility-separated migrations. The former incremental files V8–V15 (async compute orchestration, video-first production, character voice profiles, native render cuts, subtitle settings, Chapter Analysis local execution, prompt settings, and the Antigravity OAuth execution mode) are folded into the owning V1–V7 files; their final-state schema is unchanged. This inventory does not establish which versions are applied to an installed database or declare any runtime capability complete.

| Migration | Responsibility |
|---|---|
| V1__project_story_and_planning.sql | Projects, StoryVersions, Chapters, Scenes, StoryBeats, AudioCues, VisualBeats (dramatic intent and retention role), Characters with typed visual profiles/reference policies, character voice profiles and pinned voice pointers, and media plans |
| V2__generation_and_media.sql | Generation jobs (including async compute attempt handles, callback metadata and reconciliation state), Stage attempts, Provider operations, compute event receipts and target assignments, Media assets, and canonical character-reference slots |
| V3__narration_and_artifacts.sql | Narration and alignment contracts, local device render leases, and final artifact metadata |
| V4__catalog_generation_and_render_snapshots.sql | Catalogs, upload lifecycle, video-first shot production (hook plans, retention maps, shots, takes), media lineage, continuity plans, local devices, Chapter Analysis runtime (settings, redacted provider credentials, immutable execution and prompt snapshots, fenced attempts, usage/provenance), regeneration plans, immutable render snapshots including native take cuts, and project subtitle settings ([ADR-0035](../decisions/ADR-0035-installation-wide-prompt-settings.md), Proposed) |
| V5__database_logic_and_triggers.sql | Immutability guards (media plans, lineage, continuity, takes, analysis snapshots), database functions, and generation event triggers |
| V6__indexes.sql | Access-path, covering, partial, and unique indexes for every table, including compute orchestration and Chapter Analysis runtime |
| V7__seed_catalog.sql | Deterministic system and catalog seed data only, including the singleton Chapter Analysis runtime configuration row |

A clean database applies the current **V1 through V7** inventory. The squash was verified only against a temporary PostgreSQL 16 server with a stand-in `uuidv7()` function, by comparing columns, constraints, indexes, triggers, functions, comments, sequences, and seed rows with the former V1–V15 chain; it has not been run against the project PostgreSQL 18 target or Flyway. Data fix-ups that only mattered to databases migrated through the former V15 (retiring CLI credential rows and resetting `ANTIGRAVITY_CLI` runtime mode) are not carried over because a clean database never contains such rows. Chapter Analysis execution snapshots do not store provider tokens, operating-system profile paths, or story text. Runtime capability remains gated separately from the presence of these schema tables.

### Character visual profiles and reference slots (V1–V2)

`character_versions` stores `reference_policy`, an optional validated `visual_profile`, and optional same-character version lineage. Existing rows default to `LEGACY_IDENTITY_V1`; `MULTI_VIEW_V1` requires a typed profile. Reference-asset rows may store one of eight canonical face/body slots. Review and lock require the complete slot set. The active image/video executors still ignore these reference bytes, so persistence does not establish generation conditioning.

## Project Subtitle Preferences (V12)

`project_subtitle_settings` stores one validated settings object per Project, with a cascading Project foreign key. The backend validates position, preset, curated font, weight, normalized size/margins, six-digit colors and opacity. Absent rows resolve to the default appearance.

GET/PUT `/api/v1/projects/{projectId}/production/subtitle-settings` read/save preferences through Project access checks; archived Projects cannot be changed. Admission copies the validated request style into immutable `render_profile_json.subtitles.style`, independently of subsequent preference edits; legacy requests omitting style resolve saved preferences. Explicit style also participates in the render request fingerprint, so a reused key with changed style conflicts. Preferences are metadata only; Electron still owns media bytes and FFmpeg execution.

## Video-First Retention Production Schema (V9)

Migration V9 introduces the tables required for video-first, retention-driven production:

1. **`visual_beats` additions**:
   - `dramatic_intent` (VARCHAR(32), default `'SETUP'`): Dramatic function of the beat.
   - `emotion` (VARCHAR(64)): Dominant emotional valence.
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

7. **`production_insights`**:
   - Stores post-publish audience retention observations (`observation_json`, `recommendation_text`) for continuous narrative tuning.

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

1. **Single-User Local-First (ADR-0020):**
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

5. **Compute event durability (ADR-0025):**
   - `generation_jobs` and compute attempts persist state, handles, sequence, callback metadata, and reconciliation fields.
   - `compute_event_receipts.event_id` is the idempotency key for signed worker events.
   - Receipt processing is monotonic by attempt sequence and terminal states are immutable.
   - Remote provider I/O is not performed inside the local receipt/finalization transaction; reconciliation queries the execution plane outside a database transaction and persists the observation in a short local transaction.
   - `compute_target_assignments` pins one opaque target ID and executor to each `(task_id, attempt_id)` before submit. Reconciliation and cancellation resolve that same target; machine credentials and base URLs are not stored with the assignment.

6. **Immutable Snapshots:**
   - `project_render_input_snapshots`, `chapter_continuity_plans`, and `regeneration_plans` are immutable once written.
   - V9 Take admission stores typed job/task/attempt/OperationPlan links and a frozen input snapshot/fingerprint; a trigger rejects changes to that identity or snapshot. PENDING takes have no fabricated source duration. V2 OperationPlans carry the shot scope and fingerprint. V9 owns Take unique constraints (and their PostgreSQL indexes) because V6 runs before the Take table exists.
   - Project render admission requires a paired `assigned_local_device_id`; there is no server-side Chapter render or cloud render fallback.

## Verification Commands

Validate the Flyway migration baseline and PostgreSQL schema integrity:

```powershell
# From app/backend-service
./mvnw.cmd test -Dtest=FlywayBaselineStructureTest,PostgreSqlMigrationIntegrationTest
```
