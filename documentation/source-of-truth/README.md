# NarrativeX Source of Truth V1.12

## Canonical baseline

- Version: `V1.12`
- Repository: `huongni2201/NarrativeX`
- Last formal spec sync: `2026-09-15`
- Implementation checkpoint: `main` at `b1457f38a169ccc59a5789c9f40207db275cc06f`
- Canonical specification: [`NARRATIVEX_PROJECT_SPEC_V1_12.md`](./NARRATIVEX_PROJECT_SPEC_V1_12.md)
- Historical specifications: [`NARRATIVEX_PROJECT_SPEC_V1_11.md`](./NARRATIVEX_PROJECT_SPEC_V1_11.md)
- Runtime refinements: accepted ADRs plus maintained architecture/workflow docs

Current code, Flyway migrations and automated tests decide factual AS-IS implementation claims. Accepted ADRs outrank the versioned canonical specification within the exact scope they supersede.

## Current architecture direction

```text
Electron Desktop (only supported editor)
  renderer -> UI/editor/query state only
  preload  -> narrow typed capability bridge
  main     -> native files, ProjectStorage, local execution,
              FFmpeg/ffprobe, local MP4 playback/export
        |
        v HTTP / REST + SSE
Spring Boot backend-service
  -> PostgreSQL authoritative business/control plane
     + durable jobs/leases/attempts
     + artifact metadata
     + Flyway schema (V1-V7)
        |
        v Compute Protocol v1 (HTTP)
generation-service (domain-agnostic execution plane)
  -> VoiceStudio, WhisperX, ComfyUI, media validation
  -> local SQLite execution journal
  -> zero NarrativeX DB/domain access
```

The PostgreSQL-polling compute runtime has been removed; `generation-service` is the only provider execution plane. Redis and browser editors are removed.

## Identity & Access contract

Per ADR-0030, NarrativeX is a single-user local-first application. There is no application User, Account, Authentication, Authorization, Session, Tenant or ownership identity model. Desktop opens directly into the project workspace without login gates or modals.

## Desktop storage contract

```text
Generated/imported project images   -> local project workspace
Project narration/audio             -> local project workspace
Imported project media              -> local project workspace
PROJECT voice reference             -> local project workspace / manifest
GLOBAL_LOCAL voice reference        -> local application voice library
Render intermediates/cache          -> local project workspace/work
Final local MP4                     -> local project workspace/artifacts
Business/job/artifact metadata      -> PostgreSQL
```

Project bytes are strictly local-first. Final render bytes remain in Desktop ProjectStorage; the backend coordinates metadata but does not store or proxy the final MP4.

## Visual timing contract

```text
VisualBeat source_anchor
  -> deterministic UTF-16 textStart/textEnd
  -> current narration/subtitle alignment spans
  -> backend NarrationTextClockMapper
  -> production audio start/end/duration
```

Narration is the master clock. Persisted `visual_beats.audio_start_ms/audio_end_ms` are not Production Timeline inputs. Production timing is derived from deterministic source ranges plus current narration alignment. Provisional fallback timing keeps the Editor inspectable only; it does not satisfy final render readiness.

## Provider accounting contract

Monetary billing, credit balances, reservation settlement and provider pricing are not current runtime capabilities. System capacity reservations manage concurrent expensive work. Durable provider-operation fencing and UNKNOWN reconciliation remain required for retry safety. Provider adapters may retain non-monetary usage telemetry for diagnostics without turning that telemetry into a cost/accounting contract.

## Database migration state

NarrativeX is still pre-production, so the Flyway schema baseline is squashed into **V1 through V7**:
- `V1__project_story_and_planning.sql`
- `V2__generation_and_media.sql`
- `V3__narration_and_artifacts.sql`
- `V4__catalog_generation_and_render_snapshots.sql`
- `V5__database_logic_and_triggers.sql`
- `V6__indexes.sql`
- `V7__seed_catalog.sql`

At the first production deployment, the accepted V1–V7 migration history becomes immutable and subsequent schema changes become append-only starting at V8.

## Primary remaining work

- production packaging, signing, and auto-update;
- hardening long-running local execution across abrupt process/OS failure and richer recovery UX;
- richer timeline/editor review and regeneration workflows;
- narration-driven adaptive `VisualScenePlanner` and continuity-aware review completion;
- richer asset approval/reframe/edit lineage.
