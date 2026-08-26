# NarrativeX System Architecture — V1.12

**Canonical source:** `../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`

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
|       FFmpeg / ffprobe                                |
+----------------------+--------------------------------+
                       |
                       v
              Spring Boot Backend
              -> PostgreSQL authoritative state
                 + HTTP sessions + OAuth handoffs
                 + durable queues/outbox
              -> Python AI/provider execution

Electron main
  -> <userData>/projects/<projectId>/
       project.manifest.json
       assets/
       work/
       artifacts/
```

Redis is not part of the MVP runtime. Python workers discover and claim durable work directly from PostgreSQL using polling/lease queries. No Redis, broker, `LISTEN`, or `NOTIFY` path is required by the current worker topology.

Cloudflare R2 is limited to remote generated-media transport/durability for AI-produced images and narration before those bytes are materialized into the Desktop project workspace. Final video rendering and final MP4 bytes stay on the Desktop machine.

## Authority boundaries

### Spring backend

The backend owns:

- signed-in Google users plus internal stable guest principals;
- PostgreSQL-backed session/authorization policy and guest/account role gates;
- one-time hashed Desktop OAuth handoff state;
- ownership transfer when an eligible guest workspace is claimed after Google sign-in;
- Projects, Chapters, source versions, storyboard/continuity state and production choices;
- saved Chapter source identity (`source_text`, `source_hash`);
- entitlement/quota/cost admission;
- MediaPlan/production policy;
- GenerationJob/StageAttempt/ProviderOperation lifecycle;
- transactional outbox evidence and its post-commit finalization;
- local-device registration/revocation and render assignment;
- render leases, progress and terminal job state;
- durable asset identity/checksums/lineage plus final-artifact metadata;
- Flyway schema ownership.

The backend never treats an absolute Desktop filesystem path as a durable asset identity and never stores or proxies final MP4 bytes. The current product has no translation/content-variant layer; analysis and narration consume the saved Chapter directly.

### Electron main

Electron main owns machine-local privileged capabilities:

- stable installation guest secret protected by OS secure storage;
- system-browser OAuth/deep-link handling;
- backend session transport on behalf of the renderer;
- native file/folder selection and local asset inspection/hash;
- project workspace/catalog/manifest operations;
- backup/restore/archive-copy and storage verification/cleanup;
- local device credential and assigned-job execution;
- FFmpeg/ffprobe process execution;
- render journal/cache and local final-artifact validation/open/reveal/export behavior.

Local byte ownership does not make Electron main a second domain database.

### Preload

Preload is an allow-list of typed task-specific capabilities. It must not expose arbitrary Node.js, filesystem, environment, shell or process primitives.

### Renderer

The renderer owns editor UX, routing, React Query cache, local UI/draft state, timeline/preview/inspector interactions and explicit invocation of preload capabilities.

Security baseline:

```text
contextIsolation = true
nodeIntegration  = false
sandbox          = false
```

The Chromium renderer sandbox is currently disabled for Desktop startup compatibility on environments where Electron's renderer sandbox cannot initialize. Renderer code still has no Node integration; native capabilities remain behind the narrow, trust-checked preload/main IPC boundary. Treat all renderer-loaded story, prompt, reference and provider output as untrusted.

### Python workers

Workers execute backend-authorized asynchronous provider/media roles: analysis, image generation, narration/alignment and generated-media validation. They poll/claim durable PostgreSQL rows and do not translate chapter content, execute final project renders, own Desktop paths, user authorization or Flyway schema evolution.

## Guest-first authentication architecture

Desktop can open into a usable guest workspace without an account login screen.

```text
Desktop start
  -> GET /api/v1/auth/me
  -> if no usable session: POST /api/v1/auth/desktop/guest
  -> backend verifies/creates desktop_guest_installations
  -> Spring Session JDBC stores NX_SESSION in PostgreSQL
  -> stable ROLE_GUEST session
```

Guest free mutations are explicit backend allowlists. Account-bound/provider-consuming operations remain `ROLE_USER` only.

```text
Gated action
  -> 403 AUTHENTICATION_REQUIRED
  -> renderer LoginModal stays over current route
  -> main opens /api/v1/auth/desktop/start
  -> Google OIDC in system browser
  -> narrativex://auth/callback?code=...
  -> hashed 90-second handoff atomically consumed from PostgreSQL
  -> /api/v1/auth/desktop/exchange
  -> eligible guest ownership transfer
  -> ROLE_USER session
  -> invalidate/refetch without discarding editor route
```

Google is the only end-user account sign-in provider. Guest identity is an installation-scoped ownership/session mechanism, not a password/OAuth alternative.

Google tokens never enter Electron. The guest installation secret, user session and local-execution device credential are distinct credentials.

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

## Production timeline and local render

Production timeline state is backend-authoritative where persisted, including explicit beat media selections consolidated into the final V1 schema. Renderer draft state may add temporary camera/duration edits, but final render submission is converted into backend-authorized immutable input state.

```text
backend admits + assigns local render
  -> device claims lease
  -> Desktop preflight verifies runtime/disk/assets
  -> resolve stable asset IDs through manifest
  -> write/update atomic render journal
  -> reuse immutable segment-cache hits when valid
  -> FFmpeg render missing segments
  -> concat/mux
  -> ffprobe + checksum final MP4
  -> register final-artifact metadata
  -> report completion under current lease
  -> preview/export local MP4 directly
```

Lease loss prevents successful finalization. In-process cancellation and unfinished-journal discovery exist. Richer recovery/resume behavior for abrupt process/OS failure remains product hardening work.

## Native asset materialization

Desktop imports do not send arbitrary machine paths to the backend.

```text
native selection
  -> main inspects/hash + short-lived selection token
  -> backend registers stable LOCAL_ONLY media identity
  -> main commits bytes into ProjectStorage
  -> manifest records project-relative path + integrity
```

Implemented image/narration workflows materialize required generated media locally before it participates in final rendering. Remote generated-media transport does not change ownership of final project bytes.

## Persistence and migrations

Production application persistence is MyBatis + explicit PostgreSQL SQL. Final pre-release Flyway baseline:

```text
V1__create_tables.sql
V2__init_indexes.sql
V3__seed_data.sql
```

V1 includes the complete relational/runtime schema, including Spring Session JDBC, Desktop OAuth handoffs, Desktop guest identity, production beat media selection and local-execution/render metadata. V2 includes the complete index/invariant set. V3 contains deterministic bootstrap/catalog data. Translation/content-variant schema is absent. After this baseline is adopted, future schema evolution starts with append-only V4+ migrations.

## Remaining architecture hardening

- packaged build/signing/auto-update and protocol/OAuth integration coverage;
- richer crash/restart recovery semantics across every local render stage;
- adaptive narration-driven scene/beat planning and review;
- richer asset reuse/reframe/edit lineage;
- complete billing/actual-usage reconciliation and operational evidence.

Current remaining work is tracked in `../product/ROADMAP.md`; completed migration plans are intentionally retired.
