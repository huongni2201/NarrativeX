# Chapter-first continuation workflow

Chapter là processing boundary bền vững của V1.8. Project có thể nhận thêm hoặc sửa một Chapter mà không mặc định phân tích/generate/render lại các Chapter không bị ảnh hưởng. Tạo Project chỉ tạo metadata; AI analysis chỉ bắt đầu khi một Chapter đã được persist và user chủ động yêu cầu Analyze.

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

Until durable enqueue/dispatch/worker execution is implemented and integration-tested, this endpoint remains feature-gated and returns `FEATURE_NOT_AVAILABLE` without creating fake queued work.

## Rules

- `Create Project` never triggers AI analysis, image generation, TTS, render or another paid AI/media operation.
- Chapter source text, StoryVersion relation, order and metadata are versioned/optimistically locked. A stale `If-Match` returns `409 CONFLICT` and never silently overwrites newer data.
- Analysis/re-analysis is scoped to the persisted Chapter explicitly submitted by the user.
- A continuation inherits a snapshot, not a live pointer to mutable project settings. Existing rendered/approved assets remain reproducible when the Project Bible later changes.
- Affected-scope resolution marks only dependent Chapter/Scene/VisualBeat/audio/render artifacts as `OUTDATED` or needing work. Unaffected approved snapshots are reusable.
- Chapter progress is persisted by stage (`ANALYZED`, `VISUAL_READY`, `RENDERED`); reconnect or worker restart resumes durable work and does not create a duplicate job.
- `CHAPTER_RENDER` may produce an independent artifact. Full-project render consumes ready chapter/scene clips and reports readiness failures if required chapters are incomplete.

## Safety and cost gates

Prompt-injection boundaries, account abuse checks, applicable real-person consent, entitlement and `OperationPlan` reservation run before expensive chapter work. Ordinary story/chapter analysis does not wait for an application-owned moderation review or require a blanket per-story copyright/rights-attestation checkbox. Provider safety policy remains in force during provider execution; a rejected image is a scene/item-level failure with an actionable retry/edit path and does not fail unrelated scenes. Cost estimates describe incremental affected scope; they do not charge reused assets as new provider calls. A chapter job with ambiguous external submission is `UNKNOWN` and reconciles before retry.

## Current foundation status

The consolidated Flyway baseline and current domain contain Chapter/Scene/VisualBeat persistence foundations and retained chapter-continuation concepts. Full chapter source persistence alignment, create/edit command controllers, affected-scope resolver, durable enqueue transaction, dispatcher, worker claim/lease/heartbeat and resume executor remain implementation work.
