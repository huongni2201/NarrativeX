# NarrativeX Source of Truth V1.11

## Canonical baseline

- Version: `V1.11`
- Repository: `huongni2201/NarrativeX`
- Last formal spec sync: `2026-08-31`
- Implementation checkpoint: `main` at `b1457f38a169ccc59a5789c9f40207db275cc06f`
- Canonical specification: `documentation/source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`
- Runtime refinements: accepted ADRs plus maintained architecture/workflow docs

Current code, Flyway migrations and automated tests decide factual AS-IS implementation claims. Accepted ADRs outrank the versioned canonical specification within the exact scope they supersede.

## Current architecture direction

```text
Electron Desktop (only supported editor)
  renderer -> UI/editor/query state only
  preload  -> narrow typed capability bridge
  main     -> guest credential, OAuth deep link, native files,
              ProjectStorage, local execution, FFmpeg/ffprobe,
              Gemini Web Chrome/CDP automation, protected clipboard
        |
        v
Spring Boot Backend
  -> PostgreSQL authoritative business/job/policy/lease/artifact metadata
     + Spring Session JDBC
     + one-time OAuth handoffs
     + durable queue/outbox state
  -> Python AI/provider workers polling PostgreSQL
```

Redis is not required by the MVP runtime. `app/frontend-web` is removed. Browser routes that remain belong to the backend OAuth flow, not a browser editor.

## Authentication contract

The installation guest principal is an internal ownership/session identity, not an end-user login provider. Google remains the only account sign-in provider. `NX_SESSION` and short-lived hash-only Desktop OAuth handoffs are persisted in PostgreSQL; Google tokens never enter Electron.

## Desktop storage contract

```text
Generated/imported project images   -> local project workspace
Project narration/audio             -> local project workspace
Imported project media              -> local project workspace
PROJECT voice reference             -> local project workspace / manifest
Render intermediates/cache          -> local project workspace/work
Final local MP4                     -> local project workspace/artifacts
ACCOUNT voice reference/custom voice -> Cloudflare R2
Business/job/artifact metadata      -> PostgreSQL
```

Cloudflare R2 is **not** generated-project-media transport. It is limited to authenticated reusable account-owned voice-reference/custom-voice assets. Final render bytes are local-only; the backend coordinates state but does not store or proxy the MP4.

## Visual timing contract

```text
VisualBeat source_anchor
  -> deterministic UTF-16 textStart/textEnd
  -> current narration/subtitle alignment spans
  -> backend NarrationTextClockMapper
  -> production audio start/end/duration
```

Narration is the master clock. Persisted `visual_beats.audio_start_ms/audio_end_ms` are not Production Timeline inputs. Production timing is derived from deterministic source ranges plus the current narration alignment. Provisional fallback timing keeps the Editor inspectable only; it does not satisfy final render readiness.

## Provider accounting contract

Monetary billing, credit balances, reservation settlement and provider pricing are not current runtime capabilities. Durable provider-operation fencing and UNKNOWN reconciliation remain required for retry safety. Provider adapters may retain non-monetary usage telemetry for diagnostics without turning that telemetry into a cost/accounting contract.

## Database migration state

NarrativeX is still pre-production, so obsolete patch history has been folded into the owning Flyway baseline migrations. A clean database now applies only **V1 through V8** and creates the current schema directly: continuity/checkpoints, regeneration, storyboard-generation snapshots, render provenance and watermark policy are present without replaying former V9–V18 patch migrations. Retired monetary image/regeneration pricing metadata and legacy credit accounting are not created by the baseline.

At the first production deployment, the accepted V1–V8 migration history becomes immutable and subsequent schema changes become append-only.

## Primary remaining work

- production packaging, signing, auto-update and packaged protocol/OAuth/OS integration coverage;
- hardening long-running local execution across abrupt process/OS failure and richer recovery UX;
- richer timeline/editor review and regeneration workflows;
- narration-driven adaptive `VisualScenePlanner` and continuity-aware review completion;
- richer asset approval/reframe/edit lineage;
- provider-operation observability and retry/replay evidence without reintroducing monetary billing contracts.
