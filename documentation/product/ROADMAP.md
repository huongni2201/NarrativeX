# NarrativeX — V1.11 Roadmap

**Canonical baseline:** `../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`  
**Planning rule:** dependency order, not fixed-date commitment.  
**Current checkpoint:** `main` at `c370418fad5c5b7229c80c4ab64dfb796ba4dd5d` (2026-09-12)

The browser→Desktop, JPA/JDBC→MyBatis and monetary billing/credit/quota migrations are no longer roadmap tracks. Desktop is already the only editor client, MyBatis is the production persistence path, and provider execution no longer carries a monetary accounting contract. Remaining work is product/reliability/release work.

## Current implemented foundations

```text
Desktop guest-first workspace
  -> project/chapter authoring
  -> analyze / API image / Gemini Web image / narration workflows
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

Google remains the only account sign-in provider. Guest identity is an installation-scoped ownership/session mechanism, not a second login provider.

## Track A — Production Desktop release — HIGH

- lock production packaging dependencies and installer reproducibility;
- code signing and release identity;
- auto-update strategy and rollback behavior;
- packaged `narrativex://` protocol registration tests;
- packaged system-browser OAuth integration tests;
- Windows install/upgrade/uninstall data-preservation tests;
- verify bundled FFmpeg/ffprobe across supported machines;
- define crash-reporting/diagnostic collection without leaking local paths or secrets.

**Done when:** a clean supported Windows machine can install, authenticate, open/create a project, render/export, upgrade and recover without developer tooling.

## Track B — Local execution recovery and long-form reliability — HIGH

Current foundations already include render journals, unfinished-job discovery, segment cache, preflight, lease heartbeat and cancellation.

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

Real-time generation status delivery and reload recovery are implemented foundations: Desktop subscribes to owner-scoped SSE snapshots and keeps a slow GET watchdog for stream/network interruption. Durable job state remains PostgreSQL-authoritative.

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
- local missing/corrupt asset repair UX;
- optional cross-device/shared-media workflows only when a real sharing requirement exists.

## Track F — Narration/audio production completion — MEDIUM

- harden generated TTS, custom voice preview and local imported narration flows around one logical audio clock;
- complete multi-part user audio alignment/slicing behavior needed by production render;
- expose alignment diagnostics and correction UX;
- preserve `USER_PROVIDED_AUDIO` as an explicit TTS bypass;
- keep narration timing authoritative for visual duration.

## Track G — Provider operation reliability and observability — MEDIUM

- preserve UNKNOWN-before-resubmit fencing across every external provider boundary;
- prove terminal replay/idempotency behavior under retries and ambiguous outcomes;
- improve provider operation observability and non-monetary usage telemetry;
- add failure-mode tests for concurrent enqueue/edit/lease and provider terminal replay;
- keep provider usage diagnostics separate from any future commercial/accounting product decision.

## Track H — Operational hardening — MEDIUM

- production backup/restore evidence for backend PostgreSQL state;
- retention/cleanup policy for remote account-owned voice assets and local generated/render work;
- structured observability/correlation across Desktop, backend and worker;
- SSRF/upload/media validation hardening where external resources are accepted;
- security review for guest credential lifecycle, ownership transfer and logout/resume behavior;
- local quality gate that remains useful when GitHub Actions is unavailable.

## Fast-follow / deferred

- HYBRID_LOCAL_I2V/Wan runtime hardening;
- provider-neutral publish/upload from an explicitly exported local final artifact;
- richer collaborative/cross-device workflows after single-device reliability is proven.

## Acceptance scenarios

**Guest-first authoring:** a new installation resumes the same guest-owned workspace across session restarts, allows free authoring, then signs in with Google only when a gated operation is invoked without losing the active editor context.

**Desktop generated-media path:** backend-authorized generation produces accepted media identity, Desktop materializes/registers required bytes locally, and local render resolves asset IDs/checksums without persisting absolute paths.

**Editable production timeline:** a user can choose beat media, adjust supported timeline properties, undo/redo edits and submit an authoritative render snapshot that reflects persisted production choices.

**Auto Edit render:** a user can accept the default narration-aware Auto Edit plan or choose a style override; supported fit/motion decisions are applied atomically before render admission.

**Subtitle render:** narration text and alignment are captured in the immutable render input snapshot and emitted as a UTF-8 SRT track during local FFmpeg rendering when renderable cues exist.

**Local render recovery:** an assigned device renders with FFmpeg under a lease, journals progress, survives/reports interruption safely and never double-finalizes after recovery.

**Packaged release:** an installed production build can authenticate, use the editor and render with bundled/native capabilities without relying on Vite, source checkout or developer-only environment assumptions.
