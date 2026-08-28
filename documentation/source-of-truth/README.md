# NarrativeX Source of Truth V1.11

## Canonical baseline

- Version: `V1.11`
- Repository: `huongni2201/NarrativeX`
- Effective docs sync: `2026-08-28`
- Baseline implementation checkpoint: `main` at `2c965b2e95ddcc1e03dc5527340c6adb18cdd05e`
- Canonical specification: `documentation/source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`
- Implementation evidence: `documentation/TRACEABILITY.md`
- Decision ledger: `documentation/decisions/README.md`

The V1.11 label is the maintained product/spec version; it is not a claim that every target in the specification is implemented. Current code, Flyway migrations and automated tests decide factual AS-IS behavior. Accepted ADRs outrank the canonical specification only within the exact scope they explicitly supersede.

The documented implementation checkpoint intentionally points to the last code baseline audited by the docs. Docs-only commits may follow that checkpoint. If runtime/application code changes after it, the checkpoint must advance and the current docs must be reviewed again.

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

Electron main
  -> <userData>/projects/<projectId>/ project media/work/final artifacts

Generated AI media
  -> R2 only when remote provider/worker durability is needed
  -> Desktop materialization for local project use
```

Redis is not required by the MVP runtime. `app/frontend-web` is removed. Browser routes that remain belong to the backend OAuth flow, not a browser editor.

## Authentication contract

The installation guest principal is an internal ownership/session identity, not an end-user login provider. Google remains the only account sign-in provider. `NX_SESSION` and short-lived hash-only Desktop OAuth handoffs are persisted in PostgreSQL; Google tokens never enter Electron.

## Visual Beat and timing contract

Current code persists semantic Scene/VisualBeat analysis, including beat title, visual intent, camera angle and participating character references. Narration alignment is also persisted with source/text/audio spans.

The following distinction is mandatory:

```text
implemented today
  Chapter/Scene/VisualBeat semantic analysis
  narration alignment persistence
  production timeline planned/fallback timing

not yet an AS-IS claim
  deterministic VisualBeat text_start/text_end for every analyzed beat
  VisualBeat source-span -> narration audio reconciliation
  exact draft storyboard audio_start_ms/audio_end_ms before MediaPlan
  fully verified narration-clock-authoritative Desktop preview
```

Those remaining timing items are tracked by `docs/superpowers/plans/2026-08-28-draft-visual-beat-preview-audio-timeline.md` and must stay `TARGET`/`PARTIAL` in current docs until code and tests prove them.

## Desktop storage contract

```text
Generated/imported project images   -> local project workspace
Project narration/audio             -> local project workspace
Imported project media              -> local project workspace
Render intermediates/cache          -> local project workspace/work
Final local MP4                     -> local project workspace/artifacts
Business/job/artifact metadata      -> PostgreSQL
```

Cloudflare R2 is generated-media transport/durability where remote provider/worker execution needs it. Final render bytes are local-only; the backend coordinates state but does not store or proxy the MP4.

## Database baseline

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

The repository is still pre-production, so this is a clean development baseline rather than frozen upgrade history. Disposable development/test databases should be recreated when the baseline changes. At the first production deployment the accepted baseline becomes immutable and future schema changes become append-only from the next migration version.

## Documentation lifecycle

- `documentation/` is current unless a file is an ADR body.
- `documentation/decisions/ADR-*.md` is historical decision evidence; consult the decision ledger for superseded scope.
- `docs/superpowers/plans/` is non-authoritative planning; consult its README for ACTIVE/COMPLETED/SUPERSEDED status.
- retired migration reports and obsolete architecture notes stay in Git history instead of remaining discoverable as current documentation.

## Primary remaining work

- exact Visual Beat source-span and narration-timing reconciliation for draft timeline preview;
- production packaging, signing, auto-update and packaged protocol/OAuth/OS integration coverage;
- hardening long-running local execution across abrupt process/OS failure and richer recovery UX;
- richer timeline/editor review and regeneration/reuse workflows;
- narration-driven adaptive `VisualScenePlanner` and continuity-aware review completion;
- richer asset approval/reuse/reframe/edit lineage;
- complete production billing/actual-usage reconciliation and operational evidence.
