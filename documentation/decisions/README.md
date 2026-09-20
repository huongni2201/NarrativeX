# Architecture Decision Records

This directory records decisions that affect more than one feature or change a production safety boundary. Current code, migrations and automated tests establish factual implementation truth.

## Decision Classification

### ACTIVE

Decisions that define the current architecture and implementation boundaries:

- **[ADR-0003: Transactional chapter creation owns StoryVersion orchestration](./ADR-0003-transactional-chapter-creation.md)**
  Server-owned StoryVersion/Chapter orchestration, idempotency and batch-import transaction boundaries.
- **[ADR-0004: Architecture guards and pipeline observability](./ADR-0004-architecture-guards-and-pipeline-observability.md)**
  Architecture tests, worker facade boundaries, correlation/metrics and pipeline observability.
- **[ADR-0005: Bounded image-provider retries and circuit breaking](./ADR-0005-image-provider-circuit-breaker-and-retry-bounds.md)**
  Provider retry bounds, circuit breaking, reconciliation and cancellation.
- **[ADR-0006: Establish the Electron desktop editor client boundary](./ADR-0006-desktop-editor-client-boundary.md)**
  `app/desktop` is the only supported editor client. Electron main owns native capabilities/local execution; preload is narrow; renderer owns UI only; former web client removed.
- **[ADR-0007: Desktop local-first project media and local render execution](./ADR-0007-desktop-local-first-media-and-render-execution.md)**
  Local project workspace/manifest, asset-ID/checksum resolution, backend-assigned `LOCAL_DEVICE` rendering, FFmpeg in Electron main, and local final artifacts.
- **[ADR-0008: Desktop local media registration and editor mutations](./ADR-0008-desktop-local-media-registration-and-editor-mutations.md)**
  Main-process asset registration and editor mutation boundaries.
- **[ADR-0009: Workspace backup and deterministic render segment cache](./ADR-0009-workspace-backup-and-render-segment-cache.md)**
  Manifest-verified backups, restore preservation, snapshot accounting and disposable render cache behavior.
- **[ADR-0010: Desktop render lifecycle and capability-scoped IPC](./ADR-0010-desktop-render-lifecycle-and-capability-ipc.md)**
  Render journals checkpointing, error sanitization, typed preflight and capability-scoped IPC bridge for Desktop FFmpeg rendering.
- **[ADR-0011: UUID policy for public and operational identifiers](./ADR-0011-public-id-uuid-policy.md)**
  UUIDv7 for public/domain IDs; numeric operational IDs remain without a universal migration.
- **[ADR-0012: Source-owned Desktop renderer UI component stack](./ADR-0012-desktop-renderer-ui-component-stack.md)**
  Tailwind CSS, source-owned shadcn/ui-style components, Radix UI behavior and CVA-based variants for the Electron renderer.
- **[ADR-0013: Generation commit and worker build observability](./ADR-0013-generation-commit-and-worker-build-observability.md)**
  Post-commit job logging, database identity readiness diagnostics, shared Compose configuration and immutable build identity.
- **[ADR-0015: Source-anchored visual timing derived from narration alignment](./ADR-0015-source-anchored-visual-timing.md)**
  VisualBeat source anchors resolve to deterministic UTF-16 text ranges; backend production-timeline reads map those ranges through narration alignment to the audio clock; provisional timing is review-only.
- **[ADR-0016: Chapter continuity, selective regeneration and effective render reuse](./ADR-0016-chapter-continuity-selective-regeneration-and-render-reuse.md)**
  Immutable continuity/checkpoint state, backend-authoritative selective regeneration and segment-cache identity based on effective encoded inputs rather than logical workflow identity.
- **[ADR-0017: Snapshot watermark policy for Desktop renders](./ADR-0017-immutable-render-watermark-policy.md)**
  Server-authoritative watermark policy captured in immutable render snapshots and enforced by the Desktop FFmpeg renderer.
- **[ADR-0018: Backend control plane and domain-agnostic GPU execution plane](./ADR-0018-backend-control-plane-and-domain-agnostic-gpu-execution-plane.md)**
  Spring Boot is the sole domain/lifecycle control plane. A replacement `generation-service` executes closed, versioned compute tasks without NarrativeX database or domain access.
- **[ADR-0019: Light DDD and Hexagonal structure for the generation service](./ADR-0019-generation-service-light-ddd-hexagonal-structure.md)**
  Hexagonal architecture and DDD lifecycle aggregates for `app/generation-service`.
- **[ADR-0020: Single-User Local-First Architecture](./ADR-0020-single-user-local-first-architecture.md)**
  Elimination of all application identity, accounts, authentication, authorization, sessions, and multi-tenant quotas in favor of a single-user local-first architecture. Project is the top business boundary.
- **[ADR-0021: Durable submission checkpointing and safe worker recovery semantics](./ADR-0021-submission-checkpoint-and-worker-recovery-semantics.md)**
  Internal submission checkpoints (`NOT_SUBMITTED`, `SUBMITTING`, `SUBMITTED`, `UNKNOWN`), journal-before-I/O, and safe worker recovery without blind resubmission.
- **[ADR-0022: Vertex AI Gemini 3.8 Flash for Chapter Analysis Control Plane](./ADR-0022-vertex-gemini-chapter-analysis.md)**
  Direct backend-owned Vertex AI Gemini integration for Chapter Analysis; structured schema enforcement and telemetry; supersedes the historical Qwen decision preserved in Git history (formerly referenced as ADR-0032).
- **[ADR-0023: VieNeu TTS and Media Generation Runtime on Leased Remote RTX 3090](./ADR-0023-vieneu-remote-gpu-media-runtime.md)**
  VieNeu as the production TTS engine generating 48 kHz mono WAV audio, paired with WhisperX forced alignment on remote GPU; supersedes the historical VoiceStudio decision preserved in Git history (formerly referenced as ADR-0027).
- **[ADR-0024: StoryBeat Audio + Visual Director Architecture](./ADR-0024-storybeat-audio-visual-director-architecture.md)**
  StoryBeat as the semantic parent of AudioCue and VisualBeat, governed by Gemini as Story Director with Spring Boot validation, assembled narration scripts, and audio-driven visual timing.
- **[ADR-0025: Event-Driven Compute Orchestration, Worker Callback Outbox, and Scheduled State Reconciliation](./ADR-0025-event-driven-compute-orchestration-and-reconciliation.md)**
  Non-blocking worker callbacks with HMAC signatures, durable job state machine, SQLite worker outbox, scheduled non-blocking reconciliation fallback, and SSE desktop stream without extra message brokers.

### PARTIALLY SUPERSEDED

Decisions whose core technical decisions remain valid, but specific sections have been superseded by newer ADRs:

- **[ADR-0001: System topology, modular monolith, durable execution and persistence architecture](./ADR-0001-system-topology-execution-and-persistence.md)**
  *Active:* Spring Boot control plane, MyBatis/PostgreSQL persistence, durable jobs/leases/provider operations.
  *Superseded:* Direct worker polling superseded by ADR-0018; monetary cost authorization superseded by ADR-0020.
- **[ADR-0002: Storyboard aggregate, character continuity, motion models and production workflows](./ADR-0002-storyboard-character-continuity-and-production-workflows.md)**
  *Active:* Chapter-first workflow, reusable Character identity, revision/history rules and VisualBeat/motion models.
  *Superseded:* Historical translation-lineage portion is superseded by the translation-free Chapter source baseline.
- **[ADR-0014: PostgreSQL-only MVP runtime state](./ADR-0014-postgresql-only-mvp-runtime-state.md)**
  *Active:* PostgreSQL as the sole state store (no Redis).
  *Superseded:* Direct worker polling of PostgreSQL superseded by ADR-0018 Compute Protocol. Session state in PostgreSQL superseded by ADR-0020.

### HISTORICAL DECISIONS FROM PRE-CONSOLIDATION GIT HISTORY

The entries below are historical descriptions preserved in Git history. They are not active ADR
IDs or current architecture authority. Some historical documents used identifiers that were later
reused by active ADR files; use the active section and linked files above for current decisions.

- Historical media storage/generation decision: superseded by ADR-0007 and ADR-0018.
- Historical authentication/runtime-security decision: superseded by ADR-0020.
- Historical deterministic MVP render decision: superseded by ADR-0007.
- Historical Docker-runtime decision: superseded by ADR-0006 and ADR-0020.
- Historical Google OAuth identity decision: superseded by ADR-0020.
- Historical R2 voice-storage decision: superseded by ADR-0020.
- Historical local-AI production-stack decision: superseded by ADR-0020, ADR-0022, and ADR-0023.
- Historical VoiceStudio-only TTS decision: superseded by ADR-0023.
- Historical domain-neutral text-generation boundary: superseded by ADR-0022.
- Historical reference-conditioned GPU video-generation decision: deferred; video generation remains out of scope.

---

## Supersession rules

- ADR-0020 supersedes former user-quota/account and authentication models, establishing NarrativeX as a single-user local-first application without identity, account, or authentication models.
- ADR-0006 defines the primary client boundary and supersedes language that treats Next.js as the target editor.
- ADR-0007 governs Desktop project bytes and Desktop final artifacts.
- ADR-0014 supersedes Redis guidance within the current MVP runtime.
- ADR-0015 supersedes older duration-weighted visual timing descriptions.
- ADR-0022 supersedes the historical text-generation compute boundary preserved in Git history and Qwen chapter analysis; backend control plane owns Vertex Gemini integration.
- ADR-0023 supersedes the historical VoiceStudio decision preserved in Git history; VieNeu is the production TTS engine.
- ADR-0018 supersedes direct PostgreSQL polling by workers in ADR-0014 and relocates executors behind the Compute Protocol into `app/generation-service`.
- The current translation-free Chapter source baseline supersedes translation/content-variant workflow and schema language in older ADRs.
- A later accepted ADR wins when two decisions explicitly conflict in the same scope.

Use the next sequential ADR number for future cross-cutting architectural decisions.
