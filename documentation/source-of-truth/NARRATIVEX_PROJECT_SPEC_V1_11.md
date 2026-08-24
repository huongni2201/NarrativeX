# NarrativeX — Project Source of Truth V1.11

**Status:** Canonical engineering direction and code-aligned baseline  
**Effective date:** 2026-08-24  
**Repository:** `huongni2201/NarrativeX`  
**Docs-sync implementation checkpoint:** `main` at `751f006634218efb2c398fc00c2cbfecd25e1eac`  
**Primary migration:** browser studio → Electron Desktop, cloud-first project media → Desktop local-first project media/render

---

## 1. Authority and status semantics

This file is the maintained V1.11 product/domain/architecture baseline.

For factual AS-IS behavior, authority order is:

1. current code, Flyway migrations and automated tests;
2. accepted ADRs for deliberate cross-cutting decisions;
3. this source-of-truth specification;
4. derived reports, plans and older implementation notes.

Status vocabulary:

- **IMPLEMENTED** — working path exists and its key contract is present.
- **IMPLEMENTED foundation** — core runtime boundary exists but full product/reliability flow is not yet proven.
- **PARTIAL** — required pieces remain missing.
- **TARGET** — approved next direction.
- **DEFERRED** — intentionally postponed.
- **LEGACY/FALLBACK** — retained only during migration/compatibility and must not define new primary architecture.

Roadmap intent must never be presented as implemented behavior.

---

## 2. Product definition

NarrativeX is a **desktop-first AI-assisted long-form story-video studio**. It transforms persisted story/Chapter source into structured analysis, continuity-aware visual plans, narration, generated/imported project media and final long-form or Short/Reel video.

The product is:

- **desktop-first** — Electron Desktop is the primary editor client;
- **chapter-first** — Chapter remains the primary persisted source unit;
- **review-first** — generated/reviewed state is versioned rather than silently overwritten;
- **audio-timeline-first** — narration timing is authoritative for visual duration;
- **image-first** — deterministic image motion is the default low-cost render path;
- **local-media-first for Desktop** — project media and final local renders stay on the user's machine;
- **backend-authorized** — Spring/PostgreSQL remain authoritative for ownership, policy, job admission, assignment and durable execution state.

Creating a Project persists metadata. Saving a Chapter persists source. Analyze, narration/audio processing, image generation and rendering are explicit operations.

`app/frontend-web` is a temporary legacy migration client and must not constrain new Desktop product architecture.

---

## 3. Non-negotiable invariants

### 3.1 Source preservation

Expensive work pins authoritative source identity such as:

```text
chapterId
chapterRowVersion
sourceHash
```

A later source edit creates a new identity. Historical approved/generated outputs are not rewritten in place.

### 3.2 Narration is not synonymous with TTS

```text
NarrationStrategy
  TTS
  USER_PROVIDED_AUDIO
```

If accepted user-provided audio covers a scope, NarrativeX must not generate/reserve TTS for that same scope.

### 3.3 Audio file boundaries are not Chapter boundaries

A user may provide one continuous audio file for many Chapters or several ordered files for one range. The model uses ordered narration parts plus one logical audio clock/alignment model.

### 3.4 Backend owns execution policy

The backend creates/version-controls the authorized MediaPlan/production policy, including workload/cost context. Jobs pin the authorized state. Workers and Desktop devices execute persisted policy and may not silently escalate paid work or motion mode.

### 3.5 PostgreSQL remains durable control-plane authority

PostgreSQL owns durable user/project/domain/job/lease/policy/lineage metadata. Redis is useful for server-managed sessions and transient delivery/hints but must never be the only record of generation correctness.

### 3.6 Persistence is MyBatis + explicit SQL

Production backend persistence uses application/domain ports backed by MyBatis row models, mapper interfaces/XML and explicit PostgreSQL SQL. Do not reintroduce JPA or a parallel direct-`JdbcTemplate` production persistence path.

### 3.7 Desktop renderer is sandboxed UI, not a local backend

Electron renderer owns UI/routing/query/editor state only. Native filesystem/process/credential/deep-link/local-render capabilities live in Electron main and cross preload only through narrow typed capabilities.

```text
contextIsolation = true
nodeIntegration  = false
sandbox          = true
```

### 3.8 Absolute Desktop paths are never backend identities

Desktop project files are referenced in backend contracts by stable asset IDs, checksums and opaque project-relative artifact keys. Absolute local paths are machine-specific implementation details and must not be persisted to PostgreSQL or exposed as domain identity.

### 3.9 Lease ownership gates local finalization

A backend-assigned `LOCAL_DEVICE` render is executed only by its authorized device/lease. Lease loss aborts execution and prevents successful completion.

---

## 4. Canonical client topology

```text
                 system browser / Google OAuth
                           ^
                           |
+------------------------------------------------------+
|                 Electron Desktop                     |
|                                                      |
| renderer: UI / routes / query/editor state           |
|                    |                                 |
|                    v                                 |
| preload: narrow typed bridge                         |
|                    |                                 |
|                    v                                 |
| main: deep links / native files / ProjectStorage /   |
|       device execution / FFmpeg / ffprobe            |
+--------------------+---------------------------------+
                     |
                     v
              Spring Boot Backend
              -> PostgreSQL authoritative state
              -> Redis session/transient state
              -> Python worker/provider execution

Electron main
  -> <userData>/projects/<projectId>/ local bytes

Retained cloud/legacy path
  -> R2 pipeline media
  -> Google Drive cloud final MP4

Legacy Next.js web client
  -> temporary migration surface
```

The Desktop renderer is not a second domain authority. The backend does not become a local-file server for Desktop paths.

---

## 5. Desktop application boundary

### 5.1 Electron main owns

- BrowserWindow lifecycle/security;
- system-browser Google OAuth start;
- `narrativex://` callback handling;
- native file/folder dialogs;
- local project workspace/manifest;
- protected device credentials;
- local execution heartbeat/claim/progress/completion/failure;
- FFmpeg/ffprobe process execution;
- local artifact validation/open/reveal behavior.

### 5.2 Preload owns

A narrow allow-listed typed capability bridge. Do not expose arbitrary `fs`, `child_process`, `shell`, environment or Node globals.

### 5.3 Renderer owns

- application routes;
- editor presentation/layout;
- React Query/Zustand state;
- timeline/preview/inspector interaction;
- backend application-contract consumption;
- invocation of explicit preload capabilities.

Renderer code must not resolve arbitrary local paths or execute FFmpeg.

---

## 6. Authentication architecture

Google is the only user-facing authentication provider. Password login, register and forgot-password flows are not part of the target runtime and must not be reintroduced.

### 6.1 Desktop user authentication

```text
Electron main
  -> GET /api/v1/auth/desktop/start?redirect_uri=narrativex://auth/callback
  -> system browser
  -> Spring Security Google OIDC
  -> backend creates short-lived single-use handoff code
  -> narrativex://auth/callback?code=<one-time-code>
  -> Electron main extracts only the code
  -> POST /api/v1/auth/desktop/exchange
  -> backend establishes server-managed NarrativeX SecurityContext/session
```

Google access/refresh tokens never enter Electron.

### 6.2 Device execution credential

A local-execution device token is a separate machine credential used for pairing/heartbeat/render-job APIs. It is not a user OAuth token or replacement for the server-managed user session.

Current implementation uses explicit pairing. Automatic post-login device registration is a TARGET optimization, not an AS-IS claim.

---

## 7. Desktop local-first project media

Primary Desktop project bytes live under Electron `userData`:

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

`project.manifest.json` is a local byte-location/integrity index, not a domain database.

Manifest entries include:

```text
assetId or jobId
kind
relativePath
sizeBytes
checksumSha256
updatedAt
```

Electron main validates project identity, workspace boundaries, file existence, expected size and SHA-256 before a local asset is consumed.

### Desktop storage contract

```text
Generated/imported project images   -> local project workspace
Project narration/audio             -> local project workspace
Imported project media              -> local project workspace
Render intermediates                -> local project workspace/work
Final local MP4                     -> local project workspace/artifacts
Durable business/job metadata       -> PostgreSQL
```

Shared voice/sample media may remain remote when deliberate cross-install reuse requires it.

---

## 8. Retained cloud/legacy storage contract

ADR-0003 remains valid for the retained cloud/worker execution path:

```text
Cloud pipeline media              -> Cloudflare R2
Cloud final rendered MP4          -> Google Drive
Cloud worker local files          -> ephemeral scratch
Durable business/job metadata     -> PostgreSQL
```

This is **LEGACY/FALLBACK** for Desktop project storage. It must not be presented as a mandatory Desktop round trip after ADR-0012.

Cloud render/storage may coexist until Desktop parity/reliability gates are met.

---

## 9. Current implementation baseline

| Capability | State | Notes |
|---|---|---|
| Project/Chapter authoring | IMPLEMENTED foundation | durable backend/MyBatis paths exist |
| Chapter Analyze | IMPLEMENTED | durable admission + worker execution foundations |
| MyBatis-only production persistence | IMPLEMENTED | no JPA/direct JdbcTemplate production persistence path |
| Generation job/stage/provider durability | IMPLEMENTED foundation | backend/worker durable lifecycle remains authoritative |
| Character + Location continuity | IMPLEMENTED foundation | richer review/reference flows remain partial |
| Scene + VisualBeat | IMPLEMENTED foundation | richer revision/review/planning remains incomplete |
| Narration strategy + TTS bypass | IMPLEMENTED foundation | user-provided audio is a first-class strategy |
| Google TTS / VieNeu narration | IMPLEMENTED foundation | server/cloud execution foundation exists |
| User-provided multi-part timeline/alignment | IMPLEMENTED foundation | full E2E rendering depends on execution path and remaining integration |
| Vertex image generation | IMPLEMENTED foundation | provider path exists; Desktop local materialization migration remains incomplete |
| Cloud IMAGE_MOTION render | IMPLEMENTED foundation | retained worker path exists |
| Cloud R2 pipeline / Drive final storage | IMPLEMENTED foundation, LEGACY/FALLBACK for Desktop | valid cloud path, not Desktop storage authority |
| Electron Desktop shell | IMPLEMENTED foundation | primary editor boundary exists |
| Secure main/preload/renderer split | IMPLEMENTED foundation | sandboxed window + narrow IPC/preload model |
| Desktop system-browser OAuth/deep link | IMPLEMENTED foundation | start/callback/exchange backend + Electron main path exists |
| Passwordless Google-only product direction | IMPLEMENTED foundation | do not reintroduce password UX/runtime behavior |
| Desktop ProjectStorage manifest | IMPLEMENTED foundation | schema-versioned, atomic, relative paths, SHA-256 checks |
| Local device pairing/heartbeat | IMPLEMENTED foundation | explicit pairing currently required |
| Backend-assigned local render claim | IMPLEMENTED foundation | device-scoped claim/lease lifecycle exists |
| Local render lease heartbeat/progress | IMPLEMENTED foundation | lease loss abort/failure behavior exists |
| Desktop FFmpeg/ffprobe project render | IMPLEMENTED foundation | segment render → concat → mux → probe → artifact register |
| In-process local render cancellation | IMPLEMENTED foundation | AbortController-based cancellation exists |
| Restart-safe local render recovery | PARTIAL | no complete resume/recovery guarantee across Desktop process restart |
| Complete local materialization for image/TTS/import outputs | PARTIAL | migration still needed across every workflow |
| Desktop editor feature parity | PARTIAL | core shell/features exist; legacy web not yet removable |
| Legacy web removal | TARGET | remove only after parity/reliability/dependency gates |
| Disk cleanup/backup/move/repair | TARGET | required for production local-first UX |
| Packaging/signing/auto-update hardening | TARGET | production Desktop release work |
| VisualScenePlanner adaptive review loop | TARGET | narration-driven planner/review remains incomplete |
| Reuse/reframe/edit AssetResolver | DEFERRED fast-follow | optimize after creator loop reliability |
| HYBRID_LOCAL_I2V E2E | DEFERRED fast-follow | selected-beat local I2V future work |

---

## 10. Durable execution contract

Backend-authorized expensive work follows durable admission/lifecycle rules:

```text
Source Snapshot / Reviewed State
  -> OperationPlan / MediaPlan
  -> GenerationJob / stage state
  -> ProviderOperation when crossing paid provider boundary
  -> validated result
  -> project/cloud byte materialization according to execution mode
  -> authoritative PostgreSQL metadata + terminal state
```

Long provider/network calls must not keep long business transactions open. External paid-provider ambiguity preserves `UNKNOWN` until reconciliation rather than blind resubmission.

Completed results remain immutable by identity/fingerprint rules.

---

## 11. Local render execution contract

Desktop rendering is not a direct renderer-side export from transient UI state.

```text
backend admits + assigns LOCAL_DEVICE project render
  -> authorized device claims job
  -> claim includes lease + asset identities/integrity metadata
  -> Electron main resolves inputs through project.manifest.json
  -> verify size/checksum/workspace boundary
  -> build deterministic local render manifest
  -> FFmpeg render segments
  -> concatenate video
  -> concatenate narration
  -> mux audio/video
  -> ffprobe final MP4
  -> calculate/register SHA-256 local artifact
  -> report progress/completion to backend
  -> backend records LOCAL_DESKTOP + opaque project-relative artifact key
```

Lease heartbeat continues during execution. Lease loss aborts the active render. A device without the current lease cannot finalize success.

Local project rendering is capability-gated by FFmpeg/ffprobe availability and `NARRATIVEX_DESKTOP_PROJECT_RENDER_ENABLED=true`.

Process-restart recovery/resume remains PARTIAL.

---

## 12. Cloud render execution contract

The retained cloud/legacy worker path may still perform deterministic IMAGE_MOTION rendering using remote pipeline media and Google Drive final storage. Its provider/upload/idempotency rules remain governed by ADR-0001/ADR-0003 and current worker code.

Do not remove or break this fallback until Desktop migration no longer depends on it, but do not use it as the design default for new Desktop workflows.

---

## 13. Narration architecture

Narration timing is the duration authority.

### Generated narration

```text
persisted source
  -> authorized NarrationRequest
  -> Google TTS or VieNeu/provider execution
  -> validate/normalize
  -> alignment
  -> materialize according to active execution mode
```

Desktop target: narration bytes used by a local render must be registered in the local project manifest.

### User-provided audio

```text
selected source scope
  + ordered audio parts
  -> validate/register
  -> fingerprints
  -> one logical global audio clock
  -> alignment spans
```

TTS workload is zero for the covered scope. Full end-to-end multi-part behavior must be described per the currently implemented Desktop/cloud render path rather than assumed from the planning model alone.

---

## 14. Visual planning and timing

Narration timing remains authoritative for visual duration. Avoid fixed image-count or hardcoded per-image duration rules.

Target adaptive planning remains:

```text
source + analysis/storyboard + continuity + narration alignment
  -> VisualScenePlanner
  -> VisualScenePlan[] / VisualBeat timing
```

Current persisted plans/assets may be rendered before this complete review/planner loop is finished; that does not make the full planner IMPLEMENTED.

---

## 15. Image generation and local materialization

Provider execution remains backend-authorized and durable across provider boundaries.

The Desktop migration target is:

```text
authorized image operation
  -> provider execution
  -> validate image
  -> register stable MediaAsset identity/checksum
  -> materialize bytes into Desktop project workspace
  -> project.manifest.json entry
  -> local render resolves mediaAssetId
```

The provider/cloud foundation exists. Complete Desktop-local materialization for every generation/regeneration/import path is still PARTIAL.

Long-term reuse policy remains:

```text
REUSE_APPROVED
  -> REFRAME_DERIVED
  -> EDIT_EXISTING
  -> GENERATE_NEW
```

Richer reuse/approval/derivation remains incomplete.

---

## 16. Security and secrets

- Google access/refresh tokens never enter Electron.
- One-time Desktop OAuth handoff codes are short-lived/single-use.
- Device tokens are separate, revocable machine credentials protected at rest.
- Renderer does not receive arbitrary filesystem/process APIs.
- Provider/R2/Drive credentials remain server/worker secrets.
- Uploaded/provider media is untrusted until validated.
- Absolute Desktop paths are not backend/domain identifiers.
- Local project path resolution must remain inside the project workspace.
- Lease loss must fence successful local completion.

---

## 17. Cost and execution placement

NarrativeX distinguishes expected/reserved/actual workload where applicable. Provider calls may create external cost; local FFmpeg execution does not fabricate provider billing.

Desktop-local rendering reduces cloud storage/transfer requirements but does not remove backend policy, entitlement or usage accounting.

For `USER_PROVIDED_AUDIO`, TTS workload is zero for covered source while image/alignment/render workload may remain metered.

---

## 18. Review, history and continuity

Character is reusable identity; ProjectCharacter is participation/context. Appearance/outfit/age/hairstyle/injury changes do not create a new Character solely for visual state.

Regeneration/re-analysis must preserve immutable history where required. Input changes should invalidate affected scope rather than destructively rewriting unrelated approved work.

---

## 19. Legacy web deprecation rule

`app/frontend-web` remains in the repository only during migration.

Do not delete it until:

- required product screens/workflows have Desktop parity;
- auth/session flows are proven on packaged Desktop builds;
- generation/import outputs needed by local render are locally materialized;
- local render reliability/recovery requirements are defined/proven;
- no deployment/test/docs tooling still depends on Next.js runtime behavior.

After those gates, remove web code and its stale documentation rather than leaving a permanent dual-client architecture by accident.

---

## 20. Remaining release-critical Desktop work

1. Complete local materialization/registration for image generation, TTS/narration and imports.
2. Harden restart-safe local render recovery/resume.
3. Decide/implement automatic device registration if explicit pairing should disappear from primary UX.
4. Complete editor/timeline mutations, regeneration/review/reuse workflows and remaining screen parity.
5. Add disk quota/cleanup, project backup/move/restore and missing-file repair flows.
6. Harden packaging, code signing, auto-update and custom-protocol registration across supported OSes.
7. Complete narration-driven VisualScenePlanner/review loop.
8. Complete usage/cost reconciliation and production observability/retention/DR evidence.
9. Remove `app/frontend-web` and cloud-first Desktop assumptions only after parity gates pass.
10. Add publishing/export/upload features through explicit user actions/provider-neutral boundaries without making cloud storage mandatory for local editing.

---

## 21. Documentation rules

- This V1.11 file is the single maintained versioned source of truth.
- Current code decides AS-IS claims when docs drift.
- ADR-0010 defines the Desktop client boundary.
- ADR-0011 defines Google OAuth-only Desktop authentication.
- ADR-0012 defines Desktop local-first project media and local render execution.
- ADR-0003 remains valid for retained cloud/legacy worker storage/provider execution.
- Derived docs must not claim that Desktop project media must live in R2 or that Desktop final MP4 must live in Google Drive.
- Derived docs must not describe local FFmpeg orchestration as future-only after checkpoint `751f006...`.
- Derived docs must not claim restart-safe recovery, full local materialization, full Desktop parity or legacy-web removal until code proves them.
