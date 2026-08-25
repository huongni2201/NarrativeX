# NarrativeX System Architecture — V1.11

**Canonical source:** `../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`  
**Desktop decisions:** ADR-0010, ADR-0011, ADR-0012

NarrativeX is now desktop-only at the editor boundary. The Spring Boot backend remains the authoritative control plane for durable business/domain state, while Electron Desktop is the only supported editor and owns machine-local project bytes/native execution through a strict main/preload/renderer boundary.

## Logical topology

```text
                    Google OAuth
                        ^
                        |
                system browser
                        |
                        v
+------------------------------------------------+
|              Electron Desktop                  |
|                                                |
| renderer                                       |
|   UI / routes / editor state / timeline        |
|        |                                       |
|        v                                       |
| preload: narrow typed bridge                   |
|        |                                       |
|        v                                       |
| main                                           |
|   deep-link callback                           |
|   native file/folder APIs                      |
|   ProjectStorage manifest                      |
|   protected device identity                    |
|   local execution + FFmpeg/ffprobe             |
+----------------------+-------------------------+
                       |
              HTTPS / backend contracts
                       |
                       v
             Spring Boot Backend
             -> PostgreSQL
                authoritative user/project/domain/job/
                plan/lease/storage-identity metadata
             -> Redis
                server session + transient hints
             -> Python worker roles
                analysis / translation / provider execution /
                cloud narration/media/render fallback

Electron main
  -> <userData>/projects/<projectId>/
       assets/
       work/
       artifacts/
       project.manifest.json

Retained cloud/legacy execution
  -> Cloudflare R2 pipeline media
  -> Google Drive cloud-rendered final MP4

System-browser OAuth flow
  -> backend authentication flow only; not an editor client
```

## Authority boundaries

### Backend

The backend owns:

- Google-linked internal user identity and owner authorization;
- server-managed NarrativeX authentication/session state;
- Projects, Chapters, source versions and reviewed domain state;
- entitlement/quota/cost admission;
- MediaPlan/production policy;
- GenerationJob/StageAttempt/provider-operation state;
- local-device registration/revocation and render assignment;
- render lease, progress and terminal job state;
- durable metadata, asset identity, checksums and lineage;
- Flyway schema ownership.

The backend does not own absolute Desktop filesystem paths.

### Electron main

Electron main owns machine-local capabilities:

- `narrativex://` protocol callback handling;
- native file/folder selection;
- project workspace and local manifest;
- protected device credential storage;
- local-device heartbeat and assigned-job execution;
- FFmpeg/ffprobe process execution;
- local artifact validation/reveal/open operations.

Local byte ownership does not make Electron main a second domain/control database. It executes backend-authorized work and reports durable execution state back to the backend.

### Preload

Preload is an allow-list. It exposes typed, task-specific capabilities and must not expose arbitrary Node.js, filesystem, shell or process primitives.

### Renderer

The renderer owns editor UX, routing, query/cache state, local ephemeral UI state and timeline interaction. It consumes backend contracts and preload capabilities but does not own durable policy or native paths.

Security baseline:

```text
contextIsolation = true
nodeIntegration  = false
sandbox          = true
```

### Python workers

Workers own asynchronous provider/media execution according to backend-authorized persisted plans. They may still execute cloud/server flows for analysis, image generation, narration/alignment, validation and fallback rendering/storage.

Workers must not invent paid work outside the authorized plan.

## Authentication architecture

End-user authentication is Google OAuth only.

```text
Electron main
  -> open system browser
  -> GET /api/v1/auth/desktop/start
  -> Spring Security Google OIDC
  -> backend creates short-lived one-time handoff code
  -> narrativex://auth/callback?code=...
  -> Electron main extracts only code
  -> POST /api/v1/auth/desktop/exchange
  -> backend stores authenticated SecurityContext/session
```

Google access/refresh tokens never enter Electron.

A local-execution **device token** is separate from the user session. It authorizes machine heartbeat/claim/lease APIs and is stored behind Electron protected storage. Explicit pairing is the current implementation; automatic registration after user login remains a target if desired.

## Desktop local-first media boundary

Primary Desktop project bytes live under:

```text
<userData>/projects/<projectId>/
  project.manifest.json
  assets/{images,audio,video}/
  artifacts/<jobId>/final.mp4
  work/
```

The manifest maps stable backend IDs to project-relative paths and integrity metadata.

```text
backend identity
  -> assetId / jobId
  -> expected size/checksum
  -> Electron main resolves project-relative file
  -> verify workspace boundary + size + SHA-256
```

Absolute local paths are never persisted as backend asset identity.

## Local render architecture

Desktop local rendering is backend-assigned, not an ad-hoc renderer-side export.

```text
backend admits + assigns LOCAL_DEVICE render
  -> assigned Desktop device claims with device token
  -> claim returns asset IDs/checksums + lease token
  -> Electron main resolves local inputs
  -> build deterministic local render manifest
  -> FFmpeg render segments
  -> concatenate video
  -> concatenate narration
  -> mux audio/video
  -> ffprobe + checksum final MP4
  -> register local artifact in project manifest
  -> report progress/completion
  -> backend records LOCAL_DESKTOP + opaque project-relative artifact key
```

Lease heartbeat runs during execution. Lease loss aborts the render and prevents successful completion. In-process cancellation exists; process-restart recovery/resume is still a hardening gap.

Local project rendering is gated by FFmpeg availability and `NARRATIVEX_DESKTOP_PROJECT_RENDER_ENABLED=true`.

## Cloud/legacy storage and render boundary

The older worker/cloud path remains during migration:

```text
Cloud pipeline media          -> Cloudflare R2
Cloud final rendered MP4      -> Google Drive
Cloud worker scratch          -> ephemeral filesystem
Cloud durable metadata/state  -> PostgreSQL
```

This path is a compatibility/fallback execution mode. ADR-0003 governs it. It must not be presented as mandatory for Desktop project media after ADR-0012.

## Narration architecture

```text
selected source scope
   +--> generated TTS/VieNeu --------+
   +--> USER_PROVIDED_AUDIO ---------+--> narration timeline/alignment
```

Narration timing remains the master clock. Desktop migration should materialize/register project narration into the local manifest before local rendering. Cloud-backed narration remains compatible while generation/import migration is incomplete.

## Persistence

Production persistence uses MyBatis + explicit PostgreSQL SQL. The backend build has no JPA dependency and production source has no direct `JdbcTemplate` persistence.

Redis is never the sole record of generation correctness.

## Current implementation status

At `main` commit `751f006634218efb2c398fc00c2cbfecd25e1eac`, implemented Desktop foundations include:

- secure Electron shell and project-scoped renderer;
- system-browser Google auth start/custom-protocol handoff;
- backend Desktop auth start/exchange/logout contracts;
- checksum/path-safe `ProjectStorage`;
- local device pairing/identity/heartbeat;
- project render claim and lease lifecycle;
- progress/failure/completion reporting;
- FFmpeg/ffprobe probing;
- local project render pipeline and final artifact registration;
- in-process cancellation.

Still incomplete:

- restart-safe local render recovery/resume;
- automatic device registration if explicit pairing is removed;
- complete image/TTS/import local materialization;
- remaining Desktop editor/review workflow completion;
- disk cleanup/backup/move/repair UX;
- production packaging/signing/auto-update hardening.
