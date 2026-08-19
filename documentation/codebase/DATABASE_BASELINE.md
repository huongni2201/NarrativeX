# NarrativeX Database Baseline V1.10

## Authority and validation

- PostgreSQL is the authoritative business-state store.
- Redis is not authoritative GenerationJob state; it is used for sessions and non-authoritative delivery/progress hints.
- Backend is the Flyway/schema owner.
- `spring.jpa.hibernate.ddl-auto=validate` protects runtime schema drift outside test profiles.
- PostgreSQL + Flyway is the release schema gate.

## Flyway migration matrix

| Migration | Purpose | Current state |
|---|---|---|
| V1 `initial_schema` | Auth, project/story/chapter foundations, generation tables, storyboard (split motion/camera), durable provider operations & admission limits, canonical execution constraints and control plane | Consolidated baseline |
| V2 `seed_demo_data` | Deterministic development/demo seed with canonical execution enums and valid plan credits | Development only |

Migration history is forward-only. Development re-baselines must not be treated as a production migration rewrite strategy.

## Entity/schema matrix

| Domain | Table | Status | Notes |
|---|---|---|---|
| Project | `projects` | IMPLEMENTED | ownership, active query index and cursor pagination foundation |
| StoryVersion | `story_versions` | IMPLEMENTED FOUNDATION | version/source boundary |
| Chapter | `chapters` | IMPLEMENTED FOUNDATION | sourceText/sourceHash/rowVersion contract |
| Scene | `scenes` | IMPLEMENTED FOUNDATION | storyboard scene persistence |
| VisualBeat | `visual_beats` | IMPLEMENTED FOUNDATION | motion/camera split |
| GenerationJob | `generation_jobs` | IMPLEMENTED FOUNDATION | durable async execution state |
| StageAttempt | `stage_attempts` | IMPLEMENTED FOUNDATION | lease/attempt model |
| ProviderOperation | `provider_operations` | IMPLEMENTED FOUNDATION | durable provider boundary before external submit |
| OperationPlan | `operation_plans` | IMPLEMENTED MVP FOUNDATION | estimate/cap/admission link; not complete billing ledger |
| Usage reservation | `usage_windows` / related quota state | IMPLEMENTED MVP FOUNDATION | atomic admission reservation |

## Durable execution persistence

The persisted execution contract is documented in
[`ADR-0012`](../decisions/ADR-0012-canonical-execution-persistence-contract.md).
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

Current continuity gap:

- AI-returned Locations are not yet fully materialized.
- Scene -> ProjectCharacter relation is not yet durable.
- Scene -> Location relation is not yet durable.

These relations should be added as explicit domain references. Character names must not be used as historical continuity keys.

## Optimistic concurrency

Mutable entities use row version protection:

- JPA `@Version` protects persistence writes.
- Domain adapters compare expected row version before applying detached changes.
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

1. Add durable Scene continuity relation tables/columns after the continuity domain decision.
2. Add full billing ledger, actual provider usage and reservation release accounting.
3. Add media artifact/render/export persistence when the media pipeline lands.
4. Add complete deletion/retention lifecycle schema and backup verification.
5. Add indexes from measured production query plans instead of speculative indexing.

## Schema verification gate

For schema PRs:

1. Apply all migrations on an empty supported PostgreSQL instance.
2. Start backend with Hibernate validate.
3. Run backend verification suite.
4. Verify stale-version behavior.
5. Verify query plans for keyset pagination with representative data.
6. Do not use H2-only success as PostgreSQL compatibility evidence.
