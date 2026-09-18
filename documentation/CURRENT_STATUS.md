# Current architecture and migration status

Reviewed against commit `b351f4de30f6aa30bbbd9e83a7f8b6e01829994a` (branch `feat/vertex-gemini-3-8-analysis`) on 2026-09-18. This is a factual navigation and migration-status summary.

## Authority

Source code, migrations, and automated tests establish implementation facts. Accepted Architecture Decision Records (ADRs) in `documentation/decisions/` establish architectural direction; a newer ADR supersedes earlier ADRs only within its stated scope.

## Implemented

- **Desktop (`app/desktop`)**: The sole editor application. Built with React and TypeScript renderer; Electron main process owns local media files, secure credential storage, native dialogs, and timeline video assembly using local FFmpeg. Operates strictly under single-user local-first principles ([ADR-0030](decisions/ADR-0030-single-user-local-first-architecture.md)).
- **Backend Service (`app/backend-service`)**: Spring Boot modular monolith and authoritative control plane. Manages business state, project entities, admission, job scheduling, leases, and artifact metadata in PostgreSQL (Flyway migrations V1 through V7, documented in [DATABASE.md](architecture/DATABASE.md)).
- **Story Analysis**: Analysis and visual beat extraction powered by Google Vertex AI Gemini 2.5 Flash (`VertexGeminiStoryAnalysisClient`).
- **Generation Service (`app/generation-service`)**: Domain-agnostic GPU execution plane ([ADR-0028](decisions/ADR-0028-backend-control-plane-and-domain-agnostic-gpu-execution-plane.md), [ADR-0029](decisions/ADR-0029-generation-service-light-ddd-hexagonal-structure.md)). Implements Compute Protocol v1 ([COMPUTE_PROTOCOL.md](COMPUTE_PROTOCOL.md)) with capability-based token authentication, ephemeral SQLite execution journal, and durable submission checkpoints ([ADR-0031](decisions/ADR-0031-submission-checkpoint-and-worker-recovery-semantics.md)).
- **Audio Generation**: TTS synthesis via VieNeu (`VieneuTtsAdapter`); speech forced alignment via WhisperX (`WhisperXAdapter`).
- **Image Generation**: Visual beat reference-conditioned image generation via ComfyUI (`ComfyUiAdapter`).
- **Timeline Composition & Final Render**: Narration audio and visual beats rendered into final MP4 video locally within Electron using FFmpeg.

## Partial

- **GPU Residency Arbitration**: `GpuResidencyManager` implements logical domain mutual exclusion (`audio_alignment`, `tts`, `image`, `video`), but process lifecycle unload hooks and physical VRAM polling probes are not yet wired into the runtime bootstrap.

## Deferred / Not Implemented

- **GPU Video Generation**: Reference-conditioned GPU video generation via Wan 2.1 / ComfyUI ([ADR-0033](decisions/ADR-0033-reference-conditioned-gpu-video-generation.md)) is **DEFERRED / NOT IMPLEMENTED**. Final video is produced locally from visual beat images and narration audio via FFmpeg.
- **Advanced Identity Verification**: Real-person biometric embeddings and automated consent verification remain deferred.

## Known Drift

- **Remote GPU Deployment**: `deploy/remote-gpu/docker-compose.yml` reflects a Linux Docker setup, whereas the active target execution environment is a disposable Windows RTX 3090 workstation (see [REMOTE_GPU_RUNTIME.md](operations/REMOTE_GPU_RUNTIME.md)).
- **Environment Configuration**: Template defaults in `app/generation-service/.env.example` require alignment with production disposable workstation setup scripts.

## Active Architecture Decisions

Key decisions governing active architecture:
- [ADR-0028](decisions/ADR-0028-backend-control-plane-and-domain-agnostic-gpu-execution-plane.md): Backend Control Plane & Domain-Agnostic GPU Execution Plane
- [ADR-0029](decisions/ADR-0029-generation-service-light-ddd-hexagonal-structure.md): Generation Service Hexagonal Structure
- [ADR-0030](decisions/ADR-0030-single-user-local-first-architecture.md): Single-User Local-First Architecture
- [ADR-0031](decisions/ADR-0031-submission-checkpoint-and-worker-recovery-semantics.md): Submission Checkpoint & Worker Recovery Semantics
- [ADR-0033](decisions/ADR-0033-reference-conditioned-gpu-video-generation.md): Reference-Conditioned GPU Video Generation (*Deferred*)
- [ADR-0034](decisions/ADR-0034-vertex-gemini-chapter-analysis.md): Vertex AI Gemini Chapter Analysis
- [ADR-0035](decisions/ADR-0035-vieneu-remote-gpu-media-runtime.md): VieNeu Remote GPU Media Runtime
