# NarrativeX Database Baseline

## Authority and validation

- PostgreSQL is the intended authoritative business-state store; Redis is not authoritative state.
- Backend is the only Flyway/schema owner in the repository.
- `spring.jpa.hibernate.ddl-auto=validate` is used outside the test profile; Flyway owns forward schema changes.
- Test profile may use H2/create-drop for unit support, but PostgreSQL + Flyway remains the release schema gate.
- The current Compose baseline targets PostgreSQL 18.

## Flyway migration matrix

| Migration | Tables/columns owned | Indexes/constraints | Owner module |
|---|---|---|---|
| V1 `initial_schema` | Final consolidated schema: auth, project/storyboard/generation tables, control-plane tables, reusable character/appearance tables, read-model fields and project access paths | FKs, enum checks, source-hash/idempotency constraints, appearance/outfit invariants and all baseline indexes | backend/platform plus auth, project, storyboard, generation and character features |
| V2 `seed_demo_data` | Deterministic local/demo rows for the V1 schema | Idempotent seed inserts using stable identifiers | local development and integration fixtures |
| V3 `split_visual_beat_motion_fields` | `visual_beats.motion_mode`, `visual_beats.camera_movement`; legacy `motion_action` normalization/removal | Motion-mode and camera-movement check constraints | backend/storyboard plus worker contract |
| V4 `durable_provider_operations_and_admission_limits` | `operation_plans.generation_job_id`, `provider_operations.request_fingerprint`, provider status check, plan `monthly_credits` | unique provider fingerprint and durable operation lifecycle | backend generation, account quota and worker |

V1 is the complete schema baseline, V2 is the deterministic local/demo seed, and V3/V4 are forward changes to the consolidated baseline. This is a development re-baseline, not a recipe for rewriting a released migration history. Existing databases with the former V3–V8 history require a reviewed database recreation or explicit operator-managed re-baselining before using this migration path.

## Entity/schema matrix

| Domain type | Table | Migration owner | PK type | FK / delete rule | Important indexes/constraints | JPA match | Gap/risk |
|---|---|---|---|---|---|---|---|
| `Project` aggregate | `projects` | V1 | BIGINT identity | none declared | `(owner_id,status)`, active-project partial keyset index | MATCH | broader workspace membership pending |
| `StoryVersion` entity | `story_versions` | V1 | BIGINT identity | `project_id -> projects(id)` | unique `(project_id,version_number)` | MATCH | read/update/moderation flow incomplete |
| `Chapter` aggregate | `chapters` | V1 | BIGINT identity | `story_version_id`; optional source story reference | unique `(story_version_id,order_index)` | MATCH foundation | repository/application API pending |
| `Scene` aggregate | `scenes` | V1 | BIGINT identity | `chapter_id -> chapters(id)` | unique `(chapter_id,order_index)` | MATCH | repository/application API pending |
| `VisualBeat` entity | `visual_beats` | V1 | BIGINT identity | `scene_id -> scenes(id)` | unique `(scene_id,order_index)` | MATCH foundation | aggregate-owned write path pending |
| `GenerationJob` aggregate | `generation_jobs` | V1 | BIGINT identity plus UUID-like `job_id` | `project_id` | unique `job_id` | MATCH foundation | durable dispatch/progress producer incomplete |
| `StageAttempt` entity | `stage_attempts` | V1 | BIGINT identity | `generation_job_id` | unique `(generation_job_id,stage_name,attempt_number)` | MATCH | full claim/lease workflow pending |
| `ProviderOperation` entity | `provider_operations` | V1/V4 | BIGINT identity | `stage_attempt_id`, `request_fingerprint` | provider-operation lifecycle and reconciliation | MATCH | provider-specific status adapter remains worker-owned |
| `OperationPlan` aggregate | `operation_plans` | V1/V4 | BIGINT identity | `project_id`, `generation_job_id` | non-zero estimate/cap and job link | MATCH MVP | actual billing ledger and release flow remain follow-up |

## Storyboard persistence contract

`Chapter` and `Scene` are independent aggregate roots even though both live in relational parent/child tables. Relational foreign keys do not imply one DDD aggregate object graph.

```text
StoryVersion
   |
   v
Chapter aggregate
   |
   | chapter_id reference
   v
Scene aggregate
   |
   v
VisualBeat child entity
```

- `Chapter` and `Scene` mutations are protected by `row_version`/JPA `@Version`.
- `Scene.status` uses `@Enumerated(EnumType.STRING)` so database values remain stable domain codes rather than enum ordinals.
- Scene lifecycle values are `DRAFT`, `READY_FOR_VISUAL`, `GENERATING`, `REVIEW`, `APPROVED`, `FAILED`, `OUTDATED`.
- Ordered uniqueness (`Scene` within Chapter, `VisualBeat` within Scene) remains protected by database unique constraints in addition to domain/application validation.
- `VisualBeat.motion_mode` stores render strategy (`STILL`, `BASIC_MOTION`, `AI_VIDEO`); `VisualBeat.camera_movement` stores camera movement (`NONE`, `PAN`, `TILT`, `PUSH_IN`, `PULL_OUT`, `TRACK`, `ZOOM_IN`, `ZOOM_OUT`, `PARALLAX`). These fields are intentionally independent.

## Optimistic write contract

JPA `@Version` remains the persistence-level conflict guard. In addition, mutable aggregate adapters compare the detached domain model's expected `rowVersion` to the version on the currently loaded persistence entity before copying mutable state. This closes the gap where a stale detached object could otherwise be applied to a fresh managed entity before flush-time optimistic locking.

A version mismatch is a conflict and must not degrade to last-write-wins. HTTP ETag/`If-Match` propagation is still required where the public API exposes concurrent mutable updates.

## Project-list query contract

Active project listing uses keyset pagination with this shape:

```sql
WHERE owner_id = ?
  AND archived_at IS NULL
  AND (
    updated_at < ?
    OR (updated_at = ? AND id < ?)
  )
ORDER BY updated_at DESC, id DESC
```

V1 includes the matching partial index:

```sql
CREATE INDEX IF NOT EXISTS idx_projects_active_owner_updated_id
ON projects (owner_id, updated_at DESC, id DESC)
WHERE archived_at IS NULL;
```

The partial predicate keeps archived rows out of this access path, which becomes increasingly useful as archived projects accumulate.

## Schema risks / pending work

1. Most foreign-key access paths should be benchmarked and explicitly indexed when query patterns become active; PostgreSQL does not automatically index every FK.
2. Delete rules remain conservative; durable deletion/retention workflows are not replaced by cascade-delete shortcuts.
3. BIGINT database identities and string/UUID public job identifiers must remain explicit boundary mappings.
4. Storyboard repositories/mappers are still incomplete; JPA table presence alone is not a complete aggregate persistence implementation.
5. Scene lifecycle writes require expected `row_version`; HTTP/API wiring for `If-Match`/409 semantics remains implementation work.
6. Planned/future tables in the consolidated baseline must not be removed casually. Their cleanup requires an explicit schema/product migration decision rather than a mechanical code-review fix.

## Verification gate

For schema-impacting PRs:

1. Apply every migration currently present on the branch to an empty supported PostgreSQL instance.
2. Start backend with Hibernate `ddl-auto=validate`.
3. Run backend Maven `clean verify`.
4. Exercise mutable aggregate stale-version regression tests and Scene persistence with all canonical enum values.
5. Verify the active-project query plan can use `idx_projects_active_owner_updated_id` under representative data volume when performance work is being validated.
6. Do not rely on H2-only tests as proof of PostgreSQL/Flyway compatibility.
