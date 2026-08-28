# NarrativeX V1.11 Baseline Implementation Traceability

This matrix maps the V1.11 contract to baseline implementation checkpoint `main` / `2c965b2e95ddcc1e03dc5527340c6adb18cdd05e` (2026-08-28). Current code, migrations and tests remain authoritative for AS-IS claims. Docs-only commits may follow this checkpoint; application/runtime changes after it require a new docs sync.

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
| Visual Beat semantic analysis | worker schema/prompt/materializer persists title, visual intent, camera angle and beat character refs | IMPLEMENTED foundation |
| Visual Beat deterministic source spans | source-segment references -> UTF-16 `text_start/text_end` on exact Chapter source snapshot | TARGET — current analysis schema/materializer do not yet persist these offsets |
| Visual Beat narration timing reconciliation | source spans + narration alignment -> `audio_start_ms/audio_end_ms`, source-safe and idempotent | TARGET — alignment exists, but current completion/materialization path does not yet reconcile beat timing |
| Draft storyboard beats on production timeline | current storyboard fallback visible before MediaPlan, with planned rows taking precedence | TARGET/PARTIAL — active plan exists; implementation/runtime verification is not complete at this checkpoint |
| Narration-master Desktop preview clock | real narration `<audio>` drives global playhead; timer is no-audio fallback only | TARGET/PARTIAL — active plan exists; runtime verification is not complete at this checkpoint |
| Owner-scoped generation status stream | authenticated job SSE snapshots with Desktop reconnect and 15-second watchdog fallback | IMPLEMENTED foundation |
| Current media job recovery | chapter-scoped media-head lookup restores active media work after Desktop reload | IMPLEMENTED foundation |
| Generation durable persistence | GenerationJob/StageAttempt/OperationPlan/MediaPlan/outbox/job history | IMPLEMENTED foundation |
| ProviderOperation reconciliation | durable provider lifecycle with UNKNOWN-before-resubmit discipline | IMPLEMENTED foundation |
| MyBatis-only production persistence | backend production adapters use MyBatis + explicit PostgreSQL SQL | IMPLEMENTED |
| PostgreSQL-only MVP runtime state | Spring Session JDBC + OAuth handoffs + durable queues/outbox/worker polling in PostgreSQL; no required Redis service | IMPLEMENTED |
| Flyway V1-V8 clean pre-release baseline | V1-V6 responsibility-separated schema/database logic, V7 indexes/invariants, V8 deterministic catalog seeds | IMPLEMENTED |
| Stable guest schema | `desktop_guest_installations` is consolidated into V1 | IMPLEMENTED |
| Beat media selection schema | `production_beat_media_selections` is consolidated into V1 | IMPLEMENTED |
| Character + Location continuity | backend continuity foundations + project-scoped reads | IMPLEMENTED foundation |
| Beat-specific Character participation | analysis schema/materializer + `visual_beat_characters` relation | IMPLEMENTED foundation |
| Narration strategy / TTS bypass | `TTS` + `USER_PROVIDED_AUDIO` model and guards | IMPLEMENTED foundation |
| Generated narration | VieNeu provider path + Desktop local materialization foundation | IMPLEMENTED foundation |
| Narration alignment persistence | narration assets + source-hash-bound `narration_alignments.spans_json`; segment-duration alignment | IMPLEMENTED foundation |
| Local audio import | native import/registration with USER_PROVIDED_AUDIO guard | IMPLEMENTED foundation |
| Vertex/API image generation | queue/provider/review flow + verified remote-to-local materialization | IMPLEMENTED foundation |
| Gemini Web Desktop generation | Chrome/CDP automation, locked series prompt, Generate/Generate All Storyboard flow, protected IPC, checksum-verified local asset registration | IMPLEMENTED foundation |
| Protected prompt clipboard | typed preload capability to Electron main clipboard API; renderer has no direct clipboard API | IMPLEMENTED foundation |
| R2 generated-media transport | AI-generated image/narration bytes are remotely durable until Desktop materialization where required | IMPLEMENTED foundation |
| Native local asset registration | two-phase main-process inspect/hash + backend LOCAL_ONLY registration + manifest commit | IMPLEMENTED foundation |
| Production timeline reads | backend production timeline with immutable planned timing plus generic fallback timing | IMPLEMENTED foundation; exact draft narration reconciliation remains incomplete |
| Beat media selection | backend mutation/read model + Desktop editor integration | IMPLEMENTED foundation |
| Timeline draft history | typed duration/camera command history with undo/redo/reset | IMPLEMENTED foundation |
| Auto Edit render planning | narration-aware local plan with style override and atomic backend render snapshot | IMPLEMENTED foundation |
| Immutable render subtitles | subtitle text/alignment snapshot + Desktop UTF-8 SRT generation | IMPLEMENTED foundation |
| Local media duration probing | Electron main probes imported audio/video duration and persists metadata | IMPLEMENTED foundation |
| Custom voice preview | voice-reference upload/preview job and expiring result URL | IMPLEMENTED foundation |
| Local project workspace | `ProjectStorage(<userData>/projects)` | IMPLEMENTED foundation |
| Local manifest integrity | schema versioning, project-relative path, size, SHA-256, atomic write, boundary checks | IMPLEMENTED foundation |
| Backup/restore/archive-copy | manifest-verified snapshots + safe active-workspace preservation | IMPLEMENTED foundation |
| Storage verification/cleanup | Settings storage accounting, verification and completed/failed work cleanup | IMPLEMENTED foundation |
| Local render preflight | FFmpeg/ffprobe, executor, disk and local asset integrity checks | IMPLEMENTED foundation |
| Backend-assigned local render | device-scoped claim/lease/progress/completion/failure | IMPLEMENTED foundation |
| Local render input resolution | asset IDs/checksums resolved through local manifest | IMPLEMENTED foundation |
| Desktop FFmpeg render | segment render -> concat -> mux -> ffprobe -> local artifact | IMPLEMENTED foundation |
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
| Complete arbitrary multi-part audio coverage/correction | foundations exist; path-complete alignment/slicing/correction remains | PARTIAL |
| Complete actual usage/billing reconciliation | reservations/foundations exist | PARTIAL |

## Current non-claims

NarrativeX has implemented foundations for guest-first Desktop use, local asset materialization, backup/restore, render journals, segment cache, editable beat media selection, real-time job updates, Auto Edit planning, narration alignment persistence and render subtitle snapshots. These must not be described as future-only work.

NarrativeX does **not** yet claim that every analyzed Visual Beat has deterministic source offsets, that storyboard beat audio timing is reconciled from narration alignment, that draft storyboard clips are exact narration-aligned production timeline clips before a MediaPlan, or that the Desktop preview is fully verified as narration-clock-authoritative. Those capabilities remain implementation targets in the active Visual Beat timeline plan.

NarrativeX also does **not** yet claim production-complete packaging/signing/auto-update, fully hardened abrupt-process recovery across every failure mode, the complete adaptive VisualScenePlanner/review loop, complete arbitrary multi-part audio production behavior, or complete billing/actual-usage reconciliation.

## Storage invariants

1. PostgreSQL is durable business/control authority and stores final-artifact metadata only.
2. AI-generated image/narration bytes may use R2 until they are materialized locally when remote durability is required.
3. Desktop project bytes live in the local project workspace.
4. `project.manifest.json` maps stable IDs to project-relative paths + size/SHA-256.
5. Absolute local paths are not persisted as backend identities.
6. Final MP4 remains in the project artifact workspace unless an explicit export/upload/publish action copies it elsewhere.
7. Backend and Python workers do not store, stream or proxy final MP4 bytes.

## Timing invariants

1. AI selects semantic source content; it does not calculate numeric character offsets or audio timestamps.
2. Visual Beat `text_start/text_end`, once implemented, use UTF-16 half-open offsets over the exact persisted Chapter source snapshot.
3. Visual Beat `audio_start_ms/audio_end_ms` are exact only when derived from a compatible persisted narration alignment or immutable MediaPlan; missing exact alignment must remain distinguishable from provisional display geometry.
4. Narration timing is the visual master clock.
5. A changed source hash invalidates stale source-to-audio timing for the changed Chapter snapshot.
6. Planned MediaPlan timing supersedes storyboard draft timing for production/render planning.
7. Nullable `aspect_ratio_override` / `quality_tier_override` mean inherited policy, not missing AI output.

## Execution and auth invariants

1. `USER_PROVIDED_AUDIO` bypasses TTS for its covered scope.
2. Backend MediaPlan/execution policy is authoritative.
3. Provider `UNKNOWN` reconciles before paid resubmission.
4. Completed provider results remain immutable by identity/fingerprint policy.
5. Final rendering is backend-assigned and lease-controlled but executed only in Electron main.
6. FFmpeg final project rendering never runs in unrestricted renderer code or Python AI workers.
7. Stable guest identity, signed-in user session and device execution credential are distinct concepts.
8. Google remains the only end-user account sign-in provider.
9. Backend authorization, not renderer state alone, gates account/provider-consuming operations.
10. SSE is a best-effort status transport; PostgreSQL job rows remain the durable source of truth and the Desktop watchdog can recover from stream interruption.
