# NarrativeX Source of Truth V1.11

## Canonical baseline

- Version: `V1.11`
- Repository: `huongni2201/NarrativeX`
- Implementation checkpoint: `main` at `0aca94e6eef07158e161cd67c648671e74055473`
- Effective docs sync: `2026-08-26`
- Canonical specification: `documentation/source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`

Current code, Flyway migrations and automated tests decide factual AS-IS implementation claims when derived documentation drifts.

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
  -> Redis server session/transient state
  -> Python AI/provider workers
```

`app/frontend-web` is removed. Browser routes that remain belong to the backend OAuth flow, not a browser editor.

## Current Desktop implemented foundations

- Electron + Electron Vite + React + TypeScript editor with a source-owned Tailwind/shadcn-style component structure.
- Context-isolated BrowserWindow boundary with no Node integration and narrow preload/main IPC; Chromium renderer sandbox is currently disabled for startup compatibility.
- Stable installation-scoped guest identity persisted through Electron secure storage plus backend `desktop_guest_installations`.
- Guest-first session bootstrap that lets users create/edit free workspace state before account sign-in.
- Google-only account sign-in through system browser + `narrativex://auth/callback` one-time handoff.
- In-context LoginModal for backend-gated account/provider-consuming operations; successful login keeps the active project/editor route.
- Guest-owned workspace metadata transfer to the signed-in Google account for eligible mutable resources.
- `ProjectStorage` under Electron `userData` with atomic schema-versioned manifests, project-relative paths, size checks and SHA-256 verification.
- Native two-phase local asset import without exposing absolute paths to renderer code.
- Image-generation and narration foundations with local materialization/registration for the implemented Desktop workflows.
- Backend-authorized production timeline with editable beat media selection and persisted selection overrides.
- Explicit local device identity/heartbeat plus backend-assigned local render claim and lease lifecycle.
- FFmpeg/ffprobe local render pipeline, preflight, progress/failure/completion reporting and local artifact metadata registration.
- Atomic render journal discovery, segment cache, storage verification/cleanup and backup/restore/archive-copy foundations.
- Typed timeline command history with undo/redo behavior.

## Authentication contract

The installation guest principal is an internal ownership/session identity, not an end-user login provider. Google remains the only account sign-in provider.

```text
Desktop start
  -> reuse session or POST /api/v1/auth/desktop/guest
  -> stable ROLE_GUEST

Gated action
  -> AUTHENTICATION_REQUIRED
  -> LoginModal
  -> Google OIDC in system browser
  -> one-time Desktop exchange
  -> eligible guest ownership transfer
  -> ROLE_USER on the same editor route
```

Google tokens never enter Electron. The guest installation secret, user session and local-execution device credential are separate security concepts.

## Desktop storage contract

```text
Generated/imported project images   -> local project workspace
Project narration/audio             -> local project workspace
Imported project media              -> local project workspace
Render intermediates/cache          -> local project workspace/work
Final local MP4                     -> local project workspace/artifacts
Business/job/artifact metadata      -> PostgreSQL
```

The local manifest maps stable IDs to project-relative paths and checksums. Absolute local paths are not durable backend identities.

## Generated-media transport contract

```text
AI-generated image/narration bytes  -> Cloudflare R2 transport/durability
Desktop materialized project bytes  -> local project workspace
Final rendered MP4                  -> local project workspace/artifacts
Worker scratch                      -> ephemeral local storage
Business/job/artifact metadata      -> PostgreSQL
```

ADR-0003 governs remote generated-media transport. ADR-0012 governs the Desktop local-first boundary. Final render bytes are local-only; the backend coordinates state but does not store or proxy the MP4.

## Database baseline

Current Flyway baseline:

```text
V1__create_tables.sql
V2__init_indexes.sql
V3__seed_data.sql
```

V1-V3 are frozen. Desktop guest-installation, production beat-media-selection and local execution/render metadata structures are already consolidated into V1. The next schema change must be introduced as an append-only `V4__*.sql`.

## Primary remaining work

- production packaging, signing, auto-update and packaged protocol/OAuth/OS integration coverage;
- hardening long-running local execution across abrupt process/OS failure and richer recovery UX;
- richer timeline/editor review and regeneration/reuse workflows beyond the implemented foundations;
- narration-driven adaptive `VisualScenePlanner` and continuity-aware review completion;
- richer asset approval/reuse/reframe/edit lineage;
- complete production billing/actual-usage reconciliation and operational evidence.

Completed Desktop/backend/persistence migration plans have been retired. Remaining work is maintained in `documentation/product/ROADMAP.md`; architectural history remains in ADRs and Git history.
