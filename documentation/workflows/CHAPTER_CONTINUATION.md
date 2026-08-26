# Chapter-first continuation workflow

Chapter là processing boundary bền vững của V1.12. Project có thể nhận thêm hoặc sửa một Chapter mà không mặc định phân tích/generate/render lại các Chapter không bị ảnh hưởng. Tạo Project chỉ tạo metadata; AI analysis chỉ bắt đầu khi một Chapter đã được persist và user chủ động yêu cầu Analyze.

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

The endpoint performs ownership, saved-source, idempotency, entitlement/quota and cost admission, then persists the durable job/stage/outbox boundary before worker execution. After commit, outbox bookkeeping is finalized independently; Python workers discover and claim the actual job directly from PostgreSQL using polling/lease queries. Redis, a broker, `LISTEN`, and `NOTIFY` are not required by this flow.

## Rules

- `Create Project` never triggers AI analysis, image generation, TTS, render or another paid AI/media operation.
- Chapter source text, StoryVersion relation, order and metadata are versioned/optimistically locked. A stale `If-Match` returns `409 CONFLICT` and never silently overwrites newer data.
- Analysis/re-analysis is scoped to the persisted Chapter explicitly submitted by the user.
- A continuation inherits a snapshot, not a live pointer to mutable project settings. Existing rendered/approved assets remain reproducible when the Project Bible later changes.
- Affected-scope resolution marks only dependent Chapter/Scene/VisualBeat/audio/render artifacts as `OUTDATED` or needing work. Unaffected approved snapshots are reusable.
- Chapter progress is persisted by stage; reconnect or worker restart resumes durable work and does not create a duplicate paid submission.

## Safety and cost gates

Prompt-injection boundaries, account abuse checks, applicable real-person consent, entitlement and `OperationPlan` reservation run before expensive chapter work. Provider safety policy remains in force during provider execution. Cost estimates describe incremental affected scope; they do not charge reused assets as new provider calls. A chapter job with ambiguous external submission is `UNKNOWN` and reconciles before retry.

## Current foundation status

The current schema/domain contain Chapter/Scene/VisualBeat persistence and durable Chapter Analyze foundations. Create/edit/import commands, owner-scoped chapter-creation idempotency, durable enqueue, outbox finalization, worker PostgreSQL claim/lease/heartbeat and stale-source protection are implemented. Full affected-scope continuation, full-project render orchestration and richer resume/review UX remain follow-up work.
