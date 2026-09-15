# NarrativeX — Canonical Project Specification V1.12

**Status:** Canonical Project Specification
**Version:** `V1.12`
**Repository:** `huongni2201/NarrativeX`
**Last formal sync:** `2026-09-15`
**Supersedes:** `NARRATIVEX_PROJECT_SPEC_V1_11.md` and all prior project specifications.
**Docs-sync implementation checkpoint:** `main` at `b1457f38a169ccc59a5789c9f40207db275cc06f`

---

## 1. Product & Architecture Overview

NarrativeX is an AI-assisted story-to-video production studio.

### Core Principles

1. **Single-User & Local-First:** Designed as a single-operator studio running on Desktop. There is no application User, Account, Authentication, Authorization, Session, Tenant, or ownership identity model (ADR-0030).
2. **Desktop-Only Editor:** The Electron application (`app/desktop`) is the only supported editor client (ADR-0010). There is no browser editor or web client.
3. **Project-First & Chapter-First:** `Project` is the highest business boundary. Work progresses through Chapters, Scenes, and VisualBeats.
4. **Narration Master Clock:** Narration timing (TTS or user-provided audio) is the master timeline clock. VisualBeat timing is derived from source text ranges aligned with narration audio (ADR-0023).
5. **Separation of Control and Compute:**
   - `backend-service` (Spring Boot modular monolith) is the authoritative control plane for business state, admission, durable jobs, leases, and artifact metadata in PostgreSQL (ADR-0028).
   - `generation-service` (`app/generation-service`) is the domain-agnostic compute execution plane consuming closed tasks via the Compute Protocol (ADR-0028, ADR-0029).
   - `app/ai-worker` is temporary legacy migration residue scheduled for full removal after vertical-slice cutover.
6. **Local Project Media:** Generated images, narration, imported media, project voice references, render cache, and final MP4 files are stored in Desktop local project storage (`ProjectStorage`) (ADR-0012). The backend stores stable metadata and relative artifact keys, never host filesystem paths or final video bytes.
7. **System & Runtime Limits:** Non-monetary capacity limits and export reservations protect compute resources. Monetary billing, user credit balances, and per-user quotas are completely retired.

---

## 2. System Topology

```text
+-------------------------------------------------------------+
|                      Electron Desktop                       |
|  - React Renderer (UI, routes, query state, timeline draft) |
|  - Typed Preload Capability Bridge                          |
|  - Main Process (native files, ProjectStorage, FFmpeg)      |
+------------------------------+------------------------------+
                               |
                               | HTTP / REST + SSE
                               v
+-------------------------------------------------------------+
|                 Spring Boot backend-service                 |
|  - Domain aggregates (Project, Chapter, Storyboard, Asset)  |
|  - Admission, durable jobs, leases, state CAS               |
|  - PostgreSQL (sole business and control plane store)       |
+------------------------------+------------------------------+
                               |
                               | Compute Protocol v1 (HTTP)
                               v
+-------------------------------------------------------------+
|             generation-service (execution plane)            |
|  - Hexagonal architecture + SQLite execution journal        |
|  - Zero NarrativeX database or domain knowledge             |
|  - Executor adapters: VoiceStudio, WhisperX, ComfyUI, etc.  |
+-------------------------------------------------------------+
```

### Migration Context

- **Legacy AI Worker (`app/ai-worker`):** Continues direct PostgreSQL polling temporarily during migration. Once narration, image generation, and validation slices cut over to `generation-service`, `app/ai-worker` will be removed.

---

## 3. Persistence Boundaries

| Store | Responsibility | Scope |
|---|---|---|
| **PostgreSQL** | Business state, project metadata, storyboard structure, durable generation jobs, stage attempts, provider operations, artifact metadata, Flyway schema (V1–V7). | Control plane authority |
| **Desktop `ProjectStorage`** | Project manifest (`project.manifest.json`), media files (images, audio, video), render work cache, local final MP4 exports. | Local machine (`<userData>/projects/`) |
| **generation-service SQLite** | Local execution journal (`.runtime/execution_journal.sqlite3`) for submission checkpoints and crash recovery. | Local compute journal only |

### Cloud Storage (R2) Transition

In the single-user architecture (ADR-0030), Cloudflare R2 is no longer used for account-scoped voice assets. Project voice references live in `ProjectStorage` (`PROJECT` scope), while reusable voice profiles live in the local application voice library (`GLOBAL_LOCAL` scope). R2 remains an optional provider transport only where remote execution environments explicitly require remote byte access.

---

## 4. Identity & Access

Per **ADR-0030**, the following concepts are **REMOVED** from the product and runtime architecture:

- No `User`, `Account`, `Tenant`, `ownerId`, `userId`, or `accountId` in domain models.
- No `ROLE_USER`, `ROLE_GUEST`, or Spring Security authentication filter chains.
- No `NX_SESSION` or Spring Session JDBC tables.
- No Google OAuth / OIDC sign-in or login modals.
- No guest installation credentials or guest ownership transfer.
- No CSRF token handshakes for product endpoints.
- No monetary billing, user pricing catalogs, credits, or per-user quotas.

The Desktop client starts directly into the project workspace. External AI provider API keys or machine execution credentials are local runtime configurations, not user identities.

---

## 5. Domain Model & Hierarchy

```text
Project
  -> StoryVersion
      -> Chapter
          -> Scene
              -> VisualBeat
                  -> source_anchor (UTF-16 text ranges)
                  -> visual_direction_json (camera, composition, mood)
                  -> preview_media_asset_id (default preview)
                  -> selected MediaAsset (effective production choice)
```

### Reusable Entities

- `Character` -> `CharacterVersion` (immutable snapshots)
- `ProjectCharacter` (project participation)
- `ProjectLocation`

### Production Hierarchy & Planning

- **Chapter → Scene → VisualBeat:** `VisualBeat` is the atomic unit of the production timeline.
- **Narration Timeline:** TTS (VoiceStudio) or `USER_PROVIDED_AUDIO` establishes the production master clock.
- **Timing Resolution:** `NarrationTextClockMapper` maps VisualBeat source ranges through WhisperX forced-alignment timestamps to generate accurate timeline offsets.
- **Visual Intent:** `VisualGenerationMode` supports `IMAGE` (default) and `VIDEO` (browser/external workflows). Video beats utilize trim/fill duration semantics.

---

## 6. Compute Execution Plane & Lifecycle

`app/generation-service` operates under **ADR-0028**, **ADR-0029**, and **ADR-0031**:

1. **Protocol:** Tasks are submitted via `POST /v1/tasks/submit` with closed schemas defined in `contracts/compute/v1/`.
2. **Isolation:** The compute service has zero access to the NarrativeX business database, project filesystem, or business entity identifiers.
3. **Durable Checkpointing:** The execution journal records submission states:
   - `NOT_SUBMITTED`
   - `SUBMITTING`
   - `SUBMITTED`
   - `UNKNOWN`
   Reconciliation occurs before any retry; blind resubmission to external engines is strictly forbidden.
4. **Artifact Transport:** Input and output artifacts use opaque, time-limited capabilities with SHA-256 integrity verification.

---

## 7. Database Baseline (Flyway)

The schema baseline under `app/backend-service/src/main/resources/db/migration` is clean and squashed into **V1 through V7**:

- `V1__project_story_and_planning.sql`
- `V2__generation_and_media.sql`
- `V3__narration_and_artifacts.sql`
- `V4__catalog_generation_and_render_snapshots.sql`
- `V5__database_logic_and_triggers.sql`
- `V6__indexes.sql`
- `V7__seed_catalog.sql`

There are no obsolete identity migrations (`V1__identity_and_access.sql`), no `V8` in the pre-production baseline, and no V9+ upgrade patch chains. Post-release schema evolutions will append starting at V8.

---

## 8. Final Render Contract

Final video rendering is strictly local-first:

1. The backend admits a project render job and creates an immutable render snapshot.
2. The paired Desktop device claims the lease.
3. Electron Main verifies local asset integrity against `project.manifest.json`.
4. Electron Main executes FFmpeg/ffprobe locally with hardware acceleration where available.
5. The resulting MP4 is committed to `<project>/artifacts/<jobId>/final.mp4`.
6. Electron Main reports completion to the backend; the backend records `FinalArtifact` metadata only.
7. There is no cloud render executor or remote final video storage.
