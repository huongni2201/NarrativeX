# ADR-0017: Deterministic MVP E2E Rendering with Local Final Storage

- Status: Accepted
- Date: 2026-08-23

## Context

The story-to-video MVP must be verified end to end, including real worker execution and FFmpeg output. CI must not depend on Vertex/Gemini availability, Google Drive credentials, provider latency, or provider billing. A browser refresh must also be able to recover a completed render from the chapter workspace response.

## Decision

Keep PostgreSQL, Redis, the Spring Boot backend, the Python worker, and FFmpeg real in the MVP E2E environment. Select deterministic fake analysis, image, and TTS providers through explicit provider modes. Store generated media and final MP4 artifacts on the shared local E2E filesystem through `LocalFinalVideoStorage` and the backend local content adapter. Production continues to use the configured external providers and Google Drive final-video storage.

Expose the latest non-archived `CHAPTER_VIDEO` final artifact in the chapter workspace render summary as `status`, `latestJobId`, and `artifactId`. The frontend hydrates the artifact by ID after loading the workspace, while render submission and polling remain owned by the render container/hook.

## Consequences

- CI validates the real queue, persistence, worker, FFmpeg, artifact retrieval, HTTP range handling, browser metadata loading, download, and refresh path without external AI or storage services.
- Local E2E artifacts are immutable and contained below the configured local final-storage root.
- Provider adapters remain outside the backend domain and production external integrations are unchanged.
- CI must upload Playwright evidence and service logs so failures remain diagnosable.
