# NarrativeX Source of Truth V1.11

## Canonical baseline

- Version: `V1.11`
- Repository: `huongni2201/NarrativeX`
- Implementation checkpoint: `main` at `751f006634218efb2c398fc00c2cbfecd25e1eac`
- Effective docs sync: `2026-08-24`
- Canonical specification: `documentation/source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`

Current code, Flyway migrations and automated tests decide factual AS-IS implementation claims when derived documentation drifts.

## Current architecture direction

NarrativeX is **desktop-first**:

```text
Electron Desktop (primary editor)
  renderer -> UI/editor state only
  preload  -> narrow typed capability bridge
  main     -> native files, OAuth deep-link handling,
              ProjectStorage, device execution, FFmpeg/ffprobe
        |
        v
Spring Boot Backend
  -> PostgreSQL authoritative business/job/policy/lease metadata
  -> Redis server session/transient state
  -> Python provider/cloud workers
```

`app/frontend-web` is a temporary legacy migration client, not the target editor architecture.

## Current Desktop implemented foundations

- Electron + Electron Vite + React + TypeScript editor shell.
- Secure BrowserWindow boundary with context isolation, no Node integration and sandboxing.
- Google OAuth-only Desktop login through system browser + `narrativex://auth/callback` one-time handoff.
- Backend Desktop auth start/exchange/logout contracts establishing a server-managed NarrativeX session.
- `ProjectStorage` under Electron `userData` with atomic manifest writes, project-relative paths, size checks and SHA-256 verification.
- Explicit local device pairing/identity/heartbeat.
- Backend-assigned local project-render claim and lease lifecycle.
- Local render progress/failure/completion reporting and in-process cancellation.
- FFmpeg/ffprobe probing and project render pipeline: segment render → video concat → narration concat → mux → ffprobe → local artifact registration.

## Desktop storage contract

```text
Generated/imported project images   -> local project workspace
Project narration/audio             -> local project workspace
Imported project media              -> local project workspace
Render intermediates                -> local project workspace/work
Final local MP4                     -> local project workspace/artifacts
Business/job metadata               -> PostgreSQL
```

The local manifest maps backend asset/job IDs to project-relative paths and checksums. Absolute local paths are not durable backend identities.

[ADR-0012](../decisions/ADR-0012-desktop-local-first-media-and-render-execution.md) governs this boundary.

## Retained cloud/legacy contract

The older cloud/worker execution path remains during migration:

```text
Cloud pipeline media         -> Cloudflare R2
Cloud final rendered MP4     -> Google Drive
Cloud worker local storage   -> ephemeral scratch
Business/job metadata        -> PostgreSQL
```

[ADR-0003](../decisions/ADR-0003-media-storage-generation-pipelines-and-external-integrations.md) governs that fallback path. Do not apply it globally to Desktop project bytes.

## Authentication contract

Google is the only end-user login provider. Desktop uses system-browser OIDC and a short-lived single-use callback code exchanged into a server-managed NarrativeX session.

A local-execution device token is a separate machine credential used only for heartbeat/render APIs. Explicit pairing is the current AS-IS implementation; automatic post-login device registration remains a target if needed.

## Primary remaining migration work

- Complete local materialization/registration for image, TTS/narration and import workflows.
- Add restart-safe render recovery/resume.
- Complete editor/timeline/review/regeneration parity.
- Add local disk cleanup, backup/move/restore and repair UX.
- Harden packaging, signing, auto-update and protocol registration.
- Complete narration-driven `VisualScenePlanner` and richer asset reuse/approval flows.
- Remove `app/frontend-web` only after parity/reliability/dependency gates pass.

Derived documents must distinguish implemented Desktop foundations from these remaining gaps and must not restore cloud-first storage as the Desktop default.
