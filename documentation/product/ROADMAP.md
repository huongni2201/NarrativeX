# NarrativeX — V1.11 Roadmap

**Canonical baseline:** `../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`  
**Planning rule:** dependency order, not fixed-date commitment.  
**Current audited code checkpoint:** `main` at `2c965b2e95ddcc1e03dc5527340c6adb18cdd05e` (2026-08-28)

This roadmap contains remaining work only. Completed browser->Desktop, password-auth->Google-only, JPA/JDBC->MyBatis and Redis->PostgreSQL runtime migrations are not roadmap tracks and must not reappear as future work.

## Current implemented foundations

```text
Desktop guest-first workspace
  -> project/chapter authoring
  -> Chapter Analyze / API image / Gemini Web image / narration flows
  -> semantic Scene/VisualBeat storyboard state
  -> narration alignment persistence
  -> local asset registration/materialization
  -> production timeline planned/fallback timing + beat media selection
  -> Auto Edit planning with supported fit/motion decisions
  -> local render preflight
  -> backend-assigned FFmpeg render
  -> immutable subtitle snapshot + local SRT track
  -> journal/cache/artifact metadata registration
  -> local final MP4 playback/export
  -> backup/restore/storage tooling
```

Google remains the only account sign-in provider. Guest identity is an installation-scoped ownership/session mechanism, not a second login provider. PostgreSQL is the required MVP durable runtime state service; Redis is not a required runtime dependency.

## Track A — Exact Visual Beat source/audio timeline — HIGH

Current foundations already include semantic Visual Beat analysis, nullable source/audio timing columns, persisted narration alignment and production timeline planned/fallback timing. The missing work is the deterministic bridge between those pieces.

Remaining:

- expose deterministic source segments with stable IDs to Chapter analysis;
- make AI choose semantic contiguous source segment references rather than numeric offsets;
- resolve those references into UTF-16 half-open `visual_beats.text_start/text_end` on the exact Chapter source snapshot;
- reconcile compatible narration alignment into `visual_beats.audio_start_ms/audio_end_ms` deterministically;
- handle both analysis-first/audio-later and audio-first/analysis-later ordering idempotently;
- reject stale source hash/version alignment rather than writing timing onto changed source;
- keep fallback/provisional timing distinguishable from exact `ALIGNED` timing in backend/Desktop contracts;
- expose current storyboard Visual Beats before a MediaPlan without accidentally satisfying render admission;
- make real narration audio the Desktop draft-preview clock when exact timing is available;
- verify seek, beat-boundary selection, chapter transitions, playback failures and no-image preview behavior.

**Done when:** every current analyzed Visual Beat can identify exact source coverage; a compatible narration alignment deterministically yields exact Chapter-audio offsets; Desktop can preview/select/seek draft beats on the real narration clock; missing alignment remains explicitly provisional rather than silently simulated as exact.

Implementation plan: `../../docs/superpowers/plans/2026-08-28-draft-visual-beat-preview-audio-timeline.md`.

## Track B — Production Desktop release — HIGH

- lock production packaging dependencies and installer reproducibility;
- code signing and release identity;
- auto-update strategy and rollback behavior;
- packaged `narrativex://` protocol registration tests;
- packaged system-browser OAuth integration tests;
- Windows install/upgrade/uninstall data-preservation tests;
- verify bundled FFmpeg/ffprobe across supported machines;
- define crash-reporting/diagnostic collection without leaking local paths or secrets.

**Done when:** a clean supported Windows machine can install, authenticate, open/create a project, render/export, upgrade and recover without developer tooling.

## Track C — Local execution recovery and long-form reliability — HIGH

Current foundations already include render journals, unfinished-job discovery, segment cache, preflight, lease heartbeat and cancellation.

Remaining:

- define resume/retry behavior for each persisted render stage;
- prove lease-loss and app-crash recovery without duplicate finalization;
- recover safely from FFmpeg child-process termination and OS shutdown;
- expose clear retry/discard/recover UX for discovered unfinished work;
- add long-duration soak tests for 1-2 hour outputs;
- add disk-pressure behavior and cleanup policy around active/incomplete work;
- validate cache invalidation across renderer/version/output-setting changes.

## Track D — Timeline/editor review workflow — HIGH

Current foundations include production timeline reads with planned/fallback timing, beat media selection, probed source durations, duration/camera/fit draft state, typed undo/redo and Auto Edit planning.

Remaining after Track A timing work:

- richer Scene/VisualBeat hierarchy editing while preserving Chapter -> Scene -> VisualBeat semantics;
- trim/split/reorder behavior where domain rules allow it;
- clear visual distinction between image and imported/generated video beats;
- image-only camera/motion controls that do not appear as video controls;
- review/regenerate/replace media from the timeline without losing selection state;
- dirty-state/save/error/retry semantics for production mutations;
- keyboard shortcuts and accessible focus behavior for dense editor workflows.

Real-time generation status delivery and reload recovery are implemented foundations: Desktop subscribes to owner-scoped SSE snapshots and keeps a slow GET watchdog for interruption. Durable job state remains PostgreSQL-authoritative.

## Track E — Adaptive scene planning and continuity — HIGH

- complete narration-driven `VisualScenePlanner` instead of fixed image-count assumptions;
- consume exact/aligned timing from Track A rather than generic fallback geometry;
- improve semantic Scene boundaries and beat density based on source complexity;
- strengthen Character/Location continuity context in planning and prompts;
- complete review/approval/version flow for storyboard revisions;
- preserve immutable approved history when source or continuity inputs change.

## Track F — Asset review, reuse and replacement — MEDIUM

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

## Track G — Narration/audio production completion — MEDIUM

- harden generated TTS, custom voice preview and local imported narration flows around one logical audio clock;
- complete arbitrary multi-part user audio alignment/slicing behavior needed by production render;
- expose alignment diagnostics and correction UX;
- preserve `USER_PROVIDED_AUDIO` as an explicit TTS bypass;
- keep exact source/alignment identity compatible with Track A Visual Beat timing reconciliation.

## Track H — Billing, quota and provider operations — MEDIUM

- complete actual-usage ledger and reservation settlement evidence;
- prove terminal release/refund behavior under retries and provider ambiguity;
- improve provider operation observability without weakening UNKNOWN reconciliation rules;
- expose user-facing cost/usage status from backend-authoritative values;
- add failure-mode tests for concurrent enqueue/edit/lease and provider terminal replay.

## Track I — Operational hardening — MEDIUM

- production backup/restore evidence for backend PostgreSQL state;
- retention/cleanup policy for remote generated-media transport and local generated/render work;
- structured observability/correlation across Desktop, backend and worker;
- SSRF/upload/media validation hardening where external resources are accepted;
- security review for guest credential lifecycle, ownership transfer and logout/resume behavior;
- keep local quality gates useful when GitHub Actions is unavailable;
- keep documentation checkpoint/drift guards enforcing docs resync after runtime code changes.

## Fast-follow / deferred

- HYBRID_LOCAL_I2V/Wan runtime hardening;
- provider-neutral publish/upload from an explicitly exported local final artifact;
- richer collaborative/cross-device workflows after single-device reliability is proven.

## Acceptance scenarios

**Exact draft timeline:** analyzed Visual Beats have deterministic source spans; compatible narration alignment yields exact beat audio offsets; before MediaPlan the editor can show/select/seek draft clips using real narration audio without treating draft state as render-ready.

**Guest-first authoring:** a new installation resumes the same guest-owned workspace across session restarts, allows free authoring, then signs in with Google only when a gated operation is invoked without losing the active editor context.

**Desktop generated-media path:** backend-authorized generation produces accepted media identity, Desktop materializes/registers required bytes locally, and local render resolves asset IDs/checksums without persisting absolute paths.

**Gemini Web path:** Desktop main owns visible Chrome/CDP automation and style/prompt wrapping; renderer requests work only through typed capabilities; accepted results are checksum-verified and committed locally without pretending the flow is a backend API job.

**Editable production timeline:** a user can choose beat media, adjust supported timeline properties, undo/redo edits and submit an authoritative render snapshot that reflects persisted production choices.

**Subtitle render:** narration text and alignment are captured in the immutable render input snapshot and emitted as a UTF-8 SRT track during local FFmpeg rendering when renderable cues exist.

**Local render recovery:** an assigned device renders with FFmpeg under a lease, journals progress, survives/reports interruption safely and never double-finalizes after recovery.

**Packaged release:** an installed production build can authenticate, use the editor and render with bundled/native capabilities without relying on Vite, source checkout or developer-only environment assumptions.
