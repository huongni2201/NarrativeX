# NarrativeX — Project Source of Truth V1.11

**Status:** Canonical engineering direction and code-aligned baseline  
**Effective date:** 2026-08-28  
**Repository:** `huongni2201/NarrativeX`  
**Docs-sync implementation checkpoint:** `main` at `2c965b2e95ddcc1e03dc5527340c6adb18cdd05e`  
**Primary product boundary:** Electron Desktop editor + backend-authoritative control plane + Desktop local-first project media/render

---

## 1. Authority and lifecycle

This file is the maintained V1.11 product/domain/architecture baseline. V1.11 is a product/spec version, not a promise that every target below is already implemented.

For factual AS-IS behavior, authority order is:

1. current code, Flyway migrations and automated tests;
2. accepted ADRs for deliberate cross-cutting decisions;
3. this source-of-truth specification;
4. `documentation/TRACEABILITY.md` for synchronized implementation evidence;
5. current product/domain/architecture/workflow/codebase docs;
6. Git history for retired migration notes and superseded reports.

Documentation lifecycle:

- `documentation/` is CURRENT except ADR bodies;
- `documentation/decisions/ADR-*.md` is historical decision evidence and may contain superseded scope;
- `docs/superpowers/plans/` is non-authoritative implementation planning;
- completed migrations and obsolete implementation reports are retired to Git history instead of remaining current docs.

Status vocabulary:

- **IMPLEMENTED** — working path exists and the key contract is present.
- **IMPLEMENTED foundation** — core runtime boundary exists but broader product/reliability work remains.
- **PARTIAL** — required pieces remain missing or incompletely verified.
- **TARGET** — approved next direction not yet proven in current code.
- **DEFERRED** — intentionally postponed.

A plan or ADR alone never upgrades a capability to IMPLEMENTED.

---

## 2. Product definition

NarrativeX is a **desktop-first AI-assisted long-form story-video studio**. It transforms persisted story/Chapter source into structured analysis, continuity-aware scenes/Visual Beats, narration, generated/imported media and final long-form or Short/Reel video.

The product is:

- **desktop-only at the editor boundary** — `app/desktop` is the only supported editor client;
- **guest-first** — a new installation can enter a stable guest-owned workspace before account sign-in;
- **Google-only for account sign-in** — Google OIDC is the only end-user account authentication provider;
- **Chapter-first** — Chapter remains the primary persisted source unit;
- **Scene/VisualBeat aware** — Chapter → Scene → VisualBeat remains the production hierarchy;
- **review-first** — generated/reviewed state is versioned rather than silently overwritten;
- **audio-timeline-first** — narration is the visual master clock when real aligned audio exists;
- **image-first but media-flexible** — deterministic image motion is the low-cost default, while beats may use image or video media;
- **local-media-first** — project media and final renders live in the Desktop project workspace after required generated media is materialized;
- **backend-authorized** — Spring/PostgreSQL remain authoritative for ownership, policy, job admission, production choices, assignment and durable execution state.

Creating a Project persists metadata. Saving a Chapter persists source. Analyze, narration/audio processing, image generation and rendering are explicit operations.

The former `app/frontend-web` editor is removed. Browser routes that remain are backend authentication routes, not an editor client.

---

## 3. Canonical runtime topology

```text
                         Google OIDC
                            ^
                            |
                       system browser
                            |
+-------------------------------------------------------+
|                  Electron Desktop                     |
|                                                       |
| renderer: UI / routes / React Query / editor drafts   |
|                 |                                     |
|                 v                                     |
| preload: narrow typed capability bridge               |
|                 |                                     |
|                 v                                     |
| main: guest secret / backend session / OAuth callback |
|       native files / ProjectStorage / device runtime  |
|       FFmpeg / ffprobe / journal / cache / backup     |
|       Gemini Web Chrome/CDP automation                |
+----------------------+--------------------------------+
                       |
                       v
              Spring Boot Backend
              -> PostgreSQL authoritative state
                 + Spring Session JDBC
                 + one-time OAuth handoffs
                 + durable jobs/leases/outbox
              -> Python AI/provider workers
                 polling/claiming PostgreSQL work

Electron main
  -> <userData>/projects/<projectId>/ local project bytes

Generated AI-media transport
  -> Cloudflare R2 only when remote provider/worker durability is required
  -> Desktop materialization before local project use/render
```

**Redis is not required by the MVP runtime.** It is not the session authority, queue, worker notification channel or required deployment service.

PostgreSQL is the durable control-plane authority. Electron local storage is the authority for machine-local project bytes referenced by stable backend IDs and integrity metadata.

---

## 4. Non-negotiable invariants

### 4.1 Source preservation

Expensive work pins authoritative source identity such as:

```text
chapterId
chapterRowVersion
sourceHash
```

A later source edit creates a new identity. Historical approved/generated outputs are not silently rewritten in place.

### 4.2 Narration is not synonymous with TTS

```text
NarrationStrategy
  TTS
  USER_PROVIDED_AUDIO
```

If accepted user-provided audio covers a scope, NarrativeX must not generate or reserve TTS for that same scope.

### 4.3 Narration is the visual master clock

Audio file boundaries are not Chapter boundaries. One continuous file may cover multiple Chapters; several ordered parts may cover one logical timeline. Exact visual timing must be derived from compatible narration alignment or an immutable production plan, not guessed by AI.

### 4.4 Backend owns execution policy

The backend creates/version-controls authorized operation/media/render state. Workers and Desktop devices execute persisted policy and may not silently escalate paid work.

### 4.5 PostgreSQL remains durable authority

PostgreSQL owns durable auth/ownership/project/domain/job/lease/policy/lineage/artifact metadata, server sessions and one-time Desktop OAuth handoffs.

### 4.6 Persistence is MyBatis + explicit SQL

Production backend persistence uses application/domain ports backed by MyBatis rows/mappers/XML and explicit PostgreSQL SQL. JPA and parallel direct-`JdbcTemplate` production persistence are not current application persistence paths.

### 4.7 Renderer is isolated UI

```text
contextIsolation = true
nodeIntegration  = false
```

Electron renderer owns UI/routing/query/editor state only. Native filesystem/process/credential/deep-link/local-render capabilities live in Electron main behind narrow preload APIs. Renderer-loaded story, prompt, reference and provider output are untrusted input.

### 4.8 Absolute Desktop paths are never backend identities

Backend contracts identify local media using stable IDs, checksums and opaque/project-relative keys. Absolute machine paths stay inside Electron main/local storage.

### 4.9 Backend authorization gates paid/account work

Guest/user role enforcement belongs to backend security. Renderer state may improve UX but cannot be the only authorization gate.

### 4.10 Lease ownership gates finalization

A Desktop render can finalize only under its current authorized device/lease. Lease loss prevents successful completion.

### 4.11 Final video bytes are local-only

Final project rendering executes in Electron main. The final MP4 lives in the local project artifact workspace. The backend stores render/final-artifact metadata but does not store or proxy final MP4 bytes.

---

## 5. Authentication and ownership

### Stable installation guest

Electron main owns a per-installation credential protected by OS secure storage. The backend persists only the secret hash and maps the installation to a stable internal guest user.

```text
Desktop start
  -> GET /api/v1/auth/me
  -> if session missing/expired: POST /api/v1/auth/desktop/guest
  -> stable ROLE_GUEST session
```

The guest principal exists for ownership/session continuity. It is not a password account or a second account-login provider.

### Google account sign-in

Account/provider-consuming actions remain backend-gated to `ROLE_USER`.

```text
Gated action
  -> 403 AUTHENTICATION_REQUIRED
  -> LoginModal remains over current editor context
  -> Electron main opens backend Desktop auth start
  -> Google OIDC in system browser
  -> one-time narrativex:// handoff
  -> backend exchange + eligible guest ownership transfer
  -> ROLE_USER session
```

Google access/refresh tokens never enter Electron.

### Credential separation

These remain distinct:

1. guest installation secret;
2. signed-in user session;
3. local-execution device credential.

---

## 6. Chapter source and analysis

`chapters.source_text`, `source_hash` and row version are the authoritative saved Chapter source identity. Analyze and narration consume that saved Chapter directly.

Do not reintroduce translation gating, translated content variants or translation-lineage fields as a required generation flow unless product direction changes through a deliberate contract update.

Current Chapter analysis persists foundations for:

- reusable Character/ProjectCharacter continuity;
- Locations;
- ordered Scenes;
- ordered Visual Beats;
- per-beat title and visual intent;
- camera angle and derived image-motion direction;
- participating beat Character references and roles.

AI analysis is semantic. It must not invent numeric character offsets or audio timestamps.

---

## 7. Character and continuity model

```text
Character
  -> reusable owner/workspace identity

ProjectCharacter
  -> assignment of Character to Project

CharacterVersion
  -> versioned identity/bible/visual prompt

CharacterAppearance
  -> timeline/project appearance state
```

Scene and VisualBeat reference participating ProjectCharacters. Character name is not a relational identity key. Temporary outfit/age/hairstyle/injury changes do not create a duplicate Character solely for that change.

---

## 8. Visual Beat source and timing model

The database already has nullable Visual Beat source/audio timing columns, but schema availability is not equivalent to implemented materialization.

Three coordinate systems must remain separate:

```text
Chapter source position
  text_start / text_end
        |
        v
Chapter narration position
  audio_start_ms / audio_end_ms
        |
        v
Project timeline position
  chapterStartMs + local audio offset
  -> startMs / endMs
```

### Current AS-IS

- semantic Visual Beat analysis/materialization exists;
- narration alignment persistence exists with source/text/audio spans;
- production timeline supports immutable planned timing and generic fallback timing;
- `visual_beats.text_start/text_end` are not yet deterministically materialized for every analyzed beat;
- narration completion does not yet reconcile current storyboard beat source spans into `visual_beats.audio_start_ms/audio_end_ms`;
- therefore an unplanned draft storyboard beat must not be described as exactly narration-aligned merely because the UI can derive fallback geometry.

### Approved target

```text
chapters.source_text
  -> deterministic source segments
  -> AI selects stable contiguous segment IDs
  -> worker resolves UTF-16 half-open text_start/text_end
  -> compatible narration alignment
  -> deterministic VisualBeatTimingReconciler
  -> audio_start_ms/audio_end_ms
  -> global project timeline startMs/endMs
```

AI never calculates the numeric offsets. Source hash/version compatibility gates reconciliation. Analysis-first and audio-first completion orders must converge to the same result.

`aspect_ratio_override` and `quality_tier_override` remain nullable override fields. `NULL` means inherit project/default policy, not missing AI output.

---

## 9. Narration and alignment

Generated narration flow:

```text
persisted Chapter source
  -> sentence-aware segments
  -> provider/local inference
  -> normalize/encode/validate/checksum
  -> narration asset
  -> source-to-audio alignment spans
  -> Desktop materialization
```

Current narration alignment persists source hash plus spans containing text and audio boundaries. That alignment is usable by subtitles and later timing/planning work.

User-provided narration remains an explicit TTS bypass. Arbitrary multi-part coverage/alignment and correction UX remain PARTIAL and require path-specific verification.

---

## 10. Image generation and media

### Backend-authorized API generation

Provider/API image generation remains backend-authorized, durable and reconciled through job/provider-operation state before accepted results are materialized locally.

### Gemini Web Desktop generation

Gemini Web generation is a Desktop-main capability through a visible Chrome/CDP browser session. It is not a Python-worker or browser-editor architecture.

Current foundation includes:

- typed renderer/preload/main boundary;
- main-owned prompt/style wrapper;
- Storyboard per-beat Generate and serial Generate All flow;
- checksum-verified local registration/materialization;
- protected prompt clipboard capability.

Gemini Web work must not be documented as a backend API media job or backend cost-estimate path.

### Media identity

A beat may select image or video media. Explicit beat media selection is durable backend production state. Image-only camera/motion controls must not be presented as identical semantics for video beats.

---

## 11. Desktop local-first project media

Primary project bytes live under Electron `userData`:

```text
<userData>/projects/<projectId>/
  project.manifest.json
  assets/
    images/
    audio/
    video/
  artifacts/
    <jobId>/final.mp4
  work/
```

`project.manifest.json` is a local integrity/location index, not a second domain database. Entries use stable IDs, project-relative paths, byte sizes and SHA-256.

```text
AI-generated image/narration transport -> R2 only when remote durability is needed
Generated/imported project media       -> local project workspace
Project narration/audio                -> local project workspace
Render intermediates/cache             -> local project workspace/work
Final MP4                              -> local project workspace/artifacts
Durable business/job/artifact metadata -> PostgreSQL
```

Current foundations include native import/registration, storage accounting/verification/cleanup and manifest-verified backup/restore/archive-copy behavior.

---

## 12. Production timeline and editor

The production editor preserves:

```text
Project
  -> Chapter
     -> Scene
        -> VisualBeat
           -> selected image/video media
           -> timing / supported controls
```

Current foundations include production timeline reads, explicit beat media selection, media-duration probing, typed duration/camera/fit draft commands, undo/redo/reset and Auto Edit planning.

Timing claims must remain precise:

- immutable MediaPlan timing is authoritative when present;
- persisted exact narration-aligned beat timing may be used when complete;
- current fallback timing can make a timeline navigable but is not proof of exact Visual Beat narration alignment;
- draft storyboard fallback/exact audio-clock preview remains an active implementation target until the associated plan is completed and verified.

---

## 13. Final render execution

```text
backend admits + assigns local render
  -> authorized device claims lease
  -> Desktop preflight validates runtime/disk/assets
  -> resolve stable input IDs/checksums through manifest
  -> write atomic render journal
  -> reuse valid segment-cache entries
  -> FFmpeg render missing visual segments
  -> concat video/narration
  -> mux
  -> ffprobe + checksum final MP4
  -> write artifacts/<jobId>/final.mp4
  -> register final-artifact metadata
  -> report progress/completion under current lease
  -> Desktop previews/exports local MP4 directly
```

Implemented foundations include lease heartbeat, progress/failure/completion, in-process cancellation, journal discovery, segment caching, immutable narration subtitle snapshots and local UTF-8 SRT generation.

Abrupt process/OS failure recovery across every stage and complete user-facing resume/retry behavior remain PARTIAL.

---

## 14. Durable generation/provider contract

```text
Source/reviewed state
  -> OperationPlan / MediaPlan
  -> GenerationJob / StageAttempt
  -> ProviderOperation when crossing an external paid boundary
  -> validated immutable result
  -> remote generated-media transport where required
  -> Desktop materialization for project use
```

External provider ambiguity preserves `UNKNOWN` and reconciles before paid resubmission. Workers and Desktop executors do not invent paid operations outside backend authorization.

Generation status delivery is real-time-first through owner-scoped authenticated SSE with Desktop reconnect. A slower GET watchdog covers missed events. PostgreSQL remains durable authority; the stream is delivery optimization, not state authority.

---

## 15. Persistence and Flyway baseline

Production backend application persistence is MyBatis + explicit PostgreSQL SQL.

Current clean pre-release Flyway baseline:

```text
V1__identity_and_access.sql
V2__project_story_and_planning.sql
V3__generation_billing_and_media.sql
V4__narration_notifications_and_artifacts.sql
V5__catalog_generation_and_render_snapshots.sql
V6__database_logic_and_triggers.sql
V7__indexes.sql
V8__seed_catalog.sql
```

Before the first production deployment, the clean baseline may still be reorganized and disposable development/test databases recreated. At first production deployment the accepted applied baseline becomes immutable; subsequent schema changes are append-only from the next version.

---

## 16. Current implementation baseline

| Capability | State |
| --- | --- |
| Desktop-only Electron editor | IMPLEMENTED |
| Secure main/preload/renderer capability boundary | IMPLEMENTED foundation |
| Stable installation guest identity/session | IMPLEMENTED |
| Guest-first free workspace | IMPLEMENTED foundation |
| Google-only account sign-in | IMPLEMENTED |
| In-context auth gate + guest ownership transfer | IMPLEMENTED foundation |
| Project/Chapter authoring | IMPLEMENTED foundation |
| Chapter Analyze | IMPLEMENTED |
| MyBatis-only production persistence | IMPLEMENTED |
| Generation/provider durable lifecycle | IMPLEMENTED foundation |
| Character/Location continuity | IMPLEMENTED foundation |
| Scene/VisualBeat semantic persistence | IMPLEMENTED foundation |
| Beat-specific Character references | IMPLEMENTED foundation |
| Narration strategy + user-audio TTS bypass | IMPLEMENTED foundation |
| Generated narration + local materialization | IMPLEMENTED foundation |
| Narration alignment persistence | IMPLEMENTED foundation |
| Deterministic VisualBeat source offsets | TARGET |
| VisualBeat narration timing reconciliation | TARGET |
| Exact draft storyboard audio timing before MediaPlan | TARGET/PARTIAL |
| Vertex/API image generation + Desktop materialization | IMPLEMENTED foundation |
| Gemini Web Desktop image generation + local materialization | IMPLEMENTED foundation |
| R2 generated-media transport | IMPLEMENTED foundation |
| Native local asset registration | IMPLEMENTED foundation |
| Persisted beat media selection | IMPLEMENTED foundation |
| Production timeline planned/fallback timing | IMPLEMENTED foundation |
| Narration-master draft preview clock | TARGET/PARTIAL |
| Timeline draft undo/redo | IMPLEMENTED foundation |
| Auto Edit plan + atomic render snapshot | IMPLEMENTED foundation |
| ProjectStorage/ProjectCatalog integrity | IMPLEMENTED foundation |
| Backup/restore/archive-copy | IMPLEMENTED foundation |
| Storage verification/cleanup | IMPLEMENTED foundation |
| Backend-assigned local render | IMPLEMENTED foundation |
| FFmpeg/ffprobe local render | IMPLEMENTED foundation |
| Render preflight/journal/cache | IMPLEMENTED foundation |
| FinalArtifact metadata-only backend boundary | IMPLEMENTED |
| Direct local final playback/export | IMPLEMENTED foundation |
| Owner-scoped generation SSE + Desktop reconnect/watchdog | IMPLEMENTED foundation |
| Immutable subtitle snapshot + local SRT track | IMPLEMENTED foundation |
| Local media duration probing | IMPLEMENTED foundation |
| Custom voice reference preview | IMPLEMENTED foundation |
| Production packaging/signing/auto-update | TARGET |
| Full abrupt-process render recovery UX | PARTIAL |
| Adaptive narration-driven VisualScenePlanner | TARGET |
| Rich reuse/reframe/edit AssetResolver | DEFERRED fast-follow |
| Complete arbitrary multi-part audio production coverage | PARTIAL |
| Complete actual usage/billing reconciliation | PARTIAL |

---

## 17. Security and secrets

- Google provider tokens never enter Electron.
- Guest plaintext secrets do not belong in renderer logs/storage; backend stores hashes for durable verification.
- Device credentials are separate revocable machine credentials.
- Renderer receives no unrestricted filesystem/process APIs.
- Provider/R2 credentials remain backend/worker secrets.
- Uploaded/provider media is untrusted until validated.
- Absolute Desktop paths never become durable backend identity.
- Guest/account production gates are backend-authorized.
- Final local artifact paths are resolved inside Electron main, not exposed as backend storage locations.

---

## 18. Current non-claims and active direction

NarrativeX does **not** currently claim:

- deterministic source offsets for every analyzed Visual Beat;
- exact storyboard Visual Beat audio timing reconciled from narration alignment before a MediaPlan;
- fully verified narration-clock-authoritative draft preview behavior;
- production-complete packaging/signing/auto-update;
- fully hardened abrupt-process/OS render recovery for every stage;
- complete arbitrary multi-part user-audio production coverage/correction UX;
- complete adaptive VisualScenePlanner/review loop;
- complete reuse/reframe/edit asset lineage;
- complete billing/actual-usage reconciliation.

Active remaining work belongs in `documentation/product/ROADMAP.md`. The Visual Beat source/audio timing work is described by the active plan indexed in `docs/superpowers/plans/README.md`.

Retired migration reports are not maintained current documents. Use ADRs and Git history for historical rationale.
