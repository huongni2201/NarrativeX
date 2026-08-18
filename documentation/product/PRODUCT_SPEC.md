# NarrativeX — Product Specification V1.8

**Trạng thái:** V1.8 product contract and maintained summary · 18/08/2026
**Source:** attached `NARRATIVEX_PROJECT_SPEC_V1_8.md`; current implementation status is tracked separately in `documentation/TRACEABILITY.md`.

 ## 1. Định vị và mục tiêu

 NarrativeX là **AI Long-form Story Video Studio**: biến truyện chữ có độ dài linh hoạt thành video image-first, rồi tái sử dụng timeline/assets để tạo Short/Reel. Sản phẩm tối ưu cho orchestration, character consistency, review và chi phí có thể dự đoán; đây không phải one-click full text-to-video.

Mục tiêu V1.8:

 - Chuyển story → detected Character identities → ProjectCharacter assignments → CharacterAppearance/Location → Chapter/Scene/VisualBeat → audio → animatic → render bền vững.
 - Giữ nhất quán nhân vật bằng Character Master, Character Bible, Reference Asset, CharacterVersion, Outfit/Location/Style Bible và Identity QA.
 - Cho phép regenerate theo affected scope, reuse asset và review batch thay vì chạy lại toàn project.
 - Đo và giới hạn chi phí theo `user → project → operation → job → stage`, có estimate range, reservation, spending cap và actual usage.
 - Đưa Trust & Safety, consent, prompt-injection defense, abuse protection, privacy/deletion, report/review/takedown và audit vào control plane trước public production.

 ### Character ownership and reuse

Character is a reusable identity owned at User/Workspace scope.

A Project does not own Character identity directly.
It owns a ProjectCharacter assignment.

The same Character may participate in multiple Projects.

Visual changes such as outfit, hairstyle, aging or injuries must use
CharacterAppearance/OutfitVersion instead of creating duplicate Characters.

Generation always snapshots resolved CharacterVersion,
CharacterAppearance, OutfitVersion and references.

## 2. Phạm vi V1.8

 ### In scope

 - Google OIDC; backend giữ HttpOnly server session, CSRF và project ownership. Password login/register có application-layer abuse limiting. JWT/accessToken/refreshToken chưa thuộc runtime hiện tại và được tách thành migration riêng sau.
 - Paste/import story, `StoryVersion`, semantic analysis và chunking cho nội dung ngắn/dài.
 - Global reusable Character identity, ProjectCharacter assignment, CharacterVersion, CharacterAppearance, Character Master, OutfitVersion, Project Bible, Location và Style Profile.
 - Storyboard Scene/VisualBeat/Shot; merge/split theo narration và semantic complexity.
 - Image generation qua provider adapter với `ImageGenerationSettings`; approve/reject/regenerate và lưu mọi attempt.
 - TTS narration, subtitle timing, basic pan/zoom/fade, browser animatic và FFmpeg scene/chapter/final render.
 - Output ratio `16:9`, `9:16`, `1:1`, `4:3`, `3:4`; video quality Standard/High; FinalArtifact validation.
 - Ranked ShortCandidate, ShortClip độc lập, mặc định 9:16, adaptive visual density.
 - Chapter-first navigation: add/edit/reorder/continue Chapter theo nhiều đợt; mỗi chapter inherit project snapshot và có progress/lifecycle riêng, không regenerate phần không bị ảnh hưởng.
 - Durable parent job/stage/provider operation, retry/idempotency, `UNKNOWN`, reconciliation, lease/watchdog và atomic media finalization.
 - Vertex AI Gemini cho planning/intelligence; image/video provider capability adapter; Veo/Kling contract sẵn sàng cho selected beats.
 - Operation planning, cost reservation, per-user attribution, resource ledger, delta/reuse planning và spending cap.
 - Notification center + email opt-in qua transactional outbox.
 - Server-side plan entitlement, quota/credit, watermark, export/quality/concurrency enforcement.
 - Input/output moderation, prompt-injection defense, real-person consent, identity privacy, abuse limit, report/review/takedown, audit và deletion lifecycle. Story Analyze/Generate không yêu cầu blanket per-story copyright/rights-attestation checkbox.
 - UI baseline `vi-VN`/`en-US`; domain lưu stable code/enum/message key.

 ### Out of scope

 Full text-to-video cho toàn bộ thời lượng, lip-sync điện ảnh, 3D/mocap/Unreal, full Premiere/CapCut timeline editor, bắt buộc BYOK, tự kết luận bản quyền bằng LLM, và tách microservice theo tên bounded context ngay từ đầu.

 ## 3. Nguyên tắc độ dài, visual và Short

 - Không giả định video luôn 60 phút, chapter luôn 2.000 từ hoặc video luôn 150 ảnh.
 - Scene boundary ưu tiên thay đổi ngữ nghĩa. Guardrail gợi ý: tối thiểu 8–10s, lý tưởng 18–30s, khoảng 40–45s là ngưỡng xem xét merge/split; đây là planner policy, không phải invariant của domain.
 - Long-form dùng prior khoảng 2,5 visual/phút, biên mềm 80–120%; complexity, narration pace, motion need và asset reuse có thể làm mật độ tăng/giảm.
 - Short có hard minimum 30s; mặc định 45–60s và có thể 60–90s khi cần kể trọn ý. Density tham chiếu khoảng 6/30s, 8–10/45s, 10–12/60s nhưng vẫn adaptive.
 - Short phải chọn hook/conflict/reveal/emotion/payoff trọn ý, không cắt interval cố định. Ưu tiên crop/reframe approved asset; chỉ generate thêm khi source không phù hợp 9:16.

 ## 4. Image settings và output profile

 `ImageGenerationSettings` được resolve theo Project default rồi override ở VisualBeat/Shot:

 - `aspect_ratio`: preset tối thiểu `16:9`, `9:16`, `1:1`, `4:3`, `3:4`, chỉ cho chọn capability provider/model đang hỗ trợ.
 - `quality_tier`: `DRAFT`, `STANDARD` (default), `HIGH`; đây là abstraction provider-agnostic, không đồng nghĩa 720p/1080p.
 - Attempt snapshot phải lưu requested ratio/tier và actual width/height. Provider adapter lưu resolved request/capability/pricing.
 - Nếu source ratio khác render ratio, phải chọn rõ crop/fit/pad/reframe; cấm silent stretch làm méo hình.

 Render profile chuẩn:

 | Ratio | Standard | High |
 |---|---:|---:|
 | 16:9 | 1280×720 | 1920×1080 |
 | 9:16 | 720×1280 | 1080×1920 |
 | 1:1 | 720×720 | 1080×1080 |
 | 4:3 | 960×720 | 1440×1080 |
 | 3:4 | 720×960 | 1080×1440 |

 Long-form mặc định 16:9; Short mặc định 9:16, nhưng cả hai là default có thể đổi. Video quality độc lập với image quality.

 ## 5. Cost/operation plan

 Mọi expensive operation (analyze, bulk image, TTS dài, render, AI video) phải tạo `OperationPlan` trước khi execute:

 1. Resolve affected scope và snapshot duration, semantic complexity, narration/TTS, visual/motion plan, asset reuse, provider/model, quality và render profile.
 2. Phân loại visual `REUSE`, `REUSE_WITH_REFRAME`, `BASIC_MOTION`, `NEW_IMAGE`, `AI_VIDEO`.
 3. Estimate theo range + confidence + ETA; không dùng fixed image count. Estimate gồm Vertex planning, image/video, TTS, CPU/GPU, storage/egress.
 4. Persist `CostReservation` và `max_authorized_cost` trước billable submission.
 5. Re-estimate sau Story Analyze, Visual Plan và provider resolution. Nếu vượt configurable threshold (baseline 20%) hoặc cap, chuyển `COST_RECONFIRMATION_REQUIRED`/`PAUSED_COST_LIMIT`.
 6. Ghi `ResourceUsageRecord` và append-only `usage_ledger` với `requested_by_user_id`, `billed_to_user_id`, internal cost và billable cost tách biệt; release phần reservation chưa dùng.

 Edit chỉ tính incremental affected scope; project lifetime cost hiển thị riêng. Managed provider có thể scale GPU pool về 0; self-hosted ComfyUI chỉ bật khi benchmark/cost telemetry chứng minh hợp lý.

 ## 6. Entitlement và usage

 Plan capability là snapshot cấu hình `PlanEntitlement`, không rải hard-code trong business code. Launch baseline:

 | Plan | Baseline |
 |---|---|
 | FREE | Watermark bắt buộc; tối đa Standard 720p; 1 long-form export/tháng; 3 Short export/tháng; 1 expensive job đồng thời; Image HIGH bị khóa |
 | PAID | Watermark, quality, export/month, concurrency và credits theo entitlement/version cấu hình |
 | ADMIN/INTERNAL | Có thể audited override cho support/testing nhưng vẫn ghi usage/audit; không bypass accounting |

 Backend kiểm tra entitlement/quota trước enqueue và trước final export. `UsageWindow` phải enforce atomically; UI chỉ hiển thị capability.

 ## 7. Trust, safety, privacy và deletion

 Luồng canonical: authentication/ownership → account abuse limit → real-person consent khi áp dụng → input moderation → prompt-injection defense → entitlement/cost → provider → schema/domain validation → output moderation → Identity QA/human review → approve/publish. Copyright/report/takedown là concern pháp lý/review riêng, không phải checkbox gate của Story Analyze/Generate.

 - Moderation chuẩn hóa `SAFE`/`REVIEW`/`BLOCK` + category + `policy_version`; sexual content involving minors là hard block.
 - Story/chapter/character/prompt override là untrusted data; không được thay system policy, tool allowlist, owner/billing/storage path hay job authority.
 - Import/story analysis không yêu cầu per-story rights-attestation checkbox. Tranh chấp dùng report/review/evidence/takedown; hệ thống không suy diễn license/public domain bằng LLM.
 - `REAL_PERSON_REFERENCE` cần consent/use-right basis; identity template/embedding private, tenant-isolated, không log/public manifest/cross-user reuse và có retention riêng.
 - Password login/register có Redis-backed application rate limit theo IP và identity+IP, trả `429` + `Retry-After` khi vượt ngưỡng. Broader account/session/IP/route/resource-class và concurrent-expensive-job controls vẫn cần trước paid provider work; tách biệt với provider limiter/circuit breaker.
 - Xóa account/project là durable workflow: chặn job mới, cancel/reconcile, revoke URL, xóa/expire derivatives và identity data, quarantine late result, cleanup storage theo retention; backup tuân expiry policy.

 ## 8. Durability và concurrency

 PostgreSQL là authoritative state; Redis chỉ queue/cache/progress/scheduling và transient abuse-control counters; binary ở MinIO/S3-compatible storage. Job dài chạy async. `ProviderOperation` phải reserve trước submit; outcome mơ hồ là `UNKNOWN`, tuyệt đối không blind resubmit. FinalArtifact chỉ `READY` sau validate storage/checksum/MIME/dimensions/manifest.

 Mutable entity dùng `row_version`/ETag/If-Match. Expected version không khớp trả `409 CONFLICT`/`STALE_VERSION`; không last-write-wins. LOCKED CharacterVersion, APPROVED Asset và completed RenderVersion là immutable snapshot; thay đổi tạo version/attempt mới.

 Render/Short terminal state ghi outbox event cùng transaction, persist in-app Notification rồi mới dispatch email theo preference. Email retry không tạo duplicate notification và không phụ thuộc browser còn mở.

 ## 9. Release acceptance gates

 Story Parsed → Characters Approved → Storyboard Approved → Visual Ready → Audio Ready → Render Ready → Final Artifact Valid. Short có thêm candidate duration/timeline/visual/subtitle readiness. Public beta cần auth/ownership, moderation, injection tests, real-person consent where applicable, report/review/takedown handling, abuse controls, deletion, cost/provider controls, backup/restore, observability và không còn P0/P1 safety/security blocker.

 Chi tiết ID đầy đủ nằm trong [FEATURE_CATALOG.md](FEATURE_CATALOG.md); luật bất biến nằm trong [../domain/BUSINESS_RULES.md](../domain/BUSINESS_RULES.md).
