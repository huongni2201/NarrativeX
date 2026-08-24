# NarrativeX V1.11 Baseline Implementation Traceability

This matrix maps the V1.11 contract to implementation checkpoint `main` / `751f006634218efb2c398fc00c2cbfecd25e1eac` (2026-08-24). Current code, migrations and tests remain authoritative for AS-IS claims.

| Capability / invariant | Evidence | Status |
|---|---|---|
| Project/Chapter authoring and durable Analyze | backend commands/use cases/MyBatis + worker lifecycle | IMPLEMENTED foundation |
| Generation durable persistence | GenerationJob/StageAttempt/OperationPlan/MediaPlan/outbox/job history | IMPLEMENTED foundation |
| ProviderOperation lifecycle | durable provider/reconciliation/result-fingerprint path | IMPLEMENTED foundation |
| MyBatis-only production persistence | production adapters use MyBatis + explicit SQL | IMPLEMENTED |
| Character + Location continuity | backend/worker continuity foundations + project-scoped reads | IMPLEMENTED foundation |
| Narration strategy / TTS bypass | `TTS` + `USER_PROVIDED_AUDIO` planning model | IMPLEMENTED foundation |
| Google TTS / VieNeu provider execution | worker/provider narration path | IMPLEMENTED foundation |
| Multi-part uploaded-audio planning/timeline | ordered parts + logical global clock/alignment model | IMPLEMENTED foundation |
| Vertex image generation | real provider execution foundation | IMPLEMENTED foundation |
| Cloud R2 image/narration materialization | retained worker/cloud storage adapters | IMPLEMENTED foundation / LEGACY for Desktop |
| Cloud IMAGE_MOTION render | worker FFmpeg/ffprobe path | IMPLEMENTED foundation / FALLBACK |
| Cloud final MP4 in Google Drive | provider-neutral final-video storage + Drive adapter | IMPLEMENTED foundation / FALLBACK |
| Electron Desktop primary client shell | `app/desktop` Electron Vite/React renderer | IMPLEMENTED foundation |
| Secure Electron boundary | BrowserWindow context isolation, no Node integration, sandbox + preload | IMPLEMENTED foundation |
| Shared Desktop client contracts | `packages/client-contracts` consumed by Desktop | IMPLEMENTED foundation |
| Desktop system-browser Google OAuth start | `DesktopAuthService` + `/api/v1/auth/desktop/start` | IMPLEMENTED foundation |
| `narrativex://` deep-link callback | Electron protocol registration + first/second-instance handling | IMPLEMENTED foundation |
| One-time Desktop auth exchange | backend `/api/v1/auth/desktop/exchange` + server SecurityContext/session | IMPLEMENTED foundation |
| Google tokens excluded from Electron | system-browser/handoff architecture; no Google token transport to renderer | IMPLEMENTED invariant |
| Passwordless Google-only product direction | ADR-0011 + Desktop auth UI/runtime direction | IMPLEMENTED foundation |
| Local project workspace | `ProjectStorage(<userData>/projects)` | IMPLEMENTED foundation |
| Local manifest integrity | project-relative path, size, SHA-256, atomic write, workspace-boundary checks | IMPLEMENTED foundation |
| Absolute local paths excluded from backend identity | local asset IDs + opaque relative artifact key contract | IMPLEMENTED foundation |
| Local device pairing/identity | device identity store + pairing API/client | IMPLEMENTED foundation |
| Device heartbeat/status | `LocalExecutionService` | IMPLEMENTED foundation |
| Backend-assigned local render claim | project-render claim client/service | IMPLEMENTED foundation |
| Local render input resolution | `narrationAssetId` / `mediaAssetId` resolved through manifest + checksum | IMPLEMENTED foundation |
| Local render lease heartbeat | active-render lease timer + backend heartbeat | IMPLEMENTED foundation |
| Local render progress/failure/completion | backend client + execution service | IMPLEMENTED foundation |
| Local FFmpeg/ffprobe capability probing | desktop rendering runtime | IMPLEMENTED foundation |
| Desktop project render pipeline | segment render → concat video/audio → mux → ffprobe → local artifact | IMPLEMENTED foundation |
| In-process local render cancellation | AbortController + IPC cancel path | IMPLEMENTED foundation |
| Local render feature gate | FFmpeg availability + `NARRATIVEX_DESKTOP_PROJECT_RENDER_ENABLED` | IMPLEMENTED |
| Restart-safe local render recovery/resume | no complete cross-process resume/recovery guarantee | PARTIAL |
| Automatic post-login device registration | explicit pairing remains current path | TARGET |
| Complete image/TTS/import local materialization | not every result path is registered directly into local manifest yet | PARTIAL |
| Full Desktop feature parity | primary shell/features exist; legacy web remains | PARTIAL |
| Legacy `app/frontend-web` removal | parity/dependency gates not yet complete | TARGET |
| Disk cleanup/backup/move/repair | local-first product hardening | TARGET |
| Packaging/signing/auto-update hardening | production Desktop release work | TARGET |
| VisualScenePlanner | narration-driven planner/review vertical slice remains incomplete | TARGET |
| Reuse/reframe/edit AssetResolver | architecture direction exists, postponed | DEFERRED |
| HYBRID_LOCAL_I2V | adapter/planning foundation only | DEFERRED fast-follow |
| Complete actual usage/billing reconciliation | reservation/local render foundations exist | PARTIAL |

## Current non-claims

NarrativeX **does** have implemented foundations for Desktop local storage and local FFmpeg project rendering. Documentation must not describe Electron main/local render orchestration as future-only after checkpoint `751f006...`.

NarrativeX **does not** yet claim restart-safe local render recovery, automatic device registration, complete local materialization for every image/TTS/import path, full Desktop feature parity or removal of the legacy web client.

The retained R2/Google Drive cloud path remains real and supported during migration, but it is **not** the Desktop project-media source of truth.

## Storage invariants

### Desktop

1. PostgreSQL is durable business/control authority.
2. Desktop project bytes live in the local project workspace.
3. `project.manifest.json` maps stable IDs to project-relative paths + size/SHA-256.
4. Absolute local paths are not persisted as backend identities.
5. Local final MP4 remains in the project artifact workspace unless an explicit export/upload/publish action copies it elsewhere.

### Cloud/legacy

1. R2 stores cloud pipeline media.
2. Google Drive stores cloud-rendered final MP4.
3. Worker-local paths are ephemeral scratch.
4. This contract is a fallback/legacy execution mode for Desktop migration.

## Execution invariants

1. `USER_PROVIDED_AUDIO` bypasses TTS for its covered scope.
2. Audio file boundaries are not Chapter boundaries.
3. Backend MediaPlan/execution policy is authoritative.
4. Provider `UNKNOWN` reconciles before paid resubmission.
5. Completed provider results are immutable by identity/fingerprint policy.
6. Desktop local render is backend-assigned and lease-controlled.
7. Local render inputs are resolved by asset identity/checksum through the manifest.
8. Lease loss prevents local successful completion.
9. FFmpeg runs in Electron main, never unrestricted renderer code.
10. User auth session credentials and device execution credentials remain separate.
