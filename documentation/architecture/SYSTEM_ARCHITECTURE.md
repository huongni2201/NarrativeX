# NarrativeX System Architecture — V1.12

NarrativeX is Desktop-only at the editor boundary. Spring Boot is the durable control plane; Electron main owns privileged local project-media and final-render execution.

## Topology

```text
Electron Desktop
  renderer -> UI / route / query / draft state
      |
  preload  -> narrow typed capabilities
      |
  main     -> auth transport / native files / ProjectStorage /
              Chrome-CDP web providers / FFmpeg-ffprobe
      |
      +------------------------------+
      |                              |
Spring Boot Backend             Local project workspace
  -> PostgreSQL                   -> images/audio/video
  -> Python workers               -> work/cache
                                  -> final MP4

Cloudflare R2
  -> account-owned voice references/custom voices only
```

Redis is not part of the MVP runtime. Workers discover durable work from PostgreSQL.

## Backend authority

Backend owns:

- guest/account ownership and Google-only account authentication policy;
- Projects, Chapters, continuity/storyboard and production choices;
- quotas/admission and durable generation state;
- provider-operation reconciliation;
- local-device assignment, render leases and terminal state;
- stable media identity/checksums/lineage;
- final-artifact metadata;
- Flyway schema.

It does not own absolute Desktop paths or final-video bytes.

## Electron main

Electron main owns:

- guest installation credential and backend session transport;
- system-browser/deep-link auth integration;
- native file/folder selection and hashing;
- ProjectStorage/ProjectCatalog and manifest integrity;
- Gemini Web/browser automation including supported web video-generation flows;
- local device credentials and render claim/lease/progress lifecycle;
- FFmpeg/ffprobe, render journal/cache, final MP4 open/reveal/export.

## Python workers

Current worker roles:

```text
analysis
narration
media-validation
image-generation
```

Workers do not execute final project rendering and do not host a current video/I2V provider role. `VIDEO` remains an analysis/editor intent for web/browser generation and mixed-media production.

## Project-media boundary

```text
Generated images                -> shared project-local media -> Desktop ProjectStorage
Generated narration             -> shared project-local media -> Desktop ProjectStorage
Imported media                  -> Desktop ProjectStorage
Render work/cache               -> Desktop project workspace/work
Final MP4                       -> Desktop project workspace/artifacts
Voice reference/custom voice    -> R2 when account remote storage is required
Metadata                        -> PostgreSQL
```

R2 is not used as generated-project-media transport.

## Final render

```text
backend admits project render
  -> eligible paired Desktop assigned
  -> device claims lease
  -> preflight runtime/disk/assets
  -> resolve stable IDs/checksums
  -> FFmpeg/ffprobe
  -> subtitle mux where available
  -> local final MP4
  -> backend artifact metadata
```

There is no cloud/server final-render executor, no server Chapter-render pipeline and no remote final-video fallback.

## Database baseline

The pre-production Flyway baseline is V1–V8. Patch-only V9 history is folded into the owning baseline migrations. After first production deployment, applied migrations become immutable and subsequent changes are append-only.

## Remaining hardening

- packaged build/signing/auto-update and protocol/OAuth coverage;
- richer crash/restart render resume behavior;
- adaptive narration-driven scene/beat planning;
- richer asset reuse/reframe/edit lineage;
- complete billing/actual-usage reconciliation and operations evidence.
