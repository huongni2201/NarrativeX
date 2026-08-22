# ADR-0002: Storyboard aggregate, character continuity, motion models and production workflows

- Status: Accepted
- Date: 2026-08-18 (consolidated and updated: 2026-08-22)
- Scope: Chapter-first workflows, storyboard aggregate boundaries, revision lifecycle, character continuity identities, motion rendering models, and translation lineage.
- Consolidated from: former ADR-0002, ADR-0005, ADR-0007, ADR-0009, and ADR-0014.

## Context

NarrativeX processes long-form stories incrementally. A user may create or edit a chapter, translate text, modify visual prompts, or adjust camera movements without invalidating unrelated chapters or destroying already approved visual assets. 

Treating an entire story or chapter as a single monolithic aggregate leads to heavy lock contention and makes non-destructive revisioning difficult. Furthermore, character identity must remain reusable across multiple projects without cloning, while visual planning must separate camera movements from generative AI video execution to guarantee sustainable unit economics.

---

## Decision

### 1. Chapter-First Workflow & Route Boundaries

- **Metadata-Only Project Creation:** Creating a project (`POST /api/v1/projects`) persists metadata only. It never implicitly initiates AI analysis or media rendering.
- **Chapter as Durable Execution Scope:** The chapter is the primary execution unit for analysis, translation, visual beat planning, narration, and rendering.
- **URL Route Hierarchy:**
  ```text
  /projects/[projectId]
  /projects/[projectId]/chapters/[chapterId]
  /projects/[projectId]/chapters/[chapterId]/storyboard
  /projects/[projectId]/chapters/[chapterId]/visuals
  /projects/[projectId]/chapters/[chapterId]/audio
  /projects/[projectId]/chapters/[chapterId]/render
  ```
- **Affected Scope Resolution:** Editing a chapter resolves an `AffectedScope` beforehand. Unaffected scenes and previously rendered assets remain reusable.

### 2. Immutable Chapter Content Variants & Translation Lineage

- **Original Content Variants:** Every chapter text save creates an immutable `ORIGINAL` variant in `chapter_content_variants`. The `chapters.source_text` and `chapters.source_hash` columns act as the active pointer.
- **Translation Variants:** Translations are stored as `TRANSLATION` variants linked to their source variant via `source_variant_id` and `source_content_hash`. If the original text changes, existing translation variants become `STALE`.
- **Language Detection:** Local deterministic language detection classifies inputs into `language_detections`. Confirmed language mismatches create a `CHAPTER_TRANSLATE` job with dedicated chunk-level provider fencing.

### 3. Reusable Character Identity & Project Assignments

- **Reusable `Character` Aggregate:** Owned at the user or workspace level. Projects reference the character without duplicating or cloning its identity.
- **`ProjectCharacter` Assignment:** Models a character's project-specific role, importance, aliases, story metadata, and group assignments.
- **Immutable `CharacterVersion` Snapshots:** Stores the locked visual Bible, master prompt, and reference assets. AI generation tasks bind to an immutable version snapshot.
- **`CharacterAppearance` and `OutfitVersion`:** Temporal visual changes (wardrobe, hairstyle, aging, injuries) belong to appearances and outfits rather than creating new character identities.

### 4. Storyboard Aggregate Boundaries & Revision Lifecycle

- **Independent Aggregate Roots:** `Chapter` and `Scene` are independent `AggregateRoots` to allow concurrent scene updates. `VisualBeat` is an entity owned by `Scene`.
- **Durable `storyboard_revisions`:**
  - Chapter analysis materializes scenes and visual beats into a new `DRAFT` storyboard revision.
  - Upon successful analysis completion, `chapters.current_storyboard_revision_id` atomically switches to the new revision in PostgreSQL.
  - If analysis or materialization fails, the previously active revision remains untouched.
  - **Preservation of Approved Work:** Approved visual beats in older revisions are never deleted.
- **Pre-Lock Ownership Authorization:** Before acquiring the chapter-scoped advisory transaction lock (`pg_advisory_xact_lock`), the backend verifies project ownership (`project.owner_id == user_id`) to prevent unauthorized cross-tenant lock contention.

### 5. VisualBeat Motion Model & Production Modes

- **Decoupled Motion Properties:**
  - **`motion_mode` (Rendering Strategy):** `STILL`, `BASIC_MOTION`, `AI_VIDEO`.
  - **`camera_movement` (Camera Direction):** `NONE`, `PAN`, `TILT`, `PUSH_IN`, `PULL_OUT`, `TRACK`, `ZOOM_IN`, `ZOOM_OUT`, `PARALLAX`.
  - **`review_status`:** `NEEDS_REVIEW`, `APPROVED`.
- **Production Modes:**
  - **`IMAGE_MOTION`:** Deterministic keyframe motion (pan/zoom/tilt) via FFmpeg. Generative I2V is never invoked.
  - **`HYBRID_LOCAL_I2V`:** Image-first baseline. Simple beats use basic motion; medium/complex beats are routed to a self-hosted local generative I2V model (e.g. Wan2.2) when authorized by budget.
- **Asset Planning Priority:** When planning visual beats, the planner resolves assets in priority order:
  1. `REUSE_APPROVED` -> 2. `REFRAME_DERIVED` -> 3. `EDIT_EXISTING` -> 4. `GENERATE_NEW`.

### 6. Two-Command Media Pipeline & Review Separation

1. **`CHAPTER_GENERATE`:** Generates keyframes for approved `VisualBeat` entities within an immutable `MediaPlan` revision. Items are tracked in `media_generation_items`.
2. **`CHAPTER_RENDER`:** Admitted only after all required visual items are explicitly `APPROVED` and narration is `READY`. Produces an immutable `render_manifests` record and final video artifact.

---

## Invariants

1. `Chapter` and `Scene` are independent aggregate roots; scenes reference chapters by scalar IDs.
2. Character identities are never cloned across projects; project participation is modeled via `ProjectCharacter`.
3. Materialization of new storyboard revisions never overwrites or deletes approved scenes in prior revisions.
4. All chapter mutations and analysis admissions verify project ownership before acquiring PostgreSQL advisory locks.
5. In `IMAGE_MOTION` mode, no generative I2V provider calls are initiated.
6. Image generation never implicitly triggers video rendering; human review and explicit render admission are required.

---

## Consequences

- Authors can safely edit chapters and re-run story analysis without losing previously approved visual work.
- Long-form video generation remains economically viable by combining deterministic keyframe motion with selective generative AI video.
- Deep linking and browser navigation maintain consistent project/chapter context without depending on client-side state.
