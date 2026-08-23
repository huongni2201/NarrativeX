# Chapter-first continuation workflow

Chapter là processing boundary bền vững của V1.11. Project có thể nhận thêm hoặc sửa một Chapter mà không mặc định phân tích/generate/render lại các Chapter không bị ảnh hưởng. Tạo Project chỉ tạo metadata; AI analysis chỉ bắt đầu khi một Chapter đã được persist và user chủ động yêu cầu Analyze.

## Flow

```text
Authenticated owner
  -> Create Project metadata only
  -> create/edit/reorder Chapter with If-Match
  -> persist Chapter source/snapshot
  -> resolve source StoryVersion and affected scope
  -> snapshot Project Bible, locked CharacterVersion, Location, Style and generation settings
  -> persist Chapter DRAFT + inherited snapshot hash
  -> explicit Analyze Chapter
  -> CHAPTER_ANALYZE
  -> CHAPTER_GENERATE (OperationPlan + reuse/delta + reservation)
  -> chapter audio/visual readiness
  -> CHAPTER_RENDER or include in full-project render
  -> durable progress + terminal notification
```

The current HTTP analysis contract is:

```http
POST /api/v1/projects/{projectId}/chapters/{chapterId}/analysis-jobs
```

The endpoint performs ownership, saved-source, idempotency, entitlement/quota and cost admission,
then persists the durable job/stage/outbox boundary before worker execution. Redis is only a delivery
hint; the worker claims the job from PostgreSQL and validates the Chapter snapshot before materializing
results.

## Rules

- `Create Project` never triggers AI analysis, image generation, TTS, render or another paid AI/media operation.
- Chapter source text, StoryVersion relation, order and metadata are versioned/optimistically locked. A stale `If-Match` returns `409 CONFLICT` and never silently overwrites newer data. Chapter creation requires an owner-scoped `Idempotency-Key` and persists its request fingerprint.
- Analysis/re-analysis is scoped to the persisted Chapter explicitly submitted by the user.
- A continuation inherits a snapshot, not a live pointer to mutable project settings. Existing rendered/approved assets remain reproducible when the Project Bible later changes.
- Affected-scope resolution marks only dependent Chapter/Scene/VisualBeat/audio/render artifacts as `OUTDATED` or needing work. Unaffected approved snapshots are reusable.
- Chapter progress is persisted by stage (`ANALYZED`, `VISUAL_READY`, `RENDERED`); reconnect or worker restart resumes durable work and does not create a duplicate job.
- `CHAPTER_RENDER` may produce an independent artifact. Full-project render consumes ready chapter/scene clips and reports readiness failures if required chapters are incomplete.

## Safety and cost gates

Prompt-injection boundaries, account abuse checks, applicable real-person consent, entitlement and `OperationPlan` reservation run before expensive chapter work. Ordinary story/chapter analysis does not wait for an application-owned moderation review or require a blanket per-story copyright/rights-attestation checkbox. Provider safety policy remains in force during provider execution; a rejected image is a scene/item-level failure with an actionable retry/edit path and does not fail unrelated scenes. Cost estimates describe incremental affected scope; they do not charge reused assets as new provider calls. A chapter job with ambiguous external submission is `UNKNOWN` and reconciles before retry.

## Current foundation status

The consolidated Flyway baseline and current domain contain Chapter/Scene/VisualBeat persistence and
the durable Chapter Analyze foundation. Create/edit/import commands, owner-scoped chapter-creation
idempotency, durable enqueue, dispatcher, worker claim/lease/heartbeat and stale-source protection
are implemented. Full affected-scope continuation, full-project render orchestration and richer
resume/review UX remain follow-up work.
