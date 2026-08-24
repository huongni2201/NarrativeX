# NarrativeX Current Codebase Map — V1.11

**Canonical baseline:** `documentation/source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`  
**Implementation checkpoint:** `main` at `751f006634218efb2c398fc00c2cbfecd25e1eac` (2026-08-24)

## Runtime layout

```text
app/desktop/          Electron / React / TypeScript primary editor
                     + local project storage
                     + device execution
                     + FFmpeg/ffprobe local render

app/backend-service/  Java / Spring Boot modular monolith
                     durable policy/control plane

app/ai-worker/        Python async AI/media/provider worker
                     retained cloud/server execution paths

app/frontend-web/     temporary legacy migration client

packages/client-contracts/
                     shared typed client contracts

contracts/            backend <-> worker contracts
documentation/        source of truth, architecture, workflows, ADRs and plans
```

## Primary Desktop runtime

```text
Electron renderer
  -> editor UI, routing, React Query/Zustand state

Electron preload
  -> narrow typed bridge

Electron main
  -> system-browser/deep-link auth handoff
  -> native file/folder actions
  -> ProjectStorage
  -> protected device identity
  -> local execution service
  -> FFmpeg/ffprobe ProjectRenderer

Spring backend
  -> PostgreSQL authoritative domain/job/lease metadata
  -> Redis server-managed session/transient hints
  -> provider/cloud workers where needed
```

## Desktop implementation highlights

- Electron BrowserWindow uses `contextIsolation: true`, `nodeIntegration: false`, sandbox enabled.
- Desktop Google authentication opens `/api/v1/auth/desktop/start` in the system browser.
- `narrativex://auth/callback` custom-protocol handling supports initial/second-instance callback delivery.
- Backend Desktop auth start/exchange/logout contracts establish a server-managed NarrativeX session from a one-time handoff code.
- `ProjectStorage` creates `<userData>/projects/<projectId>` and maintains `project.manifest.json`.
- Local manifest entries record project-relative path, size and SHA-256.
- Path traversal/workspace escape, missing files, size mismatches and checksum mismatches are rejected.
- Local execution supports explicit pairing, protected device identity, heartbeat and online/offline state.
- Backend-assigned project renders can be claimed by the device.
- Claimed narration/image inputs are resolved by `narrationAssetId` / `mediaAssetId`, not remote storage keys or absolute paths.
- Render execution heartbeats its lease, reports progress and reports terminal completion/failure.
- Active local render can be cancelled in-process.
- `ProjectRenderer` builds a deterministic manifest, renders segments, concatenates video, concatenates narration, muxes, probes the final video and registers a checksum-verified local artifact.
- Local rendering is enabled only when FFmpeg is available and `NARRATIVEX_DESKTOP_PROJECT_RENDER_ENABLED=true`.

## Backend implementation highlights

- Production persistence is MyBatis + explicit SQL.
- Project/Chapter/Analyze foundations are durable.
- GenerationJob, StageAttempt, OperationPlan, MediaPlan and outbox/job-history foundations are persisted.
- Character/ProjectCharacter/Location continuity foundations exist.
- Provider execution state and failure/reconciliation fences remain backend/worker concerns.
- Local-device capability/heartbeat/revocation/assignment state is persisted by the backend.
- Cloud/server AI/media execution remains available during Desktop migration.

## Storage map by execution mode

### Primary Desktop path

```text
Generated/imported project images   -> local project workspace
Project narration/audio             -> local project workspace
Imported media                      -> local project workspace
Render intermediates                -> local project workspace/work
Final rendered MP4                  -> local project workspace/artifacts
Durable business/job metadata       -> PostgreSQL
```

Backend state uses stable IDs/checksums and opaque project-relative artifact keys. It never persists absolute Desktop filesystem paths.

### Retained cloud/legacy path

```text
Cloud pipeline media                -> Cloudflare R2
Cloud final rendered MP4            -> Google Drive
Cloud worker scratch                -> ephemeral filesystem
Durable business/job metadata       -> PostgreSQL
```

R2/Drive remain valid for the cloud/legacy worker path and deliberately shared remote media. They are not the Desktop project-media contract.

## Current gaps

```text
restart-safe local render recovery/resume
  -> complete local materialization of image/TTS/import outputs
  -> richer timeline/editor mutations and regeneration/reuse workflows
  -> disk cleanup/backup/move/repair UX
  -> packaging/signing/auto-update hardening
  -> Desktop parity evidence
  -> remove app/frontend-web
```

User-provided audio and other generation workflows must be described per the execution path actually implemented; do not infer Desktop-local completeness merely because a cloud/server foundation exists.

## Persistence direction

The production persistence migration is complete: production source uses MyBatis + explicit SQL and does not use JPA or direct `JdbcTemplate` persistence as the application persistence mechanism.

## Worker boundary

Python workers own provider/media mechanics according to backend-authorized plans. During migration they may still own cloud storage/materialization and cloud rendering paths. They do not own Desktop local filesystem paths, Electron native capabilities, browser/user authorization, entitlement policy or Flyway schema ownership.

## Documentation authority

For factual AS-IS behavior, current code/migrations/tests win over stale derived documentation. Desktop client/storage/auth/render boundaries are defined by ADR-0010, ADR-0011 and ADR-0012.
