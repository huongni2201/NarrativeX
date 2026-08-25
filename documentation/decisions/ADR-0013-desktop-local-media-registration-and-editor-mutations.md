# ADR-0013: Desktop local-media registration and editor mutations

## Status

Accepted

## Context

The Desktop client is becoming the primary creator surface. Native files and generated media must be usable by the local renderer without uploading bytes to object storage solely for local playback. At the same time, project and chapter mutations must remain backend-authoritative and editor-only timeline changes must not mutate immutable VisualBeat records.

## Decision

- Electron main owns native file selection, metadata inspection, hashing, and the source path. The renderer receives only metadata and a short-lived, one-use selection token.
- The backend registers a stable media identity with `storage_mode=LOCAL_ONLY`, `origin=LOCAL_ONLY`, and a null `storage_key`. Absolute filesystem paths are never persisted in PostgreSQL or sent as API state.
- Electron commits the token and backend asset ID to `ProjectStorage`; the manifest remains the local authority for bytes, relative paths, sizes, and checksums.
- Desktop project/chapter mutations use React Query invalidation. Zustand remains for transient editor/session state.
- Timeline duration, camera, and media overrides are a Desktop render draft. Export sends an override list; the backend creates the immutable render snapshot.
- Generated remote media is materialized by Electron through a bounded, checksum- and size-verified download before it is registered in the local manifest.
- Export performs a local preflight for runtime availability, executor state, disk capacity, and required local assets. Render stages are checkpointed through an atomic per-job journal, and the journal is discoverable after restart.
- The Desktop narration UI has an explicit `USER_PROVIDED_AUDIO` mode. Selecting/importing local user audio never falls through to a TTS enqueue; the chapter attachment/alignment API remains a separate backend follow-up.

## Consequences

- Local import is safe for privacy and works without R2 availability, while the backend can still enforce ownership and stable identity.
- A backend-registered local asset can exist briefly before the main process commits its bytes; the UI must surface commit failures and allow repair/retry.
- Existing remote upload paths continue to use the default `REMOTE` storage mode.
- Per-device materialization confirmation for generated assets, packaged Electron E2E, and the backend user-audio attachment/alignment endpoint remain follow-up work. Workspace backup/restore is implemented as a manifest-verified directory snapshot; single-file archive and active workspace relocation remain packaging follow-ups.
