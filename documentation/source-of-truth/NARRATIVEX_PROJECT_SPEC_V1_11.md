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
- **local-media-first** — project media and final renders stay on the user's machine after required generated media is materialized;
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

PostgreSQL owns durable auth/ownership/project/domain/job/lease/policy/lineage/artifact metadata. Redis may hold server sessions and transient hints but is never the only record of generation correctness.

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
              -> Python AI/provider workers

Electron main
  -> <userData>/projects/<projectId>/ local project bytes

Generated-media transport
  -> R2 when remote durability is required by AI/provider execution
  -> Desktop materialization before local project editing/final rendering
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
AI-generated image/narration transport -> R2 only when remote durability is needed
Generated/imported project images      -> local project workspace
Project narration/audio                -> local project workspace
Imported project media                 -> local project workspace
Render intermediates/cache             -> local project workspace/work
Final MP4                              -> local project workspace/artifacts
Durable business/job/artifact metadata -> PostgreSQL
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

Implemented image-generation/narration workflows materialize required results into Desktop local storage for the current creator flow. R2 may retain generated provider outputs while remote execution/reconciliation requires durable transport, but those remote locations do not become final project-video storage.

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

Narration-aligned timing is authoritative. Explicit beat media selections are durable backend production state through the consolidated V1 `production_beat_media_selections` table.

Renderer-local duration/camera drafts may use undo/redo/reset, but render submission must resolve to backend-authorized stable identities and immutable input state.

Image-only camera/motion controls must not be forced onto video beats.

---

## 10. Final render execution

```text
backend admits + assigns local render
  -> authorized device claims lease
  -> Desktop preflight validates runtime/disk/assets
  -> resolve input IDs/checksums through manifest
  -> write atomic render journal
  -> reuse valid segment-cache entries
  -> FFmpeg render missing segments
  -> concat video/narration
  -> mux
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
  -> OperationPlan / MediaPlan
  -> GenerationJob / StageAttempt
  -> ProviderOperation when crossing external paid boundary
  -> validated immutable result
  -> remote generated-media transport where required
  -> Desktop materialization for project use
```

External provider ambiguity preserves `UNKNOWN` and reconciles before paid resubmission. Long provider/network calls must not hold long business transactions open.

---

## 12. Current database baseline

```text
V1__create_tables.sql
V2__init_indexes.sql
V3__seed_data.sql
```

V1-V3 are the frozen consolidated baseline and are the only current Flyway files. Desktop guest-installation, production beat-media-selection and local execution/render metadata structures are already folded into V1. Future schema evolution starts with a new append-only `V4__*.sql`; current schema evolution must not rewrite already-published Flyway history.

Historical schema columns/defaults that no longer have an active executor do not by themselves define current runtime behavior; current code and additive migrations remain authoritative.

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
| Narration strategy + user-audio TTS bypass | IMPLEMENTED foundation |
| Generated narration + local import | IMPLEMENTED foundation |
| Vertex image generation + Desktop materialization | IMPLEMENTED foundation |
| R2 generated-media transport | IMPLEMENTED foundation |
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

Completed Desktop/backend/persistence migration plans are retired. Use ADRs and Git history for historical rationale rather than preserving stale migration checklists as current truth.

---

## 17. Definition of V1.11 consistency

Documentation and implementation are consistent when:

- Desktop is the only editor surface;
- stable guest ownership works without creating a second end-user login method;
- Google is the only account sign-in provider;
- account/provider-consuming operations are backend-gated;
- Desktop project bytes resolve through local stable IDs/checksums rather than backend absolute paths;
- narration drives production timing;
- Chapter → Scene → VisualBeat hierarchy is preserved;
- image/video beat media choices are explicit;
- final renders are backend-assigned/lease-controlled, execute in Electron main and validate inputs/artifacts;
- final MP4 bytes remain local and backend FinalArtifact state is metadata-only;
- MyBatis + Flyway/PostgreSQL remain the production persistence/schema path;
- R2 is described only as generated-media transport/durability before local materialization;
- current implementation foundations are not mislabeled as future migration work;
- unfinished features remain clearly marked PARTIAL/TARGET/DEFERRED.

---

## 18. Current creator-loop summary

```text
Create/open Project
  -> persist/edit Chapter source
  -> Analyze
  -> review Scene/VisualBeat structure
  -> generate/import narration and visuals
  -> materialize required media locally
  -> edit production timeline
  -> backend authorizes and leases final render
  -> Electron main renders with FFmpeg/ffprobe
  -> final MP4 remains in local project artifacts
  -> backend records final-artifact metadata
  -> Desktop previews/exports locally
```

That local-first creator loop is the architectural baseline for all new NarrativeX work.