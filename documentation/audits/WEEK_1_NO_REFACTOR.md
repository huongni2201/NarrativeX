# NarrativeX W1-D1 No-Refactor Register

The W1-D1 task was an audit and evidence-baseline task. No production source code was changed. The following items are intentionally deferred and should not be pulled into the audit patch:

- Rewrite or redesign the frontend UI, including the existing studio screens, branding, assets, presets, and navigation.
- Replace Next.js, Spring Boot, PostgreSQL, Redis, MinIO, or the modular-monolith-plus-worker shape.
- Split the backend into microservices without a measured bottleneck and an approved ADR.
- Integrate real AI, image, video, TTS, FFmpeg, or external-provider SDKs.
- Implement the complete generation pipeline, media rendering pipeline, or provider-specific prompt system.
- Introduce Kafka or another queue platform before the durable handoff contract and measured need are established.
- Perform broad package renames, dependency upgrades, framework migrations, or speculative schema redesign.
- Add production deployment orchestration, Kubernetes, or cloud-specific infrastructure as part of W1-D1.
- Replace the current test profile wholesale before the PostgreSQL migration gate and target test cases are agreed.

The P0 findings are not permission for an unbounded refactor. They should be remediated as focused, separately verifiable changes: first the PostgreSQL migration/startup gate and fail-closed identity boundary, then the API/async contracts needed by the next milestones.

## Audit change boundary

Allowed W1-D1 changes: maintainable audit/codebase Markdown, evidence notes, and (only if an architecture decision changed) an ADR. Existing ADR-0001 and ADR-0002 remain consistent with the observed codebase, so no new ADR was required.

Disallowed in this task: changes under `app/backend-service/src`, `app/frontend-web/src`, `app/ai-worker/src`, migrations, Compose, dependency manifests, or runtime configuration.
