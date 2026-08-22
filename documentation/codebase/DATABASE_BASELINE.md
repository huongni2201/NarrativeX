# NarrativeX Database Baseline V1.11

## Authority and validation

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
| V1 `initial_schema` | Auth, project/story/chapter foundations, storyboard revisions, split motion/camera visual beats, preview-asset links, character/location AI identities, backend-authoritative media plans, generation execution/review and lineage, durable provider operations, quota reservation lifecycle, chapter-level TTS, uploaded narration, upload sessions, media lifecycle hardening, durable media validation jobs, detected media metadata, style presets and voice catalog, render ownership pins, owner-scoped idempotency, voice reference asset, cleanup tasks | Consolidated baseline |
| V2 `seed_demo_data` | Deterministic development/demo seed with canonical execution enums, storyboard revisions, character bibles, plan assignments, released reservations, VieNeu catalog, and valid credits | Local profile only |
| V3 `canonical_media_asset_checksums` | Account-scoped canonical checksum claims, legacy READY backfill, removal of the partial asset checksum index, and `VALIDATING` upload sessions | Production migration |
| V4 `media_validation_lease_fencing` | Token-fenced media-validation claims, row versions, and state/lease consistency | Production migration |
| V5 `provision_default_user_plans` | Creates the default `NORMAL v1` active plan assignment for existing accounts that do not already have an assignment | Production migration |

The production migration set is V1 plus V3 and V4. V2 is an opt-in local-profile fixture under
`db/local-migration`, not a production migration.
Former feature and fixture migrations were folded into V1 and V2 because this is the development baseline.
Existing databases created from any former migration split require operator-reviewed recreation or explicit re-baselining.

The local V2 fixture covers all supported demo paths. In addition to the core
project/story rows, it includes scene and visual-beat continuity links, AI
identity mappings, favorites, media plans, quota reservations, TTS
requests/assets/alignments, uploaded narration sets/parts/documents/alignment
runs, render manifests, final artifacts, and catalog entries. Seed statements
use explicit column lists and provide valid values for every non-default
required column used by a fixture.

## Entity/schema matrix

| Domain | Table | Status | Notes |
|---|---|---|---|
| Project | `projects` | IMPLEMENTED | ownership, active query index and cursor pagination foundation |
| StoryVersion | `story_versions` | IMPLEMENTED FOUNDATION | version/source boundary |
| Chapter | `chapters` | IMPLEMENTED FOUNDATION | sourceText/sourceHash/rowVersion contract |
| StoryboardRevision | `storyboard_revisions` | IMPLEMENTED | immutable revision boundary for safe re-analysis |
| Scene | `scenes` | IMPLEMENTED FOUNDATION | storyboard scene persistence, location association |
| SceneCharacter | `scene_characters` | IMPLEMENTED | ordered scene-to-character continuity associations |
| VisualBeat | `visual_beats` | IMPLEMENTED FOUNDATION | motion/camera split and nullable project-asset preview link |
| VisualBeatCharacter | `visual_beat_characters` | IMPLEMENTED | ordered beat-to-character continuity |
| MediaPlan | `media_plans` / `media_scene_plans` / `media_beat_plans` | IMPLEMENTED | backend-authoritative execution and cost plan |
| ProjectFavorite | `project_favorites` | IMPLEMENTED | per-user dashboard favorites |
| GenerationJob | `generation_jobs` | IMPLEMENTED FOUNDATION | durable async execution state with plan & revision pinning |
| StageAttempt | `stage_attempts` | IMPLEMENTED FOUNDATION | lease/attempt model with heartbeat claims |
| ProviderOperation | `provider_operations` | IMPLEMENTED SQL-FIRST SLICE | durable provider boundary, CAS lifecycle, reconciliation, billing evidence & result fingerprint |
| OperationPlan | `operation_plans` | IMPLEMENTED MVP FOUNDATION | estimate/cap/admission link |
| QuotaReservation | `quota_reservations` / `usage_windows` | IMPLEMENTED | atomic admission reservation and terminal provider cost settlement |
| Narration (TTS) | `narration_requests` / `narration_operations` / `narration_assets` / `narration_alignments` | IMPLEMENTED FOUNDATION | immutable full-chapter TTS snapshots and segment alignment |
| Media validation | `media_assets` / `media_asset_checksums` / `media_upload_sessions` / `media_validation_jobs` / `outbox_events` | IMPLEMENTED FOUNDATION | finalization persists `VALIDATING` plus an idempotent durable validation job; worker CAS-persisted decode results drive `READY`/`REJECTED` |
| Narration (Upload) | `media_assets` / `media_asset_checksums` / `media_upload_sessions` / `narration_sets` / `narration_parts` / `narration_documents` / `narration_alignment_runs` | IMPLEMENTED FOUNDATION | verified upload finalization claims one canonical checksum owner, materializes assets as `VALIDATING`, and queues duplicate-object cleanup transactionally |
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
