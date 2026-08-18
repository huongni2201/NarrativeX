# Story-to-Video Workflow

This is the long-form image-first workflow. Duration, chapter size and visual count are adaptive; the system does not assume 60 minutes, 2,000 words or a fixed images-per-video formula.

## Project and Chapter entry flow

Creating a Project only persists project metadata and defaults. It does not analyze text and does not enqueue AI/media work.

```text
Authenticated owner
  -> Create Project metadata
  -> Add/Edit Chapter source
  -> persist Chapter source/snapshot
  -> explicit Analyze Chapter
  -> durable Chapter pipeline
```

A later Chapter is analyzed incrementally with reusable Project/Character/Location/Style context; unrelated completed Chapters are not reprocessed by default.

## End-to-end stages

```text
Google OIDC/session + ownership
  -> persisted/current Chapter source snapshot
  -> account/API abuse gate
  -> input moderation + applicable real-person consent
  -> prompt-injection defense
  -> CHAPTER_ANALYZE (Vertex AI Gemini when production adapter is enabled)
  -> detected character identities / Locations / Scenes for affected Chapter scope
  -> Character identity matching / deduplication
  -> create or reuse Character
  -> create/update ProjectCharacter assignments
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

Ordinary story/chapter analysis does **not** require a blanket per-story copyright/rights-attestation checkbox. Input moderation, real-person consent where applicable, report/review/takedown and other policy controls remain separate gates.

## Analysis API and current execution gate

The canonical analysis request is Chapter-scoped:

```http
POST /api/v1/projects/{projectId}/chapters/{chapterId}/analysis-jobs
```

The endpoint remains disabled until the durable enqueue transaction and worker execution path are implemented and integration-tested. While disabled it returns `FEATURE_NOT_AVAILABLE` and must not create `QUEUED` work.

## Stage gates

| Gate | Required condition | Failure action |
|---|---|---|
| Chapter Parsed | valid affected Chapter structure and required scene plan | edit Chapter source or analyze again |
| Characters Approved | primary participating characters have active/locked versions | revise Bible/references |
| Storyboard Approved | scenes/beats have order, narration, timing and visual intent | edit/replan affected Chapter |
| Visual Ready | required visual beats have approved assets | regenerate/review affected scope |
| Audio Ready | narration and subtitle timeline exist | regenerate voice/timing |
| Render Ready | required stages are not pending/failed | retry or omit by explicit rule |
| Final Artifact Valid | private object, MIME, dimensions, checksum and manifest validate | remain failed/unknown; never mark complete |

## Durable operation behavior

Each expensive user operation has an `OperationPlan` with affected scope, estimate range/confidence, expected visual/motion actions, provider/model snapshots and `max_authorized_cost`. User confirmation atomically creates a `CostReservation` when required; no billable provider/GPU stage can claim without authorization. Edits resolve only changed chapters/scenes/beats and reuse unchanged approved snapshots.

For Chapter analysis specifically, the minimum path is:

```text
request
  -> ownership + Project/Chapter consistency
  -> idempotency
  -> persisted/current Chapter source snapshot
  -> StoryVersion validation where required
  -> abuse + safety/moderation
  -> entitlement/quota
  -> affected scope + estimate/authorization
  -> one DB transaction:
       OperationPlan/CostReservation
       GenerationJob
       StageAttempt(s)
       OutboxEvent
  -> COMMIT
  -> dispatcher
  -> worker claim/lease/heartbeat
  -> ProviderOperation RESERVED before external submit
```

Every stage has a persisted `StageAttempt`, lease and heartbeat. Every external call has a `ProviderOperation` reserved before submission. `UNKNOWN` on an ambiguous submit or timeout schedules reconciliation and blocks blind resubmit. Retry policy is stage-aware: transient 408/5xx/429 or local I/O may retry with caps; auth/IAM/billing/content rejection does not loop.

## Planning and rendering details

Gemini analyzes semantic boundaries within the affected Chapter context. Scene guardrails are roughly 8–10 seconds minimum, 18–30 seconds ideal and 40–45 seconds maximum before merge/split; these are planner guardrails, not hard story limits. A long-form prior of approximately 2.5 visuals/minute is only a starting prior. Complexity, narration pace, motion need, reuse and delta determine actual visual budget.

The default path uses approved keyframes plus pan/zoom/fade, subtitles, narration and music. Selected beats may use a `MotionAsset` from Veo/Kling, but final composition still uses keyframe/motion assets and FFmpeg. Scene clips render in bounded parallelism with normalized codec/fps/resolution/audio; finalization promotes only validated immutable output.

## Completion and notifications

The parent job is complete only when required stages and required result/artifact state are committed. Usage and reservation reconciliation are recorded in PostgreSQL. A transactional outbox event then drives in-app notification and optional email; the user does not need to keep the tab open or poll continuously. Backup/DR protects PostgreSQL metadata and critical Character Master/Approved/Final media according to the architecture RPO/RTO targets.
