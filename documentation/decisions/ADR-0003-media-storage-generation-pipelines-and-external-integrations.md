# ADR-0003: Media generation, local materialization and external provider storage

- **Status:** Accepted; amended 2026-08-29 for project-local generated media
- **Date:** 2026-08-20; amended 2026-08-26 and 2026-08-29
- **Scope:** Provider execution, generated project media, narration and account-owned voice references.
- **Desktop boundary:** [ADR-0012](./ADR-0012-desktop-local-first-media-and-render-execution.md)

## Context

NarrativeX is a Desktop editor. Generated images, generated narration, imported media, render work and final video are project media and should not have parallel remote-storage ownership once the project-local architecture is available.

Earlier iterations used Cloudflare R2 as a general generated-media transport and also retained remote final-video assumptions. Those paths are no longer part of the current runtime.

The only current R2 use case is authenticated account-owned **voice-reference/custom-voice** storage, where a reference must survive independently of one local project workspace.

## Decision

### 1. Project media is local

```text
AI-generated image bytes     -> shared project-local media root -> Desktop ProjectStorage
Generated narration bytes    -> shared project-local media root -> Desktop ProjectStorage
Imported image/audio/video   -> Desktop ProjectStorage
Render work/cache            -> Desktop project workspace/work
Final MP4                    -> Desktop project workspace/artifacts
```

PostgreSQL stores stable identity, ownership, lineage, checksums and execution metadata. Absolute machine paths are never durable backend identities.

### 2. R2 is voice-reference/custom-voice storage only

```text
Cloudflare R2
  -> authenticated account-owned voice references
  -> custom-voice source material when remote account storage is required
```

Generated project images, generated narration, imported project media and final MP4 files are **not** uploaded to R2 as transport or durability storage.

Provider/R2 credentials never enter the renderer.

### 3. Worker-generated project media

Workers may write generated project media to the configured shared project-media root. The backend persists a logical `PROJECT_LOCAL` storage key plus integrity metadata. Desktop then materializes/verifies the accepted media into its project workspace.

The shared worker/backend path is an implementation transport inside the local deployment boundary; it is not a second project store and absolute paths remain private to privileged processes.

### 4. Native Desktop imports

Desktop-native imports use Electron main for selection, inspection/hash and ProjectStorage commit. They do not require an R2 upload in order to become production media.

### 5. Voice references

Voice-reference upload/finalization remains an authenticated backend-controlled R2 workflow. Narration workers may copy the authorized reference into ephemeral/local execution storage for inference, but generated narration output returns to project-local media.

### 6. Visual generation

Backend/API image generation uses durable provider-operation state and reconciliation. Gemini Web image generation and supported web/browser video-generation flows execute through Electron main/browser automation. Web-provider credentials or session cookies do not enter backend/worker payloads.

`VIDEO` remains a valid visual intent. It is separate from the removed Python/Wan I2V runtime.

### 7. Final rendering

Final project rendering belongs to Electron main under backend assignment/lease control:

```text
materialized local project media
  -> Electron FFmpeg/ffprobe
  -> local artifacts/<jobId>/final.mp4
  -> backend final-artifact metadata only
```

There is no server/cloud final-render executor, remote final-video fallback, or backend final-video byte proxy.

## Invariants

1. PostgreSQL owns durable identity/policy/job state, not project bytes.
2. Generated/imported project media is local-first.
3. R2 is limited to account-owned voice-reference/custom-voice storage.
4. Final MP4 bytes are Desktop-local.
5. Narration timing drives visual timing.
6. Provider ambiguity remains `UNKNOWN` until reconciled.
7. Provider/R2 credentials never enter renderer code.
8. Absolute Desktop paths are never backend identities.
9. VIDEO/web generation support must not resurrect a Python video provider implicitly.

## Consequences

NarrativeX has one project-media ownership model and one final-render model. Removing general-purpose R2 transport reduces duplicate storage paths, cleanup work and contradictory metadata while preserving the account-scoped voice-reference use case that genuinely requires remote durability.

## Related decisions

- [ADR-0001: System topology, execution and persistence](./ADR-0001-system-topology-execution-and-persistence.md)
- [ADR-0010: Electron desktop editor client boundary](./ADR-0010-desktop-editor-client-boundary.md)
- [ADR-0011: Google OAuth-only desktop authentication](./ADR-0011-google-oauth-only-desktop-auth.md)
- [ADR-0012: Desktop local-first project media and render execution](./ADR-0012-desktop-local-first-media-and-render-execution.md)
