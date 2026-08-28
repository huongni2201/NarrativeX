# NarrativeX Backend Codebase

## Runtime

- Entry point: `com.narrativex.backend.NarrativeXBackendApplication`.
- Build: Maven under `app/backend-service`.
- Runtime: Java 25, Spring Boot 4.1.0.
- Persistence: MyBatis + explicit PostgreSQL SQL is the sole production application persistence path; Flyway owns schema evolution.
- Runtime state: Spring Session JDBC, one-time Desktop OAuth handoffs, durable generation/outbox state and worker claims all use PostgreSQL. Redis is not required by the MVP runtime.
- Architecture: modular monolith with extraction-oriented feature boundaries plus separate Python asynchronous provider/media workers.

## Feature/dependency rules

A business feature owns its API, application, domain and infrastructure vertical slice. Cross-feature dependencies use explicit application contracts/ports rather than importing another feature's infrastructure. Domain objects do not call repositories, storage SDKs, provider SDKs or worker runtimes directly.

## Authentication and ownership

NarrativeX Desktop is guest-first.

- `desktop_guest_installations` maps a stable Desktop installation to an internal guest owner and stores only the installation-secret hash.
- Guest principal is not a password/OAuth login provider; it exists for ownership/session continuity.
- Google OIDC is the only end-user account sign-in provider.
- `NX_SESSION` is persisted through Spring Session JDBC in PostgreSQL.
- Desktop OAuth handoffs store only a hash of the random handoff code, expire quickly and are atomically consumed from PostgreSQL.
- Free guest mutations are explicit backend security allowlists.
- Account/provider-consuming operations require `ROLE_USER` and return `AUTHENTICATION_REQUIRED` to a guest.
- Desktop one-time exchange transfers eligible guest-owned workspace metadata to the Google account before switching session identity.
- Business modules obtain caller identity through auth application ports rather than reading Spring Security directly.

## Chapter source and analysis boundary

`chapters.source_text`, `chapters.source_hash` and Chapter row version are the authoritative saved source identity. There is no translation/content-variant table or variant-selection API in the current baseline.

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

Current analysis/materialization includes richer Character profile/appearance data and beat-specific Character participation/roles. Project creation remains metadata-only; AI/media work is explicit.

## Durable generation model

```text
OperationPlan
    -> GenerationJob
        -> StageAttempt
            -> ProviderOperation
```

Provider requests require durable lifecycle state. Ambiguous external acceptance uses `UNKNOWN` reconciliation rather than blind resubmission. Provider calls stay outside long business transactions.

Generation/media outbox rows are persisted transactionally with admitted work. Workers consume durable PostgreSQL queue tables directly; outbox handling does not publish queue work to Redis, `NOTIFY` or another broker.

## Project media identity

Backend owns stable media identity/metadata, not Desktop absolute file paths. R2 upload/session/validation paths remain valid for generated provider/worker workflows but are not a requirement for every Desktop project asset.

Persisted `production_beat_media_selections` store explicit editor-selected VisualBeat media plus supported fit/trim state.

## Production timeline timing boundary

Current production timing logic has two important paths:

```text
current valid MediaPlan
  -> immutable planned beat timing
  -> authoritative for production/render planning

incomplete/unplanned timing
  -> generic fallback geometry where representable
  -> NOT exact narration alignment
```

Narration alignment persistence exists, but backend/worker code does not yet deterministically materialize every VisualBeat `text_start/text_end` and reconcile it into exact `audio_start_ms/audio_end_ms`. Exact draft storyboard timing and a timing-state distinction remain TARGET/PARTIAL.

Do not describe the production timeline generically as “narration-aligned” without stating whether the timing is planned, exactly aligned or fallback/provisional.

## Local render boundary

Explicit beat media selections and backend render admission are durable state; Electron main resolves project-relative media paths and executes FFmpeg under the assigned lease. Final MP4 bytes remain local while backend stores FinalArtifact metadata only.

Render admission may apply supported Auto Edit overrides atomically with immutable render snapshot creation. Subtitle source text/alignment spans are captured in immutable render input and can drive local SRT generation independent of whether draft VisualBeat timing reconciliation is complete.

## API/capability foundations

Current backend surfaces include:

- auth guest bootstrap/current-user/CSRF/Google Desktop auth;
- Project/Story/Chapter CRUD and direct Chapter analysis;
- storyboard and Character/Location reads, including continuity/reference context;
- generation estimate/enqueue/history, current media-head lookup and owner-scoped SSE events;
- narration/import/alignment and voice-preview jobs/results;
- production timeline/media selection and atomic Auto Edit render admission;
- local asset/materialization metadata;
- local-device/render execution;
- FinalArtifact/notification/quota/catalog reads.

Endpoint availability does not imply every future UI interaction is complete; use `documentation/TRACEABILITY.md` and `documentation/product/FEATURE_CATALOG.md` for current status.

## Persistence and Flyway

Production application code uses MyBatis + explicit SQL with dedicated row models/mappers and row-version/state CAS where required.

Current clean pre-release baseline:

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

Important current schema facts:

- translation/content-variant schema is absent;
- `visual_beats` includes nullable text/audio timing and aspect/quality override fields, but those columns do not imply current analysis fills them;
- `visual_beat_characters` persists beat-specific ProjectCharacter participation/role;
- narration alignment persists text/audio spans bound to source hash;
- render subtitle fields are created in the render-snapshot baseline;
- VieNeu voices are seeded with speaking-rate support and narration requests persist positive `speaking_rate`.

Because no production database has adopted this history yet, the baseline can still be reorganized for clarity and disposable development/test databases should be recreated after checksum/version changes. The baseline becomes immutable at first production deployment; future changes after that point are append-only from V9+.

## Quality/concurrency rules

- Domain code remains framework-free.
- Mutable writes use expected-version/state predicates where concurrency matters.
- Zero affected rows for a guarded mutation becomes conflict rather than silent success.
- Paid/provider submission uses persisted fences and UNKNOWN reconciliation.
- PostgreSQL/Testcontainers is required for PostgreSQL-specific locking/migration/transaction behavior.
- Architecture tests protect MyBatis/schema/client boundaries.
- JaCoCo's bundle line floor comes from `pom.xml`, not from a hand-maintained historical percentage.
- Documentation plans/nullable schema fields do not upgrade a capability to IMPLEMENTED; evidence comes from code/tests plus `TRACEABILITY.md`.
