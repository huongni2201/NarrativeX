# NarrativeX Database Baseline

## Authority and validation

- PostgreSQL is the intended authoritative business-state store; Redis is not used by current application code.
- Backend is the only Flyway/schema owner in the repository.
- `application.yml:9-12` sets `spring.jpa.hibernate.ddl-auto=validate`; `application.yml:24-27` enables Flyway and points at `classpath:db/migration`.
- Test profile deliberately uses H2 `create-drop` and disables Flyway (`src/test/resources/application-test.yml:1-16`), so the passing Spring test is not PostgreSQL validation.
- The current Compose baseline targets PostgreSQL 18. Historical W1-D1 startup evidence remains in `documentation/audits/evidence/`; it is not evidence of the current migration chain being absent.

## Flyway migration matrix

| Migration | Tables/columns owned | Indexes/constraints | Owner module |
|---|---|---|---|
| V1 `initial_schema` | Consolidated baseline: `schema_baseline`, project/storyboard/generation tables, control-plane tables, reusable character/appearance tables and project keyset access path | FKs, unique version/order/idempotency constraints, appearance/outfit composite invariant and indexes | backend/platform plus project, generation, control-plane and character features |

## Entity/schema matrix

| Entity | Table | Migration owner | PK type | FK / delete rule | Important indexes | Workspace/Tenant scope | JPA match | Gap/risk |
|---|---|---|---|---|---|---|---|---|
| `Project` | `projects` | V1 | BIGINT identity | none declared; default NO ACTION | `(owner_id,status)`, `(owner_id,updated_at DESC,id DESC)` | owner string only | MATCH after V1 | no workspace membership or tenant FK |
| `StoryVersion` | `story_versions` | V1 | BIGINT identity | `project_id -> projects(id)`; default NO ACTION | unique `(project_id,version_number)` | inherited through project | MATCH after V1 | no API read/update; no moderation workflow |
| `Chapter` | `chapters` | V1 | BIGINT identity | `story_version_id`; `source_story_version_id`; default NO ACTION | unique `(story_version_id,order_index)` | inherited through story | MATCH expected after V1 | startup could not validate because table absent |
| `Scene` | `scenes` | V1 | BIGINT identity | `chapter_id`; default NO ACTION | unique `(chapter_id,order_index)` | inherited through chapter | MATCH | no repository/API |
| `VisualBeat` | `visual_beats` | V1 | BIGINT identity | `scene_id`; default NO ACTION | unique `(scene_id,order_index)` | inherited through scene | MATCH | no repository/API |
| `GenerationJob` | `generation_jobs` | V1 | BIGINT identity plus UUID-like `job_id` | `project_id`; default NO ACTION | unique `job_id` | owner fields + project owner | MATCH expected | no durable dispatch/progress producer |
| `StageAttempt` | `stage_attempts` | V1 | BIGINT identity | `generation_job_id`; default NO ACTION | unique `(generation_job_id,stage_name,attempt_number)` | inherited through job | MATCH | no claim/lease columns beyond worker/heartbeat scaffold |
| `ProviderOperation` | `provider_operations` | V1 | BIGINT identity | `stage_attempt_id`; default NO ACTION | none beyond PK | inherited through stage/job | MATCH | no unique provider fingerprint/idempotency key |
| `OperationPlan` | `operation_plans` | V1 | BIGINT identity | `project_id`; default NO ACTION | none beyond PK | inherited through project | MATCH expected | current enqueue writes zero estimates and no reservation |

## Schema risks found

1. Fresh database boot is blocked: no Flyway history or tables were present and Hibernate validation failed at `chapters`. This is `NX-W1-D1-001` (P0).
2. The consolidated baseline has no explicit indexes on most FK columns. PostgreSQL does not auto-index FKs. This is a measured structural gap to review in W1-D4, not a D1 redesign recommendation.
3. The consolidated baseline creates many control-plane tables with user/project IDs as strings and several nullable project/character/reference links. There is no workspace table/membership FK or database-level tenant boundary.
4. All mapped entities use BIGINT database PKs while the worker/API contracts also expose string job/operation identifiers. This is workable as a boundary mapping but must be kept explicit; do not migrate identifiers in D1.
5. Delete rules are left at PostgreSQL default `NO ACTION`; deletion workflows are documented but not implemented in the current domain/API.

## Closure test for W1-D4

Run the consolidated `V1__initial_schema.sql` against an isolated empty PostgreSQL database, assert V1 in Flyway history, run backend with `ddl-auto=validate`, and inspect all mapped tables/columns/constraints/indexes. Keep H2 tests as unit support, not as the schema gate.
