# Current architecture and migration status

Reviewed against commit `8006f9f5aa30a08693c29b21242d75ed4c207945` (branch `main`) on 2026-09-18. This is a factual navigation and migration-status summary.

## Authority

Source code, migrations, and automated tests establish implementation facts. Accepted Architecture Decision Records (ADRs) in `documentation/decisions/` establish architectural direction; a newer ADR supersedes earlier ADRs only within its stated scope.

## Implemented

- **Desktop (`app/desktop`)**: The sole editor application. Built with React and TypeScript renderer; Electron main process owns local media files, secure credential storage, native dialogs, and timeline video assembly using local FFmpeg. Operates strictly under single-user local-first principles ([ADR-0020](decisions/ADR-0020-single-user-local-first-architecture.md)).
- **Backend Service (`app/backend-service`)**: Spring Boot modular monolith and authoritative control plane. Manages business state, project entities, admission, job scheduling, leases, and artifact metadata in PostgreSQL (Flyway migrations V1 through V7, documented in [DATABASE.md](architecture/DATABASE.md)).
- **Story Analysis**: Analysis and visual beat extraction powered by Google Vertex AI Gemini 3.8 Flash (`VertexGeminiStoryAnalysisClient`) with thinking level `HIGH` ([ADR-0022](decisions/ADR-0022-vertex-gemini-chapter-analysis.md)).
- **StoryBeat Architecture & Workstation UX**: Implemented semantic production hierarchy `Chapter -> Scene -> StoryBeat -> {AudioCue[], VisualBeat[]}` ([ADR-0024](decisions/ADR-0024-storybeat-audio-visual-director-architecture.md)). Chapter Workspace features 4 sequential stages (`Source | Canon | Story | Production`) with 5-tab contextual inspector, control-room production stage, 6 clean navigation destinations (`Chapters`, `Canon`, `Editor`, `Assets`, `Jobs`, `Settings`), and timeline Project Explorer with StoryBeat grouping.
- **Generation Service (`app/generation-service`)**: Domain-agnostic GPU execution plane ([ADR-0018](decisions/ADR-0018-backend-control-plane-and-domain-agnostic-gpu-execution-plane.md), [ADR-0019](decisions/ADR-0019-generation-service-light-ddd-hexagonal-structure.md)). Implements Compute Protocol v1 ([COMPUTE_PROTOCOL.md](COMPUTE_PROTOCOL.md)) with capability-based token authentication, ephemeral SQLite execution journal, and durable submission checkpoints ([ADR-0021](decisions/ADR-0021-submission-checkpoint-and-worker-recovery-semantics.md)).
- **Audio Generation**: TTS synthesis via VieNeu (`VieneuTtsAdapter`, [ADR-0023](decisions/ADR-0023-vieneu-remote-gpu-media-runtime.md)); speech forced alignment via WhisperX (`WhisperXAdapter`).
- **Image Generation**: Visual beat reference-conditioned image generation via ComfyUI (`ComfyUiAdapter`).
- **Timeline Composition & Final Render**: Narration audio and visual beats rendered into final MP4 video locally within Electron using FFmpeg.

## Partial

- **GPU Residency Arbitration**: `GpuResidencyManager` implements logical domain mutual exclusion (`audio_alignment`, `tts`, `image`), with `RuntimeProcessSupervisor`, process lifecycle hooks, and `GpuVramProbe` wired into `bootstrap.py`. Production strictness and Windows runtime verification remain in progress.

## Deferred / Not Implemented

- **GPU Video Generation**: Reference-conditioned GPU video generation (Wan 2.1 / ComfyUI) is **DEFERRED / NOT IMPLEMENTED**. Final video is produced locally from visual beat images and narration audio via FFmpeg.
- **Advanced Identity Verification**: Real-person biometric embeddings and automated consent verification remain deferred.

## Known Drift

- **Remote GPU Deployment**: `deploy/remote-gpu/docker-compose.yml` reflects a Linux Docker setup, whereas the active target execution environment is a disposable Windows RTX 3090 workstation (see [REMOTE_GPU_RUNTIME.md](operations/REMOTE_GPU_RUNTIME.md)).
- **Environment Configuration**: Template defaults in `app/generation-service/.env.example` require alignment with production disposable workstation setup scripts.

## Active Architecture Decisions

Key decisions governing active architecture:
- [ADR-0018](decisions/ADR-0018-backend-control-plane-and-domain-agnostic-gpu-execution-plane.md): Backend Control Plane & Domain-Agnostic GPU Execution Plane
- [ADR-0019](decisions/ADR-0019-generation-service-light-ddd-hexagonal-structure.md): Generation Service Hexagonal Structure
- [ADR-0020](decisions/ADR-0020-single-user-local-first-architecture.md): Single-User Local-First Architecture
- [ADR-0021](decisions/ADR-0021-submission-checkpoint-and-worker-recovery-semantics.md): Submission Checkpoint & Worker Recovery Semantics
- [ADR-0022](decisions/ADR-0022-vertex-gemini-chapter-analysis.md): Vertex AI Gemini Chapter Analysis
- [ADR-0023](decisions/ADR-0023-vieneu-remote-gpu-media-runtime.md): VieNeu Remote GPU Media Runtime
- [ADR-0024](decisions/ADR-0024-storybeat-audio-visual-director-architecture.md): StoryBeat Audio + Visual Director Architecture
