# ADR-0007: Desktop local-first project media and final render execution

**Status:** Accepted and completed as the only final-render storage model  
**Date:** 2026-08-24; amended 2026-08-26 and 2026-08-29  
**Supersedes:** remote/server final-video rendering, project-media synchronization, and remote project-media storage assumptions from earlier architecture.

## Context

NarrativeX uses Electron Desktop as its only editor. Long-form projects contain large images, narration, imported media, render intermediates and final MP4 files. Sending project bytes through remote storage or synchronizing them between Desktop installations adds transfer cost, latency and duplicate ownership paths without helping the local editing workflow.

The backend remains authoritative for project scope, source versions, job admission, render policy, durable queues, leases and execution/artifact metadata. Desktop owns the project workspace and project bytes. NarrativeX is single-user local-first; installations do not synchronize project workspaces or project media.

Voice references are local PROJECT or GLOBAL_LOCAL assets. Google/Gemini Chrome login is provider/browser state and does not create a NarrativeX account or shared ownership boundary.

## Decision

### 1. Desktop project media is device-local

```text
<userData>/projects/<projectId>/
  project.manifest.json
  project.json
  assets/
    images/
    audio/
    video/
  artifacts/
    <jobId>/final.mp4
  work/
```

`project.manifest.json` maps backend asset/job IDs to project-relative paths and integrity metadata:

```text
assetId / jobId
relativePath
sizeBytes
checksumSha256
updatedAt
```

The local project catalog determines which projects are visible/openable on that Desktop installation. Backend project records are not imported into another device's local catalog as a synchronization feed.

A project created on Device A is not discovered by Device B. Device B starts with its own local project catalog and creates independent project data.

### 2. Backend contracts never contain absolute local paths

Backend contracts identify local inputs by stable IDs plus size/checksum metadata. Electron main resolves those IDs inside the project workspace.

Absolute filesystem paths must never be persisted to PostgreSQL or sent as durable backend state. Final-artifact completion records identity metadata, checksum, size and an opaque local artifact key; the backend does not own the file bytes.

### 3. Project media has one storage boundary

Generated narration, generated images, imported project media, render inputs, render intermediates and final video are project-local media. Production project-media flows must not switch to `REMOTE`, `HYBRID`, or remote-storage fallback modes.

Media selection must require that the chosen media identity is READY and available in the current project-local boundary before it becomes a production beat selection.

### 4. Electron main owns local storage and final execution

Electron main owns:

- project workspace creation;
- local project catalog persistence;
- asset import/registration and generated-media materialization;
- manifest reads/writes;
- workspace-boundary/path traversal protection;
- size/SHA-256 verification;
- FFmpeg/ffprobe capability probing and process execution;
- device identity and heartbeat;
- backend-assigned render claim/progress/completion/failure lifecycle;
- render journal/cache;
- final MP4 validation, playback, reveal and export;
- render cancellation.

The renderer receives only narrow typed capabilities through preload. It never receives unrestricted Node.js/filesystem/process access.

### 5. Backend remains execution authority

A final render is not an offline ad-hoc render from renderer state. The backend admits and assigns the job to an authorized local device. The assigned device claims it with its device token and lease token.

```text
backend assigns render job
  -> assigned device claims job
  -> resolve local asset IDs through project.manifest.json
  -> verify size/checksum
  -> execute immutable local render manifest with FFmpeg
  -> heartbeat lease + report progress
  -> ffprobe/checksum final MP4
  -> write local artifacts/<jobId>/final.mp4
  -> register backend FinalArtifact metadata
  -> complete backend job
```

Lease loss aborts local execution. A device that no longer owns the lease may not finalize success.

### 6. Local voice-reference storage

Reusable voice/reference assets use PROJECT or GLOBAL_LOCAL local scopes. No remote voice-storage
path is part of the current runtime.

Project images, generated narration, imported project media, render intermediates and final video are not uploaded to remote storage for synchronization, transport or durability.

### 7. Final video delivery is local

Preview/open/reveal/export reads the final local MP4 through Electron capabilities. The backend does not expose final-video byte download/preview proxy endpoints.

Publishing/uploading a finished video is a separate explicit workflow operating from an exported/local artifact; it is not part of final render persistence.

## Current implementation checkpoint

Current implementation includes:

- `ProjectStorage` project workspaces and atomic schema-versioned manifests;
- a Desktop local project catalog used as the project discovery boundary;
- workspace-boundary, size and SHA-256 validation;
- Electron main native file/folder and storage capabilities;
- device identity, heartbeat and execution state;
- backend-assigned local render claim and lease lifecycle;
- narration/image/video input resolution by stable asset ID/checksum;
- local FFmpeg/ffprobe render pipeline;
- progress, failure, completion and in-process cancellation;
- render journals and immutable segment cache;
- checksum-verified local final MP4 plus backend metadata registration;
- direct local artifact playback/reveal/export.

Richer process/OS-crash recovery/resume and long-duration soak validation remain reliability hardening work.

## Consequences

### Positive

- One project-media ownership model per Desktop installation.
- Separate installations do not accidentally merge project workspaces or media.
- One final-render executor and one final-video byte location.
- Long-form project media avoids remote round trips and backend proxy load.
- Backend policy/job authority is preserved without machine-specific paths.
- Local files are integrity-checked and sandboxed to one project workspace.
- Custom voice remains reusable across devices without sharing project data.

### Negative

- Project/final media is intentionally machine-local.
- Reinstall/device migration and backup require a separate explicit product feature.
- Desktop must manage disk usage, cleanup and crash recovery safely.

## Invariants

1. Renderer code cannot resolve arbitrary filesystem paths.
2. Absolute local paths are not durable backend identifiers.
3. Every local render input resolves from stable backend identity through the project manifest.
4. Expected size/checksum mismatches fail before rendering.
5. Final FFmpeg execution occurs in Electron main, never Python workers or unrestricted renderer code.
6. Backend assignment/lease state remains authoritative for execution.
7. Lease loss prevents successful completion.
8. Final MP4 bytes remain local unless an explicit user export/publish workflow copies them elsewhere.
9. Backend FinalArtifact persistence is metadata-only.
10. Project discovery is device-local; backend project lists are not synchronization feeds.
11. Project media never uses R2 fallback or cross-device synchronization.
12. Voice/reference assets use local PROJECT or GLOBAL_LOCAL scopes.

## Related decisions

- [ADR-0001: System topology, durable execution and persistence](./ADR-0001-system-topology-execution-and-persistence.md)
- [ADR-0003: Media storage, generation pipelines and external provider integrations](./ADR-0007-desktop-local-first-media-and-render-execution.md)
- [ADR-0006: Electron desktop editor client boundary](./ADR-0006-desktop-editor-client-boundary.md)
- [ADR-0020: Single-user local-first architecture](./ADR-0020-single-user-local-first-architecture.md)
