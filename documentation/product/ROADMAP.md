# NarrativeX — V1.11 Roadmap

**Canonical baseline:** `../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`  
**Planning rule:** dependency order, not fixed-date commitment.  
**Primary migration:** Electron Desktop + local-first project media/render.

## Current checkpoint — IMPLEMENTED foundations

```text
Electron Desktop only supported editor
  -> Google OAuth system-browser handoff
  -> backend-authoritative Project/Chapter/domain state
  -> local project workspace + manifest
  -> local device pairing/heartbeat
  -> backend-assigned LOCAL_DEVICE render
  -> FFmpeg/ffprobe local final MP4
```

Existing cloud/provider foundations remain available for analysis, image generation, narration and fallback rendering/storage.

## Track A — Desktop client and security boundary — IMPLEMENTED foundation

- Electron Vite + React + TypeScript shell;
- project-scoped editor workspaces;
- secure main/preload/renderer split;
- no unrestricted Node access in renderer;
- native file/folder and artifact actions owned by main;
- shared typed client contracts.

### Remaining

- complete screen/editor mutation parity;
- richer timeline editing/review/regeneration UX;
- packaging/signing/auto-update hardening.

## Track B — Google OAuth-only Desktop auth — IMPLEMENTED foundation

- system-browser `/api/v1/auth/desktop/start`;
- `narrativex://auth/callback` handling;
- one-time handoff exchange into server-managed NarrativeX session;
- user session separated from device execution token.

### Remaining

- remove any remaining password-auth product/UI leftovers;
- packaged-build protocol/OAuth integration tests;
- decide whether explicit device pairing remains or becomes automatic after login.

## Track C — Desktop local project storage — IMPLEMENTED foundation

- `<userData>/projects/<projectId>` workspace;
- atomic schema-versioned `project.manifest.json`;
- project-relative asset/artifact paths;
- size/SHA-256 verification;
- workspace/path traversal protection.

### Remaining

- disk quota/cleanup UX;
- backup/move/restore;
- missing/corrupt file repair;
- complete local materialization of all image/TTS/import outputs.

## Track D — Local project render — IMPLEMENTED foundation

- device claim/lease/progress/completion/failure;
- FFmpeg/ffprobe capability probing;
- render segments;
- concat video;
- concat narration;
- mux;
- ffprobe/checksum final artifact;
- local artifact registration;
- in-process cancellation.

### Remaining

- process-restart recovery/resume;
- richer pause/retry/recovery UI;
- long-form disk-space preflight and cleanup;
- packaged-runtime FFmpeg distribution strategy.

## Track E — Finish Desktop-local creator loop — PARTIAL → TARGET

### E1 — Image result local materialization

Provider execution foundation exists. Every accepted generated/regenerated image needed by Desktop must be registered into the project workspace/manifest so local render resolves `mediaAssetId` without mandatory R2 download.

### E2 — Narration result local materialization

Generated/imported narration used by local render must be registered locally with checksum/timing metadata. `USER_PROVIDED_AUDIO` keeps TTS bypass and one logical audio clock.

### E3 — Import/media local registration

All Desktop imports use native file selection and manifest registration. Backend stores stable IDs/metadata, never absolute paths.

### E4 — VisualScenePlanner/review

Complete narration-driven adaptive scene/beat planning and review flow. Avoid fixed image-count/fixed-duration assumptions.

### E5 — Asset review/reuse

Add richer approval/reuse/reframe/edit/affected-scope regeneration after the generate-new foundation is reliable.

## Track F — Retained cloud/legacy path — MAINTENANCE / FALLBACK

The existing path remains valid while migration is incomplete:

```text
cloud pipeline media -> R2
cloud final MP4      -> Google Drive
```

Maintain it only as required for compatibility/provider workflows and fallback. Do not make new Desktop features depend on cloud storage without an explicit cross-device/shared-media requirement.

## Track G — Legacy web removal — IMPLEMENTED

The former `app/frontend-web` client has been removed from the repository and active runtime topology. The completed removal evidence is:

- no `app/frontend-web` path in the latest tree;
- production Compose has no frontend or Caddy service;
- Desktop system-browser OAuth uses the backend auth flow and `narrativex://` handoff;
- no supported editor or deployment dependency requires Next.js.

Remaining Desktop roadmap items are tracked independently; they do not require reintroducing a browser editor.

## Fast-follow after reliable creator loop

- Character review/version/reference locking completion.
- Approved storyboard revision/reset workflow.
- Reuse → reframe → edit → new AssetResolver.
- HYBRID_LOCAL_I2V/Wan runtime hardening.
- Full actual-cost ledger/release/refund.
- Moderation/SSRF/retention/observability/backup/restore evidence.
- Provider-neutral publishing/upload from local final artifacts.

## Current acceptance scenarios

**Desktop generated-media path:** backend-authorized generation produces an accepted media identity, Desktop materializes/registers its bytes locally, local render resolves asset IDs/checksums and produces a checksum-verified local MP4.

**Desktop local render:** an authorized paired device claims a `LOCAL_DEVICE` project render, heartbeats the lease, renders with FFmpeg, validates/registers the local artifact and reports completion without persisting an absolute machine path.

**Cloud fallback:** retained R2/Drive worker rendering remains available where required during migration, but is not the Desktop target storage topology.
