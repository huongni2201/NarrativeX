# NarrativeX V1.12 Baseline Implementation Traceability

This matrix maps the V1.12 contract to the current implementation branch. Current code, migrations and tests remain authoritative for AS-IS claims.

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
| Owner-scoped generation status stream | authenticated job SSE snapshots with Desktop reconnect and 15-second watchdog fallback | IMPLEMENTED foundation |
| Current media job recovery | chapter-scoped media-head lookup restores active media work after Desktop reload | IMPLEMENTED foundation |
| Generation durable persistence | GenerationJob/StageAttempt/OperationPlan/MediaPlan/outbox/job history | IMPLEMENTED foundation |
| ProviderOperation reconciliation | durable provider lifecycle with UNKNOWN-before-resubmit discipline | IMPLEMENTED foundation |
| MyBatis-only production persistence | backend production adapters use MyBatis + explicit PostgreSQL SQL | IMPLEMENTED |
| Clean pre-release Flyway baseline | V1-V8 consolidated baseline; preview-media schema currently exists as V9 pending baseline cleanup | PARTIAL |
| Stable guest schema | `desktop_guest_installations` is consolidated into V1 | IMPLEMENTED |
| Beat media selection schema | `production_beat_media_selections` is consolidated into V1 | IMPLEMENTED |
| Character + Location continuity | backend continuity foundations + project-scoped reads | IMPLEMENTED foundation |
| Narration strategy / TTS bypass | `TTS` + `USER_PROVIDED_AUDIO` model and guards | IMPLEMENTED foundation |
| Generated narration | VieNeu provider path + Desktop local materialization foundation | IMPLEMENTED foundation |
| Local audio import | native import/registration with USER_PROVIDED_AUDIO guard | IMPLEMENTED foundation |
| Vertex image generation | queue/provider/review flow + verified local materialization | IMPLEMENTED foundation |
| Gemini Web Desktop generation | Chrome/CDP automation, locked series prompt, Generate/Generate All Storyboard flow, protected IPC, checksum-verified local asset registration | IMPLEMENTED foundation |
| Protected prompt clipboard | typed preload capability to Electron main clipboard API; renderer has no direct clipboard API | IMPLEMENTED foundation |
| Local-first project media | generated/imported project image/video bytes live in Desktop project storage; R2 is not required for project production media | IMPLEMENTED foundation |
| Voice sample remote durability | account-scoped voice samples/custom voice references may use R2 | IMPLEMENTED foundation |
| Native local asset registration | two-phase main-process inspect/hash + backend LOCAL_ONLY registration + manifest commit | IMPLEMENTED foundation |
| Generated VisualBeat source | `visual_beats.preview_media_asset_id` points at the generated/default READY media asset | IMPLEMENTED foundation |
| Production timeline reads current Storyboard | `ProductionTimelineMapper` reads current storyboard scenes/VisualBeats directly instead of requiring MediaPlan rows | IMPLEMENTED foundation |
| Effective beat media precedence | READY `production_beat_media_selections` override → READY `preview_media_asset_id` → missing | IMPLEMENTED foundation |
| MediaPlan-independent Editor visibility | current VisualBeats remain inspectable even with null MediaPlan metadata | IMPLEMENTED foundation |
| Exact narration render gate | final readiness requires contiguous VisualBeat audio spans from 0 through chapter narration duration | IMPLEMENTED foundation |
| Incomplete timing review | fallback timing keeps Editor inspectable while backend `readyForRender=false` | IMPLEMENTED foundation |
| Beat media selection | V1 table + backend mutation/read model + Desktop editor integration | IMPLEMENTED foundation |
| Editor reset semantics | deleting the explicit selection falls back to generated preview media | IMPLEMENTED foundation |
| Timeline draft history | typed duration/camera command history with undo/redo/reset foundations; duration retiming is not exposed in the local-first MVP | IMPLEMENTED foundation |
| Auto Edit render planning | narration-aware local plan with style override and atomic backend render snapshot | IMPLEMENTED foundation |
| Concrete render blockers | Desktop Render UI distinguishes missing narration, missing media and incomplete timing before preflight | IMPLEMENTED foundation |
| Immutable render subtitles | V4 subtitle text/alignment snapshot + Desktop UTF-8 SRT generation | IMPLEMENTED foundation |
| Local media duration probing | Electron main probes imported audio/video duration and persists metadata | IMPLEMENTED foundation |
| Custom voice preview | voice-reference upload/preview job and expiring result URL | IMPLEMENTED foundation |
| Local project workspace | `ProjectStorage(<userData>/projects)` | IMPLEMENTED foundation |
| Local manifest integrity | schema versioning, project-relative path, size, SHA-256, atomic write, boundary checks | IMPLEMENTED foundation |
| Backup/restore/archive-copy | manifest-verified snapshots + safe active-workspace preservation | IMPLEMENTED foundation |
| Storage verification/cleanup | Settings storage accounting, verification and completed/failed work cleanup | IMPLEMENTED foundation |
| Local render preflight | FFmpeg/ffprobe, executor, disk and local asset integrity checks | IMPLEMENTED foundation |
| Backend-assigned local render | device-scoped claim/lease/progress/completion/failure | IMPLEMENTED foundation |
| Local render input resolution | asset IDs/checksums resolved through local manifest | IMPLEMENTED foundation |
| LOCAL_ONLY render admission | READY LOCAL_ONLY image/video media is valid for LOCAL_DEVICE rendering | IMPLEMENTED foundation |
| Desktop FFmpeg render | segment render → concat → mux → ffprobe → local artifact | IMPLEMENTED foundation |
| Final artifact metadata only | backend stores FinalArtifact metadata and never final MP4 bytes | IMPLEMENTED |
| Direct local playback/export | Desktop reads final MP4 directly from project artifacts | IMPLEMENTED foundation |
| Render journal discovery | atomic `render.state.json` + unfinished-job scan | IMPLEMENTED foundation |
| Segment render cache | immutable asset/timeline/renderer/output identity cache | IMPLEMENTED foundation |
| In-process cancellation | local execution cancellation path | IMPLEMENTED foundation |
| Renderer component architecture | Tailwind 4 + source-owned shadcn/Radix primitives + feature-oriented renderer structure | IMPLEMENTED foundation |
| Production packaging/signing/auto-update | release hardening remains | TARGET |
| Abrupt process/OS failure recovery UX | journal discovery exists; full recovery/resume product behavior needs hardening | PARTIAL |
| Adaptive VisualScenePlanner/review loop | narration-driven richer planner/review remains incomplete | TARGET |
| Reuse/reframe/edit AssetResolver | architecture direction exists | DEFERRED fast-follow |
| Complete actual usage/billing reconciliation | reservations/foundations exist | PARTIAL |

## Current non-claims

NarrativeX now has implemented foundations for guest-first Desktop use, local-first project media, generated VisualBeat preview media, Storyboard-backed production timelines, exact narration render admission, editable beat media selection, local render preflight, render journals, segment cache, real-time job updates, Auto Edit planning and render subtitle snapshots. These must not be described as future-only work.

NarrativeX does **not** yet claim production-complete packaging/signing/auto-update, fully hardened abrupt-process recovery across every failure mode, the complete adaptive VisualScenePlanner/review loop, full manual timeline retiming, or complete billing/actual-usage reconciliation.

## Storage invariants

1. PostgreSQL is durable business/control authority and stores final-artifact metadata only.
2. Desktop project image/video/audio bytes live in the local project workspace once accepted for production use.
3. R2 is not required as the production store for project image/video media; it remains appropriate for account-scoped voice samples/custom voice references and provider transport where required.
4. `project.manifest.json` maps stable IDs to project-relative paths + size/SHA-256.
5. Absolute local paths are not persisted as backend identities.
6. Final MP4 remains in the project artifact workspace unless an explicit export/upload/publish action copies it elsewhere.
7. Backend and Python workers do not store, stream or proxy final MP4 bytes.

## Execution and auth invariants

1. `USER_PROVIDED_AUDIO` bypasses TTS for its covered scope.
2. Narration timing is the visual master clock.
3. Current Storyboard + narration + effective READY beat media are authoritative for the local-first Editor/Render path; MediaPlan remains compatibility/planning data and is not a render admission prerequisite.
4. Exact final render timing requires contiguous VisualBeat audio spans from `0` through narration duration; provisional fallback timing is review-only.
5. Explicit Editor media selection overrides generated preview media; reset restores preview media.
6. Provider `UNKNOWN` reconciles before paid resubmission.
7. Completed provider results remain immutable by identity/fingerprint policy.
8. Final rendering is backend-assigned and lease-controlled but executed only in Electron main.
9. FFmpeg final project rendering never runs in unrestricted renderer code or Python AI workers.
10. Stable guest identity, signed-in user session and device execution credential are distinct concepts.
11. Google remains the only end-user account sign-in provider.
12. Backend authorization, not renderer state alone, gates account/provider-consuming operations.
13. SSE is a best-effort status transport; PostgreSQL job rows remain the durable source of truth and the Desktop watchdog can recover from stream interruption.
