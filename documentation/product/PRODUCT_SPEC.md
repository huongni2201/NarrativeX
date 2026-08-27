# NarrativeX — Product Specification V1.11

**Status:** maintained product contract  
**Canonical source:** [`../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`](../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md)  
**Implementation evidence:** [`../TRACEABILITY.md`](../TRACEABILITY.md)

## Product definition

NarrativeX is an AI-assisted long-form story-video studio. It is Desktop-only at the editor boundary, guest-first, Chapter-first, review-first, audio-timeline-first, image-first, backend-authorized and local-media-first for Desktop.

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
- Character/Location continuity and Scene/VisualBeat materialization;
- generated narration/voice preview plus native user-audio import/TTS-bypass foundations;
- Vertex image generation with Desktop review and verified local materialization;
- native local media registration without renderer path exposure;
- production timeline aggregation with narration-aligned timing;
- persisted beat media selection (V1);
- timeline duration/camera/fit draft editing with undo/redo/reset;
- narration-aware Auto Edit planning with atomic render override application;
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

Narration alignment is the duration authority. The product must not assume one file per Chapter, a fixed image count or a fixed duration per image.

For an image-selected beat, supported camera/motion controls may animate the image across the beat duration. For a video-selected beat, the editor should expose video-appropriate trim/fill behavior rather than forcing image-only camera controls.

## Narration contract

```text
NarrationStrategy
  TTS
  USER_PROVIDED_AUDIO
```

`USER_PROVIDED_AUDIO` can use one file across many Chapters or several ordered files across one scope. NarrativeX models one logical audio clock and aligns source spans to it. TTS generation/reservation is zero for the covered scope.

Generated and imported narration used by Desktop local render is materialized under the local project workspace and referenced through stable IDs/checksums.

## Media planning contract

The backend owns authorized immutable MediaPlan/production state. Workers and local devices execute the pinned plan and may only fall back/escalate within explicit authorization.

The primary low-cost motion path is deterministic FFmpeg image motion. Optional I2V remains a deferred/fast-follow provider-neutral capability rather than a core Desktop dependency.

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

## Remote generated-media transport contract

```text
Cloudflare R2
  -> retained server/provider pipeline media when remote durability is required
```

ADR-0003 governs remote generated-media transport. ADR-0012 governs the Desktop local-first path. Final MP4 bytes are local-only; do not state that generated project assets or final renders must be stored remotely.

## Current final-video behavior

Primary Desktop:

```text
backend-authorized production snapshot
  -> assigned LOCAL_DEVICE lease
  -> Desktop preflight
  -> resolve local media IDs/checksums
  -> journal + segment cache
  -> FFmpeg/ffprobe render
  -> immutable subtitle snapshot + checksum-verified local final MP4
  -> backend completion metadata
```

## Current versus target scope

| Capability | Status |
|---|---|
| Stable guest identity / guest-first workspace | IMPLEMENTED |
| Google-only account sign-in | IMPLEMENTED |
| In-context auth gate + ownership transfer | IMPLEMENTED foundation |
| Chapter analysis | IMPLEMENTED |
| Character/Location continuity | IMPLEMENTED foundation |
| Storyboard Scene/VisualBeat | IMPLEMENTED foundation |
| Generated narration + Desktop materialization | IMPLEMENTED foundation |
| User-provided narration import/TTS bypass | IMPLEMENTED foundation |
| Arbitrary multi-part audio production coverage | PARTIAL |
| Vertex image generation + Desktop materialization | IMPLEMENTED foundation |
| Native local asset registration | IMPLEMENTED foundation |
| Persisted beat media selection | IMPLEMENTED foundation |
| Generation SSE + reload recovery | IMPLEMENTED foundation |
| Auto Edit planning | IMPLEMENTED foundation |
| Render subtitle track | IMPLEMENTED foundation |
| Imported media duration probing | IMPLEMENTED foundation |
| Custom voice preview | IMPLEMENTED foundation |
| Mixed image/video beat timeline | IMPLEMENTED foundation |
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
  -> narration strategy + aligned timeline
  -> generated/imported beat media
  -> explicit production selections
  -> local materialization + integrity checks
  -> backend-authorized local render
  -> validated local MP4
```

A provider success response alone never completes a media stage. Results must be validated, assigned stable identity/lineage and materialized according to the active execution/storage mode.

Detailed feature/status inventory: [FEATURE_CATALOG.md](FEATURE_CATALOG.md). Active remaining work: [ROADMAP.md](ROADMAP.md).
