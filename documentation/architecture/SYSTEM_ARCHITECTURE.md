# NarrativeX System Architecture — V1.12

NarrativeX is Desktop-only at the editor boundary, single-user local-first, and project-first. Spring Boot is the durable control plane; `generation-service` is the domain-agnostic compute execution plane; Electron main owns privileged local project-media and final-render execution.

## Topology

```text
Electron Desktop
  renderer -> UI / route / query / draft state
      |
  preload  -> narrow typed capabilities
      |
  main     -> native files / ProjectStorage / FFmpeg-ffprobe / local render
      |
      v HTTP / REST + SSE
Spring Boot Backend
  |  \
  |   \-> PostgreSQL (authoritative control/business state, Flyway V1-V7)
  |
  +-> Compute Protocol v1 (HTTP)
        |
        v
  generation-service
        |
        +-> VoiceStudio (TTS)
        +-> WhisperX (forced alignment)
        +-> ComfyUI (RealVisXL image generation)
        +-> media validation
        +-> SQLite execution journal (local crash recovery)
```

Redis and browser-based editors are removed.

## Backend authority

Backend owns Projects/Chapters/storyboard/production choices, non-monetary system capacity limits, durable generation/provider state, voice-reference scope validation, local-device render leases, stable media identity/checksums/lineage, final-artifact metadata and Flyway schema.

Per ADR-0030, there is no application User, Account, Authentication, Authorization, Session, or Tenant identity model. It does not own absolute Desktop paths, final-video bytes or a monetary billing/credit/pricing ledger.

## Electron main

Electron main owns native filesystem and hashing, ProjectStorage/ProjectCatalog and manifest integrity, local device credentials, FFmpeg/ffprobe, render journal/cache and final MP4 playback/export.

## Compute execution plane (`generation-service`)

`app/generation-service` is the target domain-agnostic execution plane under ADR-0028/ADR-0029. It accepts closed compute tasks over HTTP, tracks submission checkpoints (`NOT_SUBMITTED`, `SUBMITTING`, `SUBMITTED`, `UNKNOWN`) in a local SQLite journal, and dispatches to executor adapters (VoiceStudio, WhisperX, ComfyUI, media validation). It has zero access to the NarrativeX business database or project filesystem.

## Project-media boundary

```text
Generated images                 -> project-local media -> Desktop ProjectStorage
Generated narration              -> project-local media -> Desktop ProjectStorage
Imported media                   -> Desktop ProjectStorage
PROJECT voice reference          -> Desktop ProjectStorage / project.manifest.json
GLOBAL_LOCAL voice reference     -> local application voice library
Render work/cache                -> Desktop project workspace/work
Final MP4                        -> Desktop project workspace/artifacts
Metadata                         -> PostgreSQL
```

Project bytes are strictly local. The backend coordinates metadata but does not store, proxy or serve final video bytes.

## Production timing

```text
VisualBeat source_anchor
  -> UTF-16 textStart/textEnd
  -> narration/subtitle alignment
  -> backend NarrationTextClockMapper
  -> production beat audio clock
```

Narration alignment is the timing authority. Complete persisted exact audio spans may remain compatibility input. Provisional fallback timing is Editor-review only and never satisfies final render readiness.

## Final render

```text
backend admits project render
  -> reserve non-monetary capacity quota
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

The pre-production Flyway baseline is clean and squashed into **V1–V7**. The former patch sequences have been folded into the owning baseline migrations. After first production deployment, applied migrations become immutable and subsequent changes are append-only starting at V8.

## Remaining hardening

- packaged build/signing/auto-update;
- richer crash/restart render resume behavior;
- adaptive narration-driven scene/beat planning;
- richer asset reuse/reframe/edit lineage;
- provider execution telemetry and operational evidence.
