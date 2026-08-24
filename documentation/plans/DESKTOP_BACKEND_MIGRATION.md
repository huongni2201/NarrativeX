# NarrativeX Desktop Backend Migration

This branch migrates project rendering from cloud-only execution toward a desktop-first execution model while preserving the current cloud fallback during the transition.

## Target boundary

- Spring Backend remains the control plane and source of truth for users, ownership, project/story metadata, immutable timeline metadata, entitlements and job/lease state.
- Desktop owns project media bytes. Generated images, project narration/imported audio, local render intermediates and final MP4 files remain on the user's machine.
- Backend never stores or receives an absolute local filesystem path.
- Local render snapshots identify required bytes by stable `mediaAssetId` / `narrationAssetId`, size and checksum. Electron main resolves those IDs through the project's local manifest.
- R2 is not used for Desktop project media; only shared voice/sample audio remains R2-backed for the Desktop flow.
- `RENDER_PROJECT` supports `CLOUD` or `LOCAL_DEVICE` while migration fallback exists.
- A local device must be paired, online, and advertise `PROJECT_RENDER` before it can be assigned.
- Desktop claims only jobs assigned to its device token.
- Python project-render worker claims only `CLOUD` jobs.
- Local completion persists an opaque project-relative artifact key with provider `LOCAL_DESKTOP`; the actual MP4 remains on disk.

## Migration slices

1. **Backend execution routing**
   - execution target + assigned device on immutable project render snapshot
   - device validation/capability check
   - local claim/heartbeat/progress/complete/fail APIs
   - cloud worker excludes local jobs

2. **Local media identity contract**
   - replace remote storage-key assumptions in Desktop claim responses with asset IDs
   - include immutable size/checksum metadata for verification
   - never expose R2 credentials or presigned project-media downloads to Desktop render execution

3. **Desktop project storage**
   - project workspace under Electron `userData`
   - checksum-verified `project.manifest.json`
   - path traversal protection and project-relative asset/artifact keys
   - resolve local asset IDs before local execution begins

4. **Desktop executor**
   - device authentication
   - claim local jobs
   - resolve immutable snapshot inputs from local manifest
   - FFmpeg segmented render
   - register final artifact locally and report metadata/result to backend

5. **Desktop-first generation/storage**
   - image generation output is written/registered into the local project workspace
   - TTS/imported project audio is written/registered locally
   - shared voice/sample audio may be fetched from R2 and cached locally
   - production UI requests `LOCAL_DEVICE` once required local capabilities/assets are ready

6. **Retire cloud project renderer**
   - remove Python `ProjectRenderWorker` when local execution is fully proven
   - remove `CLOUD` path for project render when no longer needed
   - remove obsolete project-media R2 upload paths after image/audio generation have migrated to local-first execution

This document does not make Electron renderer code authoritative. All filesystem and execution operations remain behind Electron main/preload capability boundaries.
