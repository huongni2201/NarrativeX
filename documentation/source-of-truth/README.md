# NarrativeX Source of Truth V1.11

## Canonical baseline

- Version: `V1.11`
- Repository: `huongni2201/NarrativeX`
- Effective docs sync: `2026-08-26`
- Canonical specification: `documentation/source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`
- Runtime refinement: `documentation/decisions/ADR-0020-postgresql-only-mvp-runtime-state.md`

Current code, Flyway migrations and automated tests decide factual AS-IS implementation claims. Accepted ADRs outrank the canonical specification within the exact scope they supersede; ADR-0020 therefore replaces older Redis/session/delivery text still present in historical V1.11 wording.

## Current architecture direction

```text
Electron Desktop (only supported editor)
  renderer -> UI/editor/query state only
  preload  -> narrow typed capability bridge
  main     -> guest credential, OAuth deep link, native files,
              ProjectStorage, local execution, FFmpeg/ffprobe
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
Render intermediates/cache          -> local project workspace/work
Final local MP4                     -> local project workspace/artifacts
Business/job/artifact metadata      -> PostgreSQL
```

Cloudflare R2 is generated-media transport/durability where remote provider/worker execution needs it. Final render bytes are local-only; the backend coordinates state but does not store or proxy the MP4.

## Database baseline

```text
V1__create_tables.sql
V2__init_indexes.sql
V3__seed_data.sql
V4__postgres_runtime_state.sql
```

V1-V3 are frozen. V4 adds Spring Session JDBC and one-time Desktop OAuth handoff storage. Future schema changes are append-only V5+.

## Primary remaining work

- production packaging, signing, auto-update and packaged protocol/OAuth/OS integration coverage;
- hardening long-running local execution across abrupt process/OS failure and richer recovery UX;
- richer timeline/editor review and regeneration/reuse workflows;
- narration-driven adaptive `VisualScenePlanner` and continuity-aware review completion;
- richer asset approval/reuse/reframe/edit lineage;
- complete production billing/actual-usage reconciliation and operational evidence.
