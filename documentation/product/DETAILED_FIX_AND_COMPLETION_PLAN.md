# NarrativeX — Detailed Fix & Completion Plan

**Review baseline:** `main` branch  
**Repository:** `huongni2201/NarrativeX`  
**Reviewed latest commit:** `30f116a7d611252a86da789514cfc85ce5314f6b`  
**Plan date:** 2026-10-03  
**Goal:** Close the gap between implemented foundations and a coherent, production-ready end-to-end Story → Video workflow.

---

# 1. Executive Summary

NarrativeX already has a strong architectural foundation:

- Electron Desktop as the only editor client.
- Spring Boot as the authoritative control plane.
- PostgreSQL for durable business/job state.
- Generation service as a domain-agnostic execution plane.
- Compute Protocol v1.
- Durable jobs, idempotency, outbox, signed callbacks, reconciliation, and SSE.
- Local-first project media.
- LTX video generation foundation.
- Take / SelectedTake model.
- Local FFmpeg final render.
- StoryBeat / AudioCue / VisualBeat domain hierarchy.

However, the product is not yet end-to-end complete.

The most important issue is that several features exist independently but are not connected into one coherent user journey. In particular:

1. Video production UI is partially orphaned.
2. FE / backend / worker capability support is inconsistent.
3. Project aspect ratio is not propagated to generation.
4. New-project navigation enters Editor too early.
5. Chapter source can be analyzed while unsaved.
6. Chapter selection can remain null after async loading.
7. Compute / Job status indicators can show fake status.
8. Jobs are not clearly project-scoped.
9. Take selection UX is not transaction-safe.
10. Settings are not sufficient for production operation.
11. LTX native AV contract is not fully normalized.
12. Documentation contradicts actual implementation.
13. Tests do not currently prove the full user journey.
14. Render recovery and long-form reliability are still incomplete.
15. Windows release hardening is unfinished.

The implementation order below is intentionally dependency-driven.

---

# 2. Target Product Flow

The canonical creator journey should be:

```text
Projects
  ↓
Create / Open Project
  ↓
Chapter Source
  ↓
Save & Analyze
  ↓
Canon Review
  ↓
Story Review
  ↓
Production
  ├─ readiness
  ├─ shot planning
  ├─ generate
  ├─ retake
  ├─ compare/select take
  └─ trim
  ↓
Editor
  ├─ timeline
  ├─ transitions
  ├─ subtitles
  └─ audio
  ↓
Render
  ├─ preflight
  ├─ render
  ├─ recovery
  └─ validation
  ↓
Export
```

Supporting screens:

```text
Assets
Jobs
Settings
Diagnostics
```

These support the workflow but should not replace the primary creator journey.

---

# 3. Priority Model

## P0 — Contract / correctness blockers

These issues can create false success, impossible UI actions, wrong output, or incompatible runtime behavior.

- Runtime capability mismatch.
- Video generation strategy mismatch.
- Project aspect ratio ignored downstream.
- Native AV schema mismatch.
- Dirty Source Analyze race.
- Incorrect hardcoded system/job status.

## P1 — Product workflow completion

- Connect VideoShotboard to the actual Production screen.
- Make Take selection / retake / trim usable from the main workflow.
- Fix project continuation routing.
- Fix chapter selection state.
- Scope Jobs properly.
- Add correct user-facing failure states.

## P2 — UX / editor / settings completion

- Simplify Production UI.
- Improve onboarding.
- Settings/runtime configuration.
- Richer editor workflow.
- Asset repair/replacement UX.
- Accessibility and keyboard workflow.

## P3 — Reliability / production release

- Render crash recovery.
- Soak tests.
- Disk pressure.
- Installer/signing/update.
- Diagnostics/crash reporting.
- Production backup evidence.

---

# 4. Phase 0 — Freeze the Current Architecture Truth

## Objective

Before adding more feature code, define one source of truth for what the runtime actually supports.

## Current mismatch

Desktop currently exposes:

```text
TEXT_TO_VIDEO
IMAGE_TO_VIDEO
FIRST_LAST_FRAME
```

Backend preflight also accepts those modes.

But LTX worker currently effectively supports only:

```text
TEXT_TO_VIDEO
```

This causes a user-visible invalid path:

```text
UI allows strategy
→ backend accepts strategy
→ durable job created
→ worker rejects strategy
```

## Decision for current release

Until I2V and First/Last Frame are proven end-to-end:

```text
SUPPORTED = TEXT_TO_VIDEO
PLANNED = IMAGE_TO_VIDEO
PLANNED = FIRST_LAST_FRAME
DEFERRED = MULTI_KEYFRAME
DEFERRED = VIDEO_EXTEND
DEFERRED = VIDEO_RETAKE
```

Do not infer support from enum membership.

---

# 5. Phase 1 — Introduce Runtime Capability Contract

## Goal

Desktop must only show capabilities that the currently active backend + worker can execute successfully.

## Backend

Create an explicit capability endpoint.

Recommended endpoint:

```http
GET /api/v1/runtime/capabilities
```

Example response:

```json
{
  "videoGeneration": {
    "available": true,
    "provider": "ltx",
    "model": "ltx-2.5-22b-distilled-int8",
    "profile": "ltx-2.5-22b-distilled-int8-native-av-v1",
    "strategies": [
      "TEXT_TO_VIDEO"
    ],
    "supportedAspectRatios": [
      "16:9"
    ],
    "resolutionProfiles": [
      {
        "width": 1280,
        "height": 720,
        "fps": 24
      }
    ],
    "audioModes": [
      "LTX_NATIVE_AV"
    ]
  }
}
```

## Backend files

Inspect/update:

```text
app/backend-service/src/main/java/com/narrativex/backend/
  feature/
    system/
    runtime/
    generation/
```

Recommended new classes:

```text
RuntimeCapabilityController
RuntimeCapabilityQuery
RuntimeCapabilityView
RuntimeCapabilityService
VideoRuntimeCapability
```

Do not make Desktop derive support from enums.

## Generation service

Expose authoritative executor capability.

Use existing executor metadata:

```python
task_types
models
task_schema_versions
workflow_profiles
ready
readiness_error
```

Do not duplicate strategy support in several places.

Recommended structure:

```python
VideoCapability(
    provider,
    model,
    profile_id,
    task_schema_versions,
    supported_strategies,
    width,
    height,
    fps,
    audio_modes,
    ready
)
```

## Desktop

Create:

```text
features/runtime/
  api/runtime-capabilities.api.ts
  queries/runtime-capabilities.queries.ts
  model/runtime-capabilities.ts
```

`ShotActionToolbar` must receive available strategies from runtime capability instead of hardcoding all enum values.

## Acceptance criteria

- Desktop never exposes unsupported strategy.
- If LTX is unavailable, Generate buttons are disabled with explicit reason.
- Runtime support is not duplicated independently in FE and BE.
- Capability data is cacheable but refreshable.
- Runtime version/model/profile can be shown in diagnostics.

---

# 6. Phase 2 — Normalize Video Generation Strategy Support

## Files to fix

Desktop:

```text
app/desktop/src/renderer/features/storyboard/components/ShotActionToolbar.tsx
app/desktop/src/renderer/features/storyboard/components/VideoShotboard.tsx
```

Backend:

```text
app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/service/GenerationPreflightEvaluator.java
app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/usecase/GenerateShotTakeUseCase.java
```

Worker:

```text
app/generation-service/src/narrativex_gpu_worker/adapters/executors/ltx/workflow.py
app/generation-service/src/narrativex_gpu_worker/adapters/executors/ltx/executor.py
```

Contracts:

```text
contracts/compute/v1/
packages/client-contracts/
```

## Immediate change

Current runtime should expose only:

```text
TEXT_TO_VIDEO
```

Do not allow:

```text
IMAGE_TO_VIDEO
FIRST_LAST_FRAME
```

until worker tests prove those workflows.

## Later implementation

When adding I2V:

1. Add runtime workflow.
2. Add artifact input contract.
3. Add worker test with real workflow graph contract.
4. Add backend preflight.
5. Add capability endpoint support.
6. Only then expose it in UI.

Same process for First/Last Frame.

## Tests

Required cross-layer test:

```text
capabilities reported by worker
=
capabilities accepted by backend
=
capabilities rendered by Desktop
```

---

# 7. Phase 3 — Fix Project Aspect Ratio End-to-End

## Current problem

Project creation supports:

```text
16:9
9:16
1:1
4:3
3:4
```

but generation still uses:

```text
1280x720
24 FPS
```

and Chapter generation request currently hardcodes:

```text
16:9
```

## Target design

Aspect ratio belongs to the Project production profile.

```text
Project
  └─ productionProfile
       ├─ aspectRatio
       ├─ targetResolution
       ├─ fps
       └─ framingPolicy
```

Avoid passing raw aspect ratio independently in every screen.

## Backend

Recommended model:

```text
ProjectProductionProfile
```

Example:

```json
{
  "aspectRatio": "16:9",
  "width": 1280,
  "height": 720,
  "fps": 24
}
```

## Desktop

Fix:

```text
app/desktop/src/renderer/features/chapters/screens/ChapterWorkspaceScreen.tsx
```

Remove:

```ts
aspectRatio: "16:9"
```

Use Project profile or do not send it if backend owns the setting.

## Worker

Worker must either:

### Option A — Current release

Declare only:

```text
16:9 / 1280x720 / 24fps
```

and prevent other project ratios from entering LTX generation.

### Option B — Full aspect support

Implement verified profiles:

```text
16:9 → 1280x720
9:16 → 720x1280
1:1  → supported validated size
4:3  → supported validated size
3:4  → supported validated size
```

Do not simply change width/height without confirming LTX workflow support.

## UX

If runtime supports only 16:9:

Create Project may still allow other ratios only if the product has an explicit reframe/crop strategy.

Otherwise:

```text
9:16 — Not available for AI video generation yet
```

## Acceptance tests

- Create a 16:9 project → final render 16:9.
- Create a 9:16 project → generation either works end-to-end or is blocked before job creation.
- No silent conversion from 9:16 to 16:9.

---

# 8. Phase 4 — Fix Chapter Source Save / Analyze Correctness

## Problem

Unsaved textarea changes can be visible while Analyze runs against persisted old source.

## Target UX

Replace independent Save + Analyze dependency with:

```text
Save
Save & Analyze
```

or:

```text
Analyze
→ automatically saves latest source first
```

Recommended:

```text
Save & Analyze
```

## Desktop files

```text
app/desktop/src/renderer/features/chapters/components/stages/ChapterSourceStage.tsx
app/desktop/src/renderer/features/chapters/screens/ChapterWorkspaceScreen.tsx
```

## Implementation

Parent flow:

```text
1. Validate title/source.
2. If dirty:
   PATCH/PUT Chapter.
3. Receive updated rowVersion/sourceHash.
4. Start Analyze using persisted current revision.
5. Navigate to analysis/review state.
```

Do not use a random idempotency key without binding it to the actual source revision.

Recommended semantic key:

```text
chapter-analysis:{chapterId}:{sourceHash}
```

or use a server-generated/revision-aware strategy.

## UX states

```text
Idle
Unsaved
Saving
Saved
Analyzing
Analysis complete
Analysis failed
```

## Acceptance criteria

- Analyze can never run against stale source while newer text is shown.
- Double-click does not create duplicate analysis.
- Re-analysis of unchanged source is idempotent.
- Changed source produces a new analysis revision.

---

# 9. Phase 5 — Fix Chapter Selection and Navigation State

## Problem

`selectedChapterId` initializes from `chapters[0]`, but chapters load asynchronously.

## Minimal fix

Synchronize selection in `useEffect`.

## Preferred fix

Make chapter context routable.

Recommended route:

```text
/projects/:projectId/chapters/:chapterId
```

Stage as query parameter:

```text
?stage=source
?stage=canon
?stage=story
?stage=production
```

Alternative:

```text
/projects/:projectId/chapters/:chapterId/production
```

## Benefits

- Refresh-safe.
- Deep-linkable.
- Browser back/forward works.
- Selection survives data reload.
- Future command palette can navigate directly.

## Files

```text
app/desktop/src/renderer/app/DesktopRouter.tsx
app/desktop/src/renderer/features/editor/ProjectWorkspaceRoute.tsx
app/desktop/src/renderer/features/chapters/screens/ChapterWorkspaceScreen.tsx
app/desktop/src/renderer/features/workspace/workspace-navigation.ts
```

## Acceptance criteria

- Existing project opens with a valid chapter selected.
- Deleted/currently unavailable chapter falls back to first valid chapter.
- Stage stays consistent on refresh.
- Back button behaves predictably.

---

# 10. Phase 6 — Make Production Screen the Real Video Production Workspace

## Current issue

`VideoShotboard` has real user actions but is not mounted in the canonical Chapter Production flow.

## Target Production screen

```text
┌────────────────────────────────────────────────────┐
│ Chapter Production                                │
│ ✓ Story   ✓ Voice   12/16 Shots   2 Need Review   │
│                              [Generate Remaining] │
├──────────────┬─────────────────────────────────────┤
│ Scene/Beat   │ Video Shotboard                     │
│ navigation   │                                     │
│              │ Shot cards                          │
│              │ preview                             │
│              │ generate                            │
│              │ retake                              │
│              │ takes                               │
│              │ approve                             │
├──────────────┴─────────────────────────────────────┤
│ selected Shot / Take inspector                    │
└────────────────────────────────────────────────────┘
```

## Refactor recommendation

`ChapterProductionStage` becomes orchestration/container.

Mount:

```tsx
<VideoShotboard ... />
```

inside it.

Do not duplicate Take lists in both:

```text
ChapterProductionStage
VideoShotboard
```

Choose one canonical interaction surface.

Recommended:

- `ChapterProductionStage`: status + filtering + batch actions.
- `VideoShotboard`: shot/take interaction.
- `TakeSelectorDrawer`: take compare/trim/select.
- `ShotActionToolbar`: shot command controls.

## Files

```text
app/desktop/src/renderer/features/chapters/components/stages/ChapterProductionStage.tsx
app/desktop/src/renderer/features/storyboard/components/VideoShotboard.tsx
app/desktop/src/renderer/features/storyboard/components/TakeSelectorDrawer.tsx
app/desktop/src/renderer/features/storyboard/components/ShotActionToolbar.tsx
app/desktop/src/renderer/features/chapters/screens/ChapterWorkspaceScreen.tsx
```

## Remove duplication

Avoid showing the same:

```text
Take #
status
QC
duration
```

in both the Production overview and Shotboard.

## Acceptance criteria

From Chapter Production screen user can:

- Generate first take.
- Watch generated take.
- Generate new take.
- Retake from an existing take.
- Change supported strategy.
- Open take selector.
- Trim in/out.
- Select authoritative take.
- Approve/re-review shot.
- Import replacement media.
- See preflight blockers.

No hidden/unreachable production feature remains.

---

# 11. Phase 7 — Make Batch Generate and Individual Generate Consistent

## Current architecture

There are both:

```text
Chapter batch generation
Individual Shot generation
```

This is correct, but they must share exactly the same admission rules.

## Target

Batch generation should freeze the list of eligible shots.

Each leaf must call the same authoritative Shot admission path.

The existing direction in `ChapterVideoBatchService` is good and should be kept.

## Rules

Batch parent:

```text
QUEUED
RUNNING
UNKNOWN
COMPLETED
FAILED
CANCELED
```

Each leaf:

```text
QUEUED
RUNNING
UNKNOWN
READY
FAILED
CANCELED
```

## Required additions

- Display parent batch progress in UI.
- Display which shots failed.
- Retry only failed eligible shots.
- Never regenerate READY shots implicitly.
- Cancellation must not incorrectly imply remote compute stopped.
- UNKNOWN must be reconciled before replay.

## Acceptance criteria

Restart backend during batch:

```text
batch resumes
no duplicate take
no duplicate provider submission
no lost parent progress
```

---

# 12. Phase 8 — Fix Take Selector State and Mutation UX

## Current issues

- Internal drawer state can survive across different shots.
- Selection mutation closes UI before server success.
- Error state is not clear enough.
- Numeric trim controls are too low-level for creator UX.

## Files

```text
app/desktop/src/renderer/features/storyboard/components/TakeSelectorDrawer.tsx
app/desktop/src/renderer/features/production/queries/video-production.queries.ts
```

## State reset

Reset on:

```text
shot.id
selectedTake.takeId
isOpen
```

## Save behavior

Current:

```text
click Apply
→ mutation
→ close immediately
```

Target:

```text
click Apply
→ pending
→ server success
→ refresh authoritative shot
→ close
```

Failure:

```text
keep drawer open
preserve values
show API error inline
```

## Improve trim UX

Keep numeric fields for precision, but also add visual trim rail:

```text
|----[ selected source range ]---------|
0                                     duration
```

Optional later:

- frame preview.
- waveform if audio-native.
- keyboard nudge.

## Concurrency

Use:

```text
expectedShotRowVersion
```

where appropriate.

If stale:

```text
"This shot changed elsewhere. Reload the latest Take selection."
```

Do not silently overwrite.

---

# 13. Phase 9 — Fix Compute / Job / Workspace Status Truth

## Current problems

Workspace passes:

```tsx
<ComputeStatusIndicator status="Ready" />
<JobStatusIndicator activeCount={0} />
```

This overrides real query state.

## Fix

Remove hardcoded props unless explicitly needed for storybook/test.

Use actual health/job data.

## Compute status

Do not derive entire compute readiness only from Gemini.

Need separate services:

```text
Backend
Gemini
Generation worker
LTX
VieNeu
WhisperX
ComfyUI
FFmpeg
```

## Suggested UI

Top bar:

```text
Compute: Ready
2 Jobs
```

Click Compute:

```text
Backend          Ready
Story Director   Ready
LTX              Ready
VieNeu           Idle
WhisperX         Idle
ComfyUI          Stopped
FFmpeg           Ready
GPU              21.8 / 31.8 GB
```

## Workspace status

Map status correctly:

```text
loading → neutral
ready   → success
partial → warning
error   → danger
empty   → neutral
```

Never use success green for `error`.

---

# 14. Phase 10 — Scope Jobs Correctly

## Current issue

Project route contains Jobs but job history is effectively global.

## Recommended backend API

Project:

```http
GET /api/v1/projects/{projectId}/jobs
```

System/global:

```http
GET /api/v1/jobs
```

or keep current `/jobs/history` as system diagnostics only.

## Desktop

Project Jobs defaults to project scope.

Optional toggle:

```text
This project
All system jobs
```

Only show global mode if useful for a single-user workstation.

## Add filters

```text
Status
Type
Chapter
Created time
```

## Details

Expanded job should show:

```text
Job ID
Job type
Chapter
Shot
Status
Current step
Progress
Started
Updated
Provider
Model
Compute task ID
Attempt ID
Error code
Retryable?
```

Technical details should live in an expandable diagnostics area.

---

# 15. Phase 11 — Improve New Project / Continue Flow

## Current problem

New project opens Editor.

## New project target

After creation:

```text
navigate(`/projects/${id}/chapters`)
```

Not Editor.

## Existing Project Card

Replace generic open-to-editor semantics with:

```text
Continue
```

Backend/FE determines recommended destination.

## Recommended resolver

```ts
resolveProjectContinuation(projectState)
```

Rules:

```text
0 chapters
→ chapters/source

chapter with unsaved/unanalysed source
→ chapters/source

analysis needs review
→ chapters/story

shots incomplete
→ chapters/production

production ready
→ editor

render in progress
→ render

final artifact exists
→ editor by default, with latest export action
```

## Project card

Display meaningful progress:

```text
3 chapters
12/16 shots ready
Last edited 2h ago
```

Avoid generic fake "Active" if it does not communicate workflow state.

---

# 16. Phase 12 — Simplify Production UI / UX

## Current problem

Production screen exposes too many implementation terms.

Examples:

```text
LTX
WhisperX
QC
Voice Identity Readiness
Direct to Timeline
```

## Product language

Primary UI should use creator concepts:

```text
Story ready
Voices ready
Video ready
Needs review
Ready to edit
```

Provider/model remains in secondary details.

### Current

```text
Generate Video Shots (Sản xuất Video LTX)
```

### Target

```text
Generate remaining shots
```

Tooltip/details:

```text
LTX 2.5 · 720p · 24 FPS
```

## Status cards

Replace 5 equally weighted cards with a single compact readiness strip.

Example:

```text
✓ Story
✓ Voices
12 / 16 video shots
2 need review
```

Use cards only if each card is actionable.

## Avoid mixed-language AI UI

Pick a UI language strategy.

Recommended:

- Vietnamese creator-facing product text.
- Stable English technical/domain nouns where translation would be awkward.
- Do not repeatedly show both translations in parentheses.

Bad:

```text
Validation / QC (Word Alignment)
```

Better creator UI:

```text
Kiểm tra lời thoại
```

Diagnostics can expose:

```text
WhisperX alignment
```

---

# 17. Phase 13 — Normalize LTX Native AV Contract

## Goal

One clear authoritative path for native audio/video generation.

## Target

```text
video.generate
schemaVersion = 1.1
NativeVideoGenerateInputs
```

for:

```text
LTX_NATIVE_AV
```

## Backend must construct structured input

Required:

```text
workflowProfileId
audioMode
prompt
negativePrompt
width
height
fps
durationMs
generationMode
seed
dialogue[]
voiceReference
cameraIntent
motionIntent
```

Do not rely on embedding dialogue/voice only as text inside prompt.

## Backend files

```text
GenerateShotTakeUseCase.java
TakeInputSnapshot.java
VideoGenerationJobHandler.java
VideoGenerationCatalog.java
```

## Worker

Keep:

```text
NativeVideoGenerateInputs
```

as the closed contract.

Remove ambiguous legacy mapping after cutover is stable.

## Audio modes

Define exactly:

```text
LTX_NATIVE_AV
AUDIO_FIRST
```

Then map to protocol intentionally.

Do not allow a mode that the active executor cannot honor.

## Voice

Voice profile snapshot should pin:

```text
voiceProfileId
versionNumber
rowVersion
language
accent
voiceDescription
deliveryBaseline
referenceAsset metadata if supported
```

The generated job must not change because someone edits the voice profile later.

---

# 18. Phase 14 — Remove Legacy / Duplicate Video Path

## Problem

Current codebase still contains multiple eras of video-generation handling.

Examples:

```text
legacy sourceText intent
new frozen TakeInputSnapshot
schema 1.0
schema 1.1
```

Migration compatibility is acceptable temporarily but should not become permanent architecture.

## Cutover plan

1. New requests only use new frozen snapshot.
2. Existing in-flight legacy jobs remain readable.
3. Add metrics/logging when legacy path is used.
4. Once no relevant old jobs remain in pre-production:
   - remove legacy write path.
   - remove fallback generation behavior.
   - retain migration/read support only where required.
5. Update docs.

## Rule

No new feature may depend on legacy branch.

---

# 19. Phase 15 — Improve Editor Workflow

## Current foundation

Editor already has:

- explorer.
- playback surface.
- inspector.
- asset selection.
- media replacement.
- render dialog.
- auto-edit plan.
- timeline-derived state.

## Remaining important work

### P1

- Clear selected Take identity.
- Show Shot → Take relationship.
- Distinguish imported vs generated video.
- Save/dirty/error state.
- Regenerate/replace without losing selection.
- Prevent editor manipulation before authoritative production readiness.

### P2

- split.
- trim.
- reorder where domain allows.
- keyboard shortcuts.
- multi-select.
- timeline zoom.
- snap.
- undo/redo status feedback.
- transition controls.

## Domain rule

Editor must never directly mutate low-level generated Take history.

It changes editing decisions / selected production sources.

Immutable generated history remains preserved.

---

# 20. Phase 16 — Settings & Runtime Configuration

## Current state

Settings currently mainly shows diagnostics and reset actions.

## Required production sections

```text
General
Video Generation
Audio
Compute / GPU
Storage
Rendering
Backup & Recovery
Diagnostics
```

## General

- language.
- default project ratio.
- default project folder.
- theme if supported.

## Video Generation

Read-only current runtime first:

```text
Provider: LTX
Model
Profile
Supported strategies
Resolution
FPS
Runtime status
```

Only expose mutable options that are actually safe.

## Audio

```text
VieNeu status
WhisperX status
local voice library
default narration mode
```

## Compute / GPU

```text
worker endpoint
worker status
GPU name
VRAM
runtime residency
```

Secrets must remain in Electron main / secure runtime configuration.

## Storage

```text
project root
used space
cache size
cleanup
missing assets
corrupt assets
```

## Rendering

```text
FFmpeg version
FFprobe version
hardware acceleration
render output defaults
```

## Backup & Recovery

```text
create backup
restore
unfinished jobs
recover/discard
```

---

# 21. Phase 17 — Asset Review / Replacement Completion

## Required

Assets screen should answer:

```text
What is this asset?
Where is it used?
Who generated/imported it?
Which Take/Shot/Beat references it?
Is it current?
Is it approved?
Is local data healthy?
```

## Add lineage

Show:

```text
Imported
Generated
Derived
Reframed
Replacement
```

## Repair UX

States:

```text
AVAILABLE
MISSING
CORRUPT
```

Actions:

```text
Locate local file
Re-download/materialize if supported
Replace
Regenerate
Remove unused
```

Do not silently substitute a different asset.

---

# 22. Phase 18 — Render Recovery Completion

## Current foundation

Already present:

- render journal.
- cache.
- lease.
- heartbeat.
- cancellation.
- unfinished-job discovery.

## Missing production behavior

Need explicit restart semantics.

## Render state machine

Recommended:

```text
PLANNED
PREFLIGHT
PREPARING
RENDERING_SEGMENTS
ASSEMBLING
VALIDATING
COMPLETED

RECOVERABLE
FAILED
CANCELED
UNKNOWN
```

## On Desktop startup

Detect unfinished render.

Show:

```text
Previous render was interrupted

Project: ...
Progress: ...
Last stage: ...

[Resume]
[Restart]
[Discard]
```

## Rules

Resume only if:

- snapshot still exists.
- required assets still match checksum.
- renderer version compatible.
- cache key compatible.
- lease can be reacquired safely.

Otherwise force Restart.

## Test scenarios

- kill Electron during segment rendering.
- kill FFmpeg.
- backend restart.
- network disconnect.
- lease expires.
- disk becomes full.
- local asset deleted.
- app shutdown.
- Windows reboot.

No scenario may produce duplicate successful finalization.

---

# 23. Phase 19 — Long-Form Reliability

NarrativeX targets long-form video, so 30-second happy-path testing is insufficient.

## Soak tests

Required target outputs:

```text
10 min
30 min
60 min
120 min
```

## Track

- render duration.
- peak memory.
- disk usage.
- cache size.
- FFmpeg exit code.
- frame/audio drift.
- subtitle sync.
- final checksum.
- recovery.

## Disk pressure

Before render:

```text
required estimate
+
safety reserve
<
available disk
```

Block early.

Do not let FFmpeg fail after 90 minutes due to predictable disk exhaustion.

---

# 24. Phase 20 — End-to-End Test Suite

## Problem

Source-level contract tests are useful but do not prove reachability.

## Add Electron E2E

Recommended:

```text
Playwright + Electron
```

or another Electron-compatible browser automation setup.

## Core test

```text
Create Project
→ Create Chapter
→ enter source
→ Save & Analyze
→ story appears
→ approve required entities/beats
→ production
→ generate shot
→ wait mocked compute result
→ select Take
→ trim
→ Editor
→ render mocked/short test media
→ final artifact exists
```

## E2E architecture

Provider runtime should be fake/deterministic.

Do not run expensive real LTX in ordinary CI.

Use:

```text
FakeComputeExecutor
FakeLtxWorker
fixture media
```

Then keep a separate hardware validation suite.

## Must-have E2E tests

### E2E-01 Happy path

```text
Project → final MP4
```

### E2E-02 Dirty source

```text
edit source
→ Analyze
→ latest source is analyzed
```

### E2E-03 Runtime unavailable

```text
LTX offline
→ Generate disabled
```

### E2E-04 Unsupported strategy

```text
worker supports only T2V
→ no I2V option visible
```

### E2E-05 Take failure

```text
take mutation fails
→ drawer stays open
→ error visible
```

### E2E-06 Restart

```text
generation running
→ reload Desktop
→ progress recovers
```

### E2E-07 Render recovery

```text
render interrupted
→ reopen
→ recover workflow appears
```

---

# 25. Phase 21 — Cross-Layer Contract Tests

Add tests that specifically prevent architecture drift.

## Capability contract

```text
Worker advertised strategies
=
Backend advertised strategies
=
Desktop available strategy controls
```

## Compute schema

Validate every backend-generated task against JSON Schema.

Example:

```text
GenerateShotTakeUseCase
→ serialized ComputeTask
→ task-video-generate schema
```

## Client contracts

Avoid maintaining handwritten duplicate representations.

Where practical, generate or validate client types against backend schema/OpenAPI.

## Runtime matrix test

Example:

| Mode | FE | Backend | Worker | Test |
|---|---|---|---|---|
| T2V | yes | yes | yes | required |
| I2V | no | no/explained | no | required |
| First/Last | no | no/explained | no | required |

---

# 26. Phase 22 — Documentation Cleanup

## Fix immediately

Update:

```text
README.md
documentation/CURRENT_STATUS.md
documentation/product/PRODUCT_SPEC.md
documentation/product/ROADMAP.md
documentation/workflows/STORY_TO_VIDEO.md
documentation/decisions/
```

## Resolve contradictions

Remove statements claiming both:

```text
video generation not implemented
```

and:

```text
LTX implemented
```

Current truth must be explicit.

Suggested wording:

```text
LTX Text-to-Video is implemented as the active video generation path.

Image-to-Video, First/Last Frame, Multi-Keyframe, Extend, and Video Retake
remain unavailable in the currently verified worker profile unless explicitly
listed by Runtime Capabilities.
```

## CURRENT_STATUS

Update the review date.

Prefer including:

```text
Verified against commit: <sha>
```

rather than intentionally omitting it.

This makes drift auditable.

---

# 27. Phase 23 — Release / Packaging Hardening

## Windows

Must prove:

```text
Install
Launch
Create project
Analyze
Generate with connected worker
Render
Export
Close
Reopen
Upgrade
Uninstall without deleting project data
```

## Required

- Electron Builder version pinned locally.
- Avoid `npx --yes electron-builder@...` as the long-term production package mechanism.
- Code signing.
- Installer identity.
- protocol registration verification.
- FFmpeg bundle verification.
- upgrade strategy.
- rollback strategy.
- data directory migration tests.

## Auto update

Do not implement auto-update until:

- artifact signing exists.
- update channel exists.
- rollback behavior defined.
- project data compatibility documented.

---

# 28. Phase 24 — Observability

## Add correlation

Every user-visible long-running operation should have:

```text
projectId
chapterId
storyVersionId
storyboardRevisionId
shotId
takeId
generationJobId
computeTaskId
computeAttemptId
renderJobId
```

where relevant.

## Desktop diagnostics

Create a support bundle:

```text
application version
OS version
FFmpeg version
runtime capability
backend health
worker health
recent error codes
job IDs
```

Do not include:

- secrets.
- provider credentials.
- full user story text by default.
- absolute private paths unless explicitly opted in.

---

# 29. Recommended FE Folder Cleanup

Keep feature ownership clear.

Recommended:

```text
features/
  projects/
  chapters/
  canon/
  story/
  production/
    api/
    queries/
    components/
      ProductionOverview
      VideoShotboard
      ShotCard
      ShotActionToolbar
      TakeSelectorDrawer
      TakeTrimEditor
    model/
  editor/
  render/
  assets/
  jobs/
  runtime/
  settings/
  workspace/
```

## Current concern

`storyboard/components/VideoShotboard.tsx` is logically now part of production, not the old storyboard feature.

Recommended eventual move:

```text
features/storyboard/components/VideoShotboard.tsx
→
features/production/components/VideoShotboard.tsx
```

Do this after integration tests are green.

Do not perform folder churn before functionality is connected.

---

# 30. Recommended Backend Boundary Cleanup

The backend modular monolith direction is good.

Keep responsibilities:

```text
project
storyboard
character
generation
media
render
system/runtime
```

## Important

Generation module owns:

- admission.
- durable jobs.
- take generation state.
- provider-neutral orchestration.

Storyboard owns:

- Shot semantics/planning.
- visual narrative state.

Worker does NOT own:

- NarrativeX project business rules.
- retry policy.
- final lifecycle decision.
- database state.

Preserve this boundary.

---

# 31. Database Review Actions

No full redesign is required.

But verify the following.

## Take

Must store immutable generation identity:

```text
shot_id
attempt_number
provider
model
generation_mode
generation_job_id
compute_task_id
compute_attempt_id
operation_plan_id
input_snapshot_json
input_fingerprint
output_asset_id
validation_status
status
```

## SelectedTake

Must be authoritative separately from Take.

Required:

```text
shot_id
take_id
source_in_ms
source_out_ms
row_version
updated_at
```

Do not mutate original Take to represent edit decisions.

## Project production profile

If aspect ratio/resolution is not modeled cleanly, add it now before production.

## Runtime support

Do not store active runtime capability as business truth in DB unless needed for historical snapshot.

For generation history, store the actual chosen:

```text
provider
model
modelRevision
workflowRevision
profile
width
height
fps
```

inside immutable input snapshot.

---

# 32. API Error Model

User-facing FE needs stable error codes.

Examples:

```text
CAPACITY_LIMIT
RUNTIME_UNAVAILABLE
UNSUPPORTED_STRATEGY
MISSING_REFERENCE
MISSING_VOICE_PROFILE
STALE_SHOT_VERSION
UNKNOWN_PREVIOUS_ATTEMPT
PROJECT_ASPECT_UNSUPPORTED
DISK_SPACE_INSUFFICIENT
ASSET_MISSING
ASSET_CORRUPT
```

Do not make FE parse backend message strings.

## UX mapping

Example:

```text
MISSING_VOICE_PROFILE
→ "Nhân vật này chưa có giọng. Hãy chọn giọng trước khi tạo video."
```

Diagnostics may display code.

---

# 33. UX Error Recovery Rules

Every async user command should follow one pattern.

```text
Idle
→ Pending
→ Success
or
→ Error
```

## During Pending

- Disable duplicate action.
- Preserve screen context.
- Show local action-level state.

## On Success

- Refresh authoritative server state.
- Do not rely solely on optimistic local assumptions.

## On Error

- Keep input.
- Show actionable message.
- Offer Retry only if safe.

Never silently swallow production mutation errors.

---

# 34. Remove Fake / Hardcoded UI Data

Audit for UI that renders static values as if live.

Known examples:

```text
Compute = Ready
Jobs activeCount = 0
VieNeu READY
WhisperX READY
ComfyUI READY
Gemini fallback model text
```

Create rule:

> Any UI status presented as runtime truth must come from runtime state or be explicitly labeled as configured/default.

Add source-level test preventing known hardcoded production statuses where possible.

---

# 35. Accessibility / Keyboard Work

Dense production/editor UI requires keyboard support.

## Minimum

- Visible focus states.
- Enter/Space for card actions.
- ESC closes drawers/dialogs.
- Focus returns to the triggering Shot after drawer closes.
- Tabs/select menus keyboard-accessible.
- No click-only div without keyboard semantics.
- Prevent focus behind modal drawers.

## Later

Shortcuts:

```text
Space      play/pause
J/K/L      playback
A          approve
R          retake
Enter      open take
Cmd/Ctrl+S save
Cmd/Ctrl+Z undo
Shift+Cmd/Ctrl+Z redo
```

---

# 36. Concrete Implementation Order

## Sprint / Milestone 1 — Runtime truth and correctness

### Tasks

- [ ] Add runtime capability contract.
- [ ] Restrict current worker capability to T2V.
- [ ] Remove unsupported strategy options from active UI.
- [ ] Align backend preflight.
- [ ] Fix hardcoded Compute status.
- [ ] Fix hardcoded Job count.
- [ ] Fix workspace status tone.
- [ ] Fix Source Save & Analyze.
- [ ] Fix Chapter async selection.
- [ ] Update conflicting docs.

### Exit criteria

No known UI action can intentionally create an unsupported worker job.

---

## Sprint / Milestone 2 — Complete Production vertical slice

### Tasks

- [ ] Mount `VideoShotboard` into canonical Production screen.
- [ ] Remove duplicate shot/take metadata UI.
- [ ] Wire Generate.
- [ ] Wire New Take.
- [ ] Wire Retake.
- [ ] Wire Take selector.
- [ ] Wire trimming.
- [ ] Wire selected take.
- [ ] Wire review.
- [ ] Wire import replacement media.
- [ ] Show blockers.
- [ ] Add correct mutation loading/error states.

### Exit criteria

One Shot can be produced entirely without leaving Production.

---

## Sprint / Milestone 3 — Project/profile consistency

### Tasks

- [ ] Introduce production profile.
- [ ] Remove hardcoded 16:9 from Chapter generation.
- [ ] Validate runtime aspect support.
- [ ] Connect render output dimensions.
- [ ] Add E2E ratio tests.

### Exit criteria

Aspect ratio is consistent from Project creation through final artifact.

---

## Sprint / Milestone 4 — Native AV normalization

### Tasks

- [ ] Normalize schema v1.1 for native AV.
- [ ] Structured dialogue input.
- [ ] Structured voice metadata input.
- [ ] Frozen voice/profile snapshot.
- [ ] Remove new writes to legacy video intent path.
- [ ] Add schema validation test.

### Exit criteria

Native AV jobs have one unambiguous backend → protocol → worker contract.

---

## Sprint / Milestone 5 — Creator UX

### Tasks

- [ ] New Project opens Source.
- [ ] Add Continue resolver.
- [ ] Simplify Production wording.
- [ ] Compact readiness UI.
- [ ] Improve Take selector.
- [ ] Project-scoped Jobs.
- [ ] Runtime Settings.
- [ ] Better operational diagnostics.

### Exit criteria

User can follow the workflow without understanding internal architecture.

---

## Sprint / Milestone 6 — Editor completion

### Tasks

- [ ] Media type distinction.
- [ ] Selected Take visibility.
- [ ] Save/dirty/error semantics.
- [ ] Review/regenerate/replace without lost context.
- [ ] Trim/split/reorder according to domain rules.
- [ ] Keyboard shortcuts.
- [ ] Accessibility pass.

---

## Sprint / Milestone 7 — Render reliability

### Tasks

- [ ] Resume rules.
- [ ] Restart/discard UX.
- [ ] FFmpeg crash behavior.
- [ ] OS shutdown behavior.
- [ ] lease-loss tests.
- [ ] cache invalidation.
- [ ] disk pressure.
- [ ] 1–2 hour soak tests.

### Exit criteria

Interrupted render cannot incorrectly finalize and can be recovered or safely restarted.

---

## Sprint / Milestone 8 — Release hardening

### Tasks

- [ ] Windows installer test matrix.
- [ ] Pin packaging dependencies.
- [ ] Code signing.
- [ ] Data preservation on update/uninstall.
- [ ] Auto-update design.
- [ ] Crash/support diagnostics.
- [ ] Production backup verification.

---

# 37. Testing Matrix

| Layer | Required |
|---|---|
| Backend unit | Domain/admission/state transitions |
| Backend integration | PostgreSQL + Flyway + MyBatis |
| Worker unit | Workflow generation, schemas, errors |
| Worker integration | Fake ComfyUI/LTX client |
| Contracts | JSON Schema compatibility |
| Desktop unit | hooks/model/view logic |
| Desktop component | interactions + error states |
| Electron E2E | creator journey |
| Hardware validation | actual LTX/RTX workstation |
| Render integration | actual FFmpeg |
| Long-form | 10/30/60/120 min |

---

# 38. Definition of Done for a Feature

A feature is not considered complete because code exists.

It is complete only when all applicable conditions are true:

- [ ] User can reach it from canonical UI.
- [ ] FE uses real backend API.
- [ ] Backend has authoritative state.
- [ ] Worker supports requested capability.
- [ ] Error path is user-visible.
- [ ] Retry semantics are safe.
- [ ] Reload/restart behavior is defined.
- [ ] Test covers normal path.
- [ ] Test covers failure path.
- [ ] Documentation matches actual runtime.
- [ ] No fake status or mock data appears in production.
- [ ] Unsupported options are not exposed.
- [ ] Accessibility is acceptable.
- [ ] Metrics/log correlation exists for long-running work.

---

# 39. Immediate File Checklist

## Desktop

Prioritize:

```text
app/desktop/src/renderer/features/editor/ProjectWorkspaceRoute.tsx
app/desktop/src/renderer/features/workspace/components/WorkspaceShell.tsx
app/desktop/src/renderer/features/workspace/components/ComputeStatusIndicator.tsx
app/desktop/src/renderer/features/workspace/components/JobStatusIndicator.tsx
app/desktop/src/renderer/features/workspace/queries/useProjectWorkspace.ts

app/desktop/src/renderer/features/projects/screens/ProjectsScreen.tsx
app/desktop/src/renderer/features/projects/components/ProjectDialogs.tsx

app/desktop/src/renderer/features/chapters/screens/ChapterWorkspaceScreen.tsx
app/desktop/src/renderer/features/chapters/components/stages/ChapterSourceStage.tsx
app/desktop/src/renderer/features/chapters/components/stages/ChapterProductionStage.tsx

app/desktop/src/renderer/features/storyboard/components/VideoShotboard.tsx
app/desktop/src/renderer/features/storyboard/components/TakeSelectorDrawer.tsx
app/desktop/src/renderer/features/storyboard/components/ShotActionToolbar.tsx

app/desktop/src/renderer/features/production/api/video-production.api.ts
app/desktop/src/renderer/features/production/queries/video-production.queries.ts

app/desktop/src/renderer/features/jobs/screens/JobsScreen.tsx
app/desktop/src/renderer/features/jobs/api/jobs.api.ts
app/desktop/src/renderer/features/jobs/queries/jobs.queries.ts

app/desktop/src/renderer/features/settings/screens/SettingsScreen.tsx
```

## Backend

Prioritize:

```text
app/backend-service/src/main/java/com/narrativex/backend/feature/generation/
  application/usecase/GenerateShotTakeUseCase.java
  application/service/GenerationPreflightEvaluator.java
  application/service/ChapterVideoBatchService.java
  application/model/TakeInputSnapshot.java
  infrastructure/dispatch/VideoGenerationJobHandler.java

app/backend-service/src/main/java/com/narrativex/backend/feature/storyboard/
app/backend-service/src/main/java/com/narrativex/backend/feature/project/
```

Add runtime capability module/query.

## Worker

Prioritize:

```text
app/generation-service/src/narrativex_gpu_worker/adapters/executors/ltx/executor.py
app/generation-service/src/narrativex_gpu_worker/adapters/executors/ltx/workflow.py
app/generation-service/src/narrativex_gpu_worker/contracts/task.py
```

## Contracts

```text
contracts/compute/v1/
packages/client-contracts/
```

## Documentation

```text
README.md
documentation/CURRENT_STATUS.md
documentation/product/PRODUCT_SPEC.md
documentation/product/ROADMAP.md
documentation/workflows/STORY_TO_VIDEO.md
documentation/architecture/
```

---

# 40. Recommended First PR Sequence

Do not combine every change into one huge PR.

## PR-01 — Runtime Capability Truth

Scope:

- capability endpoint.
- current T2V-only truth.
- worker capability mapping.
- FE strategy filtering.
- tests.

## PR-02 — Source Correctness + Chapter Navigation

Scope:

- Save & Analyze.
- chapter async selection.
- route/state cleanup.
- continuation helpers.

## PR-03 — Production Screen Integration

Scope:

- mount VideoShotboard.
- consolidate duplicated UI.
- real production interactions.

## PR-04 — Take UX

Scope:

- drawer state reset.
- wait-for-server save.
- error states.
- rowVersion conflict.
- trim UX.

## PR-05 — Project Production Profile

Scope:

- aspect ratio.
- resolution.
- FPS.
- runtime compatibility.

## PR-06 — Native AV Contract

Scope:

- schema v1.1.
- structured dialogue.
- voice snapshot.
- remove new legacy writes.

## PR-07 — Operational Truth

Scope:

- compute health.
- jobs.
- runtime diagnostics.
- settings.

## PR-08 — E2E Workflow

Scope:

- Electron E2E.
- fake provider.
- happy path.
- critical failure paths.

## PR-09 — Render Recovery

Scope:

- unfinished render UI.
- resume/restart/discard.
- lease and crash semantics.

## PR-10 — Release Hardening

Scope:

- package.
- signing.
- Windows upgrade.
- FFmpeg bundle.
- diagnostics.

---

# 41. Final Acceptance Gate for NarrativeX V1

NarrativeX V1 should not be declared complete until the following manual scenario passes on a clean Windows workstation.

## Scenario

1. Install NarrativeX.
2. Launch without development tooling.
3. Create Project.
4. Create Chapter.
5. Paste source text.
6. Save & Analyze.
7. Review extracted Canon/Story.
8. Enter Production.
9. Generate a video Shot.
10. Preview Take.
11. Generate second Take.
12. Select preferred Take.
13. Trim Take.
14. Continue to Editor.
15. Preview complete timeline.
16. Render.
17. Interrupt one render and verify safe recovery.
18. Render again.
19. Verify final MP4.
20. Close NarrativeX.
21. Reopen project.
22. Verify all selected Takes/editor choices remain.
23. Upgrade app.
24. Reopen same project.
25. Verify local data and final artifacts remain valid.

## Required result

```text
No unsupported control
No stale analysis
No fake status
No lost Take selection
No duplicate compute submission
No silent aspect-ratio change
No invalid finalization after crash
No dependency on source checkout
No developer-only runtime requirement
```

---

# 42. Final Recommendation

Do not add more advanced generation strategies yet.

The highest-value work is now:

```text
make existing foundations reachable
→ make capabilities truthful
→ make source/revision behavior correct
→ make Production coherent
→ make Take selection robust
→ make render recoverable
→ prove the entire journey with E2E
```

NarrativeX already has enough architectural pieces to build a solid V1. The next step should be integration and reliability, not adding more parallel subsystems.
