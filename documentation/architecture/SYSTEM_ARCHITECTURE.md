# NarrativeX System Architecture — V1.11

**Canonical source:** `../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`  
**Audited code checkpoint:** `2c965b2e95ddcc1e03dc5527340c6adb18cdd05e`

NarrativeX is desktop-only at the editor boundary. Spring Boot is the authoritative control plane for durable business/domain state, while Electron Desktop owns machine-local project bytes and native execution behind a strict main/preload/renderer boundary.

## Logical topology

```text
                         Google OIDC
                            ^
                            |
                       system browser
                            |
+-------------------------------------------------------+
|                  Electron Desktop                     |
|                                                       |
| renderer: UI / routes / query/editor state            |
|                 |                                     |
|                 v                                     |
| preload: narrow typed bridge                          |
|                 |                                     |
|                 v                                     |
| main: guest credential / OAuth callback / native fs / |
|       ProjectStorage / backup / local execution /     |
|       FFmpeg / ffprobe / Gemini Web Chrome+CDP        |
+----------------------+--------------------------------+
                       |
                       v
              Spring Boot Backend
              -> PostgreSQL authoritative state
                 + HTTP sessions + OAuth handoffs
                 + durable jobs/leases/outbox
              -> Python AI/provider workers
                 analysis / narration / image / validation

Electron main
  -> <userData>/projects/<projectId>/
       project.manifest.json
       assets/
       work/
       artifacts/
```

Redis is not part of the MVP runtime. Python workers discover and claim durable work directly from PostgreSQL using polling/lease queries. No Redis, broker, `LISTEN`, or `NOTIFY` path is required by the current worker topology.

Cloudflare R2 is limited to remote generated-media transport/durability for AI-produced images and narration when remote execution needs it. Final video rendering and final MP4 bytes stay on the Desktop machine.

## Authority boundaries

### Spring backend

The backend owns:

- signed-in Google users plus internal stable guest principals;
- PostgreSQL-backed session/authorization policy and guest/account role gates;
- one-time hashed Desktop OAuth handoff state;
- eligible guest ownership transfer after Google sign-in;
- Projects, Chapters, source versions, storyboard/continuity state and production choices;
- saved Chapter source identity (`source_text`, `source_hash`, row version);
- entitlement/quota/cost admission;
- MediaPlan/production policy;
- GenerationJob/StageAttempt/ProviderOperation lifecycle;
- transactional outbox evidence and post-commit bookkeeping;
- local-device registration/revocation and render assignment;
- render leases, progress and terminal job state;
- durable asset identity/checksums/lineage plus FinalArtifact metadata;
- owner-scoped generation status snapshots delivered through SSE as transport only;
- Flyway schema ownership.

The backend never treats an absolute Desktop filesystem path as a durable asset identity and never stores or proxies final MP4 bytes. The current product has no translation/content-variant layer; analysis and narration consume the saved Chapter directly.

### Electron main

Electron main owns machine-local privileged capabilities:

- stable installation guest secret protected by OS secure storage;
- system-browser OAuth/deep-link handling;
- backend session transport on behalf of renderer;
- native file/folder selection and local asset inspection/hash;
- project workspace/catalog/manifest operations;
- backup/restore/archive-copy and storage verification/cleanup;
- local device credential and assigned-job execution;
- FFmpeg/ffprobe process execution;
- render journal/cache and local final-artifact validation/open/reveal/export;
- Gemini Web visible Chrome/CDP automation, reference-file attachment, network output capture and protected clipboard.

Local byte ownership does not make Electron main a second domain database.

### Preload

Preload is an allow-list of typed task-specific capabilities. It must not expose arbitrary Node.js, filesystem, environment, shell or process primitives.

### Renderer

Renderer owns editor UX, routing, React Query cache, local UI/draft state, timeline/preview/inspector interactions and explicit invocation of preload capabilities.

Security baseline:

```text
contextIsolation = true
nodeIntegration  = false
sandbox          = false
```

The Chromium renderer sandbox is currently disabled for startup compatibility on environments where Electron's renderer sandbox cannot initialize. Renderer code still has no Node integration; native capabilities remain behind the narrow trust-checked preload/main IPC boundary. Treat story, prompt, reference and provider output as untrusted data.

### Python workers

Current worker supervisor roles are:

```text
analysis
narration
media-validation
image-generation
```

Workers poll/claim durable PostgreSQL rows and execute backend-authorized asynchronous provider/media work. They do not translate Chapter content, execute final project renders, own Desktop paths, own user authorization or Flyway schema evolution.

## Guest-first authentication architecture

```text
Desktop start
  -> GET /api/v1/auth/me
  -> if no usable session: POST /api/v1/auth/desktop/guest
  -> backend verifies/creates desktop_guest_installations mapping
  -> Spring Session JDBC stores NX_SESSION in PostgreSQL
  -> stable ROLE_GUEST session
```

Guest free mutations are explicit backend allowlists. Account/provider-consuming operations remain `ROLE_USER` only.

```text
Gated action
  -> 403 AUTHENTICATION_REQUIRED
  -> renderer LoginModal stays over current route
  -> main opens /api/v1/auth/desktop/start
  -> Google OIDC in system browser
  -> narrativex://auth/callback?code=...
  -> short-lived hashed handoff atomically consumed from PostgreSQL
  -> /api/v1/auth/desktop/exchange
  -> eligible guest ownership transfer
  -> ROLE_USER session
```

Google is the only end-user account sign-in provider. Guest identity is an installation-scoped ownership/session mechanism, not a password/OAuth alternative. Google tokens never enter Electron. Guest secret, user session and local-execution device credential are distinct credentials.

## Desktop local-first media boundary

```text
backend stable identity + integrity metadata
  -> Electron main
  -> project.manifest.json
  -> project-relative file
  -> workspace boundary + size + SHA-256 verification
```

Primary Desktop storage:

```text
project images/audio/video       -> local workspace
render work + segment cache      -> local workspace/work
final MP4                        -> local workspace/artifacts
backup/archive snapshots         -> Desktop-managed local storage
business/job/artifact metadata   -> PostgreSQL
```

## Storyboard, narration and timing

Current implemented foundations:

- semantic Scene/VisualBeat materialization;
- richer Character profile/appearance state and beat-specific Character participation;
- narration alignment persistence with text/audio spans;
- production timeline immutable planned timing;
- generic timeline fallback geometry for incomplete scopes.

Current non-claim:

```text
VisualBeat deterministic text_start/text_end          TARGET
VisualBeat source-to-audio reconciliation             TARGET
exact draft audio_start_ms/audio_end_ms before plan   TARGET/PARTIAL
narration-clock-authoritative draft preview            TARGET/PARTIAL
```

Compatible real narration alignment is the intended visual master clock, but generic fallback geometry must not be called exact narration alignment. A current immutable MediaPlan wins for production/render timing when present.

## Production timeline and local render

Persisted beat media selection is backend production state. Renderer draft state may add temporary camera/duration/fit edits. Auto Edit derives supported narration-aware overrides, and the backend applies accepted overrides atomically with immutable render snapshot creation.

```text
backend admits + assigns local render
  -> device claims lease
  -> Desktop preflight verifies runtime/disk/assets
  -> resolve stable asset IDs through manifest
  -> write/update atomic render journal
  -> reuse immutable segment-cache hits when valid
  -> FFmpeg render missing segments
  -> concat video
  -> derive subtitle cues from immutable narration text/alignment snapshot
  -> write UTF-8 SRT when renderable cues exist
  -> mux video + narration + subtitle track
  -> ffprobe + checksum final MP4
  -> register FinalArtifact metadata
  -> report completion under current lease
  -> preview/export local MP4 directly
```

Lease loss prevents successful finalization. In-process cancellation and unfinished-journal discovery exist. Richer recovery/resume behavior for abrupt process/OS failure remains hardening work.

## Gemini Web generation boundary

Gemini Web is a Desktop-main path, not a worker/API-provider path.

```text
VisualBeat + locked Character reference context
  -> main attaches references in deterministic REF order
  -> main applies series style/reference wrapper
  -> capture pre-submit DOM/network baseline
  -> submit through visible Chrome/CDP
  -> fresh generated DOM image
  -> correlate fresh image/* network response
  -> Network.getResponseBody primary byte path
  -> visible Download control fallback only
  -> validate bytes/SHA-256
  -> sender-bound staging token
  -> backend stable LOCAL_ONLY asset registration
  -> main ProjectStorage commit
```

## Native asset materialization

Desktop imports do not send arbitrary machine paths to backend.

```text
native selection
  -> main inspect/hash + short-lived selection token
  -> backend register stable LOCAL_ONLY media identity
  -> main commits bytes into ProjectStorage
  -> manifest records project-relative path + integrity
```

Implemented image/narration workflows materialize required generated media locally before final rendering. Remote generated-media transport does not change ownership of final project bytes.

## Persistence and migrations

Production application persistence is MyBatis + explicit PostgreSQL SQL. Current pre-release Flyway baseline:

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

Translation/content-variant schema is absent. Because NarrativeX has not deployed this baseline to production, migrations may still be reorganized and disposable development/test databases recreated. At first production deployment, freeze the accepted baseline and make future schema evolution append-only from V9+.

## Remaining architecture hardening

- exact VisualBeat source/audio timing and draft narration-clock preview;
- packaged build/signing/auto-update and protocol/OAuth integration coverage;
- richer crash/restart recovery semantics across local render stages;
- adaptive narration-driven scene/beat planning and review;
- richer asset reuse/reframe/edit lineage;
- complete arbitrary multi-part audio production behavior;
- complete billing/actual-usage reconciliation and operational evidence.

Current remaining work is tracked in `../product/ROADMAP.md`; completed migration plans are retired and active implementation plans are indexed separately under `../../docs/superpowers/plans/README.md`.
