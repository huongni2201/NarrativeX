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
| CharacterTemplate | Optional user/workspace-level template dùng để tạo Character mới; không phải runtime identity. |
| Global Character Hub | User/Workspace-scoped library của reusable Character identities. |
| Project Character Library | Project-scoped view của các ProjectCharacter assignments. |
| OutfitVersion | Phiên bản trang phục tách khỏi identity nhân vật. |
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
| ProviderOperation | Bản ghi durable của external submission, gồm provider identity, operation id, request/result fingerprint, reconciliation state và status; không phải billing ledger. |
| UNKNOWN | Chưa xác định external operation thành công/thất bại; không được blind resubmit. |
| FinalArtifact | Metadata của video cuối đã validate; bytes nằm trong local Desktop project artifact workspace. |
| RenderVersion | Một lần kết xuất final immutable; render lại tạo version mới. |
| RenderProfile | Preset output gồm aspect ratio, quality, width/height/FPS/bitrate và watermark policy. |
| Aspect Ratio | Tỉ lệ rộng:cao của image/video; capability provider quyết định khả dụng. |
| ImageGenerationSettings | Settings đã resolve gồm aspect ratio + image quality tier từ Project hoặc override. |
| Image Quality Tier | DRAFT/STANDARD/HIGH; abstraction provider-agnostic, không đồng nghĩa video 720p/1080p. |
| ShortCandidate | Timeline segment được highlight analyzer đề xuất/rank cho Short/Reel. |
| ShortClip | Video dọc độc lập từ ShortCandidate hoặc range user chọn. |
| OperationPlan | Kế hoạch durable xác định operation type/scope được backend authorize; không chứa monetary estimate, budget hay max-authorized-cost. |
| Affected Scope | Tập Chapter/Scene/Beat/Audio/Clip thực sự bị edit ảnh hưởng; dùng cho incremental work. |
| QuotaReservation | Reservation non-monetary cho capacity hoặc long-form export; completion consume reservation, failure/cancellation release reservation. |
| ResourceUsageRecord | Telemetry per job/stage về resource/provider execution khi cần observability; không phải user credit/billing ledger. |
| PlanEntitlement | Snapshot capability plan: watermark, max quality, exports, concurrency và feature flags. |
| UsageWindow | Counter theo kỳ dùng để enforce export quota và biết reset time; không chứa credit balance/credits-used accounting. |
| Optimistic Lock / row_version | Update chỉ thành công khi expected version khớp current; stale update nhận conflict. |
| ETag / If-Match | HTTP representation/version token truyền concurrency token giữa UI/backend. |
| Transactional Outbox | Event persist cùng business transaction rồi dispatch async, tránh mất notification event. |
| Notification | Persisted in-app event; email/web-push chỉ là delivery channel. |
| GPU Pool | Nhóm worker GPU cho self-hosted model/runtime, tách CPU workers; managed mode có thể scale 0. |
| Critical Media | Identity references và Approved Assets cần integrity/retention chặt; final MP4 vẫn nằm trong local project artifact workspace. |
| RPO / RTO | Recovery Point Objective / Recovery Time Objective: dữ liệu mất tối đa / thời gian khôi phục mục tiêu. |
| STALLED | Stage RUNNING mất lease/heartbeat; cần safe retry hoặc external reconciliation. |
| VideoGenerationAttempt | Attempt tạo MotionAsset bằng provider video tương lai với request/output snapshot và durable provider-operation lineage. |
| Moderation Decision | Provider/media or other applicable policy outcome SAFE/REVIEW/BLOCK + categories/provider signal/policy version; not a StoryVersion lifecycle field. |
| Story rights handling | NarrativeX không yêu cầu blanket per-story rights-attestation checkbox trước Analyze/Generate; report/review/takedown và nghĩa vụ pháp lý được xử lý như concern riêng. |
| REAL_PERSON_REFERENCE | Reference có người thật; cần consent/use-right basis và retention/privacy chặt hơn. |
| FICTIONAL_REFERENCE | Reference fictional/generated; áp policy khác REAL_PERSON_REFERENCE. |
| Identity Profile | Private identity template/embedding có tenant isolation, retention và deletion lifecycle. |
| Prompt Injection | Nội dung untrusted cố thay instruction/tool/ownership/policy; phải bị chặn bởi data boundary/schema/allowlist. |
| Affected-scope regeneration | Chỉ regenerate phần dependency bị thay đổi; phần unchanged được reuse. |
| Provider Capability Registry | Data/config mô tả mode, ratio, resolution, duration và health/capability của provider/model; không phải pricing catalog runtime. |
| Image-first | Dùng approved keyframe + deterministic motion làm mặc định; AI video chỉ selected beat. |
| Human-in-the-loop | AI đề xuất/generate nhưng user/admin duyệt tại các gate quan trọng. |
| Entitlement | Quyền tính năng/usage mà backend phải enforce; UI không thể tự cấp quyền. |
| Abuse Protection | Rate limit, burst/concurrency/fairness/anomaly controls ở account/API layer, tách provider quota. |
| Deletion Workflow | Quy trình durable chặn job, revoke URL, cleanup/quarantine, retention và audit thay cho DELETE đơn lẻ. |

## Canonical status vocabulary

`SAFE`, `REVIEW`, `BLOCK` là moderation outcomes. `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELED`, `UNKNOWN`, `STALLED` là generation job lifecycle. `RESERVED`, `SUBMITTED`, `RUNNING`, `UNKNOWN`, `COMPLETED`, `FAILED` thuộc provider operation theo contract tương ứng. `OUTDATED` chỉ snapshot không còn khớp dependency; không đồng nghĩa xóa. `RECONCILING` dùng ở workflow/projection khi cần xác định external outcome. `CONFLICT/STALE_VERSION` là optimistic concurrency failure.

`PAUSED_COST_LIMIT` đã bị loại khỏi runtime/schema/contracts cùng monetary billing cutover và không còn là status hợp lệ.

## Configuration vs invariant

Domain invariant: ownership, version snapshots, idempotency, no blind resubmit, no silent stretch, capacity/export-quota enforcement, immutable final artifacts, safety/privacy gates. Configuration/policy: scene duration guardrails, density priors, story limits, auth-rate-limit thresholds, retry/circuit thresholds và retention windows. Các policy snapshot version vào quyết định liên quan khi cần audit lịch sử.
