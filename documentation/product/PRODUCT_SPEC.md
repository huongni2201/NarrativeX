# NarrativeX — Product Specification

**Status:** maintained product contract
**Authority:** code, migrations, tests, and active ADRs


## Product definition

NarrativeX is an AI-assisted long-form story-video studio. It is Desktop-only at the editor boundary, single-user local-first, Project-first, review-first, audio-timeline-first, image-first and local-media-first.

Project creation and Chapter saving persist metadata and source text only. Analysis, narration/audio processing, image generation and final rendering are explicit user operations.

## Workspace & Identity

NarrativeX boots directly into the local workspace per ADR-0020. There is no user account, login gate, guest installation identity, session cookie, or multi-tenant entitlement model. External provider credentials and GPU target settings are managed through application settings and runtime configuration.

## Creator foundations

- Single-user boot directly into workspace;
- Project/StoryVersion/Chapter authoring and dashboard;
- Durable Chapter Analyze with Character/Location/Scene/StoryBeat/AudioCue/VisualBeat materialization where supported (via Vertex Gemini chapter analysis adapter); legacy unassigned VisualBeat compatibility remains partial;
- Generated narration plus native user-audio import and TTS-bypass foundations;
- Generation-service task execution (VieNeu TTS, WhisperX forced alignment, ComfyUI RealVisXL image generation, media validation);
- Native local image/audio/video registration and ProjectStorage materialization;
- Production timeline with narration-aligned timing and explicit beat media selection;
- Auto Edit planning, render overrides and immutable subtitle snapshots;
- Backend-assigned Desktop render claim and lease;
- Electron FFmpeg/ffprobe render, journals/cache and local final artifact registration.

## Visual intent and media model

```text
Project
  -> StoryVersion
      -> Chapter
          -> Scene
              -> StoryBeat
                  -> AudioCue[]
                  -> VisualBeat[]
                      -> selected image or video MediaAsset
```

`VisualGenerationMode` supports `IMAGE` and `VIDEO`.

- `IMAGE` supports backend/generation-service image generation via ComfyUI.
- `VIDEO` remains available as an analysis/editor visual intent; no active NarrativeX video-generation provider runtime exists.
- VIDEO intent does not imply an active Python worker video-provider role; video generation runtime is currently deferred / not implemented.
- The removed Wan/provider-side I2V runtime must not be restored implicitly.
- A video-selected beat uses trim/fill/video semantics. Image-only camera motion must not be forced onto video media.

## Narration

```text
NarrationStrategy
  TTS (VieNeu)
  USER_PROVIDED_AUDIO
```

Narration alignment is the timeline authority. Generated narration is written to project-local media and materialized into Desktop ProjectStorage. User-provided audio may span Chapters or use several ordered parts on one logical clock.

## Project-media storage contract

```text
Generated project images        -> project-local media -> Desktop ProjectStorage
Generated narration             -> project-local media -> Desktop ProjectStorage
Imported image/audio/video      -> Desktop ProjectStorage
PROJECT voice reference         -> Desktop ProjectStorage / manifest
GLOBAL_LOCAL voice reference    -> local application voice library
Render work/cache               -> Desktop project workspace/work
Final MP4                       -> Desktop project workspace/artifacts
Business/job/artifact metadata  -> PostgreSQL
```

Project bytes live locally. PostgreSQL stores metadata and opaque keys, while the backend may expose short-lived local-media capabilities for authorized Desktop transfer; it is not a durable media byte store.

## Provider accounting boundary

Monetary billing, credit balances, reservation settlement and user-facing provider-cost accounting are not part of the current runtime contract. System capacity limits enforce concurrent job limits. Provider execution retains only the non-monetary telemetry needed for diagnostics (such as token usage), while durable provider-operation fencing and UNKNOWN reconciliation remain authoritative for retry safety.

## Final render contract

```text
backend-authorized production snapshot
  -> assigned paired Desktop
  -> claim + lease
  -> resolve local asset IDs/checksums
  -> FFmpeg/ffprobe
  -> subtitle mux where available
  -> checksum-verified local MP4
  -> backend artifact metadata only
```

There is one final-render executor: Electron main. There is no cloud/server final-render executor, server-side Chapter render path or remote final-video fallback.

## Feature & Capability Matrix

| Feature / Capability | Status | Current direction |
|---|---|---|
| Single-user local-first workspace | IMPLEMENTED | Direct workspace boot, Project-level boundary (ADR-0020) |
| Authentication / account runtime | REMOVED | No User, Account, Session, OAuth or login gates |
| Per-user quota / entitlement | REMOVED | Monetary billing, user credits and per-user quotas retired |
| Runtime capacity limits | IMPLEMENTED foundation | System capacity reservations with terminal settlement |
| Project / Chapter authoring | IMPLEMENTED foundation | Backend-authoritative persistence + Desktop UI |
| StoryBeat semantic authoring | IMPLEMENTED foundation | Project -> StoryVersion -> Chapter -> Scene -> StoryBeat -> {AudioCue[], VisualBeat[]} (ADR-0024); legacy unassigned VisualBeat rows remain a compatibility path |
| Chapter Workspace (4 stages) | IMPLEMENTED | Source, Canon, Story, Production stages with 5-tab inspector |
| Chapter Analyze | IMPLEMENTED | Durable job/provider lifecycle (Vertex Gemini adapter) |
| Character / Location continuity | IMPLEMENTED foundation | Richer review/reference locking remains partial |
| Scene / VisualBeat storyboard | IMPLEMENTED foundation | Review + generation preparation |
| `IMAGE` visual intent | IMPLEMENTED | Backend/generation-service image workflows (ComfyUI) |
| `VIDEO` visual intent | IMPLEMENTED foundation | Retained as an editor intent; no active video-generation runtime |
| Python / Wan video provider | DEFERRED / NOT IMPLEMENTED | Video generation deferred; no active Wan/I2V/T2V pipeline |
| VieNeu narration | IMPLEMENTED foundation | Segmented headless TTS persists a project-local WAV master |
| User-provided narration | IMPLEMENTED foundation | Native import + logical audio clock |
| Compute Protocol v1 | IMPLEMENTED | JSON Schema contracts in `contracts/compute/v1/` |
| Generation-service execution plane | IMPLEMENTED foundation | Hexagonal FastAPI execution plane (`app/generation-service`) |
| Backend compute dispatch | IMPLEMENTED foundation | Control-plane task submission, artifact verification, signed callbacks, idempotent receipt/finalization, reconciliation, and SSE |
| Narration cutover | IMPLEMENTED foundation | VieNeu synthesis + WhisperX forced alignment through generation-service |
| Image cutover | IMPLEMENTED foundation | ComfyUI/RealVisXL execution with backend-owned artifact materialization |
| Legacy compute runtime removal | IMPLEMENTED | PostgreSQL-polling runtime, CI job and active configuration removed |
| Native local media import | IMPLEMENTED foundation | Image/audio/video via Electron main |
| Persisted beat media selection | IMPLEMENTED foundation | Effective image/video production source |
| Mixed image/video timeline | IMPLEMENTED foundation | Video trim/fill semantics remain richer than image controls |
| Auto Edit planning | IMPLEMENTED foundation | Narration-aware local render overrides |
| Render subtitle track | IMPLEMENTED foundation | Immutable narration/alignment snapshot → local SRT/mux |
| Desktop local workspace | IMPLEMENTED foundation | ProjectStorage/ProjectCatalog + manifest integrity |
| Backup/restore/archive-copy | IMPLEMENTED foundation | Local snapshots and safe replacement |
| Backend-assigned local render | IMPLEMENTED foundation | Paired device + claim/lease |
| Desktop FFmpeg project render | IMPLEMENTED foundation | Single current final-render executor |
| Render journal/cache | IMPLEMENTED foundation | Recovery/performance foundation |
| Final MP4 local storage | IMPLEMENTED | Backend stores metadata only |
| Direct final playback/export | IMPLEMENTED foundation | Local artifact, no backend byte proxy |
| Cloud / server final render | REMOVED | No fallback executor |
| Server-side Chapter render pipeline | REMOVED | Project render is the supported final-render path |
| Generated project media via R2 | REMOVED | Images/narration are project-local |
| Account-scoped voice storage in R2 | REMOVED | Voice assets transition to local storage (`PROJECT` / `GLOBAL_LOCAL`) |
| MyBatis production persistence | IMPLEMENTED | Explicit PostgreSQL SQL |
| Flyway clean pre-production baseline | IMPLEMENTED | Clean DB applies squashed V1–V8 final schema directly |
| Provider operation UNKNOWN/replay safety | IMPLEMENTED foundation | Reconcile/fence before external resubmission |
| Non-monetary provider usage telemetry | IMPLEMENTED foundation | Diagnostic usage where providers expose it; not pricing/accounting |
| Abrupt process / OS render recovery UX | PARTIAL | Journals exist; richer resume UX remains |
| Adaptive VisualScenePlanner | TARGET | Narration-driven adaptive scene/beat planning |
| Rich reuse/reframe/edit lineage | DEFERRED fast-follow | Richer asset reuse after core reliability |
| Packaging/signing/auto-update | TARGET | Release hardening |

## Acceptance direction

```text
project source
  -> analysis/review
  -> narration + aligned timeline
  -> generated/imported image or video media
  -> explicit production selection
  -> local materialization + integrity checks
  -> backend-authorized Desktop render
  -> validated local MP4
```

Provider success alone never completes a media stage. Results must be validated, assigned stable identity/lineage and materialized according to the active local-media contract.

Active remaining work: [ROADMAP.md](ROADMAP.md).
