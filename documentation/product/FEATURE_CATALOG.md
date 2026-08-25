# NarrativeX — Current Feature Catalog (V1.11)

This is the single maintained feature/status view. Current code, migrations and tests decide factual AS-IS claims when derived docs drift.

| Feature | V1.11 status | Current direction |
|---|---|---|
| Project/Chapter authoring | IMPLEMENTED foundation | backend-authoritative MyBatis persistence |
| Project dashboard/favorite | IMPLEMENTED foundation | authoritative project APIs; Desktop parity in progress |
| Chapter Analyze | IMPLEMENTED | durable admission/job/provider/reconciliation |
| Generation durability persistence | IMPLEMENTED foundation | GenerationJob/StageAttempt/OperationPlan/MediaPlan/outbox/job state |
| Character/Location continuity | IMPLEMENTED foundation | complete human review/reference lock remains PARTIAL |
| Project Character management | IMPLEMENTED foundation | project-scoped authoritative reads/assignment foundations |
| Storyboard/VisualBeat | IMPLEMENTED foundation | richer approved revision/reset/planning flow PARTIAL |
| Backend MediaPlan authority | IMPLEMENTED foundation | immutable policy/job authorization |
| TTS/VieNeu narration + alignment | IMPLEMENTED foundation | provider/cloud path exists; Desktop local materialization still partial |
| User-provided narration planning | IMPLEMENTED foundation | ordered parts, logical audio clock, TTS bypass |
| User-provided narration E2E | PARTIAL | complete Desktop/cloud render integration still needs path-specific hardening |
| Vertex image generation | IMPLEMENTED foundation | provider execution exists; Desktop result materialization PARTIAL |
| Cloud R2 pipeline media storage | IMPLEMENTED / LEGACY for Desktop | retained cloud/worker storage path |
| Cloud Google Drive final MP4 storage | IMPLEMENTED foundation / FALLBACK | retained cloud/server final-video path |
| Cloud IMAGE_MOTION render | IMPLEMENTED foundation / FALLBACK | worker FFmpeg/ffprobe path remains available |
| Electron Desktop only editor client | IMPLEMENTED foundation | sole supported editor; former web client removed |
| Secure main/preload/renderer split | IMPLEMENTED foundation | native capabilities outside renderer |
| Google OAuth-only Desktop login | IMPLEMENTED foundation | system browser + one-time deep-link handoff + server session |
| Password login/register/forgot | NOT TARGET | do not reintroduce production product flow |
| Desktop local project workspace | IMPLEMENTED foundation | Electron `userData` + `project.manifest.json` |
| Local manifest integrity | IMPLEMENTED foundation | relative paths + size/SHA-256 + workspace-boundary checks |
| Local device pairing | IMPLEMENTED foundation | explicit pairing + protected device identity |
| Local device heartbeat | IMPLEMENTED foundation | ONLINE/OFFLINE execution state |
| Backend-assigned local render claim | IMPLEMENTED foundation | device-scoped assignment/lease |
| Local render progress/failure/completion | IMPLEMENTED foundation | backend durable execution state |
| Desktop FFmpeg project render | IMPLEMENTED foundation | segments → concat → narration → mux → ffprobe → local artifact |
| In-process local render cancellation | IMPLEMENTED foundation | active render abort path |
| Desktop final MP4 local storage | IMPLEMENTED foundation | local project artifact; backend uses opaque identity/checksum metadata |
| Restart-safe local render recovery | PARTIAL | complete process-restart resume/recovery not yet guaranteed |
| Automatic device registration after login | TARGET | explicit pairing is current AS-IS behavior |
| Complete image/TTS/import local materialization | PARTIAL | required before cloud-independent local creator loop is complete |
| Full Desktop feature completeness | PARTIAL | remaining editor/review/recovery roadmap work is still being hardened |
| Legacy web removal | IMPLEMENTED | former `app/frontend-web` removed from repository and active runtime |
| Disk cleanup/backup/move/repair | TARGET | production local-first hardening |
| Packaging/signing/auto-update | TARGET | production Desktop release hardening |
| MyBatis-only production persistence | IMPLEMENTED | all production persistence uses MyBatis + explicit SQL |
| VisualScenePlanner | TARGET | narration-timeline-driven adaptive scenes/review |
| Reuse/reframe/edit AssetResolver | DEFERRED fast-follow | cost/consistency optimization after reliable creator loop |
| HYBRID_LOCAL_I2V | DEFERRED fast-follow | selected-beat private/local I2V future work |
| Full actual-cost reconciliation | PARTIAL | estimate/reservation/actual usage remain distinct |
| Public-production retention/DR/observability | PARTIAL | release-blocking evidence remains |

## Storage contract by execution mode

### Primary Desktop

```text
Generated/imported project images -> local project workspace
Project narration/audio           -> local project workspace
Imported project media            -> local project workspace
Render work                       -> local project workspace/work
Final local MP4                   -> local project workspace/artifacts
Business/job state                -> PostgreSQL
```

### Retained cloud/legacy

```text
Cloud pipeline media             -> R2
Cloud final rendered MP4         -> Google Drive
Business/job state               -> PostgreSQL
```

ADR-0012 governs Desktop local-first project bytes. ADR-0003 governs the retained cloud/worker path.

## Authentication acceptance

Desktop login uses Google OIDC in the system browser, returns a short-lived one-time code through `narrativex://auth/callback`, and exchanges that code into a server-managed NarrativeX session. Google tokens do not enter Electron. Device execution credentials are separate.

## Local render acceptance

A backend-authorized device can claim a local project render, resolve checksum-verified narration/images by stable IDs, heartbeat the lease, execute FFmpeg/ffprobe, register a local final artifact and report completion without persisting an absolute local path.

Do not claim restart-safe recovery or complete local materialization until those paths are proven.
