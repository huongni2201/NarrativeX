# NarrativeX Data Flow and Durability Model — V1.12

PostgreSQL state determines durable business/control truth. Desktop owns machine-local project bytes; privileged local execution lives in Electron main; domain-agnostic compute tasks execute in `generation-service`.

## Authority matrix

| Concern | Authority |
|---|---|
| Project/Chapter/storyboard/continuity | PostgreSQL |
| Generation jobs/provider operations | PostgreSQL |
| Compute dispatch & reconciliation | backend-service control plane |
| Non-monetary capacity quota state | PostgreSQL |
| Production media selection | PostgreSQL |
| Narration/alignment metadata | PostgreSQL |
| Project byte locations | Desktop `project.manifest.json` |
| Execution submission state | generation-service SQLite journal |
| Render journal/cache | Desktop project work storage |
| Final MP4 bytes | Desktop project `artifacts/` |

Redis and browser-based editors are removed. Per ADR-0030, application identity and account ownership models do not exist.

## Compute Task Execution Flow (Target Architecture)

```text
User action / scheduled generation
  -> backend-service validates policy & persists durable intent (PostgreSQL)
  -> backend-service builds closed ComputeTask (contracts/compute/v1/)
  -> backend-service submits ComputeTask via HTTP to generation-service
  -> generation-service records submission state (SQLite journal, ADR-0031)
  -> generation-service executes task via adapter (VoiceStudio, WhisperX, ComfyUI, validation)
  -> generation-service notifies backend callback / backend reconciles
  -> backend-service applies domain state transition in PostgreSQL
  -> Desktop receives SSE event / updates editor state
```

### Legacy AS-IS path (Migration only)

```text
backend persists GenerationJob in PostgreSQL
  -> legacy app/ai-worker polls and claims row from PostgreSQL directly
  -> worker executes provider logic and writes directly to business database
```
*Note: This direct-polling path is legacy migration residue and is being phased out as vertical slices cut over to `generation-service`.*

## Chapter Analyze

```text
saved Chapter
  -> backend admission + immutable source identity
  -> GenerationJob / StageAttempt
  -> compute task execution
  -> stale-source guard
  -> Character / Location / Scene / VisualBeat materialization
```

`VisualGenerationMode` supports `IMAGE` and `VIDEO`. VIDEO remains available for web/browser generation workflows; it does not create a Python video-provider role.

## Narration

```text
TTS
  -> generation-service VoiceStudio synthesis
  -> WhisperX forced alignment
  -> project-local generated WAV audio
  -> Desktop materialization

USER_PROVIDED_AUDIO
  -> native import
  -> logical global clock
  -> WhisperX forced alignment
```

Narration timing is the production clock.

## Image generation

```text
backend-authorized image work
  -> generation-service ComfyUI adapter (RealVisXL)
  -> validate result
  -> stable MediaAsset + checksum + lineage
  -> project-local generated image
  -> Desktop materialization
```

Generated project images are stored locally in Desktop ProjectStorage.

## Native import

```text
renderer requests import
  -> Electron main picker
  -> inspect/hash + short-lived selection token
  -> backend stable media identity
  -> ProjectStorage commit
```

Absolute machine paths do not enter backend domain state.

## Final project render

```text
production timeline + narration + selected image/video media
  -> backend admits project render
  -> reserve non-monetary capacity quota
  -> paired Desktop assignment
  -> claim + lease
  -> local preflight and checksum resolution
  -> render journal/cache
  -> FFmpeg/ffprobe
  -> subtitle mux where available
  -> local final MP4
  -> backend artifact metadata
```

There is no server/cloud final-render executor or remote final-video store.

## Backup/restore

Desktop backup/archive tooling operates on manifest-verified project workspaces. Durable business state remains PostgreSQL-authoritative.

## Current gaps

- completing compute cutover to `generation-service` and deleting legacy `app/ai-worker`;
- richer crash/restart local-render resume UX;
- adaptive narration-driven scene/beat planning;
- richer media reuse/reframe/edit lineage;
- packaging/signing/update hardening;
- richer provider execution telemetry and operational evidence.
