# NarrativeX — Current Feature Catalog (V1.11)

This is the maintained feature/status view at docs checkpoint `0aca94e6eef07158e161cd67c648671e74055473` (2026-08-26). Current code, migrations and tests decide factual AS-IS claims when documentation drifts.

| Feature | V1.11 status | Current direction |
|---|---|---|
| Stable installation guest identity | IMPLEMENTED | guest ownership/session continuity without becoming a second login provider |
| Guest-first free workspace | IMPLEMENTED foundation | free authoring/local-workspace mutations allowed by explicit backend guest rules |
| Google-only account sign-in | IMPLEMENTED | system browser + one-time deep-link exchange + server session |
| In-context authentication gate | IMPLEMENTED foundation | `AUTHENTICATION_REQUIRED` opens LoginModal without losing editor route |
| Guest ownership transfer on sign-in | IMPLEMENTED foundation | eligible mutable guest-owned workspace metadata transfers to Google account |
| Password login/register/forgot | NOT TARGET | do not reintroduce production product flows |
| Project/Chapter authoring | IMPLEMENTED foundation | backend-authoritative MyBatis persistence + Desktop API integration |
| Project dashboard/favorite | IMPLEMENTED foundation | authoritative project APIs and Desktop mutations |
| Chapter Analyze | IMPLEMENTED | durable admission/job/provider/reconciliation |
| Generation durability | IMPLEMENTED foundation | GenerationJob/StageAttempt/OperationPlan/MediaPlan/outbox state |
| Character/Location continuity | IMPLEMENTED foundation | richer human review/reference locking remains partial |
| Storyboard / Scene / VisualBeat | IMPLEMENTED foundation | richer adaptive planning/revision review remains partial |
| Narration timing authority | IMPLEMENTED foundation | aligned narration drives beat duration |
| TTS/VieNeu narration | IMPLEMENTED foundation | provider execution + Desktop local materialization for current flows |
| Local voice preview | IMPLEMENTED foundation | Desktop voice selection/preview workflow |
| User-provided narration | IMPLEMENTED foundation | native local import, ordered parts, logical clock and TTS bypass |
| Arbitrary multi-part user-audio production coverage | PARTIAL | slicing/concatenation/alignment behavior needs complete path-specific proof |
| Vertex image generation | IMPLEMENTED foundation | selection/estimate/queue/review + verified Desktop materialization |
| Native local media import | IMPLEMENTED foundation | main-process inspect/hash + backend stable identity + ProjectStorage commit |
| Persisted beat media selection | IMPLEMENTED foundation | V5 production beat media selection state |
| Mixed image/video beat model | IMPLEMENTED foundation | timeline can carry media identity; richer video editing semantics remain partial |
| Timeline duration/camera draft editing | IMPLEMENTED foundation | typed command history with undo/redo/reset |
| Electron Desktop only editor | IMPLEMENTED | sole supported editor; former web client removed |
| Secure main/preload/renderer split | IMPLEMENTED foundation | native capabilities outside renderer |
| Tailwind/source-owned UI primitives | IMPLEMENTED foundation | production-oriented renderer structure and accessible component vocabulary |
| Desktop local project workspace | IMPLEMENTED foundation | Electron `userData` + ProjectStorage/ProjectCatalog |
| Local manifest integrity | IMPLEMENTED foundation | relative paths + size/SHA-256 + workspace-boundary checks |
| Storage accounting/verification/cleanup | IMPLEMENTED foundation | Settings storage and project integrity tooling |
| Backup/restore/archive-copy | IMPLEMENTED foundation | manifest-verified snapshots and safe workspace replacement behavior |
| Local device identity/heartbeat | IMPLEMENTED foundation | protected device credential + execution state |
| Backend-assigned local render claim | IMPLEMENTED foundation | device-scoped assignment/lease |
| Local render preflight | IMPLEMENTED foundation | FFmpeg/ffprobe, executor, disk and asset-integrity checks |
| Desktop FFmpeg project render | IMPLEMENTED foundation | segments → concat → narration → mux → ffprobe → local artifact |
| Render journal discovery | IMPLEMENTED foundation | atomic state journal + unfinished-work discovery |
| Render segment cache | IMPLEMENTED foundation | immutable input/timeline/renderer/output identity cache |
| In-process cancellation | IMPLEMENTED foundation | active render abort path |
| Desktop final MP4 local storage | IMPLEMENTED foundation | local artifact; backend stores opaque identity/checksum metadata |
| Full abrupt-process render recovery/resume UX | PARTIAL | journals exist; complete stage recovery/soak behavior still needs hardening |
| Cloud R2 pipeline media | IMPLEMENTED / LEGACY for Desktop | retained server/provider durability path |
| Cloud Google Drive final MP4 | IMPLEMENTED foundation / FALLBACK | retained cloud-render final-video path |
| MyBatis-only production persistence | IMPLEMENTED | production persistence uses MyBatis + explicit SQL |
| Flyway V1-V3 frozen baseline | IMPLEMENTED | V4+ append-only feature migrations |
| VisualScenePlanner | TARGET | narration-driven adaptive Scene/VisualBeat planning/review |
| Reuse/reframe/edit AssetResolver | DEFERRED fast-follow | richer asset lineage/reuse after core reliability |
| HYBRID_LOCAL_I2V | DEFERRED fast-follow | optional selected-beat I2V, not core Desktop dependency |
| Packaging/signing/auto-update | TARGET | production Desktop release hardening |
| Full actual-cost reconciliation | PARTIAL | estimate/reservation/actual usage remain distinct |
| Production retention/DR/observability | PARTIAL | operational evidence remains |

## Storage contract by execution mode

### Primary Desktop

```text
Generated/imported project media  -> local project workspace
Narration/audio                   -> local project workspace
Render work/cache                 -> local project workspace/work
Backups                           -> Desktop-managed local snapshots
Final local MP4                   -> local project workspace/artifacts
Business/job state                -> PostgreSQL
```

### Retained server/cloud

```text
Cloud pipeline media              -> R2
Cloud final rendered MP4          -> Google Drive
Business/job state                -> PostgreSQL
```

## Authentication acceptance

A Desktop installation can resume the same guest-owned workspace after server-session expiry by presenting its protected installation credential. Google remains the only account sign-in provider. A gated operation can sign the guest in through the system browser and one-time `narrativex://` handoff without discarding the active editor context. Google tokens do not enter Electron.

## Local render acceptance

A backend-authorized device can claim a local project render, preflight runtime/disk/assets, resolve checksum-verified media by stable IDs, heartbeat the lease, journal/cache local execution, run FFmpeg/ffprobe, register a local final artifact and report completion without persisting an absolute local path.

Do not claim production-complete crash recovery, adaptive planner completion, arbitrary multi-part audio coverage or release packaging until those paths are proven.
