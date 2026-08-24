# NarrativeX V1.11 — Glossary

 | Thuật ngữ | Định nghĩa |
 |---|---|
 | StoryVersion | Phiên bản nội dung truyện đã nhập/chỉnh; một version ACTIVE trên Project tại một thời điểm. |
 | Character Bible | Hồ sơ nhận diện ổn định của nhân vật. |
 | CharacterVersion | Immutable snapshot của Character Bible và approved reference assets. |
 | Reference Asset | Ảnh dùng làm điều kiện tham chiếu cho AI. |
 | Identity Anchor | Reference asset role được chọn làm reference ưu tiên cho CharacterVersion; không phải một cột master-asset riêng. |
 | Character | Canonical reusable character identity thuộc User/Workspace; có thể tham gia nhiều Project. |
| ProjectCharacter | Assignment của Character vào một Project; giữ role và metadata riêng của story/project. |
| CharacterAppearance | Visual state của Character trong một khoảng story/timeline; không phải identity mới. |
| SceneCharacter | Character participation trong một Scene; tham chiếu ProjectCharacter và scene-specific state. |
| CharacterTemplate | Optional template dùng để tạo Character mới; không phải runtime identity và không bắt buộc clone mỗi Project. |
| Global Character Hub | User/Workspace-scoped library của reusable Character identities. |
| Project Character Library | Project-scoped view của các ProjectCharacter assignments. |
 | OutfitVersion | Phiên bản trang phục tách khỏi identity nhân vật. |
 | CharacterTemplate | Nhân vật reusable ở user-level library; Project import thành snapshot. |
| Project Bible | Project-scoped snapshot/assignments của ProjectCharacter, Location, Outfit, Style và generation settings dùng xuyên chapter. |
 | Scene | Đơn vị nội dung storyboard có narration và duration. |
 | Shot | Khái niệm camera/timeline finer-grained tùy workflow; không bắt buộc tách semantics khỏi VisualBeat. |
 | VisualBeat | Khoảng narration/timeline có visual intent ổn định; đơn vị generation chính long-form. |
 | GenerationAttempt | Một lần generate cụ thể, lưu prompt/model/seed/settings/output. |
 | Approved Asset | Asset được user chọn làm output chính cho beat/shot. |
 | KeyframeAsset | Approved image/source visual cho still/basic motion hoặc image-to-video. |
 | MotionAsset | Visual motion playable: deterministic FFmpeg hoặc AI-generated clip. |
 | Resolved Prompt | Prompt cuối sau khi ghép context, constraints, system template và override. |
 | Identity QA | Bước chấm/flag identity so với reference snapshot; không thay human approval. |
 | StageAttempt | Attempt persisted của một stage trong parent job, có lifecycle retry/recover riêng. |
 | ProviderOperation | Bản ghi durable của external submission, gồm provider identity, operation id và status. |
 | UNKNOWN | Chưa xác định external operation thành công/thất bại; không được blind resubmit. |
 | FinalArtifact | Metadata của video cuối đã validate storage/MIME/dimensions/manifest; bytes nằm trong Google Drive production hoặc local final storage ở E2E deterministic. |
 | RenderVersion | Một lần kết xuất final immutable; render lại tạo version mới. |
 | RenderProfile | Preset output gồm aspect ratio, quality, width/height/FPS/bitrate. |
 | Aspect Ratio | Tỉ lệ rộng:cao của image/video; capability provider quyết định khả dụng. |
 | ImageGenerationSettings | Settings đã resolve gồm aspect ratio + image quality tier từ Project hoặc override. |
 | Image Quality Tier | DRAFT/STANDARD/HIGH; abstraction provider-agnostic, không đồng nghĩa video 720p/1080p. |
 | ShortCandidate | Timeline segment được highlight analyzer đề xuất/rank cho Short/Reel. |
 | ShortClip | Video dọc độc lập từ ShortCandidate hoặc range user chọn. |
 | OperationPlan | Kế hoạch operation gồm affected scope, estimate range/confidence, visual/motion actions và budget. |
 | Affected Scope | Tập Chapter/Scene/Beat/Audio/Clip thực sự bị edit ảnh hưởng; dùng cho incremental work. |
 | CostReservation | Budget/credit giữ trước expensive operation, rồi reconcile/release theo actual. |
 | ResourceUsageRecord | Telemetry per job/stage: GPU/CPU/provider/storage/egress và internal/billable cost. |
 | Internal Cost | Chi phí thực hệ thống chịu từ provider/GPU/CPU/storage. |
 | Billable Cost | Chi phí/credit policy quyết định charge user; có thể khác Internal Cost. |
 | PlanEntitlement | Snapshot capability plan: watermark, max quality, exports, concurrency, features. |
 | UsageWindow | Counter theo kỳ dùng để enforce export/credit/quota atomically và biết reset time. |
 | Optimistic Lock / row_version | Update chỉ thành công khi expected version khớp current; stale update nhận conflict. |
 | ETag / If-Match | HTTP representation/version token truyền concurrency token giữa UI/backend. |
 | Transactional Outbox | Event persist cùng business transaction rồi dispatch async, tránh mất notification event. |
 | Notification | Persisted in-app event; email/web-push chỉ là delivery channel. |
 | GPU Pool | Nhóm worker GPU cho self-hosted ComfyUI/model, tách CPU workers; managed mode có thể scale 0. |
 | Critical Media | Identity references, Approved Assets, FinalArtifacts cần RPO/RTO chặt hơn attempts. |
 | RPO / RTO | Recovery Point Objective / Recovery Time Objective: dữ liệu mất tối đa / thời gian khôi phục mục tiêu. |
 | STALLED | Stage RUNNING mất lease/heartbeat; cần safe retry hoặc external reconciliation. |
 | PAUSED_COST_LIMIT | Operation tạm dừng vì stage billable tiếp theo có thể vượt max authorized spend. |
 | VideoGenerationAttempt | Attempt tạo MotionAsset bằng Veo/Kling/provider tương lai với request/cost/output snapshot. |
 | Moderation Decision | Application outcome SAFE/REVIEW/BLOCK + categories/provider signal/policy version. |
 | Story rights handling | NarrativeX không yêu cầu blanket per-story rights-attestation checkbox trước Analyze/Generate; report/review/takedown và nghĩa vụ pháp lý được xử lý như concern riêng. |
 | REAL_PERSON_REFERENCE | Reference có người thật; cần consent/use-right basis và retention/privacy chặt hơn. |
 | FICTIONAL_REFERENCE | Reference fictional/generated; áp policy khác REAL_PERSON_REFERENCE. |
 | Identity Profile | Private identity template/embedding có tenant isolation, retention và deletion lifecycle. |
 | Prompt Injection | Nội dung untrusted cố thay instruction/tool/ownership/policy; phải bị chặn bởi data boundary/schema/allowlist. |
 | Usage Ledger | Append-only record resource/credit/cost theo user/project/operation/job/stage. |
 | Affected-scope regeneration | Chỉ regenerate phần dependency bị thay đổi; phần unchanged được reuse. |
 | Provider Capability Registry | Data/config mô tả mode, ratio, resolution, duration, pricing và health của provider/model. |
 | Image-first | Dùng approved keyframe + deterministic motion làm mặc định; AI video chỉ selected beat. |
 | Human-in-the-loop | AI đề xuất/generate nhưng user/admin duyệt tại các gate quan trọng. |
 | Entitlement | Quyền tính năng/usage mà backend phải enforce; UI không thể tự cấp quyền. |
 | Abuse Protection | Rate limit, burst/concurrency/fairness/anomaly controls ở account/API layer, tách provider quota. |
 | Deletion Workflow | Quy trình durable chặn job, revoke URL, cleanup/quarantine, retention và audit thay cho DELETE đơn lẻ. |

 ## Canonical status vocabulary

 `SAFE`, `REVIEW`, `BLOCK` là moderation outcomes. `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELED` là job lifecycle. `RESERVED`, `SUBMITTED`, `UNKNOWN` thuộc provider operation. `OUTDATED` chỉ snapshot không còn khớp dependency; không đồng nghĩa xóa. `RECONCILING` dùng khi cần xác định external outcome. `CONFLICT/STALE_VERSION` là optimistic concurrency failure.

 ## Configuration vs invariant

 Domain invariant: ownership, version snapshots, idempotency, no blind resubmit, no silent stretch, cap enforcement, immutable final artifacts, safety/privacy gates. Configuration/policy: scene duration guardrails, density priors, story limits, auth-rate-limit thresholds, 20% re-estimate threshold, FREE limits, retry/circuit thresholds, retention windows và pricing. Các policy luôn snapshot version vào quyết định liên quan khi cần audit lịch sử.
