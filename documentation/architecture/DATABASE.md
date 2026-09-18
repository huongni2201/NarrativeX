# NarrativeX Database Architecture and Baseline Policy

**Status:** maintained database contract  
**Authority:** Spring Boot backend Flyway migrations (V1–V7)

## PostgreSQL Authority and Flyway Ownership

PostgreSQL is the single authoritative store for business state, admission control, durable generation jobs, device leases, and artifact metadata. The Spring Boot backend owns Flyway and manages the relational schema. pp/generation-service and Electron Desktop have zero direct access to PostgreSQL.

## Current Canonical Baseline (V1–V7)

NarrativeX maintains a clean, squashed pre-production baseline. A fresh database applies exactly seven responsibility-separated migrations:

| Migration | Responsibility |
|---|---|
| V1__project_story_and_planning.sql | Projects, Stories, Chapters, Storyboard, Characters, Scenes, VisualBeats, and planning entities |
| V2__generation_and_media.sql | Generation jobs, Stage attempts, Provider operations, Media assets, and voice-reference assets |
| V3__narration_and_artifacts.sql | Narration and alignment contracts, local device render leases, final artifact metadata |
| V4__catalog_generation_and_render_snapshots.sql | Catalogs, upload lifecycle, media lineage, continuity plans, regeneration plans, immutable render snapshots |
| V5__database_logic_and_triggers.sql | Immutability guards, database functions, and generation event triggers |
| V6__indexes.sql | All access-path, covering, partial, and unique indexes |
| V7__seed_catalog.sql | Deterministic system and catalog seed data only |

A clean database applies **V1 through V7** directly. There are no obsolete patch migrations (former V9+ patches were squashed into the baseline).

## Pre-Production Rewrite Rule

Until the first production deployment:
- The baseline is treated as a development contract optimized for final schema clarity.
- Schema modifications are folded directly into the owning domain migration (V1–V5), indexes into V6, and deterministic seed data into V7.
- Do not create patch migrations that alter or drop schema introduced earlier in the same baseline.
- When the baseline changes, development and test databases are recreated from scratch.
- Never place application test content or non-deterministic data in Flyway migrations.

## Post-Production Append-Only Rule

Immediately prior to the first production release, the V1–V7 baseline is frozen and made immutable. From that point forward:
- Applied migrations must never be modified or deleted.
- All future schema, index, backfill, and catalog changes must be append-only forward migrations starting at **V8**.
- Forward migrations must preserve backward compatibility for active installations.

## Critical Schema Invariants

1. **Single-User Local-First (ADR-0030)**:
   - No uth_users, desktop_guest_installations, desktop_auth_handoffs, sessions, roles, or tenant IDs exist.
   - Project is the root business boundary.

2. **Non-Monetary Capacity Quotas**:
   - Only CAPACITY and LONGFORM_EXPORT reservation kinds exist.
   - No user credit balances, pricing tables, cost estimations, or monetary ledger columns.

3. **Local Project Media**:
   - Media assets belong to projects (media_assets.project_id).
   - Reusable voice references are managed locally (PROJECT or GLOBAL_LOCAL).
   - No absolute machine filesystem paths are persisted in PostgreSQL.
   - inal_artifacts stores video metadata, checksums, and opaque project-relative artifact keys only; backend never proxies or stores video bytes.

4. **VisualBeat Timing and Direction**:
   - isual_beats stores source-text anchors (	ext_start, 	ext_end), not duplicate audio timestamps. Runtime beat clocks are computed dynamically from narration alignment via NarrationTextClockMapper.
   - isual_direction_json is the sole persisted representation for camera and visual composition.

5. **Immutable Snapshots**:
   - project_render_input_snapshots, chapter_continuity_plans, and 
egeneration_plans are immutable once written.
   - Project render admission requires a paired ssigned_local_device_id; there is no server-side Chapter render or cloud render fallback.

## Verification Commands

Validate the Flyway migration baseline and PostgreSQL schema integrity:

`powershell
# From app/backend-service
./mvnw.cmd test -Dtest=FlywayBaselineStructureTest,PostgreSqlMigrationIntegrationTest
`
