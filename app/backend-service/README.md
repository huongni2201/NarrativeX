# NarrativeX Backend Service

## Purpose

The Spring Boot backend is NarrativeX's product/domain and durable execution-policy authority. Heavy AI/media execution is asynchronous in the Python worker; final project FFmpeg rendering is backend-authorized but executed in Electron main.

Project creation is metadata-only. Chapter save persists source only. Analysis, narration/audio processing, image/media generation and rendering are explicit operations.

## Technology stack

- Java 25 / Spring Boot 4.1.x
- PostgreSQL + Flyway
- **MyBatis + explicit SQL is the production application persistence boundary**
- Spring Security + Spring Session JDBC + CSRF + Google OIDC authentication
- PostgreSQL-backed one-time Desktop OAuth handoffs; raw handoff codes are never persisted
- Testcontainers / JUnit / AssertJ / JaCoCo

Redis is not required by the MVP backend runtime.

Exact versions/configuration are authoritative in `pom.xml` and application configuration; do not maintain a second exact dependency matrix here.

## Durable authority

PostgreSQL owns authoritative auth/ownership/domain/job/plan/usage/lease/artifact metadata, server sessions and short-lived OAuth handoff state. Python workers claim durable jobs directly from PostgreSQL using polling/lease queries. Generation/media outbox rows are transactional evidence; no Redis/broker/`LISTEN`/`NOTIFY` queue dependency is required.

Cloudflare R2 is generated-media transport/durability only where remote provider/worker execution requires it. Desktop project bytes and final MP4 artifacts are local-first and are not backend storage bytes.

## Authentication and ownership

Desktop starts guest-first with a stable installation-scoped guest owner/session identity. Google is the only end-user account sign-in provider. Guest installation credential, signed-in user session and local-execution device credential are distinct.

Backend authorization, not renderer state, gates account/provider-consuming operations. Eligible guest-owned workspace metadata transfers to the Google account during the one-time Desktop exchange without changing Project/Chapter/asset IDs.

## Chapter source and analysis

`chapters.source_text`, `source_hash` and row version are the authoritative saved source snapshot used by current analysis/narration flows. There is no translation/content-variant generation layer in the current baseline.

Current analysis/materialization foundations include:

- reusable Character/ProjectCharacter continuity;
- source-grounded Character profile and Chapter appearance data;
- Locations;
- ordered Scenes and Visual Beats;
- beat-specific participating Character references/roles;
- VisualBeat title, visual intent and camera metadata.

AI analysis is semantic. It does not currently own exact numeric source/audio timing.

## Visual Beat timing boundary

The schema contains nullable VisualBeat timing columns, but exact materialization is not complete at the audited code checkpoint.

```text
implemented foundation
  semantic VisualBeat materialization
  narration alignment persistence
  immutable MediaPlan timing
  generic production-timeline fallback geometry

active target
  deterministic UTF-16 visual_beats.text_start/text_end
  source-compatible narration -> VisualBeat reconciliation
  exact visual_beats.audio_start_ms/audio_end_ms before MediaPlan
```

Generic fallback geometry must not be called exact narration alignment. A current valid MediaPlan timing snapshot is authoritative for production/render planning.

## MediaPlan and production authority

The backend creates/version-controls authorized MediaPlan/production state and resolves execution policy under the selected ProductionMode. Workers/Desktop executors execute pinned policy and do not independently escalate paid/compute-heavy work.

Persisted `production_beat_media_selections` are durable editor/production state rather than renderer-only decoration.

## Narration strategies

```text
NarrationStrategy
  TTS
  USER_PROVIDED_AUDIO
```

Current foundations include generated narration, persisted source-to-audio alignment, local Desktop materialization and user-provided-audio import/TTS-bypass foundations. Broader arbitrary multi-part production coverage/correction remains PARTIAL; schema/foundation presence must not be read as path-complete implementation.

Persisted narration alignment does not itself mean every storyboard VisualBeat has been reconciled to exact audio offsets.

## Character read model

Project Character list/detail reads use project-scoped APIs/MyBatis projections. Current continuity state includes role, importance, aliases/groups, pinned version, appearance context and Scene/VisualBeat participation where exposed. Fields without an authoritative read model remain explicitly unavailable rather than fabricated by Desktop.

## Local render boundary

The backend owns render admission, immutable render input, assignment, lease/progress/terminal state and FinalArtifact metadata. Electron main resolves checksum-verified local assets and runs FFmpeg/ffprobe.

```text
backend-authorized render snapshot
  -> assigned local device lease
  -> Electron main preflight + local asset resolution
  -> FFmpeg/ffprobe
  -> local final MP4
  -> backend FinalArtifact metadata/completion
```

The backend does not store or proxy final MP4 bytes and does not persist absolute Desktop paths.

## Persistence and Flyway

Production application/domain persistence is MyBatis + explicit PostgreSQL SQL. JPA and direct `JdbcTemplate` domain persistence are not current production paths.

Current clean pre-release Flyway baseline:

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

Persistence migration is complete; the old `PERSISTENCE_MIGRATION.md` report is retired. Current persistence rules live in `../../documentation/codebase/BACKEND_CODEBASE.md`, `../../documentation/codebase/DATABASE_BASELINE.md`, the Flyway baseline policy and accepted ADRs.

Before first production deployment, disposable development/test databases may be recreated when the clean baseline is intentionally rewritten. After first production deployment, applied migrations become immutable and future schema evolution is append-only from V9+.

## Development / verification

```bash
./mvnw clean verify
```

The backend does not execute heavy AI/media/FFmpeg workloads inside HTTP request threads.

Coverage policy is documented in `../../documentation/codebase/BACKEND_COVERAGE.md`. Repository-level verification additionally runs documentation lifecycle/drift/checkpoint guards so application code cannot silently advance past the audited docs baseline.
