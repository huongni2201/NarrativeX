# NarrativeX — Legacy Image-First Cut-Over Dependency Inventory

**Status:** Authoritative Pre-Cutover Audit & Action Mapping  
**Date:** 2026-09-20  
**Authority:** ADR-0026, ADR-0027, ADR-0028, ADR-0029, ADR-0030, ADR-0031  

---

## 1. Context & Scope

NarrativeX is transitioning from an image-first architecture:
```text
Story → VisualBeat → Image Prompt → Image Generation (ComfyUI RealVisXL) → Pan/Zoom/Ken Burns → Timeline → Video Assembly
```
to a video-first, retention-driven architecture:
```text
Story → Retention Plan → VisualBeat → ShotSequence → Shot → GenerationStrategy → Moving Video Take → SelectedTake → Editing → Final Video → Retention Feedback
```

This inventory documents all code artifacts, persistence structures, compute contracts, and UI components maintaining the legacy path, their incoming/outgoing dependencies, and their target replacement in the video-first architecture.

---

## 2. Legacy Component Inventory & Classification

Each legacy component is categorized into one of four dispositions:
- **A — REMOVE**: Obsolete with zero forward value (e.g. Ken Burns zoompan filters, fake motion presets, still image timeline).
- **B — REPURPOSE**: Service retained but responsibility shifted (e.g. ComfyUI image generator shifted from primary scene footage to reference conditioning and keyframes).
- **C — MIGRATE**: Entity/data transitioned to the new model (e.g. `VisualBeat` shifted to dramatic beat; `Shot` became atomic production unit).
- **D — ARCHIVE / SUPERSEDE**: Historical docs and ADRs marked as superseded.

| Legacy item | Type | Location | Replacement | Migration phase | Delete? |
|---|---|---|---|---|---|
| **VisualBeat Entity (Image-Centric)** | C — MIGRATE | `app/backend-service/src/main/java/com/narrativex/backend/feature/storyboard/domain/entity/VisualBeat.java` | Dramatic beat entity holding `DramaticIntent`, `RetentionRole`, pointing to `ShotSequence` | Phase B (Domain cut-over) | No (repurposed to semantic container) |
| **visual_beats DB Table (Image Columns)** | C — MIGRATE | `app/backend-service/src/main/resources/db/migration/V1__project_story_and_planning.sql`, `V9__video_first_retention_production.sql` | `visual_beats` retains dramatic metadata; `shot_sequences` and `shots` become production tables | Phase B / Phase G | No (legacy columns made nullable; new columns added) |
| **MediaPlan & ProductionMode.IMAGE_MOTION** | C — MIGRATE | `app/backend-service/.../generation/domain/aggregate/MediaPlan.java` | `ProductionMode.VIDEO_FIRST` with `ShotSequence` and `GenerationStrategy` | Phase B / Phase D | No (IMAGE_MOTION retained for legacy read-only) |
| **VisualPromptComposer (Still Image)** | B — REPURPOSE | `app/backend-service/.../generation/application/service/VisualPromptComposer.java` | `VideoPromptCompiler` (Subject, Action, Camera, Subject Motion, Camera Motion, Temporal Progression) | Phase D | Deprecate for new video production |
| **Compute Task `image.generate` as Primary Scene Footage** | B — REPURPOSE | `contracts/compute/v1/schemas/task-image-generate.json`, `app/generation-service` | `video.generate` (LTX-2.5) for moving footage; `image.generate` strictly for references & keyframes | Phase D | No (restricted to references) |
| **ComfyUIExecutor (Still Scene Image)** | B — REPURPOSE | `app/generation-service/.../adapters/executors/comfyui/executor.py` | `LtxVideoExecutor` for video generation; ComfyUI retained for reference generation only | Phase D | No (repurposed for references) |
| **Timeline Auto-Edit Planner (Image Ken Burns)** | A — REMOVE | `app/desktop/src/renderer/features/production/auto-edit-planner.ts` | `EditingDirector` generating `EditDecisionList` from `SelectedTake` in/out points | Phase E / Phase G | Yes (remove synthetic image motion planning) |
| **Segment Renderer (Ken Burns Filter)** | A — REMOVE | `app/desktop/src/main/rendering/segment-renderer.ts` | Direct moving video segment encoding with SelectedTake trimming and hardware acceleration | Phase E / Phase G | Yes (remove `imageMotionFilter` from active path) |
| **Image Motion Presets (zoompan expressions)** | A — REMOVE | `app/desktop/src/shared/image-motion.ts` | Deprecated; no synthetic zoompan on still images in `VIDEO_FIRST` | Phase G | Yes (dead code removal after cutover) |
| **Storyboard Desktop UI (Image Cards)** | C — MIGRATE | `app/desktop/src/renderer/features/storyboard/components/` (`VisualBeatGrid.tsx`, `BeatRegenerationAction.tsx`, `StoryboardNavigator.tsx`) | **Video Shotboard** (`VideoShotboard.tsx`, `TakeSelectorDrawer.tsx`, `ShotActionToolbar.tsx`, `RetentionPlanView.tsx`) | Phase F | Yes (replaced by Video Shotboard) |
| **Fit Mode Fallbacks (FREEZE_END, LOOP on still images)** | A — REMOVE | `packages/client-contracts/src/production.ts`, `segment-renderer.ts` | Moving video footage trimmed via `SelectedTake` in/out points; no fake freeze-frames on stills | Phase E / Phase G | Deprecate for video-first |
| **Legacy ADRs (Motion Models in ADR-0002)** | D — SUPERSEDE | `documentation/decisions/ADR-0002-storyboard-character-continuity-and-production-workflows.md` | ADR-0026, ADR-0027, ADR-0028 | Phase A | No (marked superseded in historical record) |

---

## 3. Backward Compatibility Policy

1. **Legacy Projects**: Projects created with `production_mode = 'IMAGE_MOTION'` remain viewable and exportable via legacy snapshot adapters.
2. **New Projects**: All projects initialized after cut-over are strictly provisioned as `production_mode = 'VIDEO_FIRST'`.
3. **No Dual Production**: No feature will be added to generate still-image scene footage for new projects.
