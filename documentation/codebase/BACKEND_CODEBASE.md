# NarrativeX Backend Codebase

## Runtime

- Entry point: `com.narrativex.backend.NarrativeXBackendApplication`.
- Build: Maven under `app/backend-service`.
- Runtime: Java 25, Spring Boot 4.1.1.
- Persistence: MyBatis + explicit PostgreSQL SQL is the sole production application persistence path; Flyway owns schema evolution.
- Runtime state: durable generation/outbox state, compute task mapping, and execution attempt leases all use PostgreSQL. Redis is not required.
- Architecture: modular monolith with extraction-oriented feature boundaries plus domain-agnostic compute execution plane (`app/generation-service`).

## Feature/dependency rules

A business feature owns its API, application, domain and infrastructure vertical slice. Cross-feature dependencies use explicit application contracts/ports rather than importing another feature's infrastructure. Domain objects do not call repositories, storage SDKs, provider SDKs or worker runtimes directly.

## Single-user application boundary

Per ADR-0030:

- **Project is the highest business boundary.**
- NarrativeX is a single-user local-first desktop application.
- No caller identity (`userId`, `accountId`, `ownerId`) is threaded through business use cases or domain models.
- There are no application users, accounts, authentication gates, session cookies (`NX_SESSION`), or guest ownership transfers.
- External provider credentials and machine tokens are runtime configuration concerns, not application identity.

## Chapter source and analysis boundary

`chapters.source_text` and `chapters.source_hash` are the authoritative saved source. There is no language-detection confirmation, translation job, content-variant table or variant-selection API in the current baseline.

```text
persisted Chapter source
  -> lock/reload authoritative source snapshot
  -> idempotency + capacity admission
  -> OperationPlan + GenerationJob + StageAttempt + OutboxEvent
  -> commit + compute task dispatch
  -> Character/Location/Scene/VisualBeat materialization
```

Project creation remains metadata-only. AI/media work is explicit.

## Durable generation & compute model

```text
OperationPlan
    -> GenerationJob
        -> StageAttempt
            -> ComputeTask (dispatched to generation-service)
```

The backend compute module coordinates execution:

- **Task Materialization (`IMPLEMENTED` foundation):** Translates domain context into closed versioned compute tasks (`contracts/compute/v1/`).
- **Attempt Mapping (`IMPLEMENTED` foundation):** Correlates `StageAttempt` with compute task execution and attempt counters.
- **Dispatch (`PARTIAL`):** Submits tasks to `generation-service` via HTTP POST.
- **Callback / Reconciliation (`PARTIAL`):** Handles completion/failure observations and reconciles ambiguous states.
- **Artifact Capability Coordination (`PARTIAL`):** Generates time-limited capability URLs and verifies SHA-256 digests.

Ambiguous external acceptance uses `UNKNOWN` reconciliation rather than blind resubmission (ADR-0031). Provider calls stay outside long business transactions. The runtime does not persist provider pricing snapshots, monetary operation estimates, user credit balances or billing owners.

## Project media identity

The backend owns stable media identity/metadata, not Desktop absolute file paths. Project media is project-local; Cloudflare R2 is not used for project media. Reusable voice assets are managed locally (`GLOBAL_LOCAL` / `PROJECT`).

## Production timeline and local render

Narration/alignment is the timing authority. Explicit beat media selections and backend render admission are durable state; Electron main resolves project-relative media paths and executes FFmpeg under the assigned lease. Final MP4 bytes remain local while the backend stores final-artifact metadata only.

## Persistence and Flyway

Production application code uses MyBatis + explicit SQL with dedicated row models/mappers and row-version/state CAS where required.

Current pre-release baseline:

```text
V1__project_story_and_planning.sql
V2__generation_and_media.sql
V3__narration_and_artifacts.sql
V4__catalog_generation_and_render_snapshots.sql
V5__database_logic_and_triggers.sql
V6__indexes.sql
V7__seed_catalog.sql
```

V1-V5 separate schema/database logic by responsibility, V6 contains the index/invariant set, and V7 contains deterministic system/catalog seeds. Continuity/checkpoints, regeneration plans, storyboard-generation snapshots, render continuity provenance and watermark policy are folded into the owning V1-V7 migrations; there is no V8+ patch chain in the current pre-production baseline.

Because no production database has adopted this history yet, the baseline can still be reorganized for clarity and disposable development/test databases should be recreated after checksum/version changes. The baseline becomes immutable at the first production deployment; future changes after that point must be append-only starting at V8.

## Quality/concurrency rules

- Domain code remains framework-free.
- Mutable writes use expected-version/state predicates where concurrency matters.
- Zero affected rows for a guarded mutation becomes a conflict rather than silent success.
- Compute submission uses persisted fences and `UNKNOWN` reconciliation before any ambiguous resubmission.
- PostgreSQL/Testcontainers is required for PostgreSQL-specific locking/migration/transaction behavior.
- Architecture tests protect MyBatis/schema/client boundaries.
- JaCoCo's current bundle line floor comes from `pom.xml`, not from a hardcoded historical measurement in this document.
