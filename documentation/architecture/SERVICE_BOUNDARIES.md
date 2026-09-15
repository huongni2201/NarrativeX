# NarrativeX Service and Module Boundaries — V1.12

NarrativeX uses one Spring Boot modular monolith as control plane, `generation-service` as domain-agnostic compute execution plane, and one Electron Desktop editor. These are ownership boundaries, not microservices for their own sake.

## Desktop renderer

Owns presentation only: routes/screens, React Query state, editor/timeline drafts, preview/inspector interactions and explicit typed preload calls. It does not own credentials, filesystem/process access, FFmpeg execution or durable policy.

## Preload

Exposes narrow task-specific capabilities. Never exposes arbitrary Node.js, filesystem, environment or process primitives.

## Electron main

Owns privileged Desktop behavior:

- native file/folder selection and hashing;
- ProjectStorage/ProjectCatalog and local manifest;
- backup/restore/storage verification;
- local device identity and render lease claim;
- render assignment/progress/failure/completion;
- FFmpeg/ffprobe, render journal/cache and final-artifact operations.

## Backend

| Boundary / Feature | Responsibility |
|---|---|
| `project` | Project/Chapter source, authoring and workspace hierarchy |
| `storyboard` | Scene/VisualBeat source anchors, review state and visual directions |
| `character` | Character, CharacterVersion snapshots, ProjectCharacter participation |
| `assets` | Stable MediaAsset identity, checksums, lineage, project media metadata |
| `generation` | Admission, GenerationJob, StageAttempt, ProviderOperation, capacity limits |
| `compute` | Compute task materialization, dispatch to generation-service, callback reconciliation |
| `render` | Immutable project render snapshots, lease assignment, FinalArtifact metadata |
| `local execution` | Device enrollment, assignment, heartbeat and capability tracking |
| `catalog` | System profiles, voice catalogs and style references |
| `runtime configuration` | Application settings, GPU target configuration, provider credentials |
| `common` | Shared primitives, error handling and API envelopes |

The backend never persists absolute Desktop project paths and never stores or proxies final MP4 bytes. Per ADR-0030, caller identity is not threaded through business use cases.

## Compute execution plane (`generation-service`)

Owns domain-agnostic compute execution under ADR-0028/ADR-0029:

- `contracts/compute/v1/` task processing;
- execution adapters: VoiceStudio, WhisperX, ComfyUI, media validation;
- local SQLite execution journal (`.runtime/execution_journal.sqlite3`) for crash recovery (ADR-0031);
- artifact download/upload via opaque capability URLs;
- zero business DB access and zero domain entity awareness.

Legacy `app/ai-worker` directly polling PostgreSQL is a temporary migration implementation scheduled for removal.

## Storage boundaries

```text
Generated project image/audio        -> project-local media -> Desktop ProjectStorage
Imported project image/audio/video   -> Desktop ProjectStorage
PROJECT voice reference              -> project-local media / project.manifest.json
GLOBAL_LOCAL voice reference         -> local application voice library
Render work/cache                    -> Desktop workspace/work
Final MP4                            -> Desktop workspace/artifacts
Business/job/artifact metadata       -> PostgreSQL
```

Project working media stays local. The backend coordinates metadata but does not serve media bytes.

## Timing boundary

```text
Generation-service: WhisperX forced alignment -> timestamp spans
Backend: text ranges + narration alignment -> production beat audio clock
Desktop: consume backend-authorized timeline for preview/render
```

Complete persisted beat audio spans remain compatibility input. Provisional fallback timing is review-only and cannot satisfy final render admission.

## Final-render boundary

The only final project render executor is Electron main under backend authorization/lease. Former server/cloud and Chapter-render executor paths are removed.

## Persistence

Production persistence uses MyBatis + explicit PostgreSQL SQL. Flyway **V1–V7** is the clean pre-production baseline. After first production deployment, future changes become append-only starting at V8.
