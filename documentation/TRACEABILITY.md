# NarrativeX V1.12 Baseline Implementation Traceability

This matrix maps maintained documentation to implementation checkpoint `main` / `b1457f38a169ccc59a5789c9f40207db275cc06f` (2026-09-12). The versioned V1.12 project spec ([`NARRATIVEX_PROJECT_SPEC_V1_12.md`](source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_12.md)) is the canonical specification. Current code, accepted ADRs, maintained workflow/product docs, migrations and tests are authoritative for AS-IS claims.

| Capability / invariant | Evidence | Status |
|---|---|---|
| Desktop-only editor client | `app/desktop`; former web client absent | IMPLEMENTED |
| Secure Electron boundary | context-isolated, no-Node-integration BrowserWindow + narrow preload/main capabilities | IMPLEMENTED foundation |
| Single-user workspace | direct boot into workspace without login gates or modals (ADR-0030) | IMPLEMENTED |
| No application authentication | no User, Account, Session, OAuth or CSRF security filter chain (ADR-0030) | IMPLEMENTED |
| No account/session persistence | no `NX_SESSION`, Spring Session JDBC tables or token cookies | IMPLEMENTED |
| No user-scoped domain ownership | `Project` is the highest business boundary; no `ownerId` / `userId` threading | IMPLEMENTED |
| Runtime capacity limits | system capacity reservations limit concurrent expensive work | IMPLEMENTED foundation |
| Generation-service protocol boundary | Compute Protocol v1 JSON Schemas (`contracts/compute/v1/`) | IMPLEMENTED |
| Generation-service DB isolation | `app/generation-service` has no access to PostgreSQL business DB or domain IDs | IMPLEMENTED |
| Submission checkpoint/recovery | SQLite journal records `NOT_SUBMITTED`, `SUBMITTING`, `SUBMITTED`, `UNKNOWN` (ADR-0031) | IMPLEMENTED |
| Project/Chapter authoring | backend commands/use cases/MyBatis + Desktop React Query flows | IMPLEMENTED foundation |
| Chapter Analyze | durable admission + compute task execution | IMPLEMENTED |
| Generation durable persistence | GenerationJob/StageAttempt/OperationPlan/MediaPlan/outbox/job history | IMPLEMENTED foundation |
| ProviderOperation reconciliation | durable provider lifecycle with UNKNOWN-before-resubmit discipline | IMPLEMENTED foundation |
| Non-monetary provider usage telemetry | provider adapters retain diagnostic usage without monetary pricing/cost contracts | IMPLEMENTED foundation |
| Monetary billing/credit/quota runtime | billing repositories, pricing enforcement and credit settlement are outside the current runtime contract | REMOVED |
| MyBatis-only production persistence | backend production adapters use MyBatis + explicit PostgreSQL SQL | IMPLEMENTED |
| Flyway baseline policy | clean databases apply only V1–V7 and create the final schema directly | IMPLEMENTED |
| Character + Location continuity | backend continuity foundations + project-scoped reads | IMPLEMENTED foundation |
| Narration strategy / TTS bypass | `TTS` + `USER_PROVIDED_AUDIO` model and guards | IMPLEMENTED foundation |
| Generated narration | VoiceStudio headless provider + WhisperX alignment + project-local WAV persistence/Desktop materialization | IMPLEMENTED foundation |
| Local audio import | native import/registration with USER_PROVIDED_AUDIO guard | IMPLEMENTED foundation |
| PROJECT voice-reference storage | project MediaAsset + ProjectStorage/manifest | IMPLEMENTED foundation |
| GLOBAL_LOCAL voice-reference storage | local reusable voice library in Desktop storage | IMPLEMENTED foundation |
| Voice-reference scope validation | backend validates PROJECT versus GLOBAL_LOCAL storage semantics before narration admission | IMPLEMENTED |
| Vertex image generation | queue/provider/review flow + project-local result/materialization | IMPLEMENTED foundation |
| Gemini Web Desktop generation | Chrome/CDP automation, backend prompt context, local asset commit | IMPLEMENTED foundation |
| Local-first project media | generated/imported project image/video/audio bytes live in project-local storage | IMPLEMENTED foundation |
| Native local asset registration | two-phase main-process inspect/hash + backend stable registration + manifest commit | IMPLEMENTED foundation |
| VisualBeat source anchoring | analysis/source anchor resolves to deterministic UTF-16 `textStart/textEnd` | IMPLEMENTED foundation |
| Backend text-to-audio mapping | `NarrationTextClockMapper` maps VisualBeat text ranges through narration alignment | IMPLEMENTED foundation |
| Production timeline reads current Storyboard | timeline loads current Scene/VisualBeat state directly | IMPLEMENTED foundation |
| Effective beat media precedence | READY explicit selection → READY preview media → missing | IMPLEMENTED foundation |
| Exact narration render gate | final readiness requires exact contiguous aligned VisualBeat clock through narration duration | IMPLEMENTED foundation |
| Incomplete timing review | fallback/provisional timing keeps Editor inspectable while `readyForRender=false` | IMPLEMENTED foundation |
| Persisted VisualBeat audio timing as Production input | `visual_beats.audio_start_ms/audio_end_ms` are not Production Timeline inputs; runtime derives timing from source ranges + current narration alignment | REMOVED FROM PRODUCTION CONTRACT |
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

## Current non-claims

NarrativeX has implemented foundations for single-user local-first Desktop use, local-first project media, explicit PROJECT/GLOBAL_LOCAL voice-reference storage, source-anchored VisualBeat timing, Storyboard-backed production timelines, exact narration render admission, editable beat media selection, local render preflight, render journals/cache, real-time job updates, Auto Edit planning and render subtitle snapshots.

NarrativeX does **not** claim production-complete packaging/signing/auto-update, fully hardened abrupt-process recovery across every failure mode, the complete adaptive VisualScenePlanner/review loop, or unrestricted manual timeline retiming. Monetary billing/credit/quota accounting is intentionally not a current-runtime capability rather than an incomplete implementation claim.

## Storage invariants

1. PostgreSQL is durable business/control authority and stores final-artifact metadata only.
2. Desktop/project-local storage owns accepted project image/video/audio bytes.
3. PROJECT voice references remain project-local and resolve through stable asset identity + `project.manifest.json` integrity metadata.
4. GLOBAL_LOCAL voice references live in local application storage.
5. Generated project images and narration are not uploaded to remote object storage as transport, fallback or dual write.
6. Absolute local paths are not persisted as backend identities.
7. Final MP4 remains in the project artifact workspace unless an explicit export/publish action copies it elsewhere.
8. Backend and Python workers do not store, stream or proxy final MP4 bytes.

## Execution and timing invariants

1. `USER_PROVIDED_AUDIO` bypasses TTS for its covered scope.
2. Narration timing is the visual master clock.
3. VisualBeat source anchors resolve to deterministic UTF-16 text ranges.
4. Backend Production Timeline maps text ranges through the current narration/subtitle alignment using `NarrationTextClockMapper`.
5. Persisted `visual_beats.audio_start_ms/audio_end_ms` are not Production Timeline inputs.
6. Provisional fallback timing is Editor-review only and never satisfies final render readiness.
7. Exact final render timing requires a contiguous aligned clock from `0` through narration duration.
8. Current Storyboard + narration alignment + effective READY beat media are authoritative for the local-first Editor/Render path; MediaPlan remains planning/compatibility data and is not a render admission prerequisite.
9. Explicit Editor media selection overrides generated preview media; reset restores preview media.
10. Provider `UNKNOWN` reconciles before external provider resubmission.
11. Final rendering is backend-assigned and lease-controlled but executed only in Electron main.
12. FFmpeg final project rendering never runs in unrestricted renderer code or Python AI workers.
13. Backend coordinates durable lifecycle and dispatches domain-agnostic compute tasks to `generation-service`.
14. SSE is a best-effort status transport; PostgreSQL job rows remain durable authority.
