# ADR-0012: Desktop local-first project media and final render execution

**Status:** Accepted and completed as the only final-render storage model  
**Date:** 2026-08-24; amended 2026-08-26  
**Supersedes:** remote/server final-video rendering and storage assumptions from earlier architecture.

## Context

NarrativeX uses Electron Desktop as its only editor. Long-form projects contain large images, narration, imported media, render intermediates and final MP4 files. Sending final video bytes through remote storage or backend proxy endpoints adds transfer cost, latency and duplicate execution/storage paths without helping the Desktop editing workflow.

The backend must remain authoritative for ownership, source versions, job admission, render policy, device assignment, leases and durable execution/artifact metadata. Desktop therefore owns project bytes and final rendering while backend contracts use stable identities and integrity metadata.

## Decision

### 1. Desktop project media is local-first

```text
<userData>/projects/<projectId>/
  project.manifest.json
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

The manifest is a local byte-location index, not a second domain database.

### 2. Backend contracts never contain absolute local paths

Backend contracts identify local inputs by stable asset IDs plus size/checksum metadata. Electron main resolves those IDs inside the project workspace.

Absolute filesystem paths must never be persisted to PostgreSQL or sent as durable backend state. Final-artifact completion records provider/identity metadata, checksum, size and an opaque local artifact key; the backend does not own the file bytes.

### 3. Electron main owns local storage and final execution

Electron main owns:

- project workspace creation;
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

### 4. Backend remains execution authority

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

### 5. Remote storage is generated-media transport only

AI/provider execution may use Cloudflare R2 when remote bytes must survive worker/provider boundaries. Accepted media required by the project is materialized into Desktop storage before final rendering.

There is no remote final-video storage fallback and no server-side final-render executor.

### 6. Final video delivery is local

Preview/open/reveal/export reads the final local MP4 through Electron capabilities. The backend does not expose final-video byte download/preview proxy endpoints.

Publishing/uploading a finished video is a separate explicit workflow operating from an exported/local artifact; it is not part of final render persistence.

## Current implementation checkpoint

Current implementation includes:

- `ProjectStorage` project workspaces and atomic schema-versioned manifests;
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

- One final-render executor and one final-video byte location.
- Long-form final video avoids remote round trips and backend proxy load.
- Backend policy/job authority is preserved without machine-specific paths.
- Local files are integrity-checked and sandboxed to one project workspace.
- Server worker/runtime/config surface is smaller.

### Negative

- Project/final media is machine-local unless an explicit synchronization/export feature is added.
- Reinstall/device migration and backup require separate product policy.
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
10. R2 is limited to generated-media transport/durability before Desktop materialization.

## Related decisions

- [ADR-0001: System topology, durable execution and persistence](./ADR-0001-system-topology-execution-and-persistence.md)
- [ADR-0003: Media storage, generation pipelines and external provider integrations](./ADR-0003-media-storage-generation-pipelines-and-external-integrations.md)
- [ADR-0010: Electron desktop editor client boundary](./ADR-0010-desktop-editor-client-boundary.md)
- [ADR-0011: Google OAuth-only desktop authentication](./ADR-0011-google-oauth-only-desktop-auth.md)
