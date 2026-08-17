 # NarrativeX V1.7 — Business Rules

 **Nguồn:** đặc tả V1.7 Production ngày 17/08/2026. Mọi threshold/plan default có chữ “baseline/default” là configuration có version; không hard-code trong aggregate hay UI.

 ## Story, identity và asset lifecycle

 - **BR-01** Mỗi Project có đúng một StoryVersion ACTIVE tại một thời điểm.
 - **BR-02** Character thuộc đúng một Project.
 - **BR-03** Character có nhiều CharacterVersion; chỉ ACTIVE/LOCKED dùng mặc định.
 - **BR-04** Lock không xóa version cũ.
 - **BR-05** Scene đã generate lưu CharacterVersion đã dùng.
 - **BR-06** Đổi CharacterVersion không ghi đè shot cũ; đánh dấu OUTDATED khi cần.
 - **BR-07** Shot có tối đa một primary image APPROVED, nhưng nhiều attempts.
 - **BR-08** Regenerate tạo attempt mới, không overwrite artifact cũ.
 - **BR-09** Project render chỉ bắt đầu khi mọi scene bắt buộc READY.
 - **BR-10** Job dài luôn async; HTTP không giữ đến khi AI hoàn tất.
 - **BR-11** Retry FAILED theo policy và idempotent theo job/attempt.
 - **BR-12** Binary không lưu trong PostgreSQL.
 - **BR-13** Delete Project soft-delete trước; physical cleanup bằng retention job.
 - **BR-14** Scene order unique trong Chapter; Shot order unique trong Scene.
 - **BR-15** Narration timing là duration mặc định nếu user không override.
 - **BR-16** Lưu resolved prompt và mọi reference/version snapshot để reproducible.
 - **BR-17** Provider/model nằm ngoài domain qua configuration/port.
 - **BR-18** Kiểm quota trước enqueue expensive job.
 - **BR-19** Cancel không xóa output đã hoàn tất.
 - **BR-20** Final render immutable; render lại tạo RenderVersion mới.
 - **BR-21** Chỉ owner/share được truy cập asset.
 - **BR-22** Transition job quan trọng có audit timestamp và error code khi fail.
 - **BR-23** Reference bắt buộc mất thì fail fast, không tự tạo nhân vật mới.
 - **BR-24** V1.7 image-first; AI video chỉ optional/selected theo capability, cost, quality.
 - **BR-25** Đổi scene order làm render hiện tại OUTDATED nhưng không xóa export.
 - **BR-26** Character Bible/Master ở Project, dùng lại xuyên chapter.
 - **BR-27** LOCKED CharacterVersion immutable identity/reference; thay đổi tạo version mới.
 - **BR-28** Outfit là entity/version riêng, không tạo Character mới.
 - **BR-29** VisualBeat là đơn vị generation chính; planner đề xuất, user merge/split.
 - **BR-30** GenerationAttempt lưu character/outfit/reference/workflow/model/resolved prompt snapshot.
 - **BR-31** Generation success không tự APPROVED; cần human review và/hoặc Identity QA.
 - **BR-32** Identity QA chỉ là tín hiệu hỗ trợ; similarity không bảo đảm tuyệt đối.
 - **BR-33** Regenerate beat/shot chỉ tác động đơn vị đó trừ khi user yêu cầu rộng hơn.
 - **BR-34** Location Bible và Style Profile được resolve vào beat liên quan.
 - **BR-35** Render chapter không làm đổi snapshot/reference của chapter đã render.
 - **BR-36** Multi-character phải chỉ rõ CharacterVersion từng nhân vật; region/inpaint là nâng cao.
 - **BR-37** V1.7 không bắt buộc train LoRA/adapter; reference conditioning phải hoạt động.

 ## Duration, Short và image/render settings

 - **BR-38** Không giả định 60 phút, 2.000 từ hay fixed image count; boundary/budget là policy/config.
 - **BR-39** Long-form prior khoảng 2,5 visual/phút với biên mềm 80–120%; complexity được tăng/giảm.
 - **BR-40** Semantic boundary ưu tiên hơn duration guardrail; không phá đoạn kể liền mạch.
 - **BR-41** Short hard minimum 30s, default 45–60s; dưới 45s chỉ khi hook/payoff đủ ý.
 - **BR-42** Short density tham chiếu 6/30s, 8–10/45s, 10–12/60s; adaptive theo complexity.
 - **BR-43** Short default 9:16; reuse asset nếu crop/reframe còn tốt.
 - **BR-44** Provider credentials server-side/secret store; không BYOK bắt buộc.
 - **BR-45** Auth là Spring Security + Google OIDC + HttpOnly session; không Keycloak.
 - **BR-52** Project có ImageGenerationSettings default: long-form 16:9 + STANDARD; Short 9:16 + STANDARD nếu chưa chọn.
 - **BR-53** Image ratio chỉ từ capability provider/model active.
 - **BR-54** Quality tier là DRAFT/STANDARD/HIGH provider-agnostic; adapter map và snapshot resolved option.
 - **BR-55** Attempt lưu requested ratio/tier và actual dimensions; Project default đổi không đổi asset cũ.
 - **BR-56** Beat/Shot có thể override ratio/tier; không override thì inherit; regenerate tạo attempt mới.
 - **BR-57** Ratio mismatch phải chọn crop/fit/pad/reframe; cấm silent stretch.
 - **BR-58** Quality tier không giả định pixel dimensions; actual dimensions phải persist.
 - **BR-59** RenderProfile resolve ratio + video quality thành dimensions encoder hợp lệ.
 - **BR-60** Output default 16:9/9:16 có thể đổi; manifest snapshot ratio/dimensions/reframe policy.
 - **BR-61** UI preview crop/fit/pad/reframe; cấm stretch.

 ## Provider durability, state và delivery

 - **BR-46** Persist ProviderOperation RESERVED/PENDING trước external request.
 - **BR-47** Outcome mơ hồ → UNKNOWN; không resubmit trước reconcile.
 - **BR-48** Provider operation id namespace theo provider.
 - **BR-49** Parent job chỉ COMPLETED khi required stages và FinalArtifact persist hợp lệ.
 - **BR-50** Final video width/height > 0 và lưu cùng metadata.
 - **BR-51** Storage key unique; duplicate phải quarantine, không silently drop.
 - **BR-62** StoryVersion mặc định reject ở 500.000 Unicode hoặc 120.000 estimated tokens, ngưỡng chạm trước; không âm thầm truncate.
 - **BR-63** Analyzer chunk target 12k–16k tokens, hard max 24k/provider call hoặc thấp hơn theo capability; overlap/summary versioned.
 - **BR-64** Beat/Shot tối đa 4 tracked named characters; >3 cảnh báo, >4 phải split/reframe/background.
 - **BR-67** Render/Short terminal transition tạo outbox event idempotent; persist notification trước email; email retry không duplicate.
 - **BR-82** Batch action dùng item-level result + optimistic concurrency; conflict item không rollback item hợp lệ.
 - **BR-83** Prompt tách auto_resolved, structured override, submitted; raw override không sửa LOCKED snapshot.
 - **BR-84** Character Library dùng template version + Project snapshot; update library không cascade.

 ## Entitlement, concurrency, cost và operations

 - **BR-65** Mutable update phải match row_version; mismatch → 409 CONFLICT/STALE_VERSION, không last-write-wins.
 - **BR-66** LOCKED CharacterVersion, APPROVED Asset, completed RenderVersion là immutable snapshot.
 - **BR-68** FREE launch config: watermark, Standard max, 1 long-form/tháng, 3 Short/tháng, 1 expensive job đồng thời; tất cả versioned/audited.
 - **BR-69** Entitlement/quota server-side trước enqueue và final export; client flag không bypass.
 - **BR-70** Estimate không phải invoice; snapshot inputs và ghi actual usage.
 - **BR-71** Dev/staging/prod tách DB, bucket root, Redis namespace, secrets; lower env không chứa unsanitized production data.
 - **BR-72** Usage/resource records append-only, multi-user và có attribution; không tạo bảng riêng từng user.
 - **BR-73** Job/OperationPlan lưu requested_by và billed_to; khác nhau phải audit.
 - **BR-74** internal_cost và billable_cost tách biệt.
 - **BR-75** Expensive operation phải có estimate range + pricing/rate version trước enqueue.
 - **BR-76** Không dùng “1 giờ = 150 ảnh”; visual count từ duration + complexity + importance + reuse.
 - **BR-77** Edit chỉ execute/charge affected scope; unchanged dependency được reuse.
 - **BR-78** Reuse planning chạy trước cost estimator; REUSE/REFRAME/BASIC_MOTION không tính new image call.
 - **BR-79** Reservation giữ authorized/worst-case; finalize actual và release phần dư.
 - **BR-80** Nếu actual + next estimate vượt cap → PAUSED_COST_LIMIT.
 - **BR-81** Re-estimate tăng >20% baseline hoặc vượt cap → COST_RECONFIRMATION_REQUIRED; threshold configurable.
 - **BR-85** Gemini production qua Vertex AI adapter, ADC/workload identity; credential không qua browser.
 - **BR-86** Capability là data/config; domain không branch theo tên Veo/Kling.
 - **BR-87** Beat có KeyframeAsset/MotionAsset; motion approved/ready ưu tiên, fallback basic motion.
 - **BR-88** AI video phải xét motion necessity, impact, capability, budget, keyframe.
 - **BR-89** VideoGenerationAttempt immutable; đổi provider tạo attempt mới.
 - **BR-90** AUTO fallback không vượt cap và phải được policy cho phép.
 - **BR-91** GPU_HEAVY mặc định tối đa 1 workflow/GPU; tăng chỉ sau benchmark.
 - **BR-92** Scheduler áp dụng per-user fairness trong priority/resource class.
 - **BR-93** Retry: provider 5xx/408/network initial+2; 429 tối đa 3 theo backoff; invalid structured output tối đa 2 repair; auth/billing/permission/rejection/ambiguous submit không auto retry/resubmit.
 - **BR-94** Circuit key provider+model+capability+location/account; baseline mở sau 5 retryable liên tiếp hoặc >=50%/20 request; auth/billing/permission pause ngay.
 - **BR-95** Heartbeat baseline 30s; lease khoảng 120s không renew → STALLED; phân biệt local retry và external reconcile.
 - **BR-96** FinalArtifact chỉ reference immutable object đã validate; temp không READY.
 - **BR-97** Attempt cũ/rejected không overwrite; metadata lâu dài, media theo hot/cold/archive lifecycle.

 ## Trust & Safety, rights, privacy và deletion

 - **BR-98** Safety/abuse chạy trước reservation/provider submission khi có thể; BLOCK/rate-limited không tiêu paid work.
 - **BR-99** Story/chapter/character/prompt là untrusted; không đổi policy, tools, billing/ownership/storage/job authority.
 - **BR-100** Sexual content involving minors/sexualization of minors là hard block, không ordinary override.
 - **BR-101** Provider filter chỉ defense-in-depth; app normalize SAFE/REVIEW/BLOCK + policy_version.
 - **BR-102** Active rights attestation là prerequisite Analyze/Generate; không phải proof ownership tuyệt đối.
 - **BR-103** Không kết luận public domain/licensed bằng LLM; dispute qua report/review/evidence/takedown.
 - **BR-104** REAL_PERSON_REFERENCE cần consent/use-right; revoke dừng generation tương lai và expire/delete derivatives.
 - **BR-105** Identity embedding/template private per-user/per-project; không log/analytics/error/public manifest/cross-tenant reuse.
 - **BR-106** Delete Project/Account idempotent, durable; late external result quarantine/expire, không reattach deleted owner.
 - **BR-107** Account rate limit khác provider limit; quota/credit không thay abuse policy.
 - **BR-108** AI audit đủ tái hiện kỹ thuật; raw sensitive prompt/reference chỉ giữ theo retention, không vô hạn.
 - **BR-109** Localized label/message không phải state; DB lưu enum/code/message_key.
 - **BR-110** REVIEW không tự thành SAFE vì provider success; publishable cần policy decision độc lập.
 - **BR-111** Reference phải ghi rõ REAL_PERSON_REFERENCE hay FICTIONAL_REFERENCE để áp đúng retention/consent.
 - **BR-112** Safety/security/rights/consent policy version phải snapshot vào quyết định để audit lịch sử.
