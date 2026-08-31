# NarrativeX V1.12 Baseline Implementation Traceability

This matrix maps the current implementation refinements to implementation checkpoint `main` / `b1457f38a169ccc59a5789c9f40207db275cc06f` (2026-08-31). The canonical source-of-truth remains V1.11 until the next docs-sync version cut; current code, migrations, accepted ADRs and tests remain authoritative for AS-IS claims.

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
| Owner-scoped generation status stream | authenticated job SSE snapshots with Desktop reconnect and watchdog fallback | IMPLEMENTED foundation |
| Generation durable persistence | GenerationJob/StageAttempt/OperationPlan/MediaPlan/outbox/job history | IMPLEMENTED foundation |
| ProviderOperation reconciliation | durable provider lifecycle with UNKNOWN-before-resubmit discipline | IMPLEMENTED foundation |
| MyBatis-only production persistence | backend production adapters use MyBatis + explicit PostgreSQL SQL | IMPLEMENTED |
| Clean pre-release Flyway baseline | exactly V1-V8 in `db/migration`; no active patch-only V9 | IMPLEMENTED |
| Character + Location continuity | backend continuity foundations + project-scoped reads | IMPLEMENTED foundation |
| Narration strategy / TTS bypass | `TTS` + `USER_PROVIDED_AUDIO` model and guards | IMPLEMENTED foundation |
| Generated narration | VieNeu provider path + project-local persistence/Desktop materialization | IMPLEMENTED foundation |
| Local audio import | native import/registration with USER_PROVIDED_AUDIO guard | IMPLEMENTED foundation |
| PROJECT voice-reference storage | project MediaAsset + ProjectStorage/manifest; no R2 storage key | IMPLEMENTED foundation |
| ACCOUNT voice-reference storage | account-owned READY voice-reference asset + `voices/...` R2 namespace | IMPLEMENTED foundation |
| Voice-reference scope validation | backend validates PROJECT versus ACCOUNT storage semantics before narration admission | IMPLEMENTED |
| Vertex image generation | queue/provider/review flow + project-local result/materialization | IMPLEMENTED foundation |
| Gemini Web Desktop generation | Chrome/CDP automation, backend prompt context, local asset commit | IMPLEMENTED foundation |
| Local-first project media | generated/imported project image/video/audio bytes live in project-local storage; R2 is not project-media transport | IMPLEMENTED foundation |
| Native local asset registration | two-phase main-process inspect/hash + backend stable registration + manifest commit | IMPLEMENTED foundation |
| VisualBeat source anchoring | analysis/source anchor resolves to deterministic UTF-16 `textStart/textEnd` | IMPLEMENTED foundation |
| Backend text-to-audio mapping | `NarrationTextClockMapper` maps VisualBeat text ranges through narration alignment | IMPLEMENTED foundation |
| Production timeline reads current Storyboard | timeline loads current Scene/VisualBeat state directly | IMPLEMENTED foundation |
| Effective beat media precedence | READY explicit selection → READY preview media → missing | IMPLEMENTED foundation |
| Exact narration render gate | final readiness requires exact contiguous aligned VisualBeat clock through narration duration | IMPLEMENTED foundation |
| Incomplete timing review | fallback/provisional timing keeps Editor inspectable while `readyForRender=false` | IMPLEMENTED foundation |
| Persisted audio timing compatibility | complete existing audio spans may still be consumed; source-anchored mapping is the current derivation path | IMPLEMENTED compatibility |
| Legacy duration-weighted Python timing | removed production module/tests; no current timing authority | REMOVED |
| Beat media selection | V1 table + backend mutation/read model + Desktop editor integration | IMPLEMENTED foundation |
| Timeline draft history | typed editor command history foundations; final timing remains narration-authoritative | IMPLEMENTED foundation |
| Auto Edit render planning | narration-aware local plan with style override and atomic backend render snapshot | IMPLEMENTED foundation |
| Immutable render subtitles | narration/alignment snapshot + Desktop UTF-8 SRT generation | IMPLEMENTED foundation |
| Local media duration probing | Electron main probes imported audio/video duration and persists metadata | IMPLEMENTED foundation |
| Local project workspace | `ProjectStorage(<userData>/projects)` | IMPLEMENTED foundation |
| Local manifest integrity | schema versioning, project-relative path, size, SHA-256, atomic write, boundary checks | IMPLEMENTED foundation |
| Backup/restore/archive-copy | manifest-verified snapshots + safe active-workspace preservation | IMPLEMENTED foundation |
| Storage verification/cleanup | Settings storage accounting, verification and work cleanup | IMPLEMENTED foundation |
| Local render preflight | FFmpeg/ffprobe, executor, disk and local asset integrity checks | IMPLEMENTED foundation |
| Backend-assigned local render | device-scoped claim/lease/progress/completion/failure | IMPLEMENTED foundation |
| Desktop FFmpeg render | segment render → concat → mux → ffprobe → local artifact | IMPLEMENTED foundation |
| Final artifact metadata only | backend stores FinalArtifact metadata and never final MP4 bytes | IMPLEMENTED |
| Direct local playback/export | Desktop reads final MP4 directly from project artifacts | IMPLEMENTED foundation |
| Render journal/cache | atomic journal discovery + immutable segment cache | IMPLEMENTED foundation |
| In-process cancellation | local execution cancellation path | IMPLEMENTED foundation |
| Production packaging/signing/auto-update | release hardening remains | TARGET |
| Abrupt process/OS failure recovery UX | journal discovery exists; full recovery/resume product behavior needs hardening | PARTIAL |
| Adaptive VisualScenePlanner/review loop | narration-driven richer planner/review remains incomplete | TARGET |
| Reuse/reframe/edit AssetResolver | architecture direction exists | DEFERRED fast-follow |
| Complete actual usage/billing reconciliation | reservations/foundations exist | PARTIAL |

## Current non-claims

NarrativeX has implemented foundations for guest-first Desktop use, local-first project media, explicit PROJECT/ACCOUNT voice-reference storage, source-anchored VisualBeat timing, Storyboard-backed production timelines, exact narration render admission, editable beat media selection, local render preflight, render journals/cache, real-time job updates, Auto Edit planning and render subtitle snapshots.

NarrativeX does **not** claim production-complete packaging/signing/auto-update, fully hardened abrupt-process recovery across every failure mode, the complete adaptive VisualScenePlanner/review loop, unrestricted manual timeline retiming, or complete billing/actual-usage reconciliation.

## Storage invariants

1. PostgreSQL is durable business/control authority and stores final-artifact metadata only.
2. Desktop/project-local storage owns accepted project image/video/audio bytes.
3. R2 is limited to reusable authenticated ACCOUNT voice-reference/custom-voice assets.
4. PROJECT voice references remain project-local and resolve through stable asset identity + `project.manifest.json` integrity metadata.
5. Generated project images and narration are not uploaded to R2 as transport, fallback or dual write.
6. Absolute local paths are not persisted as backend identities.
7. Final MP4 remains in the project artifact workspace unless an explicit export/publish action copies it elsewhere.
8. Backend and Python workers do not store, stream or proxy final MP4 bytes.

## Execution and timing invariants

1. `USER_PROVIDED_AUDIO` bypasses TTS for its covered scope.
2. Narration timing is the visual master clock.
3. VisualBeat source anchors resolve to deterministic UTF-16 text ranges.
4. Backend production timeline maps text ranges through narration/subtitle alignment using `NarrationTextClockMapper`.
5. Complete existing persisted audio spans remain compatibility input; they are not the only timing source of truth.
6. Provisional fallback timing is Editor-review only and never satisfies final render readiness.
7. Exact final render timing requires a contiguous aligned clock from `0` through narration duration.
8. Current Storyboard + narration + effective READY beat media are authoritative for the local-first Editor/Render path; MediaPlan remains compatibility/planning data and is not a render admission prerequisite.
9. Explicit Editor media selection overrides generated preview media; reset restores preview media.
10. Provider `UNKNOWN` reconciles before paid resubmission.
11. Final rendering is backend-assigned and lease-controlled but executed only in Electron main.
12. FFmpeg final project rendering never runs in unrestricted renderer code or Python AI workers.
13. Stable guest identity, signed-in user session and device execution credential are distinct concepts.
14. Google remains the only end-user account sign-in provider.
15. Backend authorization, not renderer state alone, gates account/provider-consuming operations.
16. SSE is a best-effort status transport; PostgreSQL job rows remain durable authority.
