# Architecture Decision Records

This directory records decisions that affect more than one feature or change a production safety boundary. The maintained V1.11 source-of-truth specification remains the product/architecture authority; current code, migrations and tests decide factual AS-IS behavior when derived docs drift.

## Current decision set

1. **[ADR-0001: System topology, modular monolith, durable execution and persistence architecture](./ADR-0001-system-topology-execution-and-persistence.md)**  
   Spring Boot control plane, Python worker boundary, MyBatis/PostgreSQL persistence, durable jobs/leases/provider operations and cost authorization.

2. **[ADR-0002: Storyboard aggregate, character continuity, motion models and production workflows](./ADR-0002-storyboard-character-continuity-and-production-workflows.md)**  
   Chapter-first workflow, reusable Character identity, revision/history rules and VisualBeat/motion models. Its historical translation-lineage portion is superseded by the current translation-free Chapter source baseline.

3. **[ADR-0003: Media storage, generation pipelines and external provider integrations](./ADR-0003-media-storage-generation-pipelines-and-external-integrations.md)**  
   Historical cloud/provider media transport guidance. Current project-media storage is governed by ADR-0012 and the active R2 boundary is further superseded by ADR-0022.

4. **[ADR-0004: Authentication, runtime security and test credentials](./ADR-0004-authentication-runtime-security-and-test-credentials.md)**  
   Spring Security/session baseline, Google OIDC security controls, CSRF and test/runtime credential boundaries. Password-auth product behavior is superseded by ADR-0011.

5. **[ADR-0005: Deterministic MVP E2E rendering with local final storage](./ADR-0005-deterministic-mvp-e2e-render-storage.md)**  
   Deterministic integration verification and test-only local storage exception for the earlier server-render path.

6. **[ADR-0006: Transactional chapter creation owns StoryVersion orchestration](./ADR-0006-transactional-chapter-creation.md)**  
   Server-owned StoryVersion/Chapter orchestration, idempotency and batch-import transaction boundaries.

7. **[ADR-0007: Architecture guards and pipeline observability](./ADR-0007-architecture-guards-and-pipeline-observability.md)**  
   Architecture tests, worker facade boundaries, correlation/metrics and pipeline observability.

8. **[ADR-0008: Production-profile Docker runtime for real machine-local execution](./ADR-0008-real-docker-runtime.md)**  
   Retained backend/worker Docker runtime. This is no longer the primary editor/client runtime after the Desktop migration.

9. **[ADR-0009: Bounded image-provider retries and circuit breaking](./ADR-0009-image-provider-circuit-breaker-and-retry-bounds.md)**  
   Provider retry bounds, circuit breaking, reconciliation and cancellation.

10. **[ADR-0010: Establish the Electron desktop editor client boundary](./ADR-0010-desktop-editor-client-boundary.md)**  
   `app/desktop` is the only supported editor client. Electron main owns native capabilities/local execution, preload is narrow, renderer owns UI only, and the former `app/frontend-web` client has been removed.

11. **[ADR-0011: Google OAuth-only identity with Desktop system-browser handoff](./ADR-0011-google-oauth-only-desktop-auth.md)**  
   Google-only end-user authentication, system-browser OIDC, one-time `narrativex://` handoff into a server-managed NarrativeX session, and strict separation from local-execution device tokens.

12. **[ADR-0012: Desktop local-first project media and local render execution](./ADR-0012-desktop-local-first-media-and-render-execution.md)**  
   Local project workspace/manifest, asset-ID/checksum resolution, backend-assigned `LOCAL_DEVICE` rendering, FFmpeg in Electron main and local final artifacts.

13. **[ADR-0013: Desktop local media registration and editor mutations](./ADR-0013-desktop-local-media-registration-and-editor-mutations.md)**  
   Main-process asset registration and editor mutation boundaries.

14. **[ADR-0014: Workspace backup and deterministic render segment cache](./ADR-0014-workspace-backup-and-render-segment-cache.md)**  
   Manifest-verified backups, restore preservation, snapshot accounting and disposable render cache behavior.

16. **[ADR-0016: UUID policy for public and operational identifiers](./ADR-0016-public-id-uuid-policy.md)**  
   UUIDv7 for public/domain IDs; numeric operational IDs remain without a universal migration.

17. **[ADR-0017: Source-owned Desktop renderer UI component stack](./ADR-0017-desktop-renderer-ui-component-stack.md)**  
   Tailwind CSS, source-owned shadcn/ui-style components, Radix UI behavior and CVA-based variants for the Electron renderer.

18. **[ADR-0018: Generation commit and worker build observability](./ADR-0018-generation-commit-and-worker-build-observability.md)**  
   Post-commit job logging, database identity readiness diagnostics, shared Compose configuration and immutable build identity.

20. **[ADR-0020: PostgreSQL-only MVP runtime state](./ADR-0020-postgresql-only-mvp-runtime-state.md)**  
   PostgreSQL is the sole MVP state service for sessions, handoffs, durable queues and worker polling; Redis is not required.

21. **[ADR-0021: Desktop Gemini Web image generation boundary](./ADR-0021-desktop-gemini-web-image-generation.md)**  
   Desktop-only Gemini Web generation through visible Chrome/CDP, backend-owned prompt context, protected file commit and renderer orchestration.

22. **[ADR-0022: R2 voice-only storage and explicit voice-reference scope](./ADR-0022-r2-voice-only-and-voice-reference-scope.md)**  
   Generated/imported project media stays local; `PROJECT` voice references remain project-local; `ACCOUNT` voice references/custom voices use the authenticated R2 `voices/...` boundary.

23. **[ADR-0023: Source-anchored visual timing derived from narration alignment](./ADR-0023-source-anchored-visual-timing.md)**  
   VisualBeat source anchors resolve to deterministic UTF-16 text ranges; backend production-timeline reads map those ranges through narration alignment to the audio clock; provisional timing is review-only.

24. **[ADR-0024: Chapter continuity, selective regeneration and effective render reuse](./ADR-0024-chapter-continuity-selective-regeneration-and-render-reuse.md)**  
   Immutable continuity/checkpoint state, backend-authoritative selective regeneration and segment-cache identity based on effective encoded inputs rather than logical workflow identity.

## Supersession rules

- ADR-0010 defines the primary client boundary and supersedes language that treats Next.js as the target editor.
- ADR-0011 supersedes password-authentication product/runtime behavior and distinguishes user session credentials from execution device credentials.
- ADR-0012 governs Desktop project bytes and Desktop final artifacts.
- ADR-0020 supersedes Redis/session/queue guidance within the current MVP runtime.
- ADR-0021 defines the Gemini Web Desktop execution boundary; it does not replace the backend-authorized Vertex/API generation path.
- ADR-0022 supersedes ADR-0003/older docs wherever they describe R2 as generated project image/narration transport or allow project-media R2 fallback. It also defines `PROJECT` versus `ACCOUNT` voice-reference storage.
- ADR-0023 supersedes older duration-weighted or audio-column-only visual timing descriptions. It does not remove compatibility fields still consumed by current code.
- ADR-0024 extends ADR-0014 for continuity-aware regeneration/render reuse and extends ADR-0020 for durable analysis checkpoints. It does not move provider credentials or local render execution into the renderer.
- The current translation-free Chapter source baseline supersedes translation/content-variant workflow and schema language in older ADRs; historical text remains rationale/history and is not an AS-IS contract.
- A later accepted ADR wins when two decisions explicitly conflict in the same scope.

Use the next sequential ADR number for future cross-cutting architectural decisions.
