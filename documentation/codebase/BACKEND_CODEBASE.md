# NarrativeX Backend Codebase

## Runtime

- Entry point: `com.narrativex.backend.NarrativeXBackendApplication`.
- Build: Maven under `app/backend-service`.
- Runtime: Java 25, Spring Boot 4.1.0.
- Persistence: MyBatis + explicit PostgreSQL SQL is the sole production application persistence path; Flyway owns schema evolution.
- Redis: Spring Session Redis plus non-authoritative transient/delivery/progress infrastructure.
- Architecture: modular monolith with extraction-oriented feature boundaries plus separate Python asynchronous provider/media workers.

## Feature/dependency rules

A business feature owns its API, application, domain and infrastructure vertical slice. Cross-feature dependencies use explicit application contracts/ports rather than importing another feature's infrastructure. Domain objects do not call repositories, Redis, storage SDKs, provider SDKs or worker runtimes directly.

## Authentication and ownership

NarrativeX Desktop is guest-first.

- `desktop_guest_installations` maps a stable Desktop installation to an internal guest owner and stores only the installation-secret hash.
- The guest principal is not a password/OAuth login provider; it exists for ownership/session continuity.
- Google OIDC remains the only end-user account sign-in provider.
- Free guest mutations are explicit backend security allowlists.
- Account/provider-consuming operations require `ROLE_USER` and return `AUTHENTICATION_REQUIRED` to a guest.
- Desktop one-time exchange transfers eligible guest-owned workspace metadata to the Google account before switching session identity.
- Business modules obtain caller identity through auth application ports rather than reading Spring Security directly.

## Aggregate/domain classification

| Feature | Representative roots/state |
|---|---|
| project | `Project`, `StoryVersion` |
| storyboard | `Chapter`, `Scene`, `VisualBeat` |
| character | `Character`, `ProjectCharacter`, version/appearance/reference state |
| generation | `GenerationJob`, `OperationPlan`, `StageAttempt`, `ProviderOperation`, `MediaPlan` |
| assets | stable `MediaAsset` identity, checksums/materialization metadata |
| local execution | device identity/capabilities/assignment/lease state |
| render | immutable input snapshots/manifests/final-artifact metadata |

Chapter owns persisted source/title/order behavior. Scene/VisualBeat model production/storyboard hierarchy; renderer UI does not flatten durable semantics into arbitrary timeline-only state.

## Chapter analysis boundary

```text
persisted Chapter
  -> lock/reload authoritative source snapshot
  -> ownership + idempotency + entitlement/quota/cost admission
  -> OperationPlan + GenerationJob + StageAttempt + OutboxEvent
  -> worker execution
  -> rowVersion/sourceHash stale guard
  -> Character/Location/Scene/VisualBeat materialization
```

Project creation remains metadata-only. AI/media work is explicit.

Chapter language detection/translation uses persisted content variants and durable translation jobs rather than mutating the original source silently.

## Durable generation model

```text
OperationPlan
    -> GenerationJob
        -> StageAttempt
            -> ProviderOperation
```

Provider requests require durable lifecycle state. Ambiguous external acceptance uses `UNKNOWN` reconciliation rather than blind resubmission. Provider calls stay outside long business transactions.

Production application persistence for generation, projects, chapters, storyboard, characters, auth, quota, catalog, notifications, assets and render/local-device state is MyBatis-backed with explicit SQL and guarded affected-row checks.

## Project media identity

The backend owns stable media identity/metadata, not Desktop absolute file paths.

Desktop local media flow:

```text
native/main-process selection or accepted generated result
  -> backend stable MediaAsset identity + integrity metadata
  -> local_media_materializations/device availability where applicable
  -> Electron ProjectStorage owns actual project-relative byte path
```

Remote R2 upload/session/validation paths remain valid for server/provider/cloud workflows, but are not a requirement for every Desktop project asset.

## Production timeline

The backend aggregates authoritative production timing/media state for the Desktop editor. V5 adds `production_beat_media_selections` so explicit beat media choices persist outside renderer memory.

Narration/alignment is the timing authority. Renderer duration/camera drafts are not durable production truth until converted into an admitted render/production contract.

## Local render control plane

The backend owns:

- immutable project render input snapshot;
- execution target (`LOCAL_DEVICE` or retained `CLOUD` path);
- assigned local device and capabilities;
- claim/lease/heartbeat/progress/terminal transitions;
- final artifact identity/checksum/metadata.

Electron main owns actual local FFmpeg execution and paths. Lease loss prevents stale-device successful finalization.

## Continuity materialization

Analysis materializes/reuses:

- Character / ProjectCharacter / CharacterVersion foundations;
- stable Character AI-key mappings;
- project-scoped Locations and Location AI-key mappings;
- Scene / VisualBeat;
- scene character/location relations.

Richer review/version/reference locking remains a separate product-hardening workflow.

## API/capability foundations

Current backend surfaces include:

- auth guest bootstrap, current-user/CSRF, Google Desktop start/exchange/logout;
- project list/create/detail/dashboard/favorite/overview;
- StoryVersion and Chapter CRUD/import/workspace/analysis/translation paths;
- storyboard/VisualBeat reads and review foundations;
- Character/Location/project asset reads and mutations where implemented;
- generation estimate/enqueue/job/history/event flows;
- narration/TTS/import/alignment foundations;
- production timeline and beat media-selection APIs;
- local asset registration/materialization metadata;
- local-device pairing/heartbeat/assignment/render execution APIs;
- render snapshot/final-artifact and notification/quota/catalog reads.

Endpoint availability does not imply every future UI interaction is complete; use `documentation/TRACEABILITY.md` and `documentation/product/FEATURE_CATALOG.md` for current status.

## Persistence and Flyway

Production application code uses MyBatis + explicit SQL with dedicated row models/mappers and row-version/state CAS where required.

Current Flyway order:

```text
V1__create_tables.sql
V2__init_indexes.sql
V3__seed_data.sql
V4__desktop_guest_installations.sql
V5__production_beat_media_selections.sql
```

V1-V3 are frozen core migrations. V4+ are append-only feature migrations.

## Quality/concurrency rules

- Domain code remains framework-free.
- Mutable writes use expected-version/state predicates where concurrency matters.
- Zero affected rows for a guarded mutation becomes a conflict rather than silent success.
- Paid/provider submission uses persisted fences and UNKNOWN reconciliation.
- PostgreSQL/Testcontainers is required for PostgreSQL-specific locking/migration/transaction behavior.
- Architecture tests protect MyBatis/schema/client boundaries.
- JaCoCo's current bundle line floor comes from `pom.xml` (35% at the 2026-08-26 checkpoint), not from a hardcoded historical measurement in this document.
