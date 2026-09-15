# Architecture Decision Records

This directory records decisions that affect more than one feature or change a production safety boundary. The canonical V1.12 source-of-truth specification ([`NARRATIVEX_PROJECT_SPEC_V1_12.md`](../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_12.md)) remains the product/architecture authority; current code, migrations and tests decide factual AS-IS behavior when derived docs drift.

## Decision Classification

### ACTIVE

Decisions that define the current architecture and implementation boundaries:

- **[ADR-0006: Transactional chapter creation owns StoryVersion orchestration](./ADR-0006-transactional-chapter-creation.md)**
  Server-owned StoryVersion/Chapter orchestration, idempotency and batch-import transaction boundaries.
- **[ADR-0007: Architecture guards and pipeline observability](./ADR-0007-architecture-guards-and-pipeline-observability.md)**
  Architecture tests, worker facade boundaries, correlation/metrics and pipeline observability.
- **[ADR-0009: Bounded image-provider retries and circuit breaking](./ADR-0009-image-provider-circuit-breaker-and-retry-bounds.md)**
  Provider retry bounds, circuit breaking, reconciliation and cancellation.
- **[ADR-0010: Establish the Electron desktop editor client boundary](./ADR-0010-desktop-editor-client-boundary.md)**
  `app/desktop` is the only supported editor client. Electron main owns native capabilities/local execution; preload is narrow; renderer owns UI only; former web client removed.
- **[ADR-0012: Desktop local-first project media and local render execution](./ADR-0012-desktop-local-first-media-and-render-execution.md)**
  Local project workspace/manifest, asset-ID/checksum resolution, backend-assigned `LOCAL_DEVICE` rendering, FFmpeg in Electron main, and local final artifacts.
- **[ADR-0013: Desktop local media registration and editor mutations](./ADR-0013-desktop-local-media-registration-and-editor-mutations.md)**
  Main-process asset registration and editor mutation boundaries.
- **[ADR-0014: Workspace backup and deterministic render segment cache](./ADR-0014-workspace-backup-and-render-segment-cache.md)**
  Manifest-verified backups, restore preservation, snapshot accounting and disposable render cache behavior.
- **[ADR-0016: UUID policy for public and operational identifiers](./ADR-0016-public-id-uuid-policy.md)**
  UUIDv7 for public/domain IDs; numeric operational IDs remain without a universal migration.
- **[ADR-0017: Source-owned Desktop renderer UI component stack](./ADR-0017-desktop-renderer-ui-component-stack.md)**
  Tailwind CSS, source-owned shadcn/ui-style components, Radix UI behavior and CVA-based variants for the Electron renderer.
- **[ADR-0018: Generation commit and worker build observability](./ADR-0018-generation-commit-and-worker-build-observability.md)**
  Post-commit job logging, database identity readiness diagnostics, shared Compose configuration and immutable build identity.
- **[ADR-0023: Source-anchored visual timing derived from narration alignment](./ADR-0023-source-anchored-visual-timing.md)**
  VisualBeat source anchors resolve to deterministic UTF-16 text ranges; backend production-timeline reads map those ranges through narration alignment to the audio clock; provisional timing is review-only.
- **[ADR-0024: Chapter continuity, selective regeneration and effective render reuse](./ADR-0024-chapter-continuity-selective-regeneration-and-render-reuse.md)**
  Immutable continuity/checkpoint state, backend-authoritative selective regeneration and segment-cache identity based on effective encoded inputs rather than logical workflow identity.
- **[ADR-0026: Snapshot watermark policy for Desktop renders](./ADR-0026-immutable-render-watermark-policy.md)**
  Server-authoritative watermark policy captured in immutable render snapshots and enforced by the Desktop FFmpeg renderer.
- **[ADR-0027: VoiceStudio-only TTS and WhisperX-aligned WAV narration](./ADR-0027-voicestudio-only-tts-and-whisperx-wav-pipeline.md)**
  VoiceStudio is the sole production TTS engine boundary; NarrativeX synthesizes per segment, persists a 48 kHz mono WAV master and force-aligns Vietnamese script with WhisperX on RTX 4060. Voice reference scope refined to PROJECT and GLOBAL_LOCAL.
- **[ADR-0028: Backend control plane and domain-agnostic GPU execution plane](./ADR-0028-backend-control-plane-and-domain-agnostic-gpu-execution-plane.md)**
  Spring Boot is the sole domain/lifecycle control plane. A replacement `generation-service` executes closed, versioned compute tasks without NarrativeX database or domain access.
- **[ADR-0029: Light DDD and Hexagonal structure for the generation service](./ADR-0029-generation-service-light-ddd-hexagonal-structure.md)**
  Hexagonal architecture and DDD lifecycle aggregates for `app/generation-service`.
- **[ADR-0030: Single-User Local-First Architecture](./ADR-0030-single-user-local-first-architecture.md)**
  Elimination of all application identity, accounts, authentication, authorization, sessions, and multi-tenant quotas in favor of a single-user local-first architecture. Project is the top business boundary.
- **[ADR-0031: Durable submission checkpointing and safe worker recovery semantics](./ADR-0031-submission-checkpoint-and-worker-recovery-semantics.md)**
  Internal submission checkpoints (`NOT_SUBMITTED`, `SUBMITTING`, `SUBMITTED`, `UNKNOWN`), journal-before-I/O, and safe worker recovery without blind resubmission.

### PARTIALLY SUPERSEDED

Decisions whose core technical decisions remain valid, but specific sections have been superseded by newer ADRs:

- **[ADR-0001: System topology, modular monolith, durable execution and persistence architecture](./ADR-0001-system-topology-execution-and-persistence.md)**
  *Active:* Spring Boot control plane, MyBatis/PostgreSQL persistence, durable jobs/leases/provider operations.
  *Superseded:* Worker direct DB polling superseded by ADR-0028; monetary cost authorization superseded by ADR-0030.
- **[ADR-0002: Storyboard aggregate, character continuity, motion models and production workflows](./ADR-0002-storyboard-character-continuity-and-production-workflows.md)**
  *Active:* Chapter-first workflow, reusable Character identity, revision/history rules and VisualBeat/motion models.
  *Superseded:* Historical translation-lineage portion is superseded by the translation-free Chapter source baseline.
- **[ADR-0008: Production-profile Docker runtime for real machine-local execution](./ADR-0008-real-docker-runtime.md)**
  *Active:* Backend/worker Docker execution environment for development/testing.
  *Superseded:* Desktop client is no longer part of Docker runtime (ADR-0010).
- **[ADR-0020: PostgreSQL-only MVP runtime state](./ADR-0020-postgresql-only-mvp-runtime-state.md)**
  *Active:* PostgreSQL as the sole state store (no Redis).
  *Superseded:* Direct worker polling of PostgreSQL superseded by ADR-0028 Compute Protocol. Session state in PostgreSQL superseded by ADR-0030.
- **[ADR-0022: R2 voice-only storage and explicit voice-reference scope](./ADR-0022-r2-voice-only-and-voice-reference-scope.md)**
  *Active:* Local project media boundaries.
  *Superseded:* `ACCOUNT` voice reference scope superseded by ADR-0030; reusable voices transition to local storage (`GLOBAL_LOCAL` / `PROJECT`).
- **[ADR-0025: Local Qwen, RealVisXL and staged single-GPU production stack](./ADR-0025-local-ai-production-stack.md)**
  *Active:* Local Qwen Chapter analysis, staged RTX 4060 execution, RealVisXL ComfyUI adapter, WhisperX/VoiceStudio.
  *Superseded:* Multi-tenant quota and user entitlement assumptions superseded by ADR-0030 system/runtime capacity limits.

### SUPERSEDED

Historical rationale only; not part of current runtime:

- **[ADR-0003: Media storage, generation pipelines and external provider integrations](./ADR-0003-media-storage-generation-pipelines-and-external-integrations.md)**
  Superseded by ADR-0012 (local project media), ADR-0022 (R2 voice-only), and ADR-0025/ADR-0028 (local/compute execution plane).
- **[ADR-0004: Authentication, runtime security and test credentials](./ADR-0004-authentication-runtime-security-and-test-credentials.md)**
  Superseded by ADR-0030 (single-user local-first architecture; no user/session/CSRF authentication model).
- **[ADR-0011: Google OAuth-only identity with Desktop system-browser handoff](./ADR-0011-google-oauth-only-desktop-auth.md)**
  Superseded by ADR-0030 (single-user local-first architecture; no Google OAuth or guest installation identity).

### HISTORICAL

Preserved for context on retired subsystems or early integration spikes:

- **[ADR-0005: Deterministic MVP E2E rendering with local final storage](./ADR-0005-deterministic-mvp-e2e-render-storage.md)**
  Early integration spike for server-render verification; final render is now owned by Desktop FFmpeg (ADR-0012).
- **[ADR-0021: Desktop Gemini Web image generation boundary](./ADR-0021-desktop-gemini-web-image-generation.md)**
  Historical Desktop-only Gemini Web browser automation boundary. Target production image generation is RealVisXL/ComfyUI per ADR-0025.

---

## Supersession rules

- ADR-0030 supersedes ADR-0004, ADR-0011, and the user-quota/account portions of earlier ADRs, establishing NarrativeX as a single-user local-first application without identity, account, or authentication models.
- ADR-0010 defines the primary client boundary and supersedes language that treats Next.js as the target editor.
- ADR-0012 governs Desktop project bytes and Desktop final artifacts.
- ADR-0020 supersedes Redis guidance within the current MVP runtime.
- ADR-0022 supersedes older docs wherever they describe R2 as generated project image/narration transport.
- ADR-0023 supersedes older duration-weighted visual timing descriptions.
- ADR-0025 supersedes Vertex Gemini Chapter-analysis and production API image portions of ADR-0003/ADR-0008.
- ADR-0027 refines ADR-0025 for VoiceStudio-only TTS and WhisperX post-TTS alignment. VieNeu has no production path.
- ADR-0028 supersedes direct PostgreSQL polling by workers in ADR-0020 and relocates executors behind the Compute Protocol into `app/generation-service`. Legacy `app/ai-worker` direct polling remains temporary migration residue.
- The current translation-free Chapter source baseline supersedes translation/content-variant workflow and schema language in older ADRs.
- A later accepted ADR wins when two decisions explicitly conflict in the same scope.

Use the next sequential ADR number for future cross-cutting architectural decisions.
