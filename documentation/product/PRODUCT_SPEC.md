# NarrativeX — Product Specification V1.10

**Trạng thái:** maintained product contract · 19/08/2026  
**Canonical source:** [`../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_10.md`](../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_10.md)  
**Implementation status:** tracked separately in [`../TRACEABILITY.md`](../TRACEABILITY.md).

This document is the maintained product-facing summary. The canonical V1.10 source-of-truth owns product and architecture invariants; current code, migrations and tests own factual AS-IS implementation claims.

## 1. Định vị và mục tiêu

NarrativeX là **AI Long-form Story Video Studio**: biến truyện chữ có độ dài linh hoạt thành video image-first, rồi tái sử dụng timeline/assets để tạo Short/Reel. Sản phẩm tối ưu cho orchestration, character consistency, review và chi phí có thể dự đoán; đây không phải one-click full text-to-video.

Mục tiêu V1.10:

- Chuyển Chapter source → detected Character/Location/Scene data → ProjectCharacter assignments → Scene/VisualBeat → audio → animatic → render bền vững.
- Giữ nhất quán nhân vật bằng Character identity, CharacterVersion, CharacterAppearance/OutfitVersion, reference assets và scene-level continuity relations.
- Cho phép regenerate theo affected scope, reuse asset và review batch thay vì chạy lại toàn project.
- Đo và giới hạn chi phí theo `user → project → operation → job → stage → provider operation`, có estimate, authorization/reservation và actual usage reconciliation.
- Đưa Trust & Safety, consent, prompt-injection defense, abuse protection, privacy/deletion, report/review/takedown và audit vào control plane trước public production.

### Current implementation snapshot

Current repository foundations include:

- metadata-only Project creation plus Project Overview read model;
- StoryVersion and Chapter create/list/get/update with source hash and optimistic concurrency;
- Chapter batch import for `.txt`, `.docx` and `.pdf`;
- explicit Chapter Analyze durable enqueue;
- MVP safety/entitlement/quota/cost admission before enqueue;
- PostgreSQL outbox, worker claim/lease/heartbeat and bounded worker concurrency;
- durable `ProviderOperation` reservation/submission state and `UNKNOWN` reconciliation foundation;
- Character/ProjectCharacter/CharacterVersion plus Scene/VisualBeat materialization;
- Storyboard read, VisualBeat create and review-status foundations;
- backend read surfaces for Characters, project Locations/Assets, Job History, Quota and Notifications.

The current worker **does not yet materialize AI-returned Locations or Scene → Character / Scene → Location relations**. Full image/TTS/render/export remains outside the current vertical slice.

### Project creation and Chapter analysis

- `Create Project` chỉ tạo metadata/default settings và **không** chạy AI analysis, image generation, TTS hay render.
- User thêm/sửa Chapter và lưu source snapshot trước.
- Analyze là explicit action theo Chapter: `POST /api/v1/projects/{projectId}/chapters/{chapterId}/analysis-jobs`.
- Backend reload persisted Chapter source; browser text is not the analysis authority.
- Thêm/sửa Chapter chỉ reprocess affected scope; Chapter không bị ảnh hưởng được reuse.
- Không auto-analyze theo autosave để tránh duplicate work và chi phí ngoài ý muốn.

### Character ownership and reuse

Character is a reusable identity owned at User/Workspace scope. A Project does not own Character identity directly; it owns a ProjectCharacter assignment. The same Character may participate in multiple Projects. Visual changes such as outfit, hairstyle, aging or injuries use CharacterAppearance/OutfitVersion instead of duplicate Characters. Generation snapshots resolved identity/version/reference data rather than resolving historical output by display name.

## 2. Phạm vi V1.10

### In scope target

- Google OIDC + email/password; backend giữ HttpOnly server session, CSRF và ownership enforcement. JWT access/refresh tokens are not the current browser runtime.
- Paste/import Chapter/story source, StoryVersion, semantic analysis và chunking cho nội dung ngắn/dài.
- Global reusable Character identity, ProjectCharacter assignment, CharacterVersion, CharacterAppearance, OutfitVersion, Location/Style context.
- Chapter-first navigation và execution: add/edit/continue Chapter theo nhiều đợt; mỗi Chapter có snapshot/progress riêng và không regenerate scope không bị ảnh hưởng.
- Storyboard Scene/VisualBeat; merge/split theo narration và semantic complexity.
- Image generation qua provider adapter với `ImageGenerationSettings`; approve/reject/regenerate và lưu immutable attempts.
- TTS narration, subtitle timing, basic pan/zoom/fade, browser animatic và FFmpeg scene/chapter/final render.
- Output ratio `16:9`, `9:16`, `1:1`, `4:3`, `3:4`; video quality Standard/High; FinalArtifact validation.
- Ranked ShortCandidate, ShortClip độc lập, mặc định 9:16, adaptive visual density.
- Durable parent job/stage/provider operation, retry/idempotency, `UNKNOWN`, reconciliation, lease/watchdog và atomic media finalization.
- Vertex AI Gemini cho planning/intelligence; provider capability adapters for future image/video stages.
- Operation planning, cost reservation, per-user attribution, resource ledger, delta/reuse planning và spending cap.
- Notification center + optional email delivery through durable event/outbox flow.
- Server-side entitlement, quota/credit, watermark, export/quality/concurrency enforcement.
- Input/output moderation, prompt-injection defense, real-person consent, identity privacy, abuse limit, report/review/takedown, audit và deletion lifecycle. Story/Chapter Analyze/Generate không yêu cầu blanket per-story copyright/rights-attestation checkbox.
- UI baseline `vi-VN`/`en-US`; domain lưu stable code/enum/message key.

### Out of scope

Full text-to-video cho toàn bộ thời lượng, lip-sync điện ảnh, 3D/mocap/Unreal, full Premiere/CapCut timeline editor, bắt buộc BYOK, tự kết luận bản quyền bằng LLM, và tách microservice theo tên bounded context ngay từ đầu.

## 3. Nguyên tắc độ dài, visual và Short

- Không giả định video luôn 60 phút, Chapter luôn 2.000 từ hoặc video luôn 150 ảnh.
- Scene boundary ưu tiên thay đổi ngữ nghĩa. Guardrail gợi ý: tối thiểu 8–10s, lý tưởng 18–30s, khoảng 40–45s là ngưỡng xem xét merge/split; đây là planner policy, không phải invariant domain.
- Long-form dùng prior khoảng 2,5 visual/phút với biên mềm; complexity, narration pace, motion need và asset reuse có thể làm mật độ tăng/giảm.
- Short có hard minimum 30s; mặc định 45–60s và có thể 60–90s khi cần kể trọn ý.
- Short phải chọn hook/conflict/reveal/emotion/payoff trọn ý, không cắt interval cố định. Ưu tiên crop/reframe approved asset; chỉ generate thêm khi source không phù hợp ratio mục tiêu.

## 4. Image settings và output profile

`ImageGenerationSettings` được resolve theo Project default rồi override ở VisualBeat/Shot:

- `aspect_ratio`: tối thiểu `16:9`, `9:16`, `1:1`, `4:3`, `3:4`, chỉ cho chọn capability provider/model đang hỗ trợ.
- `quality_tier`: `DRAFT`, `STANDARD` (default), `HIGH`; provider-agnostic, không đồng nghĩa trực tiếp pixel size.
- Attempt snapshot phải lưu requested ratio/tier và actual width/height.
- Nếu source ratio khác render ratio, phải chọn rõ crop/fit/pad/reframe; cấm silent stretch.

Render profile target:

| Ratio | Standard | High |
|---|---:|---:|
| 16:9 | 1280×720 | 1920×1080 |
| 9:16 | 720×1280 | 1080×1920 |
| 1:1 | 720×720 | 1080×1080 |
| 4:3 | 960×720 | 1440×1080 |
| 3:4 | 720×960 | 1080×1440 |

Long-form mặc định 16:9; Short mặc định 9:16, nhưng cả hai là configurable defaults. Video quality độc lập với image quality.

## 5. Cost / admission / operation plan

Mọi expensive operation phải có server-side admission trước khi paid provider work được phép chạy.

### Current Chapter Analyze foundation

Current implementation performs:

```text
persisted Chapter
  -> latest persisted safety decision gate
  -> storyAnalysis entitlement flag
  -> cost estimate from source size
  -> concurrent-expensive-job limit
  -> monthly credit check
  -> atomic PostgreSQL UsageWindow reservation
  -> OperationPlan with estimate min/max + maxAuthorizedCost
  -> GenerationJob + StageAttempt + OutboxEvent
```

This is an **MVP admission boundary**, not final billing. The current estimator is a simple source-size heuristic and reservation currently updates the usage window; full pricing-version snapshots, actual provider usage, append-only billing ledger, release/refund of unused authorization and reconfirmation after material scope changes remain target work.

### Target complete cost contract

1. Resolve affected Chapter scope, semantic complexity, narration/TTS, visual/motion plan, asset reuse, provider/model, quality and render profile.
2. Classify planned work such as `REUSE`, `REUSE_WITH_REFRAME`, `BASIC_MOTION`, `NEW_IMAGE`, `AI_VIDEO`.
3. Estimate range + confidence + pricing version; do not use fixed image count.
4. Reserve authorized/worst-case budget before billable submission.
5. Re-estimate after planning/provider resolution; require reconfirmation or pause when policy threshold/cap is exceeded.
6. Record actual usage and internal/billable cost separately; release unused reservation.

Edit chỉ tính incremental affected scope; project lifetime cost hiển thị riêng.

## 6. Entitlement và usage

Plan capability là versioned configuration, không rải hard-code trong UI/business code.

- Backend currently checks `storyAnalysis` entitlement, active expensive-job concurrency and monthly credits before Chapter Analyze enqueue.
- `UsageWindow` reservation is atomic in PostgreSQL for the current Chapter Analyze path.
- Final export quality/watermark/export-count enforcement remains part of the broader media/export target.
- UI capability display never grants authority; backend policy remains authoritative.

## 7. Trust, safety, privacy và deletion

Target canonical order:

```text
authentication/ownership
  -> source validation + account abuse controls
  -> applicable consent
  -> moderation / safety decision
  -> prompt-injection defense
  -> entitlement + cost admission
  -> provider
  -> schema/domain validation
  -> output moderation / review
  -> publish
```

Current Chapter Analyze admission checks the latest persisted moderation decision for the Chapter and rejects `BLOCK` or `REVIEW`. This is a useful safety boundary but **not complete moderation coverage**: automatic moderation creation, full policy/version handling, output moderation, real-person consent enforcement and broader abuse controls still require completion before public production.

- Story/chapter/character/prompt override là untrusted data; không được thay system policy, tool allowlist, owner/billing/storage path hay job authority.
- Import/analysis không yêu cầu per-story rights-attestation checkbox.
- Không kết luận public domain/licensed bằng LLM; dispute dùng report/review/evidence/takedown.
- `REAL_PERSON_REFERENCE` cần consent/use-right basis and private retention rules.
- Password login/register has application-layer Redis-backed abuse limiting; provider limiting/circuit breaking is a separate outbound concern.
- Xóa account/project là durable lifecycle target; backup/retention semantics must honor deletion policy.

## 8. Durability và concurrency

PostgreSQL is authoritative state. Redis provides session storage and non-authoritative delivery/progress hints; it is not the source of truth for GenerationJob execution.

Current Chapter Analyze durable flow:

```text
request
  -> authentication + ownership + Project/Chapter consistency
  -> idempotency lock/key
  -> persisted/current Chapter source snapshot
  -> safety + entitlement + cost/quota admission
  -> one transaction:
       UsageWindow reservation
       OperationPlan
       GenerationJob
       StageAttempt
       OutboxEvent
  -> COMMIT
  -> dispatcher publishes best-effort Redis hint outside long DB lock
  -> worker claim/lease/heartbeat
  -> ProviderOperation RESERVED persisted before external submit
  -> SUBMITTED/RUNNING/COMPLETED | FAILED | UNKNOWN
  -> UNKNOWN reconciliation before any blind resubmit
  -> snapshot check + transactional result materialization
```

Worker process concurrency is configurable (`WORKER_CONCURRENCY`, default 4, bounded 1..32) and graceful shutdown stops new claims before waiting for in-flight jobs.

Mutable entities use `row_version` / ETag / `If-Match` where exposed. Stale expected versions must fail rather than silently overwrite newer state.

## 9. Continuity materialization requirement

The structured AI response includes Characters, Locations and per-Scene character/location references. Current materialization persists Characters and Storyboard rows, but it currently drops Location and scene relationship data.

Required next continuity slice:

- resolve/materialize AI Location into project-scoped Location records;
- add/maintain Scene → Location reference;
- add/maintain Scene → ProjectCharacter relation using IDs, never character names as durable references;
- materialize these relations atomically with Scene/VisualBeat output under the same Chapter snapshot check;
- protect approved output with explicit reset/versioning semantics rather than destructive overwrite.

This is a P1 correctness gap because downstream image generation cannot guarantee character/environment continuity without durable scene relations.

## 10. Release acceptance gates

Target product gates:

```text
Chapter Persisted
  -> Chapter Parsed
  -> Characters/Continuity Reviewed
  -> Storyboard Approved
  -> Visual Ready
  -> Audio Ready
  -> Render Ready
  -> Final Artifact Valid
```

Before public beta, the system additionally needs complete moderation/consent/abuse coverage, continuity materialization, billing reconciliation, deletion workflow, backup/restore evidence, observability and real-provider E2E verification.

Chi tiết feature inventory nằm trong [FEATURE_CATALOG.md](FEATURE_CATALOG.md); business invariants nằm trong [../domain/BUSINESS_RULES.md](../domain/BUSINESS_RULES.md).
