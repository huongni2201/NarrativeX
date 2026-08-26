# NarrativeX V1.11 Baseline Implementation Traceability

This matrix maps the V1.11 contract to implementation checkpoint `main` / `0aca94e6eef07158e161cd67c648671e74055473` (2026-08-26). Current code, migrations and tests remain authoritative for AS-IS claims.

| Capability / invariant | Evidence | Status |
|---|---|---|
| Desktop-only editor client | `app/desktop`; former web client absent | IMPLEMENTED |
| Secure Electron boundary | context-isolated, no-Node-integration BrowserWindow + narrow preload/main capabilities; Chromium renderer sandbox currently disabled for startup compatibility | IMPLEMENTED foundation with documented trade-off |
| Stable Desktop guest identity | Electron secure installation credential + backend `desktop_guest_installations` / guest session service | IMPLEMENTED |
| Guest-first free workspace | backend guest allowlists + Desktop guest bootstrap | IMPLEMENTED foundation |
| Google-only account sign-in | system-browser OIDC + one-time Desktop handoff/exchange | IMPLEMENTED |
| In-context auth gate | `AUTHENTICATION_REQUIRED` + Desktop LoginModal without route loss | IMPLEMENTED foundation |
| Guest ownership transfer | auth use case transfers eligible guest-owned workspace metadata on Google exchange | IMPLEMENTED foundation |
| Project/Chapter authoring | backend commands/use cases/MyBatis + Desktop React Query flows | IMPLEMENTED foundation |
| Chapter Analyze | durable admission + worker execution | IMPLEMENTED |
| Generation durable persistence | GenerationJob/StageAttempt/OperationPlan/MediaPlan/outbox/job history | IMPLEMENTED foundation |
| ProviderOperation reconciliation | durable provider lifecycle with UNKNOWN-before-resubmit discipline | IMPLEMENTED foundation |
| MyBatis-only production persistence | backend production adapters use MyBatis + explicit PostgreSQL SQL | IMPLEMENTED |
| Flyway frozen core + additive migrations | V1-V3 frozen; V4 guest identity; V5 beat media selections | IMPLEMENTED |
| Character + Location continuity | backend continuity foundations + project-scoped reads | IMPLEMENTED foundation |
| Narration strategy / TTS bypass | `TTS` + `USER_PROVIDED_AUDIO` model and guards | IMPLEMENTED foundation |
| Generated narration | Google TTS / VieNeu provider paths + Desktop local materialization foundation | IMPLEMENTED foundation |
| Local audio import | native import/registration with USER_PROVIDED_AUDIO guard | IMPLEMENTED foundation |
| Vertex image generation | queue/provider/review flow + verified remote-to-local materialization | IMPLEMENTED foundation |
| Native local asset registration | two-phase main-process inspect/hash + backend LOCAL_ONLY registration + manifest commit | IMPLEMENTED foundation |
| Production timeline reads | backend production timeline + narration-aligned timing | IMPLEMENTED foundation |
| Beat media selection | V5 table + backend mutation/read model + Desktop editor integration | IMPLEMENTED foundation |
| Timeline draft history | typed duration/camera command history with undo/redo/reset | IMPLEMENTED foundation |
| Local project workspace | `ProjectStorage(<userData>/projects)` | IMPLEMENTED foundation |
| Local manifest integrity | schema versioning, project-relative path, size, SHA-256, atomic write, boundary checks | IMPLEMENTED foundation |
| Backup/restore/archive-copy | manifest-verified snapshots + safe active-workspace preservation | IMPLEMENTED foundation |
| Storage verification/cleanup | Settings storage accounting, verification and completed/failed work cleanup | IMPLEMENTED foundation |
| Local render preflight | FFmpeg/ffprobe, executor, disk and local asset integrity checks | IMPLEMENTED foundation |
| Backend-assigned local render | device-scoped claim/lease/progress/completion/failure | IMPLEMENTED foundation |
| Local render input resolution | asset IDs/checksums resolved through local manifest | IMPLEMENTED foundation |
| Desktop FFmpeg render | segment render → concat → mux → ffprobe → local artifact | IMPLEMENTED foundation |
| Render journal discovery | atomic `render.state.json` + unfinished-job scan | IMPLEMENTED foundation |
| Segment render cache | immutable asset/timeline/renderer/output identity cache | IMPLEMENTED foundation |
| In-process cancellation | local execution cancellation path | IMPLEMENTED foundation |
| Cloud R2/Drive path | retained server-worker storage/render fallback | LEGACY/FALLBACK for Desktop |
| Renderer component architecture | Tailwind 4 + source-owned shadcn/Radix primitives + feature-oriented renderer structure | IMPLEMENTED foundation |
| Production packaging/signing/auto-update | release hardening remains | TARGET |
| Abrupt process/OS failure recovery UX | journal discovery exists; full recovery/resume product behavior needs hardening | PARTIAL |
| Adaptive VisualScenePlanner/review loop | narration-driven richer planner/review remains incomplete | TARGET |
| Reuse/reframe/edit AssetResolver | architecture direction exists | DEFERRED fast-follow |
| Complete actual usage/billing reconciliation | reservations/foundations exist | PARTIAL |

## Current non-claims

NarrativeX now has implemented foundations for guest-first Desktop use, local asset materialization, backup/restore, render journals, segment cache and editable beat media selection. These must not be described as future-only work.

NarrativeX does **not** yet claim production-complete packaging/signing/auto-update, fully hardened abrupt-process recovery across every failure mode, the complete adaptive VisualScenePlanner/review loop, or complete billing/actual-usage reconciliation.

The retained R2/Google Drive path remains real for server-worker/fallback flows, but it is not the Desktop project-media source of truth.

## Storage invariants

### Desktop

1. PostgreSQL is durable business/control authority.
2. Desktop project bytes live in the local project workspace.
3. `project.manifest.json` maps stable IDs to project-relative paths + size/SHA-256.
4. Absolute local paths are not persisted as backend identities.
5. Local final MP4 remains in the project artifact workspace unless an explicit export/upload/publish action copies it elsewhere.

### Cloud/fallback

1. R2 stores retained cloud pipeline media.
2. Google Drive stores retained cloud-rendered final MP4.
3. Worker-local paths are ephemeral scratch.
4. This contract does not redefine Desktop local-first project storage.

## Execution and auth invariants

1. `USER_PROVIDED_AUDIO` bypasses TTS for its covered scope.
2. Narration timing is the visual master clock.
3. Backend MediaPlan/execution policy is authoritative.
4. Provider `UNKNOWN` reconciles before paid resubmission.
5. Completed provider results remain immutable by identity/fingerprint policy.
6. Desktop local render is backend-assigned and lease-controlled.
7. FFmpeg runs in Electron main, never unrestricted renderer code.
8. Stable guest identity, signed-in user session and device execution credential are distinct concepts.
9. Google remains the only end-user account sign-in provider.
10. Backend authorization, not renderer state alone, gates account/provider-consuming operations.
