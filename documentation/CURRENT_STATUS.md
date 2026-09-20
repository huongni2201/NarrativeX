# Current architecture and migration status

Reviewed against the current `main` worktree on 2026-09-20. The commit SHA is intentionally omitted because this document is a working-tree status summary.

## Authority

Source code, migrations, and automated tests establish implementation facts. Accepted Architecture Decision Records (ADRs) in `documentation/decisions/` establish architectural direction; a newer ADR supersedes an earlier ADR only within its stated scope. When an accepted decision is not fully implemented, this document records the gap explicitly.

## Implemented

- **Desktop (`app/desktop`)**: The sole editor application. React and TypeScript renderer state stays behind a narrow Electron preload bridge; Electron main owns local media files, protected provider/browser runtime configuration, native capabilities, and timeline video assembly using local FFmpeg. It operates under single-user local-first principles ([ADR-0020](decisions/ADR-0020-single-user-local-first-architecture.md)).
- **Backend Service (`app/backend-service`)**: Spring Boot modular monolith and authoritative control plane. It manages Project/StoryVersion/Chapter/Scene/StoryBeat/AudioCue/VisualBeat metadata, admission, durable jobs, leases, and artifact metadata in PostgreSQL. Flyway currently applies V1 through V8 ([DATABASE.md](architecture/DATABASE.md)).
- **StoryBeat architecture and workstation UX**: The semantic hierarchy is `Project -> StoryVersion -> Chapter -> Scene -> StoryBeat -> {AudioCue[], VisualBeat[]}` ([ADR-0024](decisions/ADR-0024-storybeat-audio-visual-director-architecture.md)). StoryBeat, AudioCue, and VisualBeat persistence/read models and the Chapter Workspace grouping are implemented. The schema/read path still exposes legacy/manual VisualBeat rows without a StoryBeat through a compatibility container, so the full analysis-to-canonical attachment cutover remains partial.
- **Story analysis**: Vertex Gemini Chapter Analyze is implemented through `VertexGeminiStoryAnalysisClient` with thinking level `HIGH` ([ADR-0022](decisions/ADR-0022-vertex-gemini-chapter-analysis.md)). Source anchoring, review state, and durable job/provider fencing are implemented; canonical StoryBeat attachment for every legacy/manual VisualBeat is not claimed as complete.
- **Generation service (`app/generation-service`)**: Domain-agnostic GPU execution plane ([ADR-0018](decisions/ADR-0018-backend-control-plane-and-domain-agnostic-gpu-execution-plane.md), [ADR-0019](decisions/ADR-0019-generation-service-light-ddd-hexagonal-structure.md)). It implements Compute Protocol v1 with capability-based machine authentication, a SQLite execution journal, durable submission checkpoints ([ADR-0021](decisions/ADR-0021-submission-checkpoint-and-worker-recovery-semantics.md)), and the worker SQLite `compute_event_outbox`.
- **Event-driven compute orchestration**: Worker state transitions are recorded with outbox events, delivered through signed callbacks, received idempotently in PostgreSQL, and finalized monotonically. A non-blocking scheduled reconciliation fallback handles ambiguous/lost callbacks. Backend generation updates are broadcast to Desktop through project-scoped SSE ([ADR-0025](decisions/ADR-0025-event-driven-compute-orchestration-and-reconciliation.md)).
- **Audio generation**: VieNeu TTS and WhisperX forced alignment are implemented through the generation service ([ADR-0023](decisions/ADR-0023-vieneu-remote-gpu-media-runtime.md)).
- **Image generation**: Visual-beat reference-conditioned image generation is implemented through ComfyUI (`ComfyUiAdapter`).
- **Timeline composition and final render**: Narration-aligned timing and selected visual media are rendered into a final MP4 locally within Electron using FFmpeg.

## Partial

- **GPU residency arbitration**: `GpuResidencyManager` implements logical domain mutual exclusion (`audio_alignment`, `tts`, `image`), with `RuntimeProcessSupervisor` and `GpuVramProbe` wired into `bootstrap.py`. Production strictness and Windows runtime verification remain in progress.
- **Canonical StoryBeat materialization**: StoryBeat/AudioCue/VisualBeat domain boundaries and grouped reads are implemented, but nullable legacy/manual VisualBeat rows remain supported and not every existing analysis/manual row is proven to be attached to a StoryBeat.

## Deferred / Not Implemented

- **GPU video generation**: Reference-conditioned GPU video generation (Wan 2.1 / ComfyUI) is **DEFERRED / NOT IMPLEMENTED**. Final video is produced locally from visual media and narration audio via FFmpeg.
- **Advanced identity verification**: Real-person biometric embeddings and automated consent verification remain deferred.

## Known Drift

- **Remote GPU deployment**: `deploy/remote-gpu/docker-compose.yml` reflects a legacy Linux Docker prototype, while the active target execution environment is a disposable Windows RTX 3090 workstation (see [REMOTE_GPU_RUNTIME.md](operations/REMOTE_GPU_RUNTIME.md)).
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
