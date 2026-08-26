# NarrativeX — Project Source of Truth V1.11

**Status:** Canonical engineering direction and code-aligned baseline  
**Effective date:** 2026-08-26  
**Repository:** `huongni2201/NarrativeX`  
**Docs-sync implementation checkpoint:** `main` at `0aca94e6eef07158e161cd67c648671e74055473`  
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

Status vocabulary:

- **IMPLEMENTED** — working path exists and the key contract is present.
- **IMPLEMENTED foundation** — core runtime boundary exists but broader product/reliability work may remain.
- **PARTIAL** — required pieces remain missing.
- **TARGET** — approved next direction.
- **DEFERRED** — intentionally postponed.
- **LEGACY/FALLBACK** — retained only for compatibility/server execution and must not define new Desktop architecture.

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
- **local-media-first for Desktop** — project media and final local renders stay on the user's machine;
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

### 3.4 Backend owns execution policy

The backend creates/version-controls authorized MediaPlan/production policy and expensive job admission. Workers and Desktop devices execute persisted policy and may not silently escalate paid work.

### 3.5 PostgreSQL remains durable control-plane authority

PostgreSQL owns durable auth/ownership/project/domain/job/lease/policy/lineage metadata. Redis may hold server sessions and transient hints but is never the only record of generation correctness.

### 3.6 Persistence is MyBatis + explicit SQL

Production backend persistence uses application/domain ports backed by MyBatis rows/mappers/XML and explicit PostgreSQL SQL. Do not reintroduce JPA or parallel direct-`JdbcTemplate` production persistence without an ADR.

### 3.7 Renderer is isolated UI

```text
contextIsolation = true
nodeIntegration  = false
sandbox          = false
```

The Chromium renderer sandbox is currently disabled for Desktop startup compatibility. Electron
renderer still owns UI/routing/query/editor state only; native filesystem/process/credential/deep-link/
local-render capabilities live in Electron main behind narrow preload APIs, with context isolation
and no Node integration preserved.

### 3.8 Absolute Desktop paths are never backend identities

Backend contracts identify local media using stable asset/job IDs, checksums and opaque project-relative keys. Absolute machine paths stay inside Electron main/local storage.

### 3.9 Backend authorization gates paid/account work

Guest/user role enforcement belongs to backend security. Renderer state may improve UX but cannot be the only authorization gate.

### 3.10 Lease ownership gates local finalization

A `LOCAL_DEVICE` render can finalize only under its current authorized device/lease. Lease loss prevents successful completion.

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
+----------------------+--------------------------------+
                       |
                       v
              Spring Boot Backend
              -> PostgreSQL authoritative state
              -> Redis sessions/transient hints
              -> Python provider/server workers

Electron main
  -> <userData>/projects/<projectId>/ local project bytes

Retained server/cloud path
  -> R2 pipeline media when remote durability is needed
  -> Google Drive final MP4 for retained cloud rendering
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
- render journal/cache and local artifact operations.

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

Primary Desktop contract:

```text
Generated/imported project images   -> local project workspace
Project narration/audio             -> local project workspace
Imported project media              -> local project workspace
Render intermediates/cache          -> local project workspace/work
Final local MP4                     -> local project workspace/artifacts
Durable business/job metadata       -> PostgreSQL
```

Current foundations also include storage accounting/verification/cleanup and manifest-verified backup/restore/archive-copy behavior.

---

## 8. Asset import and materialization

Desktop native import must not expose arbitrary paths to renderer/backend domain state.

```text
native selection
  -> Electron main inspect/hash
  -> short-lived selection token
  -> backend stable MediaAsset registration
  -> main commits bytes into ProjectStorage
  -> manifest stores relative path + integrity
```

Implemented image-generation/narration workflows materialize required results into Desktop local storage for the current creator flow. Retained cloud-backed source assets remain valid where a server/provider workflow still needs remote durability.

---

## 9. Production timeline model

The production editor is not Chapter-only. It preserves:

```text
Project
  -> Chapter
     -> Scene
        -> VisualBeat
           -> selected media (image or video)
           -> timing / supported visual controls
```

Narration-aligned timing is authoritative. Explicit beat media selections are durable backend production state through `production_beat_media_selections` (V5).

Renderer-local duration/camera drafts may use undo/redo/reset, but render submission must resolve to backend-authorized stable identities and immutable input state.

Image-only camera/motion controls must not be forced onto video beats.

---

## 10. Local render execution

```text
backend admits + assigns LOCAL_DEVICE render
  -> authorized device claims lease
  -> Desktop preflight validates runtime/disk/assets
  -> resolve input IDs/checksums through manifest
  -> write atomic render journal
  -> reuse valid segment-cache entries
  -> FFmpeg render missing segments
  -> concat video/narration
  -> mux
  -> ffprobe + checksum final MP4
  -> register local artifact
  -> report progress/completion under current lease
```

Implemented foundations include lease heartbeat, progress/failure/completion, in-process cancellation, journal discovery and immutable segment caching.

Abrupt process/OS failure recovery across every stage and its user-facing resume/retry UX remains **PARTIAL** hardening work.

---

## 11. Retained server/cloud execution

ADR-0003 continues to govern retained worker/cloud paths:

```text
Cloud pipeline media      -> Cloudflare R2
Cloud final MP4           -> Google Drive
Worker scratch            -> ephemeral filesystem
Durable metadata/state    -> PostgreSQL
```

This is **LEGACY/FALLBACK** for Desktop project storage. New Desktop features must not depend on it without a real remote/shared durability requirement.

---

## 12. Durable generation/provider contract

```text
Source/reviewed state
  -> OperationPlan / MediaPlan
  -> GenerationJob / StageAttempt
  -> ProviderOperation when crossing external paid boundary
  -> validated immutable result
  -> local/cloud materialization according to execution mode
```

External provider ambiguity preserves `UNKNOWN` and reconciles before paid resubmission. Long provider/network calls must not hold long business transactions open.

---

## 13. Current database baseline

```text
V1__create_tables.sql
V2__init_indexes.sql
V3__seed_data.sql
V4__desktop_guest_installations.sql
V5__production_beat_media_selections.sql
```

V1-V3 are frozen core migrations. V4+ are append-only feature migrations. Current schema evolution must not rewrite already-published Flyway history.

---

## 14. Current implementation baseline

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
| Narration strategy + user-audio TTS bypass | IMPLEMENTED foundation |
| Generated narration + local import | IMPLEMENTED foundation |
| Vertex image generation + Desktop materialization | IMPLEMENTED foundation |
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
| Retained R2/Drive cloud path | LEGACY/FALLBACK for Desktop |
| Production packaging/signing/auto-update | TARGET |
| Full abrupt-process render recovery UX | PARTIAL |
| Adaptive narration-driven VisualScenePlanner | TARGET |
| Rich reuse/reframe/edit AssetResolver | DEFERRED fast-follow |
| Complete actual usage/billing reconciliation | PARTIAL |

---

## 15. Visual planning and continuity direction

Avoid fixed image counts and fixed per-image duration. The target planner uses:

```text
source + analysis + continuity + narration alignment
  -> adaptive Scene/VisualBeat plan
  -> review/approval
  -> media generation/reuse/import
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

## 16. Security and secrets

- Google tokens never enter Electron.
- Guest plaintext secret never enters renderer logs/storage and backend stores only its hash.
- Device credentials are separate revocable machine credentials.
- Renderer receives no unrestricted filesystem/process APIs.
- Provider/R2/Drive credentials remain server/worker secrets.
- Uploaded/provider media is untrusted until validated.
- Absolute Desktop paths never become durable backend identity.
- Guest/account production gates are enforced by backend authorization.

---

## 17. Active remaining work

Active work belongs in `../product/ROADMAP.md`, currently centered on:

1. production packaging/signing/auto-update and packaged protocol/OAuth tests;
2. long-form crash/restart recovery and soak reliability;
3. richer timeline/editor review/regeneration behavior;
4. adaptive narration-driven scene planning and continuity review;
5. richer asset reuse/reframe/edit lineage;
6. user-audio alignment/production hardening;
7. billing/actual-usage and operational evidence.

Completed Desktop/backend/persistence migration plans are retired. Use ADRs and Git history for historical rationale rather than preserving stale migration checklists as current truth.

---

## 18. Definition of V1.11 consistency

Documentation and implementation are consistent when:

- Desktop is the only editor surface;
- stable guest ownership works without creating a second end-user login method;
- Google is the only account sign-in provider;
- account/provider-consuming operations are backend-gated;
- Desktop project bytes resolve through local stable IDs/checksums rather than backend absolute paths;
- narration drives production timing;
- Chapter → Scene → VisualBeat hierarchy is preserved;
- image/video beat media choices are explicit;
- local renders are backend-assigned/lease-controlled and validate inputs/artifacts;
- MyBatis + Flyway/PostgreSQL remain the production persistence/schema path;
- cloud R2/Drive storage is described only as retained server/fallback behavior;
- current implementation foundations are not mislabeled as future migration work;
- unfinished features remain clearly marked PARTIAL/TARGET/DEFERRED.
