# NarrativeX — Image-First Legacy Dependency Inventory

**Status:** Authoritative Pre-Cutover Audit  
**Date:** 2026-09-20  
**Scope:** Identification and mapping of all image-first, still-timeline, and Ken Burns motion components scheduled for cut-over and deprecation.

---

## 1. Inventory Summary

The legacy production path operates as:
```text
Story → VisualBeat → Image Prompt → Image Generation (ComfyUI RealVisXL) → Pan/Zoom/Ken Burns → Timeline → Video Assembly
```

This inventory documents all code artifacts, persistence structures, compute schemas, and UI components maintaining this path, their incoming/outgoing dependencies, and their target replacement in the video-first, retention-driven architecture.

---

## 2. Dependency Inventory Table

| Component | Repository Location | Incoming Dependencies | Outgoing Dependencies | Replacement | Removal Phase |
|---|---|---|---|---|---|
| **VisualBeat Entity (Image-Centric)** | `app/backend-service/src/main/java/com/narrativex/backend/feature/storyboard/domain/entity/VisualBeat.java` | `StoryboardMapper`, `ChapterStoryQueryAdapter`, `UpdateVisualBeatUseCase`, `VisualPromptComposer` | `MotionMode`, `VisualBeatReviewStatus`, `AspectRatio` | Dramatic beat entity with `DramaticIntent`, `RetentionRole`, pointing to `ShotSequence` | Phase G (Legacy accessors preserved for backward-compatibility reads) |
| **visual_beats DB Table** | `db/migration/V1__project_story_and_planning.sql`, `V2__generation_and_media.sql` | `visual_beat_characters`, `media_generation_items`, `render_beat_overrides` | PostgreSQL schema | `visual_beats` retains metadata; `shot_sequences` and `shots` become production tables | Phase G (Legacy columns kept nullable) |
| **MediaPlan & ProductionMode** | `app/backend-service/.../generation/domain/aggregate/MediaPlan.java` | `CreateMediaJobUseCase`, `GenerationJob` | `ProductionMode.IMAGE_MOTION`, `imageAspectRatio`, `imageProviderKey` | `ProductionMode.VIDEO_FIRST` with `ShotSequence` and `GenerationStrategy` | Phase G (IMAGE_MOTION read-only) |
| **VisualPromptComposer** | `app/backend-service/.../generation/application/service/VisualPromptComposer.java` | `CreateMediaJobUseCase`, `BatchMediaItemComposer` | Character snapshots, Location canon, Camera direction JSON | `VideoPromptCompiler` (Subject, Action, Camera, Subject Motion, Camera Motion, Temporal Progression) | Phase D / Phase G |
| **Compute Task `image.generate` as Primary Footage** | `contracts/compute/v1/schemas/task-image-generate.json`, `app/generation-service` | Backend `GenerationJob` dispatch | ComfyUI RealVisXL | `video.generate` (LTX-2.5) for moving footage; `image.generate` restricted to references & keyframes | Phase D / Phase G |
| **ComfyUIExecutor (Still Image)** | `app/generation-service/src/narrativex_gpu_worker/adapters/executors/comfyui/executor.py` | Worker task router | ComfyUI Client, RealVisXL txt2img workflow | `LtxVideoExecutor` / ComfyUI LTX video workflow adapter | Phase D (ComfyUIExecutor retained for reference generation only) |
| **Timeline Auto-Edit Planner (Image Ken Burns)** | `app/desktop/src/renderer/features/production/auto-edit-planner.ts` | `useRenderController`, `TimelineScreen` | `DesktopTimelineBeat`, `imageMotionPreset` | `EditingDirector` generating `EditDecisionList` from `SelectedTake` in/out points | Phase E / Phase G |
| **Segment Renderer (Ken Burns Filter)** | `app/desktop/src/main/rendering/segment-renderer.ts` | `project-renderer.ts` | `imageMotionFilter`, `image-motion.ts` | Direct moving video segment encoding with SelectedTake trimming and hardware acceleration | Phase E / Phase G |
| **Image Motion Presets** | `app/desktop/src/shared/image-motion.ts` | `segment-renderer.ts`, `auto-edit-planner.ts` | FFmpeg `zoompan` filter expressions | Deprecated; no synthetic zoompan on still images in `VIDEO_FIRST` | Phase G |
| **Storyboard Desktop UI** | `app/desktop/src/renderer/features/storyboard/components/` (`VisualBeatGrid.tsx`, `BeatRegenerationAction.tsx`, `StoryboardNavigator.tsx`) | `ChapterWorkspaceScreen`, `StoryboardScreen` | Feature query hooks, Still image asset previews | **Video Shotboard** (`VideoShotboard.tsx`, `TakeSelectorDrawer.tsx`, `ShotActionToolbar.tsx`, `RetentionPlanView.tsx`) | Phase F / Phase G |
| **Fit Mode Fallbacks (LOOP, FREEZE_END, SPEED_ADJUST)** | `packages/client-contracts/src/production.ts`, `segment-renderer.ts` | Desktop timeline editing | FFmpeg filter graphs | In `VIDEO_FIRST`, footage must be moving and trimmed via `SelectedTake` in/out points; no fake freeze-frames | Phase E / Phase G |

---

## 3. Transitional Compatibility Guarantees

1. **Legacy Projects**: Projects created under `production_mode = 'IMAGE_MOTION'` remain viewable and exportable through backward-compatible snapshot renderers.
2. **New Projects**: All projects initialized after cut-over are strictly provisioned as `production_mode = 'VIDEO_FIRST'`.
3. **No Dual Production**: No feature will be added to generate still-image scenes for new projects.
