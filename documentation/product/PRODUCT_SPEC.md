# NarrativeX — Product Specification V1.11

**Status:** maintained product contract  
**Canonical source:** [`../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`](../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md)  
**Implementation evidence:** [`../TRACEABILITY.md`](../TRACEABILITY.md)

## Product definition

NarrativeX is an AI-assisted long-form story-video studio. It is Desktop-only at the editor boundary, guest-first, Chapter-first, review-first, audio-timeline-first, image-first, backend-authorized and local-media-first.

Project creation is metadata-only. Saving Chapter source does not implicitly run AI. Analysis, narration/audio processing, image generation and rendering are explicit operations.

## Authentication and entry experience

A new Desktop installation opens into a stable guest-owned workspace rather than forcing an account login screen.

```text
Desktop startup
  -> stable installation guest session
  -> free project/chapter/local-workspace authoring

Account/provider-consuming action
  -> backend AUTHENTICATION_REQUIRED
  -> LoginModal over current route
  -> Google OIDC in system browser
  -> one-time Desktop exchange
  -> eligible guest ownership transfer
  -> continue same project/editor context
```

Google is the only end-user account sign-in provider. Guest identity is an installation-scoped ownership/session mechanism, not a second account login method.

## Current creator foundations

Implemented foundations include:

- Project/StoryVersion/Chapter authoring and project dashboard/favorite flows;
- MyBatis + explicit SQL production persistence;
- durable Chapter Analyze and provider-operation reconciliation;
- Character/Location continuity and Scene/VisualBeat semantic materialization;
- beat-specific participating Character references;
- generated narration/voice preview plus native user-audio import/TTS-bypass foundations;
- persisted narration alignment with source/text/audio spans;
- Vertex/API image generation with Desktop review and verified local materialization;
- Gemini Web image generation through Desktop Chrome/CDP, including locked series style and serial Storyboard Generate All;
- native local media registration without renderer path exposure;
- production timeline aggregation with immutable planned timing plus generic fallback timing;
- persisted beat media selection;
- timeline duration/camera/fit draft editing with undo/redo/reset;
- narration-aware Auto Edit planning with atomic render override/snapshot application;
- immutable narration subtitle snapshot and local UTF-8 SRT render track;
- imported audio/video duration probing and custom voice preview jobs;
- local ProjectStorage/ProjectCatalog integrity, storage accounting/verification/cleanup;
- backup/restore/archive-copy foundations;
- backend-assigned local render preflight/lease/FFmpeg execution;
- render journals, unfinished-work discovery and immutable segment cache;
- checksum-verified local final artifact registration.

## Timeline and media model

```text
Project
  -> Chapter
      -> Scene
          -> VisualBeat
              -> selected image or video MediaAsset
```

Narration is the visual master clock when compatible real alignment exists. The product must not assume one file per Chapter, a fixed image count or a fixed duration per image.

Visual Beat source position, Chapter-audio position and global project-timeline position are separate coordinate systems. Current code does **not** yet materialize deterministic `text_start/text_end` for every analyzed beat or reconcile every storyboard beat to exact `audio_start_ms/audio_end_ms`. Generic fallback timing may keep the editor navigable but must not be labeled exact narration alignment.

Approved target:

```text
semantic VisualBeat source range
  -> deterministic UTF-16 text_start/text_end
  -> compatible narration alignment
  -> deterministic audio_start_ms/audio_end_ms
  -> global project startMs/endMs
```

AI chooses semantic source content; code owns numeric offsets/timestamps.

For an image-selected beat, supported camera/motion controls may animate the image across the beat duration. For a video-selected beat, the editor should expose video-appropriate trim/fill behavior rather than forcing image-only camera controls.

## Narration contract

```text
NarrationStrategy
  TTS
  USER_PROVIDED_AUDIO
```

`USER_PROVIDED_AUDIO` can use one file across many Chapters or several ordered files across one scope. NarrativeX models one logical audio clock and aligns source spans to it. TTS generation/reservation is zero for a scope explicitly covered by accepted user-provided audio.

Generated and imported narration used by Desktop local render is materialized under the local project workspace and referenced through stable IDs/checksums.

Arbitrary multi-part production coverage, correction UX and exact Visual Beat source-to-audio reconciliation remain incomplete and must stay distinct from the implemented alignment persistence foundation.

## Media planning contract

The backend owns authorized immutable MediaPlan/production state. Workers and local devices execute pinned backend policy and may only fall back/escalate within explicit authorization.

A current valid MediaPlan takes precedence over storyboard draft/fallback timing for production planning and render admission.

The primary low-cost motion path is deterministic FFmpeg image motion. Optional I2V remains a deferred/fast-follow provider-neutral capability rather than a core Desktop dependency.

## Visual generation contract

NarrativeX supports two distinct image-generation paths:

1. backend-authorized API/provider generation with durable jobs/provider reconciliation and materialization;
2. Desktop Gemini Web generation through a visible Chrome/CDP session with main-owned prompt/style locking and privileged local commit behind the preload capability boundary.

Gemini Web must not be represented as a backend API generation job or backend cost-estimate path merely because its accepted bytes become stable project media.

## Desktop storage contract

```text
Local project workspace
  -> generated/imported images
  -> narration/audio
  -> imported video
  -> render work/cache
  -> final local MP4
  -> backup/archive snapshots

PostgreSQL
  -> ownership, domain state, stable asset identity, policy, jobs, leases, lineage
```

`project.manifest.json` maps stable backend IDs to project-relative paths plus size/SHA-256. Absolute machine paths are never durable backend identities.

Cloudflare R2 is remote transport/durability for generated AI media only when remote provider/worker execution requires it. Final MP4 bytes are local-only; the backend stores metadata/state, not final-video bytes.

## Current final-video behavior

```text
backend-authorized production snapshot
  -> assigned LOCAL_DEVICE lease
  -> Desktop preflight
  -> resolve local media IDs/checksums
  -> journal + segment cache
  -> FFmpeg/ffprobe render
  -> immutable subtitle snapshot + local SRT
  -> checksum-verified local final MP4
  -> backend completion/artifact metadata
  -> direct Desktop playback/export
```

## Current versus target scope

| Capability | Status |
| --- | --- |
| Stable guest identity / guest-first workspace | IMPLEMENTED |
| Google-only account sign-in | IMPLEMENTED |
| In-context auth gate + ownership transfer | IMPLEMENTED foundation |
| Chapter analysis | IMPLEMENTED |
| Character/Location continuity | IMPLEMENTED foundation |
| Storyboard Scene/VisualBeat semantic state | IMPLEMENTED foundation |
| Beat-specific Character participation | IMPLEMENTED foundation |
| Generated narration + Desktop materialization | IMPLEMENTED foundation |
| Narration alignment persistence | IMPLEMENTED foundation |
| User-provided narration import/TTS bypass | IMPLEMENTED foundation |
| Arbitrary multi-part audio production coverage | PARTIAL |
| Deterministic VisualBeat source offsets | TARGET |
| VisualBeat narration timing reconciliation | TARGET |
| Exact draft storyboard timing before MediaPlan | TARGET/PARTIAL |
| Vertex/API image generation + Desktop materialization | IMPLEMENTED foundation |
| Gemini Web Desktop generation + local materialization | IMPLEMENTED foundation |
| Native local asset registration | IMPLEMENTED foundation |
| Persisted beat media selection | IMPLEMENTED foundation |
| Production timeline planned/fallback timing | IMPLEMENTED foundation |
| Narration-master draft preview clock | TARGET/PARTIAL |
| Generation SSE + reload recovery | IMPLEMENTED foundation |
| Auto Edit planning | IMPLEMENTED foundation |
| Render subtitle track | IMPLEMENTED foundation |
| Imported media duration probing | IMPLEMENTED foundation |
| Custom voice preview | IMPLEMENTED foundation |
| Mixed image/video beat model | IMPLEMENTED foundation |
| Desktop local FFmpeg render | IMPLEMENTED foundation |
| Render preflight/journal/cache | IMPLEMENTED foundation |
| Backup/restore/archive-copy | IMPLEMENTED foundation |
| Abrupt process/OS render recovery UX | PARTIAL |
| Packaging/signing/auto-update | TARGET |
| Adaptive VisualScenePlanner | TARGET |
| Rich reuse/reframe/edit lineage | DEFERRED fast-follow |
| HYBRID_LOCAL_I2V | DEFERRED fast-follow |
| Complete billing/actual-usage reconciliation | PARTIAL |

## Acceptance direction

The reliable creator-loop target is:

```text
guest/account project source
  -> analysis/review
  -> source-grounded Visual Beats
  -> narration strategy + alignment
  -> exact beat timing when compatible alignment exists
  -> generated/imported beat media
  -> explicit production selections
  -> local materialization + integrity checks
  -> backend-authorized local render
  -> validated local MP4
```

A provider success response alone never completes a media stage. Results must be validated, assigned stable identity/lineage and materialized according to the active execution/storage mode.

Detailed feature/status inventory: [FEATURE_CATALOG.md](FEATURE_CATALOG.md). Active remaining work: [ROADMAP.md](ROADMAP.md).
