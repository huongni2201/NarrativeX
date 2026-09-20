# NarrativeX Database Architecture and Baseline Policy

**Status:** maintained database contract  
**Authority:** Spring Boot backend Flyway migrations (V1–V8), integration tests, and active ADRs (ADR-0020, ADR-0021, ADR-0025)

## PostgreSQL Authority and Flyway Ownership

PostgreSQL is the single authoritative store for business state, admission control, durable generation jobs, device leases, and artifact metadata. The Spring Boot backend owns Flyway and manages the relational schema. `app/generation-service` and Electron Desktop have zero direct access to PostgreSQL.

## Current Canonical Baseline (V1–V8)

NarrativeX maintains a clean, squashed pre-production baseline. A fresh database applies exactly eight responsibility-separated migrations:

| Migration | Responsibility |
|---|---|
| V1__project_story_and_planning.sql | Projects, StoryVersions, Chapters, Scenes, StoryBeats, AudioCues, VisualBeats, Characters, and planning entities |
| V2__generation_and_media.sql | Generation jobs, Stage attempts, Provider operations, Media assets, and voice-reference assets |
| V3__narration_and_artifacts.sql | Narration and alignment contracts, local device render leases, and final artifact metadata |
| V4__catalog_generation_and_render_snapshots.sql | Catalogs, upload lifecycle, media lineage, continuity plans, regeneration plans, and immutable render snapshots |
| V5__database_logic_and_triggers.sql | Immutability guards, database functions, and generation event triggers |
| V6__indexes.sql | Access-path, covering, partial, and unique indexes |
| V7__seed_catalog.sql | Deterministic system and catalog seed data only |
| V8__generation_async_orchestration.sql | Compute attempt handles, callback metadata, event receipts, and reconciliation indexes |

A clean database applies **V1 through V8** directly. There are no obsolete patch migrations; former patch work was folded into the baseline.

## Pre-Production Rewrite Rule

Until the first production deployment:

- The baseline is treated as a development contract optimized for final schema clarity.
- Schema modifications are folded directly into the owning domain migration (V1–V5), indexes into V6, deterministic seed data into V7, and asynchronous orchestration schema into V8.
- Do not create patch migrations that alter or drop schema introduced earlier in the same baseline.
- When the baseline changes, development and test databases are recreated from scratch.
- Never place application test content or non-deterministic data in Flyway migrations.

## Post-Production Append-Only Rule

Immediately prior to the first production release, the V1–V8 baseline is frozen and made immutable. From that point forward:

- Applied migrations must never be modified or deleted.
- All future schema, index, backfill, and catalog changes must be append-only forward migrations starting at **V9**.
- Forward migrations must preserve backward compatibility for active installations.

## Critical Schema Invariants

1. **Single-User Local-First (ADR-0020):**
   - No `auth_users`, `desktop_guest_installations`, `desktop_auth_handoffs`, application sessions, roles, or tenant IDs exist.
   - Project is the root business boundary.

2. **Non-Monetary Capacity Limits:**
   - Only CAPACITY and LONGFORM_EXPORT reservation kinds exist.
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

6. **Immutable Snapshots:**
   - `project_render_input_snapshots`, `chapter_continuity_plans`, and `regeneration_plans` are immutable once written.
   - Project render admission requires a paired `assigned_local_device_id`; there is no server-side Chapter render or cloud render fallback.

## Verification Commands

Validate the Flyway migration baseline and PostgreSQL schema integrity:

```powershell
# From app/backend-service
./mvnw.cmd test -Dtest=FlywayBaselineStructureTest,PostgreSqlMigrationIntegrationTest
```
