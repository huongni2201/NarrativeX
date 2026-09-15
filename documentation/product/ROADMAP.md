# NarrativeX — V1.12 Roadmap

**Canonical baseline:** `../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_12.md`
**Planning rule:** dependency order, not fixed-date commitment.
**Current checkpoint:** `main` at `b1457f38a169ccc59a5789c9f40207db275cc06f`

The browser→Desktop, authentication/account and monetary billing/credit migrations are no longer active roadmap tracks. Desktop is already the only editor client, NarrativeX is a single-user local-first application per ADR-0030, MyBatis is the production persistence path, provider execution carries no monetary accounting contract, and system capacity limits replace per-user quotas. Remaining work is compute execution-plane cutover, product reliability, and release hardening.

## Track 0 — Compute execution-plane cutover — IN PROGRESS

Build on the `app/generation-service` scaffold and Compute Protocol v1:

- complete backend compute control-plane persistence, task materialization, and attempt mapping;
- cut narration over first (VoiceStudio TTS + WhisperX forced alignment);
- cut image generation over next (ComfyUI RealVisXL adapter);
- move domain-neutral media validation to `generation-service`;
- support interchangeable local RTX 4060 and remote GPU execution targets;
- implement artifact capability transport with SHA-256 integrity verification;
- delete `app/ai-worker` after parity, recovery, rollback and dependency gates pass.

**Done when:** backend owns all durable business transitions, local and remote GPU targets pass the Compute Protocol test suite, and `app/ai-worker` is completely removed.

## Current implemented foundations

```text
Desktop single-user local workspace
  -> project/chapter authoring
  -> analyze / generation / narration workflows
  -> local asset registration/materialization
  -> production timeline + beat media selection
  -> Auto Edit planning with narration-aware fit/motion decisions
  -> local render preflight
  -> backend-assigned FFmpeg render
  -> immutable subtitle snapshot + local SRT track
  -> journal/cache/artifact metadata registration
  -> local final MP4 playback/export
  -> backup/restore/storage tooling
```

## Track A — Production Desktop release — HIGH

- lock production packaging dependencies and installer reproducibility;
- code signing and release identity;
- auto-update strategy and rollback behavior;
- Windows install/upgrade/uninstall data-preservation tests;
- verify bundled FFmpeg/ffprobe across supported machines;
- runtime configuration and provider setting UX;
- define crash-reporting/diagnostic collection without leaking local paths or secrets.

**Done when:** a clean supported Windows machine can install, boot directly into the workspace, create/render/export a project, upgrade and recover without developer tooling.

## Track B — Local execution recovery and long-form reliability — HIGH

Current foundations include render journals, unfinished-job discovery, segment cache, preflight, lease heartbeat and cancellation.

Remaining:

- define resume/retry behavior for each persisted render stage;
- prove lease-loss and app-crash recovery without duplicate finalization;
- recover safely from FFmpeg child-process termination and OS shutdown;
- expose clear retry/discard/recover UX for discovered unfinished work;
- add long-duration soak tests for 1–2 hour outputs;
- add disk-pressure behavior and cleanup policy around active/incomplete work;
- validate cache invalidation across renderer/version/output-setting changes.

## Track C — Timeline/editor review workflow — HIGH

Current foundations include production timeline reads, narration-aligned timing, beat media selection, probed source durations, duration/camera draft state, typed undo/redo, Auto Edit planning and atomic application of render overrides.

Remaining:

- richer scene/beat hierarchy editing while preserving Chapter → Scene → VisualBeat semantics;
- trim/split/reorder behavior where domain rules allow it;
- clear visual distinction between image and imported/generated video beats;
- image-only camera/motion controls that do not appear for video beats;
- review/regenerate/replace media from the timeline without losing selection state;
- dirty-state/save/error/retry semantics for production mutations;
- keyboard shortcuts and accessible focus behavior for dense editor workflows.

Real-time generation status delivery and reload recovery are implemented foundations: Desktop subscribes to SSE snapshots with fallback watchdog. Durable job state remains PostgreSQL-authoritative.

## Track D — Adaptive scene planning and continuity — HIGH

- complete narration-driven `VisualScenePlanner` instead of fixed image-count assumptions;
- use narration alignment as the duration authority;
- improve semantic scene boundaries and beat density based on source complexity;
- strengthen Character/Location continuity context in planning and prompts;
- complete review/approval/version flow for storyboard revisions;
- preserve immutable approved history when source or continuity inputs change.

## Track E — Asset review, reuse and replacement — MEDIUM

Build on current media identity/materialization foundations:

```text
REUSE_APPROVED
  -> REFRAME_DERIVED
  -> EDIT_EXISTING
  -> GENERATE_NEW
```

Remaining:

- explicit approved-asset reuse decisions;
- lineage-aware reframe/edit operations;
- imported user video as a first-class selectable beat medium;
- affected-scope regeneration after source/character/style changes;
- local missing/corrupt asset repair UX.

## Track F — Narration/audio production completion — MEDIUM

- harden generated TTS, custom voice preview and local imported narration flows around one logical audio clock;
- complete multi-part user audio alignment/slicing behavior needed by production render;
- expose alignment diagnostics and correction UX;
- preserve `USER_PROVIDED_AUDIO` as an explicit TTS bypass;
- keep narration timing authoritative for visual duration;
- transition custom voice profiles to local voice library (`GLOBAL_LOCAL`).

## Track G — Provider operation reliability and observability — MEDIUM

- preserve UNKNOWN-before-resubmit fencing across every external provider boundary;
- prove terminal replay/idempotency behavior under retries and ambiguous outcomes;
- improve provider operation observability and non-monetary usage telemetry;
- add failure-mode tests for concurrent enqueue/edit/lease and provider terminal replay;
- keep provider usage diagnostics separate from any future commercial/accounting product decision.

## Track H — Operational hardening — MEDIUM

- production backup/restore evidence for backend PostgreSQL state;
- retention/cleanup policy for local generated/render work;
- structured observability/correlation across Desktop, backend and generation-service;
- SSRF/upload/media validation hardening where external resources are accepted;
- local quality gate that remains useful when GitHub Actions is unavailable.

## Fast-follow / deferred

- any future provider-side/local I2V runtime only after an explicit architecture decision defines its provider, storage and execution boundaries; the removed Wan/Python path is not a deferred runtime to harden;
- provider-neutral publish/upload from an explicitly exported local final artifact.

## Acceptance scenarios

**Single-user workspace authoring:** a new installation opens directly into the workspace, allows free authoring and project management without login prompts or network auth dependencies.

**Desktop generated-media path:** backend-authorized generation produces accepted media identity, Desktop materializes/registers required bytes locally, and local render resolves asset IDs/checksums without persisting absolute paths.

**Editable production timeline:** a user can choose beat media, adjust supported timeline properties, undo/redo edits and submit an authoritative render snapshot that reflects persisted production choices.

**Auto Edit render:** a user can accept the default narration-aware Auto Edit plan or choose a style override; supported fit/motion decisions are applied atomically before render admission.

**Subtitle render:** narration text and alignment are captured in the immutable render input snapshot and emitted as a UTF-8 SRT track during local FFmpeg rendering when renderable cues exist.

**Local render recovery:** an assigned device renders with FFmpeg under a lease, journals progress, survives/reports interruption safely and never double-finalizes after recovery.

**Packaged release:** an installed production build can boot, use the editor and render with bundled/native capabilities without relying on Vite, source checkout or developer-only environment assumptions.
