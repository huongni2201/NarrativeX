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
| V1 `initial_schema` | Consolidated baseline: project/storyboard/generation tables, control-plane tables, reusable character/appearance tables and project keyset access path | FKs, unique version/order/idempotency constraints, appearance/outfit invariants and indexes | backend/platform plus project, storyboard, generation and character features |
| V2 `scene_status` | Adds `scenes.status VARCHAR(24) NOT NULL DEFAULT 'DRAFT'` | state column persisted as canonical Scene lifecycle enum | storyboard |

V1 is treated as the consolidated baseline. V2 is a forward migration introduced by the Storyboard aggregate/lifecycle implementation and must not be folded back into V1 after the baseline decision.

## Entity/schema matrix

| Domain type | Table | Migration owner | PK type | FK / delete rule | Important indexes/constraints | JPA match | Gap/risk |
|---|---|---|---|---|---|---|---|
| `Project` aggregate | `projects` | V1 | BIGINT identity | none declared | `(owner_id,status)`, project keyset index | MATCH | broader workspace membership pending |
| `StoryVersion` entity | `story_versions` | V1 | BIGINT identity | `project_id -> projects(id)` | unique `(project_id,version_number)` | MATCH | read/update/moderation flow incomplete |
| `Chapter` aggregate | `chapters` | V1 | BIGINT identity | `story_version_id`; optional source story reference | unique `(story_version_id,order_index)` | MATCH foundation | repository/application API pending |
| `Scene` aggregate | `scenes` | V1 + V2 | BIGINT identity | `chapter_id -> chapters(id)` | unique `(chapter_id,order_index)` | MATCH after V2 | repository/application API pending |
| `VisualBeat` entity | `visual_beats` | V1 | BIGINT identity | `scene_id -> scenes(id)` | unique `(scene_id,order_index)` | MATCH foundation | aggregate-owned write path pending |
| `GenerationJob` aggregate | `generation_jobs` | V1 | BIGINT identity plus UUID-like `job_id` | `project_id` | unique `job_id` | MATCH foundation | durable dispatch/progress producer incomplete |
| `StageAttempt` entity | `stage_attempts` | V1 | BIGINT identity | `generation_job_id` | unique `(generation_job_id,stage_name,attempt_number)` | MATCH | full claim/lease workflow pending |
| `ProviderOperation` entity | `provider_operations` | V1 | BIGINT identity | `stage_attempt_id` | provider-operation semantics | MATCH foundation | stronger submission fingerprinting may be needed |
| `OperationPlan` aggregate | `operation_plans` | V1 | BIGINT identity | `project_id` | plan-level fields | MATCH foundation | full reservation/cost flow incomplete |

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

## Schema risks / pending work

1. Most foreign-key access paths should be benchmarked and explicitly indexed when query patterns become active; PostgreSQL does not automatically index every FK.
2. Delete rules remain conservative; durable deletion/retention workflows are not replaced by cascade-delete shortcuts.
3. BIGINT database identities and string/UUID public job identifiers must remain explicit boundary mappings.
4. Storyboard repositories/mappers are still incomplete; JPA table presence alone is not a complete aggregate persistence implementation.
5. Scene lifecycle writes require expected `row_version`; HTTP/API wiring for `If-Match`/409 semantics remains implementation work.

## Verification gate

For schema-impacting PRs:

1. Apply V1 then V2 to an empty supported PostgreSQL instance.
2. Start backend with Hibernate `ddl-auto=validate`.
3. Run backend Maven `clean verify`.
4. Exercise Scene persistence with all canonical enum values and optimistic locking.
5. Do not rely on H2-only tests as proof of PostgreSQL/Flyway compatibility.
