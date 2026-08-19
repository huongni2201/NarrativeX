# ADR-0012: Canonical execution persistence contract

- Status: Accepted
- Date: 2026-08-19
- Scope: `generation_jobs`, `stage_attempts`, `provider_operations`

## Context

Execution state is written by Spring Boot and the Python worker. The database
must reject unknown values, but the existing development seed still contained
older aliases such as `STORY_ANALYSIS`, `IMAGE_GENERATION`, `GPU`, `PENDING`
and `SUCCEEDED`.

## Decision

- PostgreSQL `TEXT/VARCHAR` plus `CHECK` remains the persisted representation.
- V5 defines the canonical job types as `STORY_ANALYZE`, `CHAPTER_ANALYZE`,
  `IMAGE_GENERATE`, `CHAPTER_GENERATE`, `CHAPTER_RENDER`, `PROJECT_CONTINUE`,
  `VISUAL_BEAT_PLAN`, `SHOT_IMAGE_GENERATE`, `RENDER_PROJECT` and `RENDER_SHORT`.
- V5 defines the canonical resource classes as the currently implemented
  Java classes plus the worker workflow classes: `PROVIDER_INTERACTIVE`,
  `PROVIDER_BATCH`, `GPU_HEAVY`, `CPU_RENDER`, `CPU_LIGHT`, `BACKGROUND`,
  `NOTIFICATION`, `FAST_CPU`, `CPU_HEAVY` and `MEDIA_IO`.
- Job and stage statuses are `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`,
  `CANCELED`, `UNKNOWN`, `STALLED` and `PAUSED_COST_LIMIT`.
- Provider operation statuses are `RESERVED`, `SUBMITTED`, `RUNNING`,
  `COMPLETED`, `FAILED` and `UNKNOWN`.
- Known legacy aliases are migrated explicitly in V5. Progress is never
  silently changed; out-of-range or unknown values abort the migration.
- New values require a forward migration and matching Java/Python contract
  updates. PostgreSQL enums are intentionally not used.

## Consequences

Invalid execution state can no longer be inserted or updated directly in
PostgreSQL. The Java and Python mirrors must be kept in sync with the V5
contract when a new execution type is introduced.
