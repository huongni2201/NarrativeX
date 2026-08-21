# NarrativeX Database Baseline V1.11

## Authority and validation

- PostgreSQL is the authoritative business-state store.
- Redis is not authoritative GenerationJob state; it is used for sessions and non-authoritative delivery/progress hints.
- Backend is the Flyway/schema owner.
- `spring.jpa.hibernate.ddl-auto=validate` protects runtime schema drift outside test profiles.
- PostgreSQL + Flyway is the release schema gate.

## Flyway migration matrix

| Migration | Purpose | Current state |
|---|---|---|
| V1 `initial_schema` | Auth, project/story/chapter foundations, storyboard revisions, split motion/camera visual beats, character/location AI identities, backend-authoritative media plans, generation execution pipeline, durable provider operations, quota reservation lifecycle, chapter-level TTS and multi-part uploaded narration pipeline | Consolidated baseline |
| V2 `seed_demo_data` | Deterministic development/demo seed with canonical execution enums, storyboard revisions, character bibles, plan assignments and valid credits | Development only |
| V3 `drop_deprecated_expensive_jobs_active` | Removes the unused `usage_windows.expensive_jobs_active` projection; active expensive jobs are derived from `quota_reservations` rows with `RESERVED` status | Forward-only cleanup |

The migration set starts with the V1/V2 baseline (schema plus development seed), followed by forward-only cleanup migrations for databases that already applied that baseline.

The V2 fixture covers every V1 table. In addition to the core project/story
rows, it includes scene and visual-beat continuity links, AI identity mappings,
favorites, media plans, quota reservations, TTS requests/assets/alignments,
uploaded narration sets/parts/documents/alignment runs, render manifests and
final artifacts. Seed statements use explicit column lists and provide all
non-default required columns.

## Entity/schema matrix

| Domain | Table | Status | Notes |
|---|---|---|---|
| Project | `projects` | IMPLEMENTED | ownership, active query index and cursor pagination foundation |
| StoryVersion | `story_versions` | IMPLEMENTED FOUNDATION | version/source boundary |
| Chapter | `chapters` | IMPLEMENTED FOUNDATION | sourceText/sourceHash/rowVersion contract |
| StoryboardRevision | `storyboard_revisions` | IMPLEMENTED | immutable revision boundary for safe re-analysis |
| Scene | `scenes` | IMPLEMENTED FOUNDATION | storyboard scene persistence, location association |
| SceneCharacter | `scene_characters` | IMPLEMENTED | ordered scene-to-character continuity associations |
| VisualBeat | `visual_beats` | IMPLEMENTED FOUNDATION | motion/camera split |
| VisualBeatCharacter | `visual_beat_characters` | IMPLEMENTED | ordered beat-to-character continuity |
| MediaPlan | `media_plans` / `media_scene_plans` / `media_beat_plans` | IMPLEMENTED | backend-authoritative execution and cost plan |
| ProjectFavorite | `project_favorites` | IMPLEMENTED | per-user dashboard favorites |
| GenerationJob | `generation_jobs` | IMPLEMENTED FOUNDATION | durable async execution state with plan & revision pinning |
| StageAttempt | `stage_attempts` | IMPLEMENTED FOUNDATION | lease/attempt model with heartbeat claims |
| ProviderOperation | `provider_operations` | IMPLEMENTED SQL-FIRST SLICE | durable provider boundary, CAS lifecycle, reconciliation, billing evidence & result fingerprint |
| OperationPlan | `operation_plans` | IMPLEMENTED MVP FOUNDATION | estimate/cap/admission link |
| QuotaReservation | `quota_reservations` / `usage_windows` | IMPLEMENTED | atomic admission reservation and terminal provider cost settlement |
| Narration (TTS) | `narration_requests` / `narration_operations` / `narration_assets` / `narration_alignments` | IMPLEMENTED FOUNDATION | immutable full-chapter TTS snapshots and segment alignment |
| Narration (Upload) | `media_assets` / `narration_sets` / `narration_parts` / `narration_documents` / `narration_alignment_runs` | IMPLEMENTED FOUNDATION | multi-part logical narration upload pipeline & alignment cache |
| Character & Identity | `characters` / `character_versions` / `outfit_versions` / `character_appearances` / `project_characters` / `project_character_ai_identities` | IMPLEMENTED FOUNDATION | reusable character identity, appearance timelines & AI continuity matching |
| Location | `project_locations` / `project_location_ai_identities` | IMPLEMENTED FOUNDATION | project locations and AI continuity key mapping |
| Render artifact | `render_manifests` / `final_artifacts` | IMPLEMENTED | immutable render inputs and durable output metadata |

## Durable execution persistence

The persisted execution contract is documented in
[`ADR-0008`](../decisions/ADR-0008-durable-provider-operations-and-execution-lifecycle.md).
Java and Python mirrors must be updated with every new persisted execution
value. Canonical execution values and bounds are validated via PostgreSQL CHECK constraints in V1.

The database contract for expensive work is:

```text
OperationPlan
      |
      v
GenerationJob
      |
      v
StageAttempt
      |
      v
ProviderOperation
```

Before an external AI provider request:

```text
create ProviderOperation
      -> persist RESERVED
      -> submit external request
      -> update SUBMITTED/RUNNING
      -> COMPLETE / FAILED / UNKNOWN
```

`UNKNOWN` exists because a worker crash or network ambiguity can happen after provider acceptance but before local completion persistence. The system must reconcile before resubmission.

## Storyboard and continuity schema boundary

Current persisted output:

```text
StoryVersion
   |
Chapter
   |
Scene
   |
VisualBeat
```

AI-returned locations and scene-to-character continuity are materialized as
explicit durable relations. Character names must not be used as historical
continuity keys.

## Optimistic concurrency

Mutable entities use row version protection:

- JPA `@Version` protects persistence writes.
- Domain adapters compare expected row version before applying detached changes.
- The ProviderOperation MyBatis adapter enforces allowed status plus expected `row_version` in SQL; zero affected rows are conflicts.
- Public mutable APIs should expose ETag / `If-Match` semantics.
- Stale writes must return conflict, not last-write-wins.

## Project query performance contract

Active project list uses keyset pagination:

```sql
WHERE owner_id = ?
AND archived_at IS NULL
AND (
 updated_at < ?
 OR (updated_at = ? AND id < ?)
)
ORDER BY updated_at DESC, id DESC
```

Recommended access path:

```sql
CREATE INDEX idx_projects_active_owner_updated_id
ON projects(owner_id, updated_at DESC, id DESC)
WHERE archived_at IS NULL;
```

The partial predicate avoids archived rows polluting the common active-project path.

## Remaining database work

1. Add full billing ledger, actual provider usage and reservation release accounting.
2. Add complete deletion/retention lifecycle schema and backup verification.
3. Add indexes from measured production query plans instead of speculative indexing.

## Schema verification gate

For schema PRs:

1. Apply all migrations on an empty supported PostgreSQL instance.
2. Start backend with Hibernate validate.
3. Run backend verification suite.
4. Verify stale-version behavior.
5. Verify query plans for keyset pagination with representative data.
6. Do not use H2-only success as PostgreSQL compatibility evidence.
