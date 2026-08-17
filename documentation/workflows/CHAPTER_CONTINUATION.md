# Chapter-first continuation workflow

Chapter là processing boundary bền vững của v1.7. Project có thể nhận thêm hoặc sửa một Chapter mà không mặc định phân tích/generate/render lại các Chapter không bị ảnh hưởng.

## Flow

```text
Authenticated owner
  -> create/edit/reorder Chapter with If-Match
  -> resolve source StoryVersion and affected scope
  -> snapshot Project Bible, locked CharacterVersion, Location, Style and generation settings
  -> persist Chapter DRAFT + inherited snapshot hash
  -> CHAPTER_ANALYZE
  -> CHAPTER_GENERATE (OperationPlan + reuse/delta + reservation)
  -> chapter audio/visual readiness
  -> CHAPTER_RENDER or include in full-project render
  -> durable progress + terminal notification
```

## Rules

- Chapter source text, StoryVersion relation, order and metadata are versioned/optimistically locked. A stale `If-Match` returns `409 CONFLICT` and never silently overwrites newer data.
- A continuation inherits a snapshot, not a live pointer to mutable project settings. Existing rendered/approved assets remain reproducible when the Project Bible later changes.
- Affected-scope resolution marks only dependent Chapter/Scene/VisualBeat/audio/render artifacts as `OUTDATED` or needing work. Unaffected approved snapshots are reusable.
- Chapter progress is persisted by stage (`ANALYZED`, `VISUAL_READY`, `RENDERED`); reconnect or worker restart resumes durable work and does not create a duplicate job.
- `CHAPTER_RENDER` may produce an independent artifact. Full-project render consumes ready chapter/scene clips and reports readiness failures if required chapters are incomplete.

## Safety and cost gates

Rights attestation, input moderation, prompt-injection boundaries, account abuse checks, entitlement and `OperationPlan` reservation run before expensive chapter work. Cost estimates describe incremental affected scope; they do not charge reused assets as new provider calls. A chapter job with ambiguous external submission is `UNKNOWN` and reconciles before retry.

## Current foundation status

The repository has Chapter/Scene/VisualBeat persistence, v1.7 worker job types, contract enum values and V3 snapshot metadata columns. Full chapter command controllers, affected-scope resolver and resume executor remain implementation work.
