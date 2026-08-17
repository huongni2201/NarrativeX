# Story-to-Video Workflow

This is the long-form image-first workflow. Duration, chapter size and visual count are adaptive; the system does not assume 60 minutes, 2,000 words or a fixed images-per-video formula.

## End-to-end stages

```text
Google OIDC/session + ownership
  -> account/API abuse gate
  -> rights attestation for StoryVersion
  -> input moderation + prompt-injection defense
  -> STORY_ANALYZE (Vertex AI Gemini)
  -> detected character identities / Locations / Chapters / Scenes
  -> Character identity matching / deduplication
  -> create or reuse Character
  -> create ProjectCharacter assignments
  -> Character Bible + CharacterVersion review/lock
  -> CharacterAppearance planning
  -> VISUAL_BEAT_PLAN (semantic timing and adaptive density)
  -> OperationPlan + reuse/delta + cost confirmation/reservation
  -> Scene / VisualBeat
  -> SceneCharacter / VisualBeatCharacter
  -> ProjectCharacter
  -> Character
  -> locked/pinned CharacterVersion
  -> CharacterAppearance / OutfitVersion
  -> required ReferenceAssets only
  -> image generation + Identity QA + visual review
  -> TTS narration + subtitle timing
  -> browser animatic review
  -> selected basic motion or VIDEO_MOTION_GENERATE
  -> parallel scene render / chapter render
  -> project finalization and FinalArtifact validation
  -> long-form export + notification
```

## Stage gates

| Gate | Required condition | Failure action |
|---|---|---|
| Story Parsed | valid structure and at least one scene | edit StoryVersion or analyze again |
| Characters Approved | primary characters have active/locked versions | revise Bible/references |
| Storyboard Approved | scenes/beats have order, narration, timing and visual intent | edit/replan |
| Visual Ready | required visual beats have approved assets | regenerate/review affected scope |
| Audio Ready | narration and subtitle timeline exist | regenerate voice/timing |
| Render Ready | required stages are not pending/failed | retry or omit by explicit rule |
| Final Artifact Valid | private object, MIME, dimensions, checksum and manifest validate | remain failed/unknown; never mark complete |

## Durable operation behavior

Each expensive user operation has an `OperationPlan` with affected scope, estimate range/confidence, expected visual/motion actions, provider/model snapshots and `max_authorized_cost`. User confirmation atomically creates a `CostReservation`; no billable provider/GPU stage can claim without it. Edits resolve only changed chapters/scenes/beats and reuse unchanged approved snapshots.

Every stage has a persisted `StageAttempt`, lease and heartbeat. Every external call has a `ProviderOperation` reserved before submission. `UNKNOWN` on an ambiguous submit or timeout schedules reconciliation and blocks blind resubmit. Retry policy is stage-aware: transient 408/5xx/429 or local I/O may retry with caps; auth/IAM/billing/content rejection does not loop.

## Planning and rendering details

Gemini analyzes semantic boundaries. Scene guardrails are roughly 8–10 seconds minimum, 18–30 seconds ideal and 40–45 seconds maximum before merge/split; these are planner guardrails, not hard story limits. A long-form prior of approximately 2.5 visuals/minute is only a starting prior. Complexity, narration pace, motion need, reuse and delta determine actual visual budget.

The default path uses approved keyframes plus pan/zoom/fade, subtitles, narration and music. Selected beats may use a `MotionAsset` from Veo/Kling, but final composition still uses keyframe/motion assets and FFmpeg. Scene clips render in bounded parallelism with normalized codec/fps/resolution/audio; finalization promotes only validated immutable output.

## Completion and notifications

The parent job is complete only when required stages and `FinalArtifact(READY)` are committed. Usage and reservation reconciliation are recorded in PostgreSQL. A transactional outbox event then drives in-app notification and optional email; the user does not need to keep the tab open or poll continuously. Backup/DR protects PostgreSQL metadata and critical Character Master/Approved/Final media according to the architecture RPO/RTO targets.
