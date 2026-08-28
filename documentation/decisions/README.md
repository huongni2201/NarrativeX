# NarrativeX Architecture Decision Ledger

ADRs are **historical decision evidence**, not a second set of current-state documentation. A file may remain in this directory after part of its original scope has been superseded. Use this ledger before relying on an older ADR.

For factual AS-IS implementation, current code, Flyway migrations and tests win. For current product/architecture direction, use the maintained V1.11 source-of-truth specification plus accepted ADRs that are still current in the relevant scope.

## Status vocabulary

- **CURRENT** — accepted and still the active decision for its main scope.
- **CURRENT WITH SUPERSEDED SCOPE** — still useful, but a later ADR/current baseline replaces part of the original decision.
- **HISTORICAL** — retained for rationale/verification history; do not use it as the current runtime contract.

## Decision set

| ADR | Ledger status | Current scope / supersession |
| --- | --- | --- |
| [ADR-0001 — System topology, modular monolith, durable execution and persistence](./ADR-0001-system-topology-execution-and-persistence.md) | CURRENT WITH SUPERSEDED SCOPE | Spring Boot control plane, Python worker boundary, durable jobs/provider operations remain relevant. Redis/session/queue assumptions are superseded by ADR-0020 and the PostgreSQL-only current baseline. |
| [ADR-0002 — Storyboard aggregate, character continuity, motion models and workflows](./ADR-0002-storyboard-character-continuity-and-production-workflows.md) | CURRENT WITH SUPERSEDED SCOPE | Chapter/Scene/VisualBeat and reusable Character continuity remain relevant. Historical translation/content-variant lineage is superseded by the current translation-free Chapter source contract. |
| [ADR-0003 — Media storage, generation pipelines and external providers](./ADR-0003-media-storage-generation-pipelines-and-external-integrations.md) | CURRENT WITH SUPERSEDED SCOPE | Remote generated-media/provider transport remains relevant. Desktop project bytes and final artifacts are governed by ADR-0012; final MP4 is local. |
| [ADR-0004 — Authentication, runtime security and test credentials](./ADR-0004-authentication-runtime-security-and-test-credentials.md) | CURRENT WITH SUPERSEDED SCOPE | Security/test credential principles remain relevant. Password-auth product behavior is superseded by ADR-0011; Redis session assumptions are superseded by ADR-0020. |
| [ADR-0005 — Deterministic MVP E2E rendering with local final storage](./ADR-0005-deterministic-mvp-e2e-render-storage.md) | HISTORICAL | Earlier deterministic/server-render verification rationale. Current final render execution/storage is governed by ADR-0012 and ADR-0015. |
| [ADR-0006 — Transactional Chapter creation](./ADR-0006-transactional-chapter-creation.md) | CURRENT | Server-owned StoryVersion/Chapter orchestration, idempotency and transaction boundaries. |
| [ADR-0007 — Architecture guards and pipeline observability](./ADR-0007-architecture-guards-and-pipeline-observability.md) | CURRENT | Architecture tests, facade boundaries, diagnostics and observability principles. |
| [ADR-0008 — Real Docker runtime](./ADR-0008-real-docker-runtime.md) | HISTORICAL | Retained server/provider Docker rationale. It is no longer the primary editor/client runtime after ADR-0010/0012. |
| [ADR-0009 — Image-provider retry bounds and circuit breaking](./ADR-0009-image-provider-circuit-breaker-and-retry-bounds.md) | CURRENT | Provider retry bounds, reconciliation, circuit breaking and cancellation. |
| [ADR-0010 — Electron Desktop editor boundary](./ADR-0010-desktop-editor-client-boundary.md) | CURRENT | `app/desktop` is the only supported editor. Electron main owns native capabilities; preload is narrow; renderer owns UI only. |
| [ADR-0011 — Google OAuth-only Desktop authentication](./ADR-0011-google-oauth-only-desktop-auth.md) | CURRENT | Google-only account sign-in, system-browser OIDC and one-time Desktop handoff. |
| [ADR-0012 — Desktop local-first media and render execution](./ADR-0012-desktop-local-first-media-and-render-execution.md) | CURRENT | Local project workspace/manifest, backend-assigned local render, FFmpeg in Electron main and local final artifacts. |
| [ADR-0013 — Desktop local media registration and editor mutations](./ADR-0013-desktop-local-media-registration-and-editor-mutations.md) | CURRENT | Main-process local registration and mutation/capability boundaries. |
| [ADR-0014 — Workspace backup and deterministic render segment cache](./ADR-0014-workspace-backup-and-render-segment-cache.md) | CURRENT | Manifest-verified backups, restore preservation, storage accounting and disposable render cache. |
| [ADR-0015 — Desktop render lifecycle and capability-scoped IPC](./ADR-0015-desktop-render-lifecycle-and-capability-ipc.md) | CURRENT | Journal lifecycle, resumable interruption semantics, idempotent registration and capability-scoped native/materialization IPC. |
| [ADR-0016 — UUID policy](./ADR-0016-public-id-uuid-policy.md) | CURRENT | UUIDv7 for public/domain IDs; numeric operational IDs remain where explicitly intended. |
| [ADR-0017 — Desktop renderer UI component stack](./ADR-0017-desktop-renderer-ui-component-stack.md) | CURRENT | Tailwind CSS, source-owned shadcn-style primitives, Radix behavior and CVA variants. |
| [ADR-0018 — Generation commit and worker build observability](./ADR-0018-generation-commit-and-worker-build-observability.md) | CURRENT | Post-commit job logging, DB identity readiness diagnostics, shared Compose configuration and build identity. |
| [ADR-0020 — PostgreSQL-only MVP runtime state](./ADR-0020-postgresql-only-mvp-runtime-state.md) | CURRENT | PostgreSQL is the sole required MVP state service for sessions, handoffs, durable queues/outbox and worker polling. Redis is not required. |
| [ADR-0021 — Desktop Gemini Web image generation](./ADR-0021-desktop-gemini-web-image-generation.md) | CURRENT | Desktop-main visible Chrome/CDP generation, main-owned style/prompt wrapper, protected capability boundary and checksum-verified local commit. |

ADR number 0019 is intentionally absent; do not invent or renumber historical ADRs to make numbering contiguous.

## Current supersession rules

1. ADR-0010 supersedes any earlier language treating a browser/Next.js client as the target editor.
2. ADR-0011 supersedes password-authentication product/runtime behavior and separates user session credentials from execution device credentials.
3. ADR-0012 supersedes ADR-0003 for Desktop project bytes and Desktop final artifacts; ADR-0003 remains useful for remote generated-media/provider transport.
4. ADR-0015 refines Desktop render interruption, registration and capability-scoped IPC behavior.
5. ADR-0020 supersedes older Redis/session/queue/broker guidance for the MVP runtime.
6. ADR-0021 defines the Gemini Web Desktop execution boundary; it does not replace backend-authorized API image generation or ADR-0012's local-first media contract.
7. The current translation-free Chapter source baseline supersedes translation/content-variant workflow and schema language in older ADRs.
8. Current Visual Beat exact source/audio timing remains a TARGET tracked in the active plan; no older ADR should be read as evidence that deterministic `text_start/text_end` or exact draft `audio_start_ms/audio_end_ms` are already implemented.
9. When two accepted ADRs explicitly conflict in the same scope, the later ADR wins unless it says otherwise.

## ADR maintenance rule

Keep accepted ADR bodies stable as decision history. When architecture changes:

1. add a new ADR for a cross-cutting decision;
2. update this ledger with the new status/supersession relation;
3. update current docs and `TRACEABILITY.md` to reflect verified AS-IS behavior;
4. do not silently rewrite an old ADR so it appears the old decision never existed.

Use the next deliberate ADR number for future cross-cutting decisions; do not fill historical numbering gaps merely for aesthetics.
