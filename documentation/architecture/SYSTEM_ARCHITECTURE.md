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
  -> Python workers               -> PROJECT voice refs
                                  -> work/cache
                                  -> final MP4

Cloudflare R2
  -> ACCOUNT voice references/custom voices only
```

Redis is not part of the MVP runtime. Workers discover durable work from PostgreSQL.

## Backend authority

Backend owns guest/account ownership, Google-only authentication policy, Projects/Chapters/storyboard/production choices, quotas/admission, durable generation/provider state, voice-reference scope validation, local-device render leases, stable media identity/checksums/lineage, final-artifact metadata and Flyway schema.

It does not own absolute Desktop paths or final-video bytes.

## Electron main

Electron main owns native filesystem and hashing, ProjectStorage/ProjectCatalog and manifest integrity, Gemini Web/browser automation, local device credentials, FFmpeg/ffprobe, render journal/cache and final MP4 playback/export.

## Python workers

Current worker roles are `analysis`, `narration`, `media-validation` and `image-generation`.

Workers do not execute final project rendering and do not host a current video/I2V provider role. Analysis materialization resolves VisualBeat source anchors to deterministic UTF-16 text ranges; production text-to-audio mapping is owned by the backend timeline path.

## Project-media boundary

```text
Generated images                 -> project-local media -> Desktop ProjectStorage
Generated narration              -> project-local media -> Desktop ProjectStorage
Imported media                   -> Desktop ProjectStorage
PROJECT voice reference          -> project-local media / project.manifest.json
Render work/cache                -> Desktop project workspace/work
Final MP4                        -> Desktop project workspace/artifacts
ACCOUNT voice reference/custom voice -> Cloudflare R2
Metadata                         -> PostgreSQL
```

R2 is not used as generated-project-media transport, fallback or dual write.

## Production timing

```text
VisualBeat source_anchor
  -> UTF-16 textStart/textEnd
  -> narration/subtitle alignment
  -> backend NarrationTextClockMapper
  -> production beat audio clock
```

Complete persisted exact audio spans may remain compatibility input. Provisional fallback timing is Editor-review only and never satisfies final render readiness.

## Final render

```text
backend admits project render
  -> eligible paired Desktop assigned
  -> device claims lease
  -> preflight runtime/disk/assets
  -> require exact narration-aligned beat clock
  -> resolve stable IDs/checksums
  -> FFmpeg/ffprobe
  -> subtitle mux where available
  -> local final MP4
  -> backend artifact metadata
```

There is no cloud/server final-render executor, no server Chapter-render pipeline and no remote final-video fallback.

## Database baseline

The pre-production Flyway baseline is V1–V8. After first production deployment, applied migrations become immutable and subsequent changes are append-only.

## Remaining hardening

- packaged build/signing/auto-update and protocol/OAuth coverage;
- richer crash/restart render resume behavior;
- adaptive narration-driven scene/beat planning;
- richer asset reuse/reframe/edit lineage;
- complete billing/actual-usage reconciliation and operations evidence.
