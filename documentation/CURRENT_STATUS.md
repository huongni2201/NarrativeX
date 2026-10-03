# Current architecture and migration status

Reviewed against the current `main` worktree on 2026-10-03 following full remediation verification. The commit SHA is intentionally omitted because this document is a working-tree status summary.

## Authority

Source code, migrations, and automated tests establish implementation facts. Accepted Architecture Decision Records (ADRs) in `documentation/decisions/` establish architectural direction; a newer ADR supersedes an earlier ADR only within its stated scope. When an accepted decision is not fully implemented, this document records the gap explicitly.

## Implemented

- **Desktop (`app/desktop`)**: The sole editor application. React and TypeScript renderer state stays behind a narrow Electron preload bridge; Electron main owns local media files, protected provider/browser runtime configuration, native capabilities, and timeline video assembly using local FFmpeg. It operates under single-user local-first principles ([ADR-0020](decisions/ADR-0020-single-user-local-first-architecture.md)).
- **Backend Service (`app/backend-service`)**: Spring Boot modular monolith and authoritative control plane. It manages Project/StoryVersion/Chapter/Scene/StoryBeat/AudioCue/VisualBeat metadata, admission, durable jobs, leases, and artifact metadata in PostgreSQL. The clean-baseline Flyway inventory is V1 through V10 ([DATABASE.md](architecture/DATABASE.md)); PostgreSQL Testcontainers verifies that baseline, while an installed database requires its own applied-history audit.
- **StoryBeat architecture and workstation UX**: The semantic hierarchy is `Project -> StoryVersion -> Chapter -> Scene -> StoryBeat -> {AudioCue[], VisualBeat[]}` ([ADR-0024](decisions/ADR-0024-storybeat-audio-visual-director-architecture.md)). StoryBeat, AudioCue, and VisualBeat persistence/read models and the Chapter Workspace grouping are implemented. VisualBeat approval remains decoupled from StoryBeat review.
- **Story analysis**: Vertex Gemini Chapter Analyze uses thinking level `HIGH` ([ADR-0022](decisions/ADR-0022-vertex-gemini-chapter-analysis.md)). Schema/prompt 1.1 requests explicit AudioCues; materialization validates anchors, speaker names and source revision before writes, then commits canon/story/cues and job completion in one Spring transaction. Cues begin DRAFT with no fabricated audio timing.
- **Generation service (`app/generation-service`)**: Domain-agnostic GPU execution plane ([ADR-0018](decisions/ADR-0018-backend-control-plane-and-domain-agnostic-gpu-execution-plane.md), [ADR-0019](decisions/ADR-0019-generation-service-light-ddd-hexagonal-structure.md)). It implements Compute Protocol v1 with capability-based machine authentication, a SQLite execution journal, durable submission checkpoints ([ADR-0021](decisions/ADR-0021-submission-checkpoint-and-worker-recovery-semantics.md)), and the worker SQLite `compute_event_outbox`.
- **Event-driven compute orchestration**: Worker state transitions are recorded with outbox events, delivered through signed callbacks, received idempotently in PostgreSQL, and finalized monotonically. A non-blocking scheduled reconciliation fallback handles ambiguous/lost callbacks. Backend generation updates are broadcast to Desktop through project-scoped SSE ([ADR-0025](decisions/ADR-0025-event-driven-compute-orchestration-and-reconciliation.md)).
- **Audio generation**: VieNeu TTS and WhisperX forced alignment are implemented through the generation service ([ADR-0023](decisions/ADR-0023-vieneu-remote-gpu-media-runtime.md)).
- **Image generation (reference-conditioned)**: Reference-conditioned image generation is maintained through ComfyUI (`ComfyUiAdapter`) for character references, keyframes, and concept frames ([ADR-0028](decisions/ADR-0028-image-generator-reference-only.md)).
- **Video generation & LTX Native AV cut-over**: Moving-video-first generation pipeline backed by LTX-2.5 (`video.generate`), shot sequencing, and multi-take models in V9 schema ([ADR-0026](decisions/ADR-0026-video-first-production.md), [ADR-0027](decisions/ADR-0027-shot-as-production-unit.md), [ADR-0032](decisions/ADR-0032-video-first-ltx-audio-native-production-runtime.md)). Schema 1.1 dispatch strictly adopts worker profile `ltx-2.5-22b-distilled-int8-native-av-v1` (revision `5e6e71018ee1756ed329b697a7b4aedc934dfce9`), with structured `dialogue[]` and `voiceReference` built from AudioCues.
- **Aspect Ratio Normalization**: Normalized project ratios (`RATIO_16_9` to `16:9`) in SQL and preflight evaluation. Preflight fails closed prior to compute job dispatch when aspect ratios are unsupported.
- **Runtime Capability Truth**: Backend probes GPU worker `/v1/capabilities` and fails closed on fallback (`UNAVAILABLE`, `available: false`). Desktop UI reflects genuine runtime status without faking readiness.
- **Take Validation and Immutable Selection**: Terminal success, positive source duration, and technical validation PASS enforced before take selection ([ADR-0030](decisions/ADR-0030-take-selected-take-and-editing-director.md)). `SelectedTake` remains an immutable editing decision record.
- **Render Recovery & Project-Scoped Diagnostics**: Startup recovery handles multiple interrupted renders (`Tác vụ 1/N`) with explicit IPC discard (`USER_CANCELLED`) and resume actions. Job history and job indicators are scoped by `projectId`.
- **Creator-first Production UX**: Compact production readiness strip, creator-friendly "Tạo các shot còn thiếu" action, expandable LTX technical details, and unblocked viewport scrolling for large shot boards.
- **Timeline composition and final render**: Narration-aligned timing and selected visual media are rendered into a final MP4 locally within Electron using FFmpeg with a 24 FPS cinematic baseline default.
- **Desktop UI Video-First Cut-Over**: Pruned obsolete still-image screens and legacy route aliases. Canonical workflow is anchored around `ChapterWorkspaceScreen`, `ProjectCanonScreen`, `AssetsScreen`, and `Editor`. Desktop video shotboard features real take generation, retake mutations, strategy updates, and take preview.

## Partial

- **GPU residency arbitration**: `GpuResidencyManager` implements logical domain mutual exclusion (`COMFYUI_IMAGE`, `LTX_VIDEO`, `VIENEU`, `WHISPERX`), with `RuntimeProcessSupervisor` and `GpuVramProbe` wired into `bootstrap.py`. Active target is RTX 5090 (32GB VRAM); production strictness and full Windows worker validation remain in progress.
- **Canonical StoryBeat materialization**: StoryBeat/AudioCue/VisualBeat domain boundaries and grouped reads are implemented, but nullable legacy/manual VisualBeat rows remain supported and not every existing analysis/manual row is proven to be attached to a StoryBeat.

## Target / Active Cut-Over

- **Video-First Retention Architecture**: Transitioning from image-first (`Story -> VisualBeat -> Image -> Ken Burns -> Timeline`) to video-first, retention-driven production (`Story -> Retention Plan -> VisualBeat -> ShotSequence -> Shot -> GenerationStrategy -> Moving Video -> Take -> SelectedTake -> Editing -> Final Video -> Retention Feedback`) ([ADR-0026](decisions/ADR-0026-video-first-production.md) through [ADR-0032](decisions/ADR-0032-video-first-ltx-audio-native-production-runtime.md)).
- **Generation Router & Extended Video Strategies**: Model-agnostic routing active for T2V, I2V, First/Last Frame; Multi-Keyframe, Extend, and Retake video-to-video strategies remain planned for subsequent engine iterations ([ADR-0029](decisions/ADR-0029-generation-router-and-video-strategies.md)).
- **Editing Decision List & Final Multi-Track Assembly**: Advanced EDL export and non-linear transitions compilation ([ADR-0030](decisions/ADR-0030-take-selected-take-and-editing-director.md)).

## Deferred / Not Implemented

- **Automated YouTube decision loop**: Retention feedback loop operates in human-in-the-loop recommendation mode; fully automated strategy re-tuning without human approval remains deferred ([ADR-0031](decisions/ADR-0031-retention-driven-narrative-planning.md)).
- **Advanced identity verification**: Real-person biometric embeddings and automated consent verification remain deferred.

## Known Drift

- **Remote GPU deployment**: `deploy/remote-gpu/docker-compose.yml` reflects a legacy Linux Docker prototype, while the active target execution environment is a disposable Windows RTX 5090 (32GB VRAM) workstation with RTX 3090 (24GB VRAM) as benchmark baseline (see [REMOTE_GPU_RUNTIME.md](operations/REMOTE_GPU_RUNTIME.md)).
- **Environment configuration**: Template defaults in `app/generation-service/.env.example` require alignment with disposable workstation setup scripts.
- **Legacy VisualBeat rows**: Nullable `visual_beats.story_beat_id` is an intentional compatibility path, not evidence that the canonical hierarchy is the old Scene-to-VisualBeat model.

## Active Architecture Decisions

Key decisions governing active architecture:

- [ADR-0018](decisions/ADR-0018-backend-control-plane-and-domain-agnostic-gpu-execution-plane.md): Backend Control Plane and Domain-Agnostic GPU Execution Plane
- [ADR-0019](decisions/ADR-0019-generation-service-light-ddd-hexagonal-structure.md): Generation Service Hexagonal Structure
- [ADR-0020](decisions/ADR-0020-single-user-local-first-architecture.md): Single-User Local-First Architecture
- [ADR-0021](decisions/ADR-0021-submission-checkpoint-and-worker-recovery-semantics.md): Submission Checkpoint and Worker Recovery Semantics
- [ADR-0022](decisions/ADR-0022-vertex-gemini-chapter-analysis.md): Vertex AI Gemini Chapter Analysis
- [ADR-0023](decisions/ADR-0023-vieneu-remote-gpu-media-runtime.md): VieNeu Remote GPU Media Runtime
- [ADR-0024](decisions/ADR-0024-storybeat-audio-visual-director-architecture.md): StoryBeat Audio and Visual Director Architecture
- [ADR-0025](decisions/ADR-0025-event-driven-compute-orchestration-and-reconciliation.md): Event-Driven Compute Orchestration and Reconciliation
- [ADR-0026](decisions/ADR-0026-video-first-production.md): Video-First Production Architecture and Legacy Still Motion Deprecation
- [ADR-0027](decisions/ADR-0027-shot-as-production-unit.md): Shot as the Atomic Production Unit
- [ADR-0028](decisions/ADR-0028-image-generator-reference-only.md): Image Generation Restricted to References and Keyframes Only
- [ADR-0029](decisions/ADR-0029-generation-router-and-video-strategies.md): Generation Router and Model-Agnostic Video Strategies
- [ADR-0030](decisions/ADR-0030-take-selected-take-and-editing-director.md): Take / SelectedTake In/Out Trimming and Editing Decision List Pipeline
- [ADR-0031](decisions/ADR-0031-retention-driven-narrative-planning.md): Retention-Driven Narrative Planning and Post-Publish Feedback Loop
- [ADR-0032](decisions/ADR-0032-video-first-ltx-audio-native-production-runtime.md): LTX 2.5 Audio-Native Production Runtime and RTX 5090 Baseline
