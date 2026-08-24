# ADR-0012: Desktop local-first project media and local render execution

**Status:** Accepted  
**Date:** 2026-08-24  
**Supersedes for Desktop:** the global R2/Google Drive project-media assumptions in ADR-0003. ADR-0003 remains valid for retained cloud/legacy worker execution.

## Context

NarrativeX is migrating the primary creator experience from the Next.js browser studio to Electron Desktop. Long-form projects contain large images, narration, imported media, render intermediates and final MP4 files. Sending those bytes through cloud object/final-video storage for a Desktop-native editing workflow adds unnecessary transfer cost, latency and operational complexity, and prevents the app from taking full advantage of local FFmpeg and native filesystem access.

The backend must still remain authoritative for ownership, source versions, job admission, render policy, device assignment, leases and durable execution state. A Desktop local-first design therefore needs a strict boundary between backend identities/metadata and machine-local bytes.

## Decision

### 1. Desktop project media is local-first

For the primary Desktop workflow, project media is stored under Electron `userData` rather than R2/Google Drive:

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

`project.manifest.json` maps backend asset IDs to project-relative paths and integrity metadata:

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

Absolute filesystem paths must never be persisted to PostgreSQL or sent as durable backend state. Local final-artifact completion records an opaque project-relative artifact key and a provider identity such as `LOCAL_DESKTOP`, plus checksum/size/media metadata.

### 3. Electron main owns local storage and execution

Electron main owns:

- project workspace creation;
- asset import/registration;
- manifest reads/writes;
- workspace-boundary/path traversal protection;
- size/SHA-256 verification;
- FFmpeg/ffprobe capability probing and process execution;
- device identity and heartbeat;
- backend-assigned local render claim/progress/completion/failure lifecycle;
- render cancellation.

The renderer receives only narrow typed capabilities through preload. It never receives unrestricted Node.js/filesystem/process access.

### 4. Backend remains execution authority

A local render is not an offline ad-hoc render from renderer state. The backend admits and assigns a `LOCAL_DEVICE` render to an authorized device. The assigned device claims it with its device token and lease token.

The Desktop execution lifecycle is:

```text
backend assigns LOCAL_DEVICE job
  -> assigned device claims job
  -> resolve local asset IDs through project.manifest.json
  -> verify size/checksum
  -> execute immutable local render manifest with FFmpeg
  -> heartbeat lease + report progress
  -> ffprobe final MP4
  -> register local artifact + checksum
  -> complete backend job with LOCAL_DESKTOP + opaque artifact key
```

Lease loss aborts local execution. A device that no longer owns the lease may not finalize success.

### 5. Cloud storage/render becomes a migration fallback

The existing cloud/worker path remains available while Desktop migration is incomplete:

```text
cloud pipeline media -> Cloudflare R2
cloud final MP4      -> Google Drive
```

That topology is a fallback/legacy execution mode and must not redefine the Desktop project-media boundary.

R2 may continue to hold deliberately shared reusable assets, such as voice/sample media that must survive across installations, even when the active project media is local-first.

### 6. Migration is capability-gated

Desktop local rendering is enabled only when FFmpeg/ffprobe are available and local project rendering is enabled in configuration. Cloud fallback may remain selectable until Desktop parity and reliability gates are satisfied.

## Current implementation checkpoint

At `main` commit `751f006634218efb2c398fc00c2cbfecd25e1eac`:

- `ProjectStorage` creates project workspaces and an atomic schema-versioned manifest;
- asset/artifact resolution validates workspace boundaries, size and SHA-256;
- Electron main owns file/folder dialogs and local storage IPC;
- device pairing/identity, heartbeat and execution status exist;
- local project render claim resolves narration/image inputs by asset ID and checksum;
- lease heartbeat, progress, failure, completion and in-process cancellation are implemented;
- `ProjectRenderer` renders segments, concatenates video/audio, muxes narration, validates with ffprobe and registers a checksum-verified local final artifact;
- local project rendering is gated by FFmpeg availability and `NARRATIVEX_DESKTOP_PROJECT_RENDER_ENABLED=true`.

Process-restart crash recovery/resume, automatic local-device registration after user auth, and complete local registration for every generation/import path remain migration/hardening work and must not be reported as complete.

## Consequences

### Positive

- Long-form project bytes no longer require cloud round trips for the primary Desktop editing/render path.
- Final video export can remain on the user's machine.
- Backend policy/job authority is preserved without persisting machine-specific paths.
- Local files are integrity-checked and sandboxed to one project workspace.
- Electron security boundaries stay explicit.

### Negative

- Project media is machine-local unless an explicit synchronization/export feature is added.
- Reinstall/device migration and backup require separate product policy.
- Desktop must manage disk usage, cleanup and crash recovery safely.
- The repository temporarily supports local Desktop and cloud/legacy storage/render paths.

## Invariants

1. Renderer code cannot resolve arbitrary filesystem paths.
2. Absolute local paths are not durable backend identifiers.
3. Every local render input is resolved from a backend asset ID through the project manifest.
4. Expected size/checksum mismatches fail before rendering.
5. FFmpeg execution occurs outside the renderer.
6. Backend assignment/lease state remains authoritative for local execution.
7. Lease loss prevents successful completion.
8. Desktop final artifacts remain local unless an explicit user/publishing/cloud-storage workflow copies them elsewhere.
9. ADR-0003 R2/Drive rules apply to cloud/legacy execution, not to Desktop-local project bytes.

## Related decisions

- [ADR-0001: System topology, durable execution and persistence](./ADR-0001-system-topology-execution-and-persistence.md)
- [ADR-0003: Media storage, generation pipelines and external provider integrations](./ADR-0003-media-storage-generation-pipelines-and-external-integrations.md)
- [ADR-0010: Electron desktop editor client boundary](./ADR-0010-desktop-editor-client-boundary.md)
- [ADR-0011: Google OAuth-only desktop authentication](./ADR-0011-google-oauth-only-desktop-auth.md)
