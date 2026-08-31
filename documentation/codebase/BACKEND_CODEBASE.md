# NarrativeX Backend Codebase

## Runtime

- Entry point: `com.narrativex.backend.NarrativeXBackendApplication`.
- Build: Maven under `app/backend-service`.
- Runtime: Java 25, Spring Boot 4.1.1.
- Persistence: MyBatis + explicit PostgreSQL SQL is the sole production application persistence path; Flyway owns schema evolution.
- Runtime state: Spring Session JDBC, one-time Desktop OAuth handoffs, durable generation/outbox state and worker claims all use PostgreSQL. Redis is not required by the MVP runtime.
- Architecture: modular monolith with extraction-oriented feature boundaries plus separate Python asynchronous provider/media workers.

## Feature/dependency rules

A business feature owns its API, application, domain and infrastructure vertical slice. Cross-feature dependencies use explicit application contracts/ports rather than importing another feature's infrastructure. Domain objects do not call repositories, storage SDKs, provider SDKs or worker runtimes directly.

## Authentication and ownership

NarrativeX Desktop is guest-first.

- `desktop_guest_installations` maps a stable Desktop installation to an internal guest owner and stores only the installation-secret hash.
- The guest principal is not a password/OAuth login provider; it exists for ownership/session continuity.
- Google OIDC remains the only end-user account sign-in provider.
- `NX_SESSION` is persisted through Spring Session JDBC in PostgreSQL.
- Desktop OAuth handoffs store only a hash of the random handoff code, expire after 90 seconds and are atomically consumed from PostgreSQL.
- Free guest mutations are explicit backend security allowlists.
- Account/provider-consuming operations require `ROLE_USER` and return `AUTHENTICATION_REQUIRED` to a guest.
- Desktop one-time exchange transfers eligible guest-owned workspace metadata to the Google account before switching session identity.
- Business modules obtain caller identity through auth application ports rather than reading Spring Security directly.

## Chapter source and analysis boundary

`chapters.source_text` and `chapters.source_hash` are the authoritative saved source. There is no language-detection confirmation, translation job, content-variant table or variant-selection API in the current baseline.

```text
persisted Chapter source
  -> lock/reload authoritative source snapshot
  -> ownership + idempotency + entitlement/quota/cost admission
  -> OperationPlan + GenerationJob + StageAttempt + OutboxEvent
  -> commit + outbox finalization
  -> worker polls/claims durable PostgreSQL job
  -> rowVersion/sourceHash stale guard
  -> Character/Location/Scene/VisualBeat materialization
```

Project creation remains metadata-only. AI/media work is explicit.

## Durable generation model

```text
OperationPlan
    -> GenerationJob
        -> StageAttempt
            -> ProviderOperation
```

Provider requests require durable lifecycle state. Ambiguous external acceptance uses `UNKNOWN` reconciliation rather than blind resubmission. Provider calls stay outside long business transactions.

Generation/media outbox rows are persisted transactionally with admitted work. Because workers consume the durable PostgreSQL queue tables directly, the outbox dispatcher only finalizes pending bookkeeping rows after commit; it does not publish to Redis, `NOTIFY`, or another broker. A failed acknowledgement remains `PENDING` and becomes claimable after its reservation timeout.

## Project media identity

The backend owns stable media identity/metadata, not Desktop absolute file paths. Remote R2 upload/session/validation paths remain valid for server/provider workflows, but are not a requirement for every Desktop project asset.

## Production timeline and local render

Narration/alignment is the timing authority. Explicit beat media selections and backend render admission are durable state; Electron main resolves project-relative media paths and executes FFmpeg under the assigned lease. Final MP4 bytes remain local while the backend stores final-artifact metadata only.

## API/capability foundations

Current backend surfaces include auth guest bootstrap/current-user/CSRF/Google Desktop auth; project/story/chapter CRUD and direct chapter analysis; storyboard and character/location reads; generation estimate/enqueue/history, current media-head lookup and owner-scoped SSE events; narration/import/alignment and voice-preview jobs/results; production timeline/media selection and atomic Auto Edit render admission; local asset/materialization metadata; local-device/render execution; final-artifact/notification/quota/catalog reads.

Endpoint availability does not imply every future UI interaction is complete; use `documentation/TRACEABILITY.md` and `documentation/product/FEATURE_CATALOG.md` for current status.

## Persistence and Flyway

Production application code uses MyBatis + explicit SQL with dedicated row models/mappers and row-version/state CAS where required.

Current pre-release baseline:

```text
V1__identity_and_access.sql
V2__project_story_and_planning.sql
V3__generation_billing_and_media.sql
V4__narration_notifications_and_artifacts.sql
V5__catalog_generation_and_render_snapshots.sql
V6__database_logic_and_triggers.sql
V7__indexes.sql
V8__seed_catalog.sql
```

V1-V6 separate schema/database logic by responsibility, V7 contains the index/invariant set, and V8 contains deterministic system/catalog seeds. Render subtitle fields are created directly with project render snapshots; the Chapter Workspace covering lookup is part of V7; VieNeu voices are seeded with `supportsSpeakingRate=true`, and narration requests persist a positive `speaking_rate`. Translation/content-variant schema is absent.

Because no production database has adopted this history yet, the baseline can still be reorganized for clarity and disposable development/test databases should be recreated after checksum/version changes. The baseline becomes immutable at the first production deployment; future changes after that point must be append-only.

## Quality/concurrency rules

- Domain code remains framework-free.
- Mutable writes use expected-version/state predicates where concurrency matters.
- Zero affected rows for a guarded mutation becomes a conflict rather than silent success.
- Paid/provider submission uses persisted fences and UNKNOWN reconciliation.
- PostgreSQL/Testcontainers is required for PostgreSQL-specific locking/migration/transaction behavior.
- Architecture tests protect MyBatis/schema/client boundaries.
- JaCoCo's current bundle line floor comes from `pom.xml`, not from a hardcoded historical measurement in this document.
