# NarrativeX — Project Source of Truth V1.11

**Status:** Canonical engineering direction and code-aligned baseline  
**Effective date:** 2026-08-31  
**Repository:** `huongni2201/NarrativeX`  
**Docs-sync implementation checkpoint:** `main` at `b1457f38a169ccc59a5789c9f40207db275cc06f`  
**Primary product boundary:** Electron Desktop editor + backend-authoritative control plane + Desktop local-first project media/render

---

## 1. Authority and status semantics

This file is the maintained V1.11 product/domain/architecture baseline.

For factual AS-IS behavior, authority order is:

1. current code, Flyway migrations and automated tests;
2. accepted ADRs for deliberate cross-cutting decisions;
3. this source-of-truth specification;
4. current roadmap/workflow/codebase documentation;
5. Git history for retired migration notes and superseded reports.

Current cross-cutting refinements include ADR-0020 (PostgreSQL-only MVP runtime), ADR-0021 (Desktop Gemini Web), ADR-0022 (R2 voice-only + voice-reference scope) and ADR-0023 (source-anchored visual timing).

Status vocabulary:

- **IMPLEMENTED** — working path exists and the key contract is present.
- **IMPLEMENTED foundation** — core runtime boundary exists but broader product/reliability work may remain.
- **PARTIAL** — required pieces remain missing.
- **TARGET** — approved next direction.
- **DEFERRED** — intentionally postponed.

Roadmap intent must never be presented as implemented behavior.

---

## 2. Product definition

NarrativeX is a **desktop-first AI-assisted long-form story-video studio**. It transforms persisted story/Chapter source into structured analysis, continuity-aware scene/beat plans, narration, generated/imported media and final long-form or Short/Reel video.

The product is:

- **desktop-only editor boundary** — `app/desktop` is the only supported editor client;
- **guest-first** — a new installation can enter a stable guest-owned workspace before account sign-in;
- **Google-only account sign-in** — Google OIDC is the only end-user account authentication provider;
- **chapter-first** — Chapter remains the primary persisted source unit;
- **scene/beat aware** — Chapter → Scene → VisualBeat remains the production hierarchy;
- **review-first** — generated/reviewed state is versioned rather than silently overwritten;
- **audio-timeline-first** — narration timing is authoritative for visual duration;
- **image-first but media-flexible** — image motion is the low-cost default, but a beat may use imported/generated video;
- **local-media-first** — project media and final renders stay on the user's machine;
- **backend-authorized** — Spring/PostgreSQL remain authoritative for ownership, policy, job admission, production choices, assignment and durable execution state.

Creating a Project persists metadata. Saving a Chapter persists source. Analyze, narration/audio processing, image generation and rendering are explicit operations.

The former `app/frontend-web` editor and Caddy frontend ingress are removed. Browser routes that remain belong to backend authentication flow only.

---

## 3. Non-negotiable invariants

### 3.1 Source preservation

Expensive work pins authoritative source identity such as:

```text
chapterId
chapterRowVersion
sourceHash
```

A later source edit creates a new identity. Historical approved/generated outputs are not silently rewritten in place.

### 3.2 Narration is not synonymous with TTS

```text
NarrationStrategy
  TTS
  USER_PROVIDED_AUDIO
```

If accepted user-provided audio covers a scope, NarrativeX must not generate/reserve TTS for that same scope.

### 3.3 Narration timing is the master clock

Audio file boundaries are not Chapter boundaries. One continuous file may cover multiple Chapters; several ordered parts may cover one logical timeline. Visual duration derives from narration/alignment rather than fixed per-image constants.

VisualBeat timing follows the source-anchored chain:

```text
source_anchor
  -> deterministic UTF-16 textStart/textEnd
  -> narration/subtitle alignment
  -> backend text-to-audio mapping
  -> production beat clock
```

Persisted exact audio timing may remain as compatibility input, but provisional/fallback timing is review-only and must not satisfy final render readiness.

### 3.4 Backend owns execution policy

The backend creates/version-controls authorized MediaPlan/production policy and expensive job admission. Workers and Desktop devices execute persisted policy and may not silently escalate paid work.

### 3.5 PostgreSQL remains durable control-plane authority

PostgreSQL owns durable auth/ownership/project/domain/job/lease/policy/lineage/artifact metadata, server sessions, one-time Desktop OAuth handoffs and durable worker queue/outbox state. Redis is not required by the MVP runtime and is not a current queue/session dependency.

### 3.6 Persistence is MyBatis + explicit SQL

Production backend persistence uses application/domain ports backed by MyBatis rows/mappers/XML and explicit PostgreSQL SQL. Do not reintroduce JPA or parallel direct-`JdbcTemplate` production persistence without an ADR.

### 3.7 Renderer is isolated UI

```text
contextIsolation = true
nodeIntegration  = false
sandbox          = false
```

The Chromium renderer sandbox is currently disabled for Desktop startup compatibility. Electron renderer still owns UI/routing/query/editor state only; native filesystem/process/credential/deep-link/local-render capabilities live in Electron main behind narrow preload APIs, with context isolation and no Node integration preserved. Treat renderer-loaded story, prompt, reference and provider output as untrusted.

### 3.8 Absolute Desktop paths are never backend identities

Backend contracts identify local media using stable asset/job IDs, checksums and opaque project-relative keys. Absolute machine paths stay inside Electron main/local storage.

### 3.9 Backend authorization gates paid/account work

Guest/user role enforcement belongs to backend security. Renderer state may improve UX but cannot be the only authorization gate.

### 3.10 Lease ownership gates finalization

A Desktop render can finalize only under its current authorized device/lease. Lease loss prevents successful completion.

### 3.11 Final video bytes are local-only

Final project rendering executes in Electron main. The final MP4 lives in the local project artifact workspace. The backend records render/final-artifact metadata but does not store, download, preview-proxy or stream final video bytes.

### 3.12 R2 is voice-reference storage only

Cloudflare R2 is limited to authenticated reusable account-owned voice-reference/custom-voice assets. It is not generated project-media transport, a project-media fallback or final-video storage.

---

## 4. Canonical runtime topology

```text
                         Google OIDC
                            ^
                            |
                       system browser
                            |
+-------------------------------------------------------+
|                  Electron Desktop                     |
|                                                       |
| renderer: UI / routes / query + editor draft state    |
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
              -> Python AI/provider workers polling PostgreSQL

Electron main
  -> <userData>/projects/<projectId>/ local project bytes

Cloudflare R2
  -> ACCOUNT voice-reference/custom-voice bytes only
```

---

## 5. Authentication and ownership architecture

### 5.1 Stable installation guest

Electron main owns a per-installation credential protected by OS secure storage. The backend persists only the secret hash and maps the installation to a stable internal guest user through `desktop_guest_installations`.

The guest row exists for ownership/FK/session continuity. It is **not** a password account and **not** an alternative OAuth provider.

```text
Desktop start
  -> GET /api/v1/auth/me
  -> if session missing/expired: POST /api/v1/auth/desktop/guest
  -> backend verify/create installation mapping
  -> stable ROLE_GUEST session
```

Free guest mutations are explicit backend allowlists.

### 5.2 Google account sign-in

Account-bound/provider-consuming actions remain `ROLE_USER` only.

```text
Gated action
  -> 403 AUTHENTICATION_REQUIRED
  -> LoginModal stays over current editor route
  -> Electron main opens /api/v1/auth/desktop/start
  -> Google OIDC in system browser
  -> backend one-time handoff code
  -> narrativex://auth/callback?code=...
  -> POST /api/v1/auth/desktop/exchange
  -> eligible guest-owned workspace metadata transferred
  -> ROLE_USER session
  -> renderer invalidates/refetches without route loss
```

Google access/refresh tokens never enter Electron.

### 5.3 Credential separation

These are distinct:

1. guest installation secret — resumes stable guest identity;
2. signed-in user session — server-managed NarrativeX account session;
3. local-execution device credential — heartbeat/claim/lease APIs.

Do not conflate them.

---

## 6. Desktop application boundary

### Electron main owns

- backend session transport;
- guest installation credential;
- Google system-browser/deep-link handoff;
- native file/folder dialogs and file inspection/hash;
- ProjectStorage/ProjectCatalog;
- backup/restore/archive-copy and storage verification/cleanup;
- protected local-device identity;
- local execution heartbeat/claim/progress/completion/failure;
- FFmpeg/ffprobe process execution;
- render journal/cache and local artifact operations;
- Gemini Web Chrome/CDP automation and protected clipboard/file commit;
- final MP4 open/reveal/playback/export capabilities.

### Preload owns

A narrow allow-listed typed capability bridge. Never expose arbitrary `fs`, `child_process`, shell, environment or Node globals.

### Renderer owns

- routes and presentation;
- React Query backend state;
- editor/timeline local draft state;
- preview/inspector interactions;
- invocation of explicit preload capabilities.

The renderer does not own backend session cookies directly or resolve arbitrary local paths.

---

## 7. Desktop local-first project media

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

`project.manifest.json` is a local integrity/location index, not a domain database. Entries use stable IDs, project-relative paths, byte sizes and SHA-256.

Primary contract:

```text
Generated project images              -> local project workspace
Generated narration                   -> local project workspace
Imported project image/audio/video    -> local project workspace
PROJECT voice reference               -> local project workspace / manifest
Render intermediates/cache            -> local project workspace/work
Final MP4                              -> local project workspace/artifacts
ACCOUNT voice reference/custom voice  -> Cloudflare R2
Durable business/job/artifact metadata -> PostgreSQL
```

There is no generated-project-media R2 fallback, dual write or compatibility read path in the current pre-deployment runtime.

Current foundations also include storage accounting/verification/cleanup and manifest-verified backup/restore/archive-copy behavior.

---

## 8. Asset import, materialization and voice-reference scope

Desktop native import must not expose arbitrary paths to renderer/backend domain state.

```text
native selection
  -> Electron main inspect/hash
  -> short-lived selection token
  -> backend stable MediaAsset registration
  -> main commits bytes into ProjectStorage
  -> manifest stores relative path + integrity
```

Implemented image-generation/narration workflows persist accepted project results into local project media and materialize them into Desktop ProjectStorage as required for creator playback/rendering.

Voice references are scope-specific:

```text
PROJECT
  -> project MediaAsset
  -> local ProjectStorage / project.manifest.json
  -> no R2 storage key

ACCOUNT
  -> reusable account VoiceReferenceAsset
  -> READY + ownership + integrity checks
  -> voices/<account>/... in R2
  -> authorized worker temporary download when selected
```

---

## 9. Production timeline model

The production editor is not Chapter-only. It preserves:

```text
Project
  -> Chapter
     -> Scene
        -> VisualBeat
           -> source anchor / deterministic text range
           -> selected media (image or video)
           -> narration-derived timing / supported visual controls
```

Production timing follows ADR-0023:

```text
VisualBeat textStart/textEnd
  + narration/subtitle alignment spans
  -> backend NarrationTextClockMapper
  -> beat audio start/end/duration
```

Complete compatible persisted audio timing may still be preferred when valid. Otherwise the backend derives timing on read from the source ranges. A provisional weighted fallback can keep the Editor inspectable, but final readiness remains false until an exact aligned clock exists.

Explicit beat media selections are durable backend production state through `production_beat_media_selections`.

Renderer-local camera/edit drafts may use undo/redo/reset, but render submission must resolve to backend-authorized stable identities and immutable input state. Image-only camera/motion controls must not be forced onto video beats.

---

## 10. Final render execution

```text
backend admits + assigns local render
  -> authorized device claims lease
  -> Desktop preflight validates runtime/disk/assets
  -> resolve input IDs/checksums through manifest
  -> require exact narration-aligned production timing
  -> write atomic render journal
  -> reuse valid segment-cache entries
  -> FFmpeg render missing segments
  -> concat video/narration
  -> subtitle mux where available
  -> ffprobe + checksum final MP4
  -> write artifacts/<jobId>/final.mp4
  -> register final-artifact metadata
  -> report progress/completion under current lease
  -> Desktop previews/exports local MP4 directly
```

Implemented foundations include lease heartbeat, progress/failure/completion, in-process cancellation, journal discovery and immutable segment caching.

Abrupt process/OS failure recovery across every stage and its user-facing resume/retry UX remains **PARTIAL** hardening work.

There is no server-side final render executor or final-video byte-storage path in the current architecture.

---

## 11. Durable generation/provider contract

```text
Source/reviewed state
  -> OperationPlan / MediaPlan where applicable
  -> GenerationJob / StageAttempt
  -> ProviderOperation when crossing external paid boundary
  -> validated immutable result
  -> project-local media persistence/materialization
```

External provider ambiguity preserves `UNKNOWN` and reconciles before paid resubmission. Long provider/network calls must not hold long business transactions open.

Provider-specific temporary infrastructure such as GCS batch staging is not NarrativeX project storage. R2 is not a generated-image/narration transport in the current runtime.

---

## 12. Current database baseline

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

V1-V8 are the clean pre-release baseline. V1-V6 separate schema/database responsibilities, V7 owns indexes and invariants, and V8 owns deterministic catalog seeds. Current project-media, voice-reference, subtitle snapshot, Chapter Workspace and VieNeu speaking-rate behavior is represented directly in the owning baseline migrations.

Future schema evolution starts with append-only `V9__*.sql` only after the first production deployment. Current disposable development/test databases may be recreated when the clean baseline changes.

Historical schema columns/defaults that no longer have an active executor do not by themselves define current runtime behavior; current code and accepted migrations remain authoritative.

---

## 13. Current implementation baseline

| Capability | State |
|---|---|
| Desktop-only Electron editor | IMPLEMENTED |
| Secure main/preload/renderer boundary | IMPLEMENTED foundation |
| Stable installation guest identity/session | IMPLEMENTED |
| Guest-first free workspace | IMPLEMENTED foundation |
| Google-only account sign-in | IMPLEMENTED |
| In-context auth gate + guest ownership transfer | IMPLEMENTED foundation |
| Project/Chapter authoring | IMPLEMENTED foundation |
| Chapter Analyze | IMPLEMENTED |
| MyBatis-only production persistence | IMPLEMENTED |
| Generation/provider durable lifecycle | IMPLEMENTED foundation |
| Character/Location continuity | IMPLEMENTED foundation |
| Scene/VisualBeat persistence | IMPLEMENTED foundation |
| VisualBeat source-anchor → UTF-16 range materialization | IMPLEMENTED foundation |
| Backend narration text-clock mapping | IMPLEMENTED foundation |
| Narration strategy + user-audio TTS bypass | IMPLEMENTED foundation |
| Generated narration + local import | IMPLEMENTED foundation |
| PROJECT voice references in local ProjectStorage | IMPLEMENTED foundation |
| ACCOUNT voice-reference/custom-voice R2 storage | IMPLEMENTED foundation |
| Vertex image generation + project-local result | IMPLEMENTED foundation |
| Gemini Web Desktop image generation + local materialization | IMPLEMENTED foundation |
| Native local asset registration | IMPLEMENTED foundation |
| Production timeline narration alignment | IMPLEMENTED foundation |
| Persisted beat media selection | IMPLEMENTED foundation |
| Timeline draft undo/redo | IMPLEMENTED foundation |
| ProjectStorage/ProjectCatalog integrity | IMPLEMENTED foundation |
| Backup/restore/archive-copy | IMPLEMENTED foundation |
| Storage verification/cleanup | IMPLEMENTED foundation |
| Backend-assigned local render | IMPLEMENTED foundation |
| FFmpeg/ffprobe local render | IMPLEMENTED foundation |
| Render preflight/journal/cache | IMPLEMENTED foundation |
| FinalArtifact metadata-only backend boundary | IMPLEMENTED |
| Direct local final playback/export | IMPLEMENTED foundation |
| Owner-scoped generation SSE + Desktop reconnect/watchdog | IMPLEMENTED foundation |
| Auto Edit plan + atomic render snapshot | IMPLEMENTED foundation |
| Immutable subtitle snapshot + local SRT track | IMPLEMENTED foundation |
| Local media duration probing | IMPLEMENTED foundation |
| Custom voice reference preview | IMPLEMENTED foundation |
| Production packaging/signing/auto-update | TARGET |
| Full abrupt-process render recovery UX | PARTIAL |
| Adaptive narration-driven VisualScenePlanner | TARGET |
| Rich reuse/reframe/edit AssetResolver | DEFERRED fast-follow |
| Complete actual usage/billing reconciliation | PARTIAL |

---

## 14. Visual planning and continuity direction

Avoid fixed image counts and fixed per-image duration. The target planner uses:

```text
source + analysis + continuity + narration alignment
  -> adaptive Scene/VisualBeat plan
  -> source anchors / deterministic text ranges
  -> review/approval
  -> media generation/import
  -> narration-derived production timing
```

Character identity remains reusable and versioned. Outfit/age/appearance changes must not create duplicate Characters solely to represent temporary visual state.

Long-term reuse preference remains:

```text
REUSE_APPROVED
  -> REFRAME_DERIVED
  -> EDIT_EXISTING
  -> GENERATE_NEW
```

---

## 15. Security and secrets

- Google tokens never enter Electron.
- Guest plaintext secret never enters renderer logs/storage and backend stores only its hash.
- Device credentials are separate revocable machine credentials.
- Renderer receives no unrestricted filesystem/process APIs.
- Provider/R2 credentials remain server/worker secrets.
- Uploaded/provider media is untrusted until validated.
- Absolute Desktop paths never become durable backend identity.
- Guest/account production gates are enforced by backend authorization.
- Final local artifact paths are resolved only inside Electron main and are not exposed as backend storage locations.
- PROJECT voice references are validated against project identity/manifest/integrity; ACCOUNT voice references require account ownership/readiness and R2 metadata.

---

## 16. Active remaining work

Active work belongs in `../product/ROADMAP.md`, currently centered on:

1. production packaging/signing/auto-update and packaged protocol/OAuth tests;
2. long-form crash/restart recovery and soak reliability;
3. richer timeline/editor review/regeneration behavior;
4. adaptive narration-driven scene planning and continuity review;
5. richer asset reuse/reframe/edit lineage;
6. user-audio alignment/production hardening;
7. billing/actual-usage and operational evidence.

Completed Desktop/backend/persistence/timing migration plans are historical evidence. Use accepted ADRs and Git history for rationale rather than preserving stale migration checklists as current truth.

---

## 17. Definition of V1.11 consistency

Documentation and implementation are consistent when:

- Desktop is the only editor surface;
- stable guest ownership works without creating a second end-user login method;
- Google is the only account sign-in provider;
- account/provider-consuming operations are backend-gated;
- Desktop project bytes resolve through local stable IDs/checksums rather than backend absolute paths;
- generated/imported project media does not use R2;
- R2 is limited to reusable ACCOUNT voice-reference/custom-voice assets;
- PROJECT voice references remain device/project local;
- narration drives production timing;
- VisualBeat source anchors/text ranges are the semantic bridge to narration alignment;
- provisional timing is not treated as render-ready exact timing;
- Chapter → Scene → VisualBeat hierarchy is preserved;
- image/video beat media choices are explicit;
- final renders are backend-assigned/lease-controlled, execute in Electron main and validate inputs/artifacts;
- final MP4 bytes remain local and backend FinalArtifact state is metadata-only;
- MyBatis + Flyway/PostgreSQL remain the production persistence/schema path;
- current implementation foundations are not mislabeled as future migration work;
- unfinished features remain clearly marked PARTIAL/TARGET/DEFERRED.

---

## 18. Current creator-loop summary

```text
Create/open Project
  -> persist/edit Chapter source
  -> Analyze
  -> materialize Scene/VisualBeat source anchors and text ranges
  -> review Scene/VisualBeat structure
  -> generate/import narration and visuals
  -> persist/materialize project media locally
  -> map VisualBeat text ranges through narration alignment
  -> edit production timeline
  -> backend authorizes and leases final render only with exact aligned timing
  -> Electron main renders with FFmpeg/ffprobe
  -> final MP4 remains in local project artifacts
  -> backend records final-artifact metadata
  -> Desktop previews/exports locally
```

That local-first, narration-clock creator loop is the architectural baseline for all new NarrativeX work.
