# NarrativeX Data Flow and Durability Model — V1.12

PostgreSQL state determines durable business/execution truth. Desktop owns machine-local project bytes; privileged local execution lives in Electron main.

## Authority matrix

| Concern | Authority |
|---|---|
| Identity/ownership/session | PostgreSQL |
| Project/Chapter/storyboard/continuity | PostgreSQL |
| Generation jobs/provider operations | PostgreSQL |
| Queue discovery | PostgreSQL polling/claim SQL |
| Production media selection | PostgreSQL |
| Narration/alignment metadata | PostgreSQL |
| Project byte locations | Desktop `project.manifest.json` |
| Render journal/cache | Desktop project work storage |
| Final MP4 bytes | Desktop project `artifacts/` |
| Voice reference/custom voice remote bytes | Cloudflare R2 |

Redis is not required by the MVP runtime.

## Chapter Analyze

```text
saved Chapter
  -> backend admission + immutable source identity
  -> GenerationJob / StageAttempt
  -> worker claim/lease
  -> analysis provider
  -> stale-source guard
  -> Character / Location / Scene / VisualBeat materialization
```

`VisualGenerationMode` supports `IMAGE` and `VIDEO`. VIDEO remains available for web/browser generation workflows; it does not create a Python video-provider role.

## Narration

```text
TTS
  -> provider/local inference
  -> validate + align
  -> project-local generated audio
  -> Desktop materialization

USER_PROVIDED_AUDIO
  -> native import
  -> logical global clock
  -> alignment
```

Narration timing is the production clock.

## Image generation

```text
backend-authorized image work
  -> provider execution/reconciliation
  -> validate result
  -> stable MediaAsset + checksum + lineage
  -> project-local generated image
  -> Desktop materialization
```

Generated project images are not uploaded to R2.

## Web/browser visual generation

```text
renderer intent
  -> typed preload capability
  -> Electron main Chrome/CDP automation
  -> generated image/video result validation
  -> backend stable media identity
  -> ProjectStorage commit
```

Provider web sessions stay in the privileged browser boundary.

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

## R2 flow

R2 is limited to authenticated account-owned voice-reference/custom-voice assets. A narration worker may read an authorized reference into local/ephemeral execution storage, but generated narration output returns to project-local media.

## Backup/restore

Desktop backup/archive tooling operates on manifest-verified project workspaces. Backend ownership and durable business state remain PostgreSQL-authoritative.

## Current gaps

- richer crash/restart local-render resume UX;
- adaptive narration-driven scene/beat planning;
- richer media reuse/reframe/edit lineage;
- complete arbitrary multi-part audio production behavior;
- packaging/signing/update hardening;
- complete billing/actual-usage and operational evidence.
