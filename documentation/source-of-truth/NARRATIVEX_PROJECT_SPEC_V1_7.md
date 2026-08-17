**AI STORY VIDEO STUDIO  |  PROJECT SPECIFICATION**

**NARRATIVEX**

AI Story Video Studio - Nền tảng tạo video truyện dài image-first và Short/Reel từ văn bản với nhân vật nhất quán

**PROJECT SPECIFICATION & SOFTWARE DESIGN DOCUMENT**

\


|**Loại tài liệu**|Đặc tả dự án / Software Design Document|
| :- | :- |
|Kiến trúc hiện tại|Next.js + Spring Boot 4.1 Modular Monolith + Python 3.12 AI/Media Worker + Vertex AI + Trust/Safety Control Plane|
|**Lĩnh vực**|Generative AI / Storytelling / Media Processing|
|Phiên bản|1\.7 - Production Specification|
|Ngày|17/08/2026|

Mục tiêu: chuyển truyện chữ có độ dài linh hoạt thành video dài image-first và Short/Reel với nhân vật nhất quán; chi phí có thể dự đoán/giới hạn theo từng user-operation; dùng Gemini trên Vertex AI cho intelligence/planning; mở rộng AI video qua Veo/Kling; đồng thời enforce moderation, prompt-injection defense, privacy, copyright attestation, account abuse controls và data lifecycle trước public production.

**TÓM TẮT ĐIỀU HÀNH**

NarrativeX là nền tảng web chuyển truyện chữ thành video dài theo pipeline có kiểm soát. Hệ thống không giả định video luôn 60 phút hoặc chapter luôn 2.000 từ. Nội dung được phân tích theo Project → StoryVersion → Chapter → Scene → VisualBeat, sau đó sinh/duyệt hình ảnh, tạo narration/subtitle và ghép bằng FFmpeg. Visual density được điều chỉnh theo độ phức tạp nội dung thay vì hard-code theo số câu hoặc số từ.

Giá trị cốt lõi nằm ở orchestration, consistency và durability: Character Master + Character Bible + Reference Assets + CharacterVersion + Outfit/Location/Style Bible + Identity QA, cùng GenerationAttempt/StageAttempt/ProviderOperation có snapshot đầy đủ. PostgreSQL là nguồn sự thật cho state; provider reservation phải được persist trước khi submit; kết quả mơ hồ được giữ ở UNKNOWN để tránh submit trùng; FinalArtifact chỉ được công nhận khi metadata và file hợp lệ.

Trong NarrativeX v1.7, Trust & Safety là một control plane bắt buộc, không phải bước hậu kiểm tùy chọn: story/reference input được kiểm duyệt trước AI planning; story text luôn được coi là untrusted data để chống prompt injection; generated prompt/media được kiểm tra lại trước khi publish; quyền sử dụng nội dung và consent cho real-person reference được lưu có version; account-level rate limit đứng trước quota/cost reservation; identity data, AI audit trail và deletion lifecycle có retention rõ ràng.

|Quyết định kiến trúc chính<br>• Core business vẫn là Spring Boot Modular Monolith; Python Worker tách riêng cho AI/media.<br>• Gemini production chạy qua Vertex AI (Google Cloud project/location + workload identity/ADC), không dùng AI Studio API key làm production contract.<br>• PostgreSQL là authoritative state; Redis dùng queue/cache/progress/scheduling chứ không thay DB.<br>• Mọi expensive operation có cost plan, budget reservation, max authorized spend và actual usage attribution theo billed\_to\_user\_id.<br>• Cost planning dựa trên duration + semantic complexity + affected delta + reusable assets + provider/model, không dựa trên số ảnh cố định.<br>• Image-first là mặc định; AI video là MotionAsset chọn lọc. VideoGenerationProvider hỗ trợ Vertex Veo, Kling và provider tương lai qua capability adapter.<br>• Runtime production dùng real provider adapters; fake provider chỉ cho deterministic test/dev.<br>• Character là reusable User/Workspace identity; Project chỉ giữ ProjectCharacter assignment và generation snapshot đã resolve.|
| :- |

**Phạm vi V1.7**

- Đăng nhập bằng Google OIDC; backend quản lý session HttpOnly và ownership project.
- Nhập/paste truyện, lưu StoryVersion và hỗ trợ nội dung ngắn/dài mà không giả định một thời lượng cố định.
- Phân tích story thành Character, Location, Chapter, Scene và VisualBeat theo ngữ nghĩa.
- Sinh Character Bible/reference, cho phép approve/lock CharacterVersion và tái sử dụng xuyên chapter.
- Sinh storyboard/visual beats, generate ảnh theo provider adapter, cho phép chọn tỉ lệ khung hình và chất lượng ảnh theo Project hoặc override từng VisualBeat/Shot; review/regenerate chọn lọc và giữ toàn bộ attempt cũ.
- Tạo narration bằng TTS, subtitle theo timeline và motion cơ bản (pan/zoom/fade).
- Render MP4 bằng FFmpeg với Output Aspect Ratio có thể chọn 16:9, 9:16, 1:1, 4:3 hoặc 3:4; preset video Standard/High tự map geometry theo ratio. Chất lượng video độc lập với quality tier của ảnh nguồn.
- Theo dõi durable job/stage/provider operation, xử lý retry/idempotency/UNKNOWN và lưu asset vào MinIO/S3-compatible storage.
- Tự đề xuất Short/Reel từ đoạn nổi bật, dựng 9:16 với visual density cao hơn long-form và export độc lập.
- Production baseline gồm môi trường dev/staging/prod tách biệt, CI/CD có quality gate, migration/rollback, backup/PITR và disaster-recovery targets.
- Long-running render/generation có notification center và email opt-in; người dùng không cần giữ tab mở hoặc tự poll liên tục.
- Business entitlement được enforce server-side: Free tier có watermark/quality/export/concurrency limits; paid tier dùng cấu hình entitlement + credit/quota.
- Self-hosted ComfyUI dùng GPU pool riêng có capacity/cost accounting và autoscaling; nếu dùng managed image/video provider thì GPU pool có thể scale về 0.
- Gemini cho story/scene/visual/prompt/highlight planning chạy qua Vertex AI; credentials dùng workload identity/ADC và provider configuration server-side.
- Mọi job tốn tài nguyên được lập OperationPlan: estimate theo range, reserve budget/credits, enforce max authorized spend, re-estimate sau stage lớn và ghi actual internal/billable cost theo user/project/job/stage.
- Cost estimator không dùng quy tắc “1 giờ = 150 ảnh”; số visual/new generation được tính động theo duration, semantic complexity, motion need, asset reuse và phạm vi thay đổi (delta).
- Visual Review hỗ trợ batch approve/reject/regenerate; user có thể xem/override prompt trước khi submit và chạy browser animatic trước final render.
- Character Library giữ reusable User/Workspace-owned Character identities; Project dùng qua ProjectCharacter assignments. CharacterVersion/appearance/outfit snapshots dùng cho reproducible generation và không auto-update historical generation snapshots.
- AI video mở rộng qua VideoGenerationProvider. Veo/Kling chỉ tạo MotionAsset cho beat đáng animate; final pipeline vẫn dùng KeyframeAsset + MotionAsset + FFmpeg.
- UI hỗ trợ i18n baseline vi-VN/en-US; domain lưu stable code/locale-neutral state, không lưu text giao diện tiếng Việt trực tiếp trong business state.
- Account/IP/API abuse protection dùng rate limit + concurrency + anomaly signals riêng với quota/cost entitlement; request bị throttle trước khi tạo paid provider operation.
- Real-person reference/identity processing yêu cầu consent, tenant isolation, restricted retention và cascade deletion; identity template/embedding không được log hoặc tái sử dụng chéo user.
- Story import yêu cầu rights attestation; hệ thống có copyright report/takedown workflow thay vì cố đoán quyền sở hữu bằng LLM.
- Trust & Safety gate nhiều lớp: input moderation -> prompt/injection checks -> provider safety -> output moderation -> human review khi cần.

**Quy mô xử lý khuyến nghị cho V1.7**

- Character/Location/Style Bible được quản lý ở cấp Project để tái sử dụng xuyên nhiều chapter và render version.
- Chapter chỉ là processing/editing boundary; độ dài story/video có thể thay đổi. Không dùng quy tắc “2.000 từ = X ảnh” hoặc “mỗi video = 60 phút”.
- Scene được tách theo thay đổi ngữ nghĩa (địa điểm, thời gian, nhân vật, sự kiện, cảm xúc, hội thoại/reveal). Guardrail gợi ý: tối thiểu 8–10s, lý tưởng 18–30s, tối đa khoảng 40–45s trước khi merge/split.
- Long-form có thể dùng baseline tham chiếu khoảng 2,5 visual/phút nhưng đây chỉ là prior cho planner, không phải cost input hoặc hard target. Planner tính visual budget theo từng scene từ duration + semantic complexity + narration pace + existing asset reuse; cùng một video 2 giờ có thể cần số visual rất khác tùy nội dung.
- Short có hard minimum 30s; mặc định 45–60s, ưu tiên không dưới 45s khi nội dung cho phép; có thể 60–90s cho đoạn cần kể trọn ý.
- Short cần mật độ hình cao hơn: khoảng 6 visual/30s, 8–10 visual/45s, 10–12 visual/60s; scene đơn giản được giảm ảnh theo adaptive complexity.

**Không thuộc V1.7**

- Tự động kết luận một story có bản quyền hay không chỉ dựa trên LLM/text similarity; V1.7 dùng rights attestation + report/review/takedown workflow.
- Full text-to-video cho toàn bộ thời lượng; V1.7 vẫn image-first và chỉ dùng image-to-video chọn lọc.
- Lip-sync/phim hội thoại liên tục ở mức điện ảnh.
- 3D, motion capture, Unreal Engine pipeline.
- Full timeline editor tương đương Premiere/CapCut.
- Phân rã full microservices theo bounded context ngay từ đầu.
- BYOK bắt buộc cho người dùng; V1.7 dùng app-owned provider credentials và credit/quota.

**CẤU TRÚC TÀI LIỆU**

- 1. Bối cảnh và bài toán
- 2. Mục tiêu, phạm vi và đối tượng sử dụng
- 3. Quy trình nghiệp vụ end-to-end
- 4. Yêu cầu chức năng
- 5. Business Rules
- 6. Use Cases chi tiết
- 7. Kiến trúc hệ thống
- 8. Thiết kế domain và dữ liệu
- 9. AI Pipeline và Character Consistency
- 10. Job Queue và xử lý bất đồng bộ
- 11. API Design
- 12. Frontend UX / màn hình chính
- 13. Công nghệ và công cụ phát triển
- 14. Cấu trúc source code
- 15. Bảo mật, hiệu năng và vận hành
- 16. MVP, tiêu chí nghiệm thu và roadmap
- 17. Rủi ro và phương án giảm thiểu
- 18. Kế hoạch kiểm thử
- 19. Phụ lục thuật ngữ và trạng thái
- 20. Tin cậy, an toàn, quyền riêng tư và quản trị nền tảng
- 21. Giả định triển khai, nhân sự, tiến độ và ngân sách

**1. BỐI CẢNH VÀ BÀI TOÁN**

**1.1. Bài toán**

Người sáng tạo nội dung có thể sở hữu một truyện dài nhưng thiếu thời gian, kỹ năng đồ họa hoặc nguồn lực dựng video. Nếu tạo ảnh AI từng cảnh một cách thủ công, các nhân vật dễ thay đổi khuôn mặt, tóc, trang phục và tỷ lệ cơ thể giữa các ảnh. Khi số lượng cảnh tăng lên hàng chục hoặc hàng trăm, việc quản lý prompt, ảnh tham chiếu, voice, subtitle và timeline trở nên khó kiểm soát.

**1.2. Vấn đề cần giải quyết**

|**Vấn đề**|**Hệ quả**|**Cách hệ thống xử lý**|
| :-: | :-: | :-: |
|Character inconsistency|Cùng một nhân vật nhưng mặt/trang phục thay đổi giữa scene|Character Bible + Reference Asset + Character Version + consistency pipeline|
|Truyện dài|Không thể tạo một lần thành video dài ổn định|Chia Chapter → Scene → Shot và render theo từng đơn vị|
|Generation lâu|HTTP request bị timeout, khó retry|Async Job Queue + Worker + progress tracking|
|Chi phí AI|Sinh lại toàn bộ video rất tốn kém|Regenerate theo scene/shot; image-first ở V1|
|Khó chỉnh sửa|Kết quả one-click không kiểm soát được|Human-in-the-loop: duyệt nhân vật, storyboard, scene trước render|
|Quản lý file|Nhiều ảnh/audio/video phát sinh|Asset metadata trong DB; binary ở MinIO/S3|
|Độ dài video không cố định|Rule cố định theo 60 phút/2.000 từ làm lệch scene và chi phí|Semantic segmentation + adaptive scene/visual budget|
|Provider trả kết quả mơ hồ|Retry mù có thể double-submit/double-charge|Persist reservation trước submit; UNKNOWN + reconciliation|
|Tạo Short thủ công|Tốn thời gian chọn đoạn và dựng lại khung dọc|Highlight selection + 9:16 recompose + adaptive visual density|
|Chi phí multi-user không cô lập|Không biết user/job nào làm tăng hóa đơn Vertex/GPU|Per-user OperationPlan + UsageLedger + ResourceUsageRecord + budget reservation/spending cap|
|Edit nhỏ nhưng chạy lại toàn project|Tốn provider/GPU/render không cần thiết|Affected Scope + dependency snapshot + incremental regeneration/render|
|AI video provider thay đổi|Veo/Kling capability/pricing khác nhau, dễ khóa domain|VideoGenerationProvider + capability registry + MotionAsset abstraction|
|Duyệt hàng trăm visual|Approve từng ảnh gây mệt và chậm|Visual Review Grid + batch action + identity-risk filters|

**1.3. Định vị sản phẩm**

Sản phẩm được định vị là “AI Long-form Story Video Studio” thay vì “Text-to-Video Generator”. Hệ thống giúp người dùng đi từ story đến storyboard và video, nhưng vẫn giữ khả năng kiểm soát, chỉnh sửa và regenerate theo từng tầng.

**2. MỤC TIÊU, PHẠM VI VÀ ĐỐI TƯỢNG SỬ DỤNG**

**2.1. Mục tiêu nghiệp vụ**

- Giảm thời gian chuyển một truyện chữ thành storyboard/video.
- Duy trì nhân vật nhất quán xuyên suốt toàn bộ project.
- Cho phép người dùng kiểm soát kết quả AI thay vì phụ thuộc one-click generation.
- Tái sử dụng character/location/style giữa nhiều scene.
- Giảm chi phí bằng image-first, visual density thích ứng và chỉ dùng AI video ở visual beat thực sự cần chuyển động.
- Tái sử dụng story/timeline/assets đã duyệt để tạo Short/Reel hấp dẫn mà không phải dựng lại toàn bộ từ đầu.
- Cô lập và đối soát chi phí theo từng user → project → operation → job → stage để một user không làm chi phí provider/GPU của user khác bị mất dấu.
- Tối ưu compute bằng delta regeneration, asset reuse, browser animatic, scene-parallel render và AI-video selection theo motion value/cost.

**2.2. Đối tượng sử dụng**

|**Actor**|**Mô tả**|**Quyền chính**|
| :-: | :-: | :-: |
|Creator|Người tạo video truyện|Tạo project, nhập truyện, duyệt nhân vật, storyboard, render/export|
|Editor|Thành viên chỉnh sửa project (V2)|Chỉnh scene/prompt/asset nhưng không quản trị billing|
|Admin|Quản trị hệ thống|Quản lý user, job lỗi, model/provider, quota và audit|
|AI Worker|Tác nhân hệ thống|Xử lý story/image/audio/render job|

**2.3. Quy mô, độ dài và visual budget V1.7**

V1.7 áp dụng giới hạn mềm theo quota, duration và complexity chứ không gắn cứng với một độ dài truyện hoặc số ảnh. Chapter có thể chunk theo context/provider; scene/visual beat được quyết định từ nội dung và narration timing. Baseline ~2,5 visual/phút chỉ là prior để khởi tạo planner. Cost/visual plan cuối cùng phải dựa trên từng scene, reuse/delta và quality/provider đã chọn. Short dùng preset riêng với visual density cao hơn nhưng vẫn adaptive.

**2.4. Mô hình sử dụng và entitlement baseline**

V1 dùng mô hình credit/quota cho các thao tác AI tốn tài nguyên, kết hợp PlanEntitlement để kiểm soát watermark, chất lượng export, số export và số job tốn tài nguyên chạy đồng thời. Giá tiền cụ thể không hard-code trong domain; entitlement có thể thay đổi mà không sửa business code. Các con số dưới đây là launch defaults cho production validation, không phải cam kết giá bán lâu dài.

|**Plan**|**Export / watermark baseline**|**Quality & concurrency baseline**|
| :-: | :-: | :-: |
|FREE|1 long-form export/tháng + 3 Short exports/tháng; watermark bắt buộc trên mọi final export.|Video tối đa STANDARD 720p; Image HIGH bị khóa; tối đa 1 expensive generation/render job đang hoạt động.|
|PAID (Creator/Pro)|Không watermark khi entitlement cho phép; số export/tháng do cấu hình plan + credit/quota quyết định.|Cho phép HIGH/1080p theo entitlement; concurrent expensive jobs và monthly credits cấu hình theo plan.|
|ADMIN / INTERNAL|Không dùng để bypass usage accounting; mọi thao tác vẫn ghi usage/audit.|Có thể override cho support/testing bằng audited permission, không từ client-side flag.|

**3. QUY TRÌNH NGHIỆP VỤ END-TO-END**

User\
`  `↓\
Google OIDC Login / Existing Session\
`  `↓\
Create Project + Add first Chapter (Paste/Import Story)\
`  `↓\
Vertex AI Gemini Story Analysis\
`  `↓\
Characters / Locations / Chapters / Scenes\
`  `↓\
Project Bible + Character Master/Versions\
`  `↓\
Visual + Motion Planning\
`  `↓\
Asset Reuse / Affected Scope / Cost Plan\
`  `↓\
Estimate Range + Max Authorized Spend → User Confirm\
`  `↓\
Generate / Review / Batch Approve Images\
`  `↓\
TTS Narration + Subtitle Timing\
`  `↓\
Browser Animatic Review\
`  `↓\
Selected Motion: Basic FFmpeg or optional Veo/Kling\
`  `↓\
Parallel Scene Render + Finalize\
`  `↓\
FinalArtifact MP4\
`  `├──────────────→ Export Long-form\
`  `↓\
Highlight Analyzer → Short Visual Plan → Cost Confirm → Short Render/Export

**3.0. Project dài hạn và Incremental Continuation**

Project là container dài hạn của toàn bộ truyện; Chapter là đơn vị nhập nội dung, planning, generation, review và render có thể tiếp tục độc lập. Việc thêm Chapter không tạo Project mới và không regenerate các Chapter đã hoàn thành trừ khi dependency hoặc affected-scope yêu cầu.

Project đã tồn tại\
`  `↓\
Add Chapter N theo đợt (Paste/Import)\
`  `↓\
Persist StoryVersion relation + rights/safety gate\
`  `↓\
Inherit Project Bible / locked CharacterVersion / Location / Style / generation settings\
`  `↓\
Analyze chỉ Chapter mới → Scene → VisualBeat\
`  `↓\
Affected Scope + Asset Reuse + OperationPlan cho phần mới\
`  `↓\
Generate / Review / Render Chapter N\
`  `↓\
Continue Project hoặc Render Full Project khi các Chapter cần thiết đã sẵn sàng

Chapter cũ chỉ chuyển OUTDATED hoặc được replan khi Affected Scope Resolver xác định có dependency bị tác động, chẳng hạn thay đổi StoryVersion liên quan, Project Bible/CharacterVersion snapshot, Location/Style hoặc render settings. Các Chapter không bị ảnh hưởng tiếp tục reuse asset, audio, scene clip và render intermediate đã hoàn tất.

**3.1. Stage gates**

|**Gate**|**Điều kiện qua gate**|**Nếu chưa đạt**|
| :-: | :-: | :-: |
|Story Parsed|Có cấu trúc story hợp lệ, có ít nhất 1 scene|User sửa truyện hoặc chạy Analyze lại|
|Characters Approved|Các nhân vật chính có CharacterVersion ACTIVE/LOCKED|Regenerate/chỉnh Character Bible|
|Storyboard Approved|Scene/shot có thứ tự, narration và visual intent|Edit/replan scene|
|Visual Ready|Các shot cần thiết có image asset APPROVED|Regenerate shot lỗi|
|Audio Ready|Narration/subtitle đã generate|Generate lại voice hoặc timing|
|Render Ready|Không còn asset bắt buộc ở trạng thái FAILED/PENDING|Retry hoặc bỏ cảnh theo rule|
|Final Artifact Valid|Final video có storage key hợp lệ, MIME hợp lệ, width/height > 0 và manifest khớp|Không mark parent COMPLETED; giữ FAILED/UNKNOWN theo nguyên nhân|
|Short Ready|Candidate đạt duration policy, timeline hợp lệ và visual/subtitle ready|User chỉnh range hoặc regenerate visual|

**3.2. Luồng xử lý long-form với độ dài linh hoạt**

Hệ thống không dùng một công thức cố định theo số từ hoặc thời lượng. Story Analyzer và Narration timing tạo các boundary ngữ nghĩa; Scene Planner áp dụng guardrail thời lượng; Visual Beat Analyzer phân bổ visual theo độ phức tạp. Baseline long-form khoảng 2,5 visual/phút, nhưng scene hành động/chuyển cảnh có thể dày hơn và scene tĩnh có thể thưa hơn. FFmpeg dùng approved images và motion để lấp timeline mà không cần AI video cho mọi giây.

Story/Chapter bất kỳ độ dài\
`  `↓\
Story Analyzer + Narration Segmentation\
`  `↓\
Semantic Scene Split\
(8–10s min / 18–30s ideal / 40–45s max guardrail)\
`  `↓\
Visual Beat Analyzer\
(~2.5 visuals/min baseline, adaptive 80–120%)\
`  `↓\
Character/Location/Style Resolver\
`  `↓\
Image Generation + Identity QA + Human Review\
`  `↓\
Pan/Zoom/Fade + Subtitle + Music\
`  `↓\
FFmpeg Render Profile\
`  `↓\
FinalArtifact

**3.3. Luồng tạo Short/Reel tự động**

Shorts không được cắt bằng interval cố định. Hệ thống chọn đoạn có hook, conflict, reveal, emotion hoặc payoff đủ trọn ý; sau đó tạo timeline dọc riêng. Hard minimum là 30 giây, mặc định 45–60 giây và có thể 60–90 giây. Visual density cao hơn long-form; ưu tiên tái sử dụng approved asset khi crop/reframe 9:16 vẫn tốt, chỉ generate thêm khi cần.

Completed/Approved Long-form Timeline\
`  `↓\
Highlight Analyzer\
`  `↓\
Rank Short Candidates\
`  `↓\
Duration Policy (30s hard min; 45–60s default)\
`  `↓\
Vertical Visual Planner (9:16)\
`  `↓\
Reuse / Crop / Regenerate Visuals\
(~6/30s, 8–10/45s, 10–12/60s; adaptive)\
`  `↓\
Subtitle + Audio Mix\
`  `↓\
FFmpeg Short Render\
`  `↓\
Short MP4

**3.4. Luồng Cost-Optimized Operation cho tạo mới và chỉnh sửa**

Mọi thao tác lớn (analyze toàn story, generate visual hàng loạt, TTS dài, render project, animate bằng Veo/Kling) phải đi qua Operation Planner. Với edit, Affected Scope Resolver tính delta trước để không chạy lại phần project không đổi. Asset Reuse Resolver chạy trước Cost Estimator để estimate chỉ tính NEW\_GENERATION/REGENERATE thực sự cần.

User Operation\
`  `↓\
New Project ───────────────┐\
Edit Existing Project → Diff/Affected Scope Resolver\
`                           `↓\
Duration + Semantic Complexity Analysis\
`                           `↓\
Visual/Motion Budget Planner\
`                           `↓\
Asset Reuse Resolver\
`      `├─ REUSE\
`      `├─ REFRAME / BASIC\_MOTION\
`      `└─ NEW\_IMAGE / AI\_VIDEO\
`                           `↓\
Cost Estimator (Vertex + image + video + TTS + CPU/GPU + storage)\
`                           `↓\
Estimate Range + Confidence + ETA + Max Authorized Spend\
`                           `↓\
Budget Reservation → Execute → Meter → Re-estimate\
`                           `↓\
Within budget → Continue | Threshold exceeded → PAUSED\_COST\_LIMIT / COST\_RECONFIRMATION\_REQUIRED\
`                           `↓\
Finalize → Actual Usage Ledger

**3.5. Nguyên tắc estimate theo duration + complexity + delta**

Không suy ra chi phí từ một số ảnh cố định. New video 30 phút, edit 30 phút bên trong video 2 giờ, và new video 2 giờ là ba operation khác nhau. Cost Planner snapshot expected duration, scene complexity distribution, proposed visual/motion actions, reusable assets, quality tier, provider/model, TTS duration và render profile. Estimate có confidence LOW/MEDIUM/HIGH và được cập nhật khi có thông tin chính xác hơn.

VisualBudget = Σ(scene\_duration\_minutes × base\_density × complexity\_multiplier)\
NewImageCalls = planned\_visuals - reusable\_visuals - reusable\_with\_reframe\
AI Video Cost = generated\_motion\_seconds × resolved\_provider\_rate × quality/resolution modifier\
Operation Estimate = Vertex planning + Images + AI Video + TTS + Render + Storage/Egress\
Incremental Edit Cost = only affected scope; unchanged assets/scenes are reused

**4. YÊU CẦU CHỨC NĂNG**

|**ID**|**Nhóm**|**Yêu cầu**|
| :-: | :-: | :-: |
|FR-01|Authentication|Đăng nhập Google OIDC, tạo/duy trì HttpOnly server session, logout; không dùng Keycloak trong V1.7.|
|FR-02|Project Management|Tạo, đổi tên, archive, duplicate project.|
|FR-03|Story Input|Paste/import truyện, lưu version truyện.|
|FR-04|Story Analysis|Phân tích story thành character/location/chapter/scene; scene split theo ngữ nghĩa, không theo thời lượng cố định.|
|FR-05|Character Bible|Tạo mô tả nhân vật có cấu trúc và visual prompt.|
|FR-06|Character Reference|Sinh/đăng ảnh tham chiếu; quản lý nhiều góc nhìn.|
|FR-07|Character Lock|Lock một CharacterVersion để dùng cho scene generation.|
|FR-08|Storyboard|Tạo, sắp xếp, chỉnh sửa Scene/VisualBeat/Shot; hỗ trợ merge/split theo narration và complexity.|
|FR-09|Prompt Build|Tự build prompt từ character + location + scene + style + camera.|
|FR-10|Image Generation|Enqueue AI Worker qua provider adapter/workflow; nhận ImageGenerationSettings đã resolve (aspect ratio + quality tier), persist snapshot/attempt/provider operation và lưu output vào object storage.|
|FR-11|Regenerate|Regenerate 1 shot mà không ảnh hưởng toàn project.|
|FR-12|Voice Generation|Sinh narration theo scene/chapter.|
|FR-13|Subtitle|Tạo segment subtitle và timing.|
|FR-14|Render Scene|Ghép image, motion, voice, music, subtitle theo render profile thành scene clip.|
|FR-15|Render Project|Ghép scene/chapter clip thành FinalArtifact MP4; hỗ trợ Standard 720p và High 1080p.|
|FR-16|Job Tracking|Hiển thị parent job/stage progress; hỗ trợ QUEUED/RUNNING/COMPLETED/FAILED/CANCELED và provider UNKNOWN khi outcome mơ hồ.|
|FR-17|Asset Library|Quản lý image/audio/video theo project và entity.|
|FR-18|Export|Download long-form MP4, Short MP4 và metadata/manifest cần thiết.|
|FR-19|Usage/Quota|Theo dõi credit hoặc resource usage (tối thiểu internal counter).|
|FR-20|Admin Operations|Retry/cancel job, disable provider/model, xem lỗi.|
|FR-21|Visual Beat Planning|Tự phân tích scene/narration để tạo VisualBeat theo thay đổi hình ảnh thay vì 1 câu = 1 ảnh.|
|FR-22|Outfit Bible|Quản lý trang phục tách khỏi identity; scene chọn outfit cụ thể cho từng nhân vật.|
|FR-23|Project Bible|Quản lý Character/Location/Style Bible dùng lại xuyên nhiều chapter.|
|FR-24|Identity QA|Hỗ trợ chấm/flag độ giống identity của ảnh mới so với Character Master/Reference trước khi approve.|
|FR-25|Chapter Render|Render và retry độc lập theo chapter; giữ lại scene clip thành công để render incremental.|
|FR-26|Multi-character Control|Cho phép chỉ định từng CharacterVersion trong một visual beat và hỗ trợ workflow vùng/inpaint ở phiên bản nâng cao.|
|FR-27|Video Render Quality Profile|Cho phép chọn Output Aspect Ratio + Video Quality. Ratio: 16:9, 9:16, 1:1, 4:3, 3:4. Standard map tương ứng: 1280×720, 720×1280, 720×720, 960×720, 720×960. High map: 1920×1080, 1080×1920, 1080×1080, 1440×1080, 1080×1440. Long-form mặc định 16:9; Short mặc định 9:16. Video quality tách biệt Image Quality Profile.|
|FR-28|Durable Provider Operation|Persist provider reservation trước external submission; lưu provider identity/operation id/status và reconcile outcome.|
|FR-29|Final Artifact Validation|Chỉ hoàn tất parent job khi FinalArtifact tồn tại, storage hợp lệ, MIME hợp lệ và width/height dương.|
|FR-30|Short Candidate Discovery|Tự tìm/rank đoạn nổi bật từ story/timeline để đề xuất Short/Reel thay vì cắt interval cố định.|
|FR-31|Short Visual Planning|Lập visual plan 9:16 với mật độ cao hơn long-form; tái sử dụng/crop asset hoặc generate thêm theo complexity.|
|FR-32|Short Render|Render Short độc lập, subtitle/audio đồng bộ và export MP4; hard min 30s, default 45–60s.|
|FR-33|Adaptive Visual Density|Long-form và Short dùng budget theo phút + complexity; không hard-code ảnh theo số câu/số từ.|
|FR-34|Provider Health|Expose trạng thái cấu hình/quyền truy cập provider để UI/admin biết khi billing/model unavailable.|
|FR-35|Image Aspect Ratio|Cho phép chọn tỉ lệ ảnh ở cấp Project và override từng VisualBeat/Shot. Preset UI tối thiểu: 16:9, 9:16, 1:1, 4:3, 3:4; chỉ hiển thị lựa chọn provider/model hiện tại hỗ trợ. Long-form mặc định 16:9; Short mặc định 9:16.|
|FR-36|Image Quality Profile|Cho phép chọn chất lượng ảnh DRAFT / STANDARD / HIGH. Domain dùng quality tier provider-agnostic; adapter ánh xạ tier sang resolution/quality option hợp lệ của provider. STANDARD là mặc định; HIGH chỉ khả dụng khi provider/model hỗ trợ.|
|FR-37|Per-Beat Generation Override|VisualBeat/Shot mặc định inherit ImageGenerationSettings của Project nhưng có thể override aspect ratio và/hoặc quality tier. UI phải hiển thị rõ Inherit/Override và cảnh báo khi ảnh nguồn khác tỉ lệ render khiến phải crop/pad.|
|FR-38|Output Aspect Ratio|Creator có thể chọn tỉ lệ khung hình video output thay vì bị khóa theo loại nội dung. Long-form default 16:9 và Short default 9:16 nhưng có thể đổi sang 1:1, 4:3 hoặc 3:4; UI preview safe area/crop trước render.|
|FR-39|Render Notifications|Khi long-form/Short render chuyển terminal state, tạo in-app notification và gửi email nếu user bật preference. Notification không phụ thuộc browser còn mở; Web Push có thể bổ sung sau.|
|FR-40|Onboarding & Empty States|Lần đầu đăng nhập hiển thị onboarding ngắn + checklist Create Project → Paste Story → Choose profile → Analyze. Dashboard/Character/Storyboard/Asset/Shorts có empty-state CTA và sample/demo option.|
|FR-41|Plan Entitlement|Backend trả entitlement hiện tại (watermark, max video quality, monthly export limits, concurrent expensive jobs, feature flags) để UI hiển thị và server enforce.|
|FR-42|Export Policy|Free tier launch default: watermark bắt buộc, tối đa STANDARD 720p, 1 long-form + 3 Short exports mỗi tháng. Paid tiers bỏ watermark/raise limits theo entitlement; mọi export vẫn ghi usage ledger.|
|FR-43|Story Input Limits|Validate StoryVersion trước khi persist/analyze: hard limit mặc định 500.000 Unicode characters hoặc 120.000 estimated input tokens, whichever first. Vượt limit phải yêu cầu split/import theo phần; limit là configuration theo plan/provider.|
|FR-44|Multi-character Frame Guardrail|V1 cho tối đa 4 tracked/named characters trong một VisualBeat/Shot; UI cảnh báo khi >3. Nếu >4, planner phải split/reframe hoặc chuyển nhân vật phụ thành background non-tracked trước generation.|
|FR-45|Optimistic Concurrency|Các entity chỉnh sửa được phải có row\_version/ETag. Update gửi expected version; stale update trả 409 CONFLICT và không ghi đè dữ liệu mới hơn. Áp dụng cả multi-tab V1 và collaboration V2.|
|FR-46|Resource Cost Estimate & Accounting|Trước expensive job, hiển thị estimate theo provider/GPU/TTS/render/storage. Sau job, persist actual provider cost khi có, gpu\_seconds/cpu\_seconds/storage bytes và cost estimate để quota, margin và capacity planning.|
|FR-47|Per-user Cost Attribution|Mọi billable/resource-consuming job lưu requested\_by\_user\_id và billed\_to\_user\_id. Resource usage/ledger truy vết được user → project → operation → job → stage; admin/internal job cũng không bypass accounting.|
|FR-48|Operation Cost Planning|Trước expensive operation, hệ thống tạo OperationPlan với affected scope, duration/complexity, visual/motion plan, provider/model, estimate range, confidence, ETA và estimate inputs snapshot.|
|FR-49|Budget Reservation & Spending Cap|Reserve credit/budget trước execute; lưu max\_authorized\_cost. Trước stage billable tiếp theo, nếu projected spend vượt cap thì PAUSED\_COST\_LIMIT thay vì tiếp tục tốn tiền.|
|FR-50|Dynamic Re-estimation|Re-estimate sau Story Analyze/Visual Plan/Provider resolution. Nếu estimate tăng vượt configurable threshold (baseline 20%) hoặc vượt authorized budget, yêu cầu user reconfirm trước stage đắt tiếp theo.|
|FR-51|Delta / Affected Scope|Edit Story/Scene/Character/Settings phải tính affected chapters/scenes/visuals/audio/render clips để chỉ regenerate/rerender delta; project lifetime cost và this-operation incremental cost được hiển thị tách biệt.|
|FR-52|Asset Reuse Planning|Visual Planner phân loại REUSE / REUSE\_WITH\_REFRAME / BASIC\_MOTION / NEW\_IMAGE / AI\_VIDEO. Reuse resolver chạy trước cost estimate; nhiều VisualBeat có thể dùng chung approved source asset khi semantics cho phép.|
|FR-53|Batch Visual Review|Visual Review Grid hỗ trợ chọn nhiều GenerationAttempt/VisualBeat để approve/reject/regenerate. Batch operation trả partial result; conflict/invalid item không rollback các item hợp lệ.|
|FR-54|Prompt Preview & Override|Trước generation, user xem auto-resolved prompt theo lớp và có structured override; Advanced raw override có warning. Attempt lưu auto\_resolved\_prompt, user\_override và submitted\_prompt.|
|FR-55|Animatic Preview|Browser animatic ghép approved image/keyframe + narration + subtitle + timing + lightweight pan/zoom để duyệt pacing trước final encode; không yêu cầu full FFmpeg render.|
|FR-56|Personal Character Library|Global Character Hub quản lý reusable Character identities và CharacterVersion; Project Character Library quản lý ProjectCharacter assignments. Assigning không clone identity; generation snapshot version/appearance/outfit đã resolve.|
|FR-57|Vertex AI Gemini Provider|Story/scene/visual/prompt/highlight intelligence production mặc định dùng Gemini trên Vertex AI qua provider adapter; authentication dùng Google Cloud workload identity/ADC, project/location/model config ở server.|
|FR-58|Provider Capability Registry|Provider/model expose capabilities, pricing unit/key, supported media modes/aspect/resolution/duration. Planner/router không hard-code Veo/Kling-specific rules trong domain.|
|FR-59|AI Video Motion Planning|VisualBeat có motion necessity/action: STILL, BASIC\_MOTION hoặc AI\_VIDEO. AI video chỉ được chọn khi value/quality/cost policy cho phép; image-first vẫn là fallback deterministic.|
|FR-60|Multi-provider Video Generation|VideoGenerationProvider hỗ trợ Vertex Veo, Kling và provider tương lai; request có AUTO hoặc explicit provider. Resolved provider/model/capability/pricing snapshot được lưu vào VideoGenerationAttempt.|
|FR-61|AI Video Budget|Operation có optional AI-video budget/max generated seconds. Planner rank motion candidates theo narrative impact × motion need / estimated cost và chọn candidate cao giá trị trong budget.|
|FR-62|Resource-class Scheduler|Queue tách resource class (PROVIDER\_INTERACTIVE, PROVIDER\_BATCH, GPU\_HEAVY, CPU\_RENDER, CPU\_LIGHT, BACKGROUND, NOTIFICATION) + priority + per-user fairness; một user không monopolize toàn worker pool.|
|FR-63|Provider Rate Limit & Circuit Breaker|Rate limiter chủ động throttle theo provider/model/location/capability. Circuit breaker pause provider route sau lỗi retryable dày đặc; auth/billing/permission failure pause ngay, không dội request.|
|FR-64|Worker Lease & Watchdog|StageAttempt có worker lease + heartbeat. Stale lease chuyển STALLED; local safe work có thể retry, external submitted operation phải reconcile thay vì blind resubmit.|
|FR-65|Atomic Media Finalization|FFmpeg ghi local temp, ffprobe/validate rồi atomic rename; object storage upload temp/unique key, verify checksum/HEAD, promote immutable final key rồi mới mark FinalArtifact READY.|
|FR-66|Error Catalog|UI nhận structured error\_code/category/retryable/user\_message/recommended\_action và optional technical details (job/stage/correlation/provider op) để self-debug mà không cần đọc raw logs.|
|FR-67|Input Content Moderation|Moderate StoryVersion, character description, prompt override và uploaded reference trước khi AI planning/generation. Kết quả normalized: SAFE / REVIEW / BLOCK với category + policy\_version; blocked content không được enqueue paid provider call.|
|FR-68|Generated Output Moderation|Generated image/video/text metadata phải qua output moderation trước APPROVED/PUBLISHABLE. Provider safety rejection được normalize nhưng không thay thế application policy.|
|FR-69|Content Rights Attestation|Khi import/paste story, user xác nhận sở hữu nội dung hoặc có đủ quyền sử dụng. Persist story\_id/user\_id/policy\_version/accepted\_at; hỗ trợ report/review/disable/takedown.|
|FR-70|Prompt Injection Defense|Story text luôn là untrusted source material. Prompt builder tách system/task/data boundary, dùng structured output/schema validation, tool/field allowlist và optional Model Armor/equivalent security layer trước/after LLM.|
|FR-71|Real-person Reference Consent|Upload reference có người thật phải khai báo REAL\_PERSON\_REFERENCE và explicit consent/use-right basis trước identity processing. Fictional/generated reference dùng policy khác.|
|FR-72|Identity Data Privacy|Identity template/face embedding nếu có phải tenant-isolated, encrypted/private, không public-download, không log, không dùng cross-user training/reuse và có retention/deletion lifecycle riêng.|
|FR-73|Account Abuse Protection|Rate limit theo account/session/IP/API route + concurrent expensive jobs + suspicious automation signals. Throttling xảy ra trước entitlement/quota/cost reservation khi có thể.|
|FR-74|AI Audit Trail|Mỗi AI interaction lưu provider/model/model\_version hoặc resolved model key, prompt/schema/policy version, safety decision, request fingerprint/input hash, usage metadata, generation parameters và correlation ids ở mức cần thiết; tránh lưu raw sensitive prompt vô hạn.|
|FR-75|Data Deletion Lifecycle|Delete Project/Account phải cancel pending jobs, revoke access, delete/expire generated assets/reference derivatives/identity data theo policy, invalidate signed URLs và ghi deletion audit. Backup expiry tuân retention documented.|
|FR-76|Localization / I18n|UI baseline vi-VN + en-US; user có preferred\_locale. Story source\_language, narration\_language, metadata\_language có thể khác nhau; backend trả stable codes/message keys thay vì hard-code UI language.|
|FR-77|Moderation Review & Appeal|REVIEW state tạo queue cho user/admin review theo policy. Hard-block category (ví dụ sexual content involving minors) không có user override; các category khác có workflow rõ ràng và audit.|
|FR-78|Safety Capability Normalization|Provider adapter normalize safety finish reason/category nhưng policy quyết định ở application layer để đổi Gemini/Imagen/Veo/Kling/provider khác không làm thay business rules.|
|FR-79|Chapter Management|Tạo, sửa nội dung/metadata, đổi chapter\_no/order và sắp xếp lại Chapter trong Project; thay đổi phải có optimistic locking và lưu source StoryVersion relation.|
|FR-80|Incremental Continuation|Cho phép nhập thêm Chapter theo nhiều đợt vào Project hiện hữu; Chapter mới inherit Project Bible, locked CharacterVersion, Location, Style và generation settings theo snapshot tại thời điểm xử lý.|
|FR-81|Chapter Lifecycle|Quản lý lifecycle DRAFT → ANALYZED → VISUAL\_READY → RENDERED; trạng thái phải phản ánh readiness thực tế của Chapter và không suy ra từ một counter tổng hợp không bền vững.|
|FR-82|Chapter Resume & Progress|Cho phép resume/retry analyze, generation và render theo Chapter; hiển thị progress durable theo stage, không tạo job trùng khi reconnect hoặc worker restart.|
|FR-83|Chapter Render Scope|Render Chapter độc lập hoặc Render Full Project; khi thêm/sửa Chapter chỉ enqueue phần affected/new, không regenerate Chapter khác nếu dependency/affected-scope không yêu cầu.|

**5. BUSINESS RULES**

|**ID**|**Quy tắc**|
| :-: | :-: |
|BR-01|Mỗi Project có một StoryVersion đang ACTIVE tại một thời điểm.|
|BR-02|Một Character phải thuộc đúng một Project.|
|BR-03|Một Character có thể có nhiều CharacterVersion; chỉ version ACTIVE/LOCKED được dùng mặc định khi generate scene.|
|BR-04|Lock CharacterVersion không xóa các version cũ.|
|BR-05|Scene đã generate phải lưu character\_version\_id đã sử dụng để đảm bảo khả năng truy vết.|
|BR-06|Khi đổi CharacterVersion, các shot cũ không tự động bị ghi đè; hệ thống đánh dấu OUTDATED nếu cần regenerate.|
|BR-07|Một Shot chỉ có tối đa một primary image APPROVED, nhưng có thể có nhiều generation attempt.|
|BR-08|Regenerate tạo GenerationAttempt mới; không overwrite artifact cũ.|
|BR-09|Project Render chỉ bắt đầu khi mọi scene bắt buộc đạt trạng thái READY.|
|BR-10|Job dài phải chạy async; API không giữ HTTP connection đến khi AI hoàn tất.|
|BR-11|FAILED job được retry theo chính sách; retry phải idempotent theo job/attempt.|
|BR-12|Asset binary không lưu trực tiếp trong PostgreSQL.|
|BR-13|Xóa Project theo soft delete trước; asset vật lý được cleanup bằng background retention job.|
|BR-14|Scene order phải duy nhất trong cùng Chapter; Shot order phải duy nhất trong cùng Scene.|
|BR-15|Narration timing quyết định duration mặc định của scene nếu user không override.|
|BR-16|Prompt hệ thống phải lưu cả resolved prompt và các reference version để reproducible.|
|BR-17|Model/provider phải được cấu hình bên ngoài domain; domain không phụ thuộc trực tiếp một vendor.|
|BR-18|Generation quota được kiểm tra trước khi enqueue job tốn tài nguyên.|
|BR-19|Cancel job không đồng nghĩa xóa output đã hoàn thành trước đó.|
|BR-20|Final render là immutable artifact; render lại tạo RenderVersion mới.|
|BR-21|Không cho phép user truy cập asset của project không thuộc quyền sở hữu/chia sẻ.|
|BR-22|Mọi thay đổi trạng thái job quan trọng phải có audit timestamp và error code nếu thất bại.|
|BR-23|Nếu reference bắt buộc bị mất, scene generation phải fail fast thay vì tự generate nhân vật mới.|
|BR-24|V1.7 ưu tiên image-first; AI video chỉ dùng chọn lọc/optional khi capability, chi phí và chất lượng phù hợp.|
|BR-25|Thay đổi thứ tự scene sau khi render làm render hiện tại OUTDATED nhưng không xóa file đã export.|
|BR-26|Character Bible và Character Master thuộc Project, không thuộc riêng Chapter; tất cả chapter dùng lại cùng identity source.|
|BR-27|Khi CharacterVersion đã LOCKED, identity fields và reference snapshot của version đó không được sửa trực tiếp; mọi thay đổi tạo version mới.|
|BR-28|Outfit là entity/version riêng; thay quần áo không được tạo Character mới và không được làm mất identity gốc.|
|BR-29|VisualBeat là đơn vị visual generation chính cho long-form; số visual beat được AI đề xuất và user có thể merge/split.|
|BR-30|Mỗi GenerationAttempt phải lưu character\_version\_id, outfit\_version\_id, reference asset IDs, workflow/model version và resolved prompt đã dùng.|
|BR-31|Ảnh có nhân vật chính không tự động trở thành APPROVED chỉ vì generation thành công; phải qua human review và/hoặc Identity QA theo cấu hình.|
|BR-32|Identity QA chỉ là tín hiệu hỗ trợ; user có quyền approve/reject và hệ thống không coi similarity threshold là đảm bảo tuyệt đối.|
|BR-33|Regenerate một VisualBeat/Shot chỉ tạo attempt mới cho đơn vị đó; không regenerate toàn chapter trừ khi user chủ động yêu cầu.|
|BR-34|Location Bible và Style Profile ở cấp Project phải được resolve vào prompt mọi visual beat có liên quan để giảm drift môi trường/phong cách.|
|BR-35|Render một chapter không được thay đổi reference/version của các chapter đã render trước; reproducibility dựa trên snapshot metadata.|
|BR-36|Khi một scene có nhiều nhân vật, mỗi nhân vật phải chỉ định CharacterVersion riêng; workflow nâng cao có thể dùng region/inpaint để tránh trộn identity.|
|BR-37|LoRA/adapter cá nhân hóa là tối ưu giai đoạn sau; V1.7 không bắt buộc train nhân vật và phải hoạt động với reference-based conditioning trước.|
|BR-38|Không giả định video luôn 60 phút hoặc chapter luôn 2.000 từ; mọi boundary và budget là policy/configuration.|
|BR-39|Long-form visual budget mặc định tham chiếu khoảng 2,5 visual/phút với biên mềm 80–120%; complexity có quyền tăng/giảm mật độ.|
|BR-40|Scene split ưu tiên semantic boundary; guardrail thời lượng chỉ hỗ trợ merge/split, không được phá một đoạn kể chuyện đang liền mạch.|
|BR-41|Short có hard minimum 30s; default 45–60s; chỉ tạo short ngắn hơn 45s khi nội dung vẫn đủ hook/payoff và không vi phạm hard minimum.|
|BR-42|Short visual density tham chiếu: ~6 visual/30s, 8–10/45s, 10–12/60s; scene đơn giản có thể giảm ảnh theo complexity.|
|BR-43|Short mặc định 9:16. Approved long-form asset được tái sử dụng nếu crop/reframe không làm mất chủ thể; nếu không phải tạo visual phù hợp dọc.|
|BR-44|Provider/API key chỉ tồn tại server-side/secret store. Frontend không nhận provider key và V1.7 không yêu cầu BYOK.|
|BR-45|Authentication V1.7 dùng Spring Security + Google OIDC + HttpOnly session; không phụ thuộc Keycloak.|
|BR-46|ProviderOperation phải được persist ở trạng thái reserved/pending trước khi external request có thể được gửi.|
|BR-47|Nếu không biết external submission đã thành công hay chưa, ProviderOperation chuyển UNKNOWN; hệ thống không được tự resubmit cho đến khi reconcile.|
|BR-48|Provider operation identifier phải được namespace theo provider; operation id giống nhau ở hai provider không được coi là cùng operation.|
|BR-49|Parent GenerationJob/RenderJob chỉ được COMPLETED khi mọi required stage hợp lệ và FinalArtifact tương ứng đã được persist.|
|BR-50|Final video artifact phải có width > 0 và height > 0; dimension phải được lưu cùng metadata để validate downstream.|
|BR-51|Storage key phải duy nhất theo policy. Duplicate key phát hiện khi migrate/reconcile phải quarantine thay vì silently drop row.|
|BR-52|Mỗi Project có ImageGenerationSettings mặc định gồm aspect\_ratio và quality\_tier; long-form mặc định 16:9 + STANDARD, Short visual plan mặc định 9:16 + STANDARD nếu user không chọn khác.|
|BR-53|Aspect ratio chỉ được chọn từ capability của provider/model đang active. UI không được cho phép enqueue một ratio mà adapter biết chắc provider không hỗ trợ.|
|BR-54|Quality tier là abstraction của domain (DRAFT/STANDARD/HIGH), không lưu business rule theo tên resolution/vendor-specific. Provider adapter chịu trách nhiệm map tier sang option hợp lệ và lưu resolved request snapshot.|
|BR-55|GenerationAttempt phải snapshot requested aspect\_ratio, quality\_tier và actual width/height của output. Thay đổi Project default không làm thay đổi attempt/asset đã generate trước đó.|
|BR-56|VisualBeat/Shot có thể override aspect ratio/quality; nếu không có override thì inherit Project default. Regenerate phải dùng setting hiện tại đã resolve và tạo attempt mới, không overwrite artifact cũ.|
|BR-57|Nếu aspect ratio của image source khác render profile, hệ thống phải chọn rõ strategy crop/fit/pad/reframe; không được silent stretch làm méo ảnh.|
|BR-58|DRAFT/STANDARD/HIGH chỉ mô tả mức chất lượng mục tiêu. Actual pixel dimensions phụ thuộc capability provider/model và phải được persist để audit/cost estimation; HIGH không được giả định luôn bằng 1080p/2K.|
|BR-59|RenderProfile phải resolve aspect\_ratio + video\_quality thành width/height dương theo preset chuẩn; không cho combination tạo dimension lẻ/không hợp lệ với encoder policy.|
|BR-60|Long-form mặc định output 16:9 và Short mặc định 9:16, nhưng default không phải hard constraint. Nếu user đổi output ratio, render manifest phải snapshot ratio/width/height và visual reframe policy.|
|BR-61|Khi image aspect ratio và output video ratio khác nhau, hệ thống phải preview crop/fit/pad/reframe. User có thể chọn strategy ở cấp render/clip; stretch làm méo hình bị cấm.|
|BR-62|StoryVersion hard limit mặc định là 500.000 Unicode characters hoặc 120.000 estimated input tokens, lấy ngưỡng chạm trước. Hệ thống phải reject trước AI enqueue; plan/provider có thể cấu hình limit thấp hơn nhưng không được âm thầm truncate.|
|BR-63|Story Analyzer chunking tách biệt user input limit: target 12.000–16.000 input tokens/chunk, hard max 24.000 tokens/provider call; nếu provider capability thấp hơn thì adapter dùng ngưỡng thấp hơn. Chunk overlap/context summary phải có version để reproducible.|
|BR-64|Một VisualBeat/Shot V1 có hard max 4 tracked named characters; 1–3 là vùng khuyến nghị. Khi count >3 UI phải cảnh báo identity risk; >4 phải split/reframe hoặc dùng background non-tracked extras trước submit.|
|BR-65|Mọi update mutable entity có concurrency token phải match row\_version hiện tại. Mismatch trả 409 CONFLICT/STALE\_VERSION và không được last-write-wins im lặng.|
|BR-66|LOCKED CharacterVersion, APPROVED Asset và completed RenderVersion là immutable snapshot. Conflict resolution không được merge trực tiếp vào snapshot; thay đổi tạo version/attempt mới.|
|BR-67|Mỗi terminal transition đáng thông báo (Render/Short COMPLETED hoặc FAILED) tạo một outbox event idempotent. In-app notification được persist trước dispatch email; retry email không được tạo duplicate notification.|
|BR-68|FREE launch entitlement: watermark\_required=true, max\_video\_quality=STANDARD, max\_longform\_exports\_per\_month=1, max\_short\_exports\_per\_month=3, max\_concurrent\_expensive\_jobs=1. Các số này là configuration có audit/version, không hard-code rải rác.|
|BR-69|Entitlement/quota phải được kiểm tra server-side trước enqueue và trước final export. UI chỉ phản ánh capability; thay client flag/request không được bypass watermark, quality, concurrency hoặc export limit.|
|BR-70|Cost estimate không được coi là invoice chính xác. Hệ thống phải snapshot estimate inputs trước job và ghi actual resource/provider usage sau job để so sánh estimate-vs-actual.|
|BR-71|Dev, staging và production không dùng chung PostgreSQL database, object-storage bucket/prefix root, Redis namespace hoặc production secrets. Production data không được copy sang lower environment nếu chưa sanitize.|
|BR-72|usage\_ledger/resource\_usage\_records phải multi-user append-only và có user attribution; không tạo schema/bảng riêng cho từng user.|
|BR-73|GenerationJob/OperationPlan phải lưu requested\_by\_user\_id và billed\_to\_user\_id. Hai field có thể khác trong support/admin flow nhưng mọi override phải audit.|
|BR-74|internal\_cost và billable\_cost là hai giá trị riêng. Hệ thống có thể chịu internal cost nhưng không charge user nếu lỗi thuộc platform/policy.|
|BR-75|Mỗi expensive operation phải có estimate snapshot trước enqueue; estimate là range, không phải invoice chính xác. Pricing/rate version đã resolve phải được snapshot để audit.|
|BR-76|Không dùng “video 1 giờ = 150 ảnh” hay bất kỳ fixed image count làm cost rule. Visual count là output của duration + scene complexity + narrative importance + reuse policy.|
|BR-77|Edit operation chỉ charge/execute phần affected. Unchanged approved asset, TTS segment, scene clip và render intermediate phải được reuse khi snapshot dependencies không đổi.|
|BR-78|Cost estimator phải chạy sau asset reuse planning. Beat REUSE/REFRAME/BASIC\_MOTION không được tính như một new image provider call.|
|BR-79|Budget reservation giữ worst-case/authorized amount trước execute; actual finalize trừ actual billable usage và release phần reservation chưa dùng.|
|BR-80|Nếu actual\_cost + estimated\_next\_stage\_cost > max\_authorized\_cost thì job chuyển PAUSED\_COST\_LIMIT; không được tự chạy stage billable tiếp theo.|
|BR-81|Nếu re-estimated total tăng >20% so với estimate user đã confirm hoặc vượt spending cap, mặc định yêu cầu COST\_RECONFIRMATION\_REQUIRED. Threshold là configuration.|
|BR-82|Batch approve/reject/regenerate dùng item-level result và optimistic concurrency; conflict của một item không rollback item khác đã commit hợp lệ.|
|BR-83|Resolved prompt phải tách auto\_resolved\_prompt, structured user\_override và submitted\_prompt. Advanced raw override không được sửa immutable CharacterVersion snapshot.|
|BR-84|Character Library reuse theo Character identity + CharacterVersion. Project dùng qua ProjectCharacter; CharacterVersion/appearance/outfit update không mutate generation history và không auto-load toàn bộ library vào generation context.|
|BR-85|Gemini production route dùng Vertex AI provider adapter. API key kiểu client/AI Studio không phải production domain contract; credential không đi qua browser.|
|BR-86|Provider capability là configuration/data. Domain không được branch theo tên Veo/Kling để quyết định duration/aspect/mode; adapter/router resolve capability trước submit.|
|BR-87|Mỗi VisualBeat có thể có KeyframeAsset và MotionAsset. MotionAsset được ưu tiên khi APPROVED/READY; nếu không, renderer dùng KeyframeAsset + deterministic basic motion.|
|BR-88|AI video không được áp dụng mặc định cho mọi beat. Motion Planner phải cân nhắc motion necessity, narrative impact, provider capability, remaining budget và existing approved keyframe.|
|BR-89|VideoGenerationAttempt là immutable attempt history; đổi provider (Veo → Kling hoặc ngược lại) tạo attempt mới và không overwrite clip cũ.|
|BR-90|AUTO provider routing không được thay provider âm thầm nếu fallback làm vượt remaining authorized budget hoặc policy không cho auto\_fallback.|
|BR-91|GPU\_HEAVY mặc định hard max 1 heavy workflow/GPU. Chỉ tăng >1 sau benchmark VRAM/stability; worker concurrency chung không được bypass GPU lease.|
|BR-92|Scheduler phải áp dụng per-user fairness trong cùng priority/resource class để một user bulk-generate không starve interactive job của user khác.|
|BR-93|Retry baseline: provider 5xx/408/network-safe initial+2; 429 tối đa 3 theo Retry-After/backoff; invalid LLM structured output tối đa 2 repair; auth/permission/billing/content rejection 0 auto retry; ambiguous submit 0 resubmit.|
|BR-94|Circuit breaker key tối thiểu theo provider + model + capability + location/account route. Baseline mở sau 5 consecutive retryable errors hoặc >=50% failure trong 20 request; auth/billing/permission pause ngay. Ngưỡng là configuration.|
|BR-95|StageAttempt heartbeat baseline mỗi 30s; lease không được renew quá khoảng 120s thì STALLED. Watchdog phải phân biệt safe local retry với external reconcile.|
|BR-96|FinalArtifact chỉ reference immutable object đã validate. Partial/local temp hoặc object temp chưa verify không bao giờ được expose như READY.|
|BR-97|Rejected/old attempts không bị overwrite để giảm size. Metadata giữ lâu dài; media lifecycle dùng thumbnail derivative + hot/cold/archive policy.|
|BR-98|Safety/abuse checks phải chạy trước paid cost reservation/provider submission. Không được tiêu provider/GPU cho request đã BLOCK hoặc rate-limited nếu có thể quyết định trước.|
|BR-99|Story text, chapter text, character text và user prompt override là untrusted data; nội dung bên trong không được thay đổi system policy, tool permission, billing/ownership/storage path hoặc job authority.|
|BR-100|Sexual content involving minors hoặc sexualization of minors là hard block. Không cho user/admin thường override để generation tiếp tục.|
|BR-101|Provider safety filter là defense-in-depth, không phải policy duy nhất. Application phải normalize SAFE/REVIEW/BLOCK và giữ policy\_version để audit.|
|BR-102|Story phải có active rights attestation trước Analyze/Generate. Attestation không chứng minh ownership tuyệt đối nhưng là business prerequisite và hỗ trợ dispute/takedown.|
|BR-103|Hệ thống không tự tuyên bố một tác phẩm là public domain/licensed chỉ từ LLM inference. Copyright dispute được xử lý qua report/review/evidence/takedown workflow.|
|BR-104|REAL\_PERSON\_REFERENCE phải có consent/use-right declaration trước identity extraction/embedding. Nếu consent bị revoke theo policy, future generation dùng reference đó phải dừng và derivative identity data được xóa/expire.|
|BR-105|Identity embedding/template là private per-user/per-project data; không ghi vào application log, analytics event, error payload hoặc public asset manifest và không reuse chéo tenant.|
|BR-106|Delete Project/Account phải idempotent và durable. Pending external operations được cancel khi provider hỗ trợ; nếu không cancel được thì kết quả về sau phải quarantine/expire thay vì reattach vào deleted owner state.|
|BR-107|Account rate limit và provider rate limit là hai lớp khác nhau. User quota/credits không thay thế chống spam; provider throughput control không thay thế per-account abuse policy.|
|BR-108|AI audit metadata phải đủ để tái hiện quyết định kỹ thuật nhưng raw prompt/reference sensitive data chỉ giữ theo retention policy. Không mặc định giữ vô hạn vì mục đích debug.|
|BR-109|Localized label/message không phải canonical domain state. Database lưu enum/code/message\_key; locale resolution xảy ra ở presentation layer.|
|BR-110|Moderation REVIEW không được tự động chuyển thành SAFE chỉ vì provider generation thành công. Publishable state cần policy decision độc lập.|
|BR-111|Reference image của người thật và fictional/generated character phải có reference\_type rõ ràng để retention/consent policy không bị trộn.|
|BR-112|Security/safety policy version, rights-policy version và consent version phải snapshot vào quyết định liên quan để thay policy không làm mất khả năng audit lịch sử.|

**6. USE CASES CHI TIẾT**

**UC-01 - Tạo Project từ truyện**

|**Thuộc tính**|**Nội dung**|
| :-: | :-: |
|Actor|Creator|
|Tiền điều kiện|Có tài khoản|
|Hậu điều kiện|Project ở DRAFT; StoryVersion được lưu|
|Luồng chính|1) Tạo project\. 2) Nhập tên + truyện\. 3) Validate size/plan limits (500k chars / 120k estimated tokens default)\. 4) Lưu StoryVersion\. 5) Chuyển đến màn hình Analyze\.|
|Ngoại lệ/Alternative|Nếu raw story > 500.000 Unicode characters hoặc > 120.000 estimated input tokens (whichever first) → reject trước enqueue, hiển thị current/max size và cho split/import theo phần. Analyzer nội bộ target 12k–16k tokens/chunk, hard 24k/provider call hoặc thấp hơn theo provider capability.|

**UC-02 - Phân tích truyện**

|**Thuộc tính**|**Nội dung**|
| :-: | :-: |
|Actor|Creator|
|Tiền điều kiện|Project có StoryVersion ACTIVE|
|Hậu điều kiện|Characters/Locations/Scenes ở trạng thái PROPOSED|
|Luồng chính|1) Creator chọn Analyze\. 2) Backend tạo job\. 3) AI Worker gọi LLM\. 4) Validate JSON schema\. 5) Lưu entity đề xuất\. 6) UI nhận progress\.|
|Ngoại lệ/Alternative|LLM output invalid → retry với repair prompt; quá số lần → FAILED và giữ raw response để debug.|

**UC-03 - Tạo & Lock nhân vật**

|**Thuộc tính**|**Nội dung**|
| :-: | :-: |
|Actor|Creator|
|Tiền điều kiện|Có Character PROPOSED|
|Hậu điều kiện|CharacterVersion LOCKED|
|Luồng chính|1) Chỉnh Character Bible\. 2) Generate reference sheet\. 3) Chọn ảnh tốt\. 4) Approve\. 5) Lock version\.|
|Ngoại lệ/Alternative|Không đạt → regenerate attempt; user có thể upload reference thủ công.|

**UC-04 - Tạo Storyboard**

|**Thuộc tính**|**Nội dung**|
| :-: | :-: |
|Actor|Creator|
|Tiền điều kiện|Story parsed, nhân vật chính đã duyệt|
|Hậu điều kiện|Scene/Shot ở trạng thái READY\_FOR\_VISUAL|
|Luồng chính|1) Planner chia scene thành shot\. 2) Sinh visual intent\. 3) User chỉnh thứ tự/narration/camera\. 4) Approve storyboard\.|
|Ngoại lệ/Alternative|Thiếu character/location → cảnh được flag để user xử lý.|

**UC-05 - Generate ảnh một Shot**

|**Thuộc tính**|**Nội dung**|
| :-: | :-: |
|Actor|Creator|
|Tiền điều kiện|Shot có resolved prompt và reference hợp lệ|
|Hậu điều kiện|Primary image APPROVED hoặc generated để review|
|Luồng chính|1) Resolve Project/VisualBeat ImageGenerationSettings\. 2) Backend check quota/cost estimate\. 3) Validate provider capability cho aspect ratio + quality tier\. 4) Enqueue job\. 5) Worker resolve refs/prompt/settings\. 6) Submit provider/workflow\. 7) Validate actual dimensions/aspect\. 8) Upload output\. 9) Ghi GenerationAttempt snapshot\.|
|Ngoại lệ/Alternative|Provider không hỗ trợ ratio/quality đã chọn → reject trước submit và đề xuất preset khả dụng; worker timeout/provider lỗi → retry/reconcile; reference thiếu → FAILED\_NO\_REFERENCE.|

**UC-06 - Regenerate Shot**

|**Thuộc tính**|**Nội dung**|
| :-: | :-: |
|Actor|Creator|
|Tiền điều kiện|Shot đã có ít nhất 1 attempt|
|Hậu điều kiện|Tạo attempt mới, không mất output cũ|
|Luồng chính|1) User chọn regenerate\. 2) Có thể giữ/đổi seed, prompt, reference, aspect ratio hoặc quality tier\. 3) Resolve capability + enqueue\. 4) So sánh output/chi phí\. 5) Set một image làm APPROVED\.|
|Ngoại lệ/Alternative|User có thể rollback về attempt cũ.|

**UC-07 - Tạo Voice/Subtitles**

|**Thuộc tính**|**Nội dung**|
| :-: | :-: |
|Actor|Creator|
|Tiền điều kiện|Scene có narration|
|Hậu điều kiện|Audio + subtitle segments|
|Luồng chính|1) Chọn voice\. 2) Generate TTS\. 3) Lấy duration\. 4) Tạo timing\. 5) Preview\.|
|Ngoại lệ/Alternative|TTS fail → retry/provider khác; user có thể upload audio.|

**UC-08 - Render Project**

|**Thuộc tính**|**Nội dung**|
| :-: | :-: |
|Actor|Creator|
|Tiền điều kiện|All required scenes READY|
|Hậu điều kiện|RenderVersion COMPLETED, FinalArtifact READY và final MP4 hợp lệ.|
|Luồng chính|1) Check readiness\. 2) Render/reuse scene clips\. 3) Concat + mix audio/subtitle\. 4) VIDEO\_COMPOSE\. 5) FINALIZE kiểm tra storage/MIME/dimensions\. 6) Persist FinalArtifact\. 7) Chỉ khi đó mark parent COMPLETED\.|
|Ngoại lệ/Alternative|Scene lỗi → FAILED\_PARTIAL và giữ clip thành công để retry incremental. Storage/finalize mơ hồ hoặc artifact invalid → không mark parent COMPLETED.|

**UC-09 - Lập Visual Beats thích ứng theo duration/complexity**

|**Thuộc tính**|**Nội dung**|
| :-: | :-: |
|Actor|Creator|
|Tiền điều kiện|Chapter có narration/story đã parse.|
|Hậu điều kiện|Danh sách VisualBeat ở trạng thái PROPOSED/READY\_FOR\_VISUAL.|
|Luồng chính|1) Backend enqueue VISUAL\_BEAT\_PLAN\. 2) Worker phân tích visual changes\. 3) Đề xuất start/end, visual intent, characters, location\. 4) User merge/split/edit\. 5) Approve\.|
|Ngoại lệ/Alternative|Nếu scene quá tĩnh, nhiều narration có thể dùng 1–2 visual beat; scene hành động có thể cần nhiều beat hơn.|

UC-10 - Kiểm tra và duyệt Identity

|**Thuộc tính**|**Nội dung**|
| :-: | :-: |
|Actor|Creator / AI Worker|
|Tiền điều kiện|VisualBeat đã generate ảnh có nhân vật khóa.|
|Hậu điều kiện|GenerationAttempt có identity score/flag và ảnh được APPROVED hoặc REJECTED.|
|Luồng chính|1) Lấy Character Master/Reference snapshot\. 2) Chạy identity/face similarity nếu workflow hỗ trợ\. 3) Ghi score/flag\. 4) UI hiển thị ảnh + reference\. 5) User approve hoặc regenerate\.|
|Ngoại lệ/Alternative|Không phát hiện mặt/nhân vật quay lưng → không auto reject; chuyển sang manual review.|

UC-11 - Đổi trang phục nhưng giữ nhân vật

|**Thuộc tính**|**Nội dung**|
| :-: | :-: |
|Actor|Creator|
|Tiền điều kiện|CharacterVersion đã LOCKED.|
|Hậu điều kiện|OutfitVersion mới có thể được chọn cho scene/visual beat mà identity không đổi.|
|Luồng chính|1) Tạo Outfit từ mô tả/reference\. 2) Approve outfit\. 3) Gán outfit cho scene/visual beat\. 4) Prompt resolver ghép identity + outfit + scene context\. 5) Generate\.|
|Ngoại lệ/Alternative|Nếu outfit mới làm drift mặt/body, giảm conditioning weight hoặc regenerate bằng reference phù hợp hơn.|

**UC-12 - Đăng nhập bằng Google**

|**Thuộc tính**|**Nội dung**|
| :-: | :-: |
|Actor|Creator|
|Tiền điều kiện|Có Google account; OAuth client được cấu hình ở server.|
|Hậu điều kiện|User identity được map/lưu trong PostgreSQL và browser có HttpOnly authenticated session.|
|Luồng chính|1) User chọn Continue with Google\. 2) Spring Security redirect OIDC\. 3) Validate callback/claims\. 4) Upsert user identity\. 5) Tạo server session\. 6) Redirect về dashboard\.|
|Ngoại lệ/Alternative|OIDC client/callback/claim validation lỗi → không tạo session; hiển thị lỗi cấu hình/auth rõ ràng. Không fallback sang Keycloak.|

**UC-13 - Tạo Short/Reel từ video truyện**

|**Thuộc tính**|**Nội dung**|
| :-: | :-: |
|Actor|Creator|
|Tiền điều kiện|Có story/timeline đã phân tích hoặc long-form/chapter đã có approved visual + audio timeline.|
|Hậu điều kiện|ShortClip có vertical manifest, approved visual plan và MP4 render độc lập.|
|Luồng chính|1) Analyze highlights\. 2) Rank candidates có hook/payoff\. 3) Chọn range theo duration policy\. 4) Tạo 9:16 visual plan\. 5) Reuse/crop hoặc generate thêm asset\. 6) Đồng bộ subtitle/audio\. 7) Render FFmpeg\. 8) Preview/approve/export\.|
|Ngoại lệ/Alternative|Không có candidate đủ tốt → user chọn range thủ công. Candidate <30s bị reject. Scene đơn giản được giảm số visual; scene phức tạp tăng trong quota.|

**UC-14 - Reconcile provider outcome mơ hồ**

|**Thuộc tính**|**Nội dung**|
| :-: | :-: |
|Actor|AI Worker / Admin|
|Tiền điều kiện|ProviderOperation đã được reserve/persist trước submit.|
|Hậu điều kiện|Operation được xác định COMPLETED/FAILED hoặc tiếp tục UNKNOWN nhưng không bị resubmit trùng.|
|Luồng chính|1) Persist reservation\. 2) Submit external call\. 3) Persist provider operation id nếu nhận được\. 4) Timeout/connection ambiguity → UNKNOWN\. 5) Reconcile bằng provider status/storage evidence\. 6) Chỉ retry/resubmit khi policy chứng minh operation cũ chưa được chấp nhận\.|
|Ngoại lệ/Alternative|Không thể reconcile → giữ UNKNOWN và yêu cầu manual/admin resolution; không đoán FAILED.|

**UC-15 - Nhận thông báo khi render hoàn tất/thất bại**

|**Thuộc tính**|**Nội dung**|
| :-: | :-: |
|Actor|Creator|
|Tiền điều kiện|User có render/Short job đang chạy; notification preference đã có default.|
|Hậu điều kiện|Có in-app notification persist; email được enqueue/attempt nếu preference bật.|
|Luồng chính|1) Job chuyển COMPLETED/FAILED\. 2) Transaction tạo outbox event duy nhất\. 3) Notification consumer persist notification\. 4) Nếu email enabled, dispatch adapter\. 5) UI badge/list cập nhật khi user mở lại app\.|
|Ngoại lệ/Alternative|Email provider lỗi → notification in-app vẫn tồn tại; email retry theo backoff, không đổi trạng thái render và không tạo duplicate event.|

**UC-16 - Xử lý xung đột chỉnh sửa Scene/Character**

|**Thuộc tính**|**Nội dung**|
| :-: | :-: |
|Actor|Creator / Editor|
|Tiền điều kiện|Entity mutable có row\_version; client đã đọc version N.|
|Hậu điều kiện|Chỉ một update hợp lệ được commit; stale writer nhận 409 và dữ liệu mới hơn không bị overwrite.|
|Luồng chính|1) Client gửi PATCH + expectedVersion/If-Match\. 2) Backend update WHERE id + version\. 3) Success tăng version N→N+1\. 4) Nếu 0 row updated, trả 409 với current version/minimal diff metadata\. 5) UI cho Reload/Copy my changes/Apply lại sau review\.|
|Ngoại lệ/Alternative|Locked/approved snapshot không merge in-place; user phải tạo new version/attempt. V1 single-owner vẫn dùng rule này để chống multi-tab/retry lost update.|

**UC-17 - Export theo plan entitlement**

|**Thuộc tính**|**Nội dung**|
| :-: | :-: |
|Actor|Creator|
|Tiền điều kiện|Project/Short render-ready; user có PlanEntitlement và usage window hiện tại.|
|Hậu điều kiện|FinalArtifact được render/export đúng watermark/quality policy và usage counter tăng atomically.|
|Luồng chính|1) Resolve entitlement\. 2) Check monthly export + concurrent job quota\. 3) Resolve RenderProfile allowed\. 4) Inject watermark nếu required\. 5) Render/finalize\. 6) Atomically record export usage\. 7) Return signed download URL\.|
|Ngoại lệ/Alternative|Quota exceeded → không enqueue hoặc không finalize paid-only profile; trả limit/reset date rõ ràng. Client-side removal of watermark flag bị bỏ qua.|

**UC-18 - Lập và xác nhận Cost Plan**

|**Thuộc tính**|**Nội dung**|
| :-: | :-: |
|Actor|Creator|
|Tiền điều kiện|Operation có thể tốn provider/GPU/TTS/render compute.|
|Hậu điều kiện|OperationPlan được persist với estimate range/confidence, reservation và max authorized spend.|
|Luồng chính|1) Resolve affected scope\. 2) Estimate duration/complexity\. 3) Plan reuse/new image/basic motion/AI video\. 4) Resolve provider capability/pricing snapshot\. 5) Hiển thị estimate theo stage + ETA\. 6) User confirm max spend\. 7) Reserve budget/credits\. 8) Enqueue\.|
|Ngoại lệ/Alternative|Estimate tăng đáng kể trước stage đắt → COST\_RECONFIRMATION\_REQUIRED; quota/budget thiếu → không enqueue.|

**UC-19 - Edit một phần project và chỉ regenerate delta**

|**Thuộc tính**|**Nội dung**|
| :-: | :-: |
|Actor|Creator|
|Tiền điều kiện|Project đã có StoryVersion/assets/audio/render intermediates.|
|Hậu điều kiện|Chỉ entity/asset phụ thuộc thay đổi bị OUTDATED/regenerate; unchanged artifacts được reuse.|
|Luồng chính|1) Diff old/new input\. 2) Resolve affected Chapter/Scene/Beat/Character/Audio/Clip\. 3) Reuse unaffected snapshots\. 4) Lập incremental cost plan\. 5) User confirm\. 6) Regenerate/rerender delta\. 7) Concat/finalize version mới\.|
|Ngoại lệ/Alternative|Dependency không xác định chắc chắn → widen affected scope và cảnh báo estimate; không silently reuse artifact có dependency đã đổi.|

**UC-20 - Batch review visual**

|**Thuộc tính**|**Nội dung**|
| :-: | :-: |
|Actor|Creator / Editor|
|Tiền điều kiện|Có nhiều visual ở REVIEW.|
|Hậu điều kiện|Các item hợp lệ được APPROVED/REJECTED/queued regenerate theo batch request; item lỗi trả kết quả riêng.|
|Luồng chính|1) Mở grid/filter\. 2) Chọn item\. 3) Hệ thống exclude/warn identity-risk item theo policy\. 4) Submit batch action với version token\. 5) Backend xử lý item-level\. 6) UI hiển thị approved/conflict/invalid counts\.|
|Ngoại lệ/Alternative|Stale version → item CONFLICT nhưng không rollback item khác; raw “Approve all” không được bypass warning policy.|

**UC-21 - Preview/override prompt trước generation**

|**Thuộc tính**|**Nội dung**|
| :-: | :-: |
|Actor|Creator|
|Tiền điều kiện|VisualBeat/Shot đã resolve Character/Location/Style context.|
|Hậu điều kiện|GenerationAttempt lưu đủ auto prompt, override và submitted prompt.|
|Luồng chính|1) Resolve prompt theo lớp\. 2) UI hiển thị Character/Outfit/Location/Style/Camera/Negative\. 3) User chỉnh structured override hoặc Advanced raw prompt\. 4) Re-resolve cost/capability nếu cần\. 5) Confirm rồi submit\.|
|Ngoại lệ/Alternative|Raw override làm mất critical identity constraint → UI cảnh báo; immutable snapshot không bị sửa.|

**UC-22 - Duyệt Animatic trước final render**

|**Thuộc tính**|**Nội dung**|
| :-: | :-: |
|Actor|Creator|
|Tiền điều kiện|Có timing, narration/subtitle và keyframe/placeholder đủ để preview.|
|Hậu điều kiện|User xác nhận pacing/timing hoặc chỉnh beat trước final render.|
|Luồng chính|1) Browser dựng timeline từ image/keyframe + audio + subtitle\. 2) Preview basic pan/zoom client-side\. 3) User phát hiện beat quá dài/ngắn\. 4) Split/merge/edit timing\. 5) Mark animatic approved/readiness\.|
|Ngoại lệ/Alternative|Asset thiếu → placeholder + warning; animatic không được coi là FinalArtifact.|

**UC-23 - Reuse Character từ Personal Library**

|**Thuộc tính**|**Nội dung**|
| :-: | :-: |
|Actor|Creator|
|Tiền điều kiện|User/Workspace có reusable Character và CharacterVersion hợp lệ.|
|Hậu điều kiện|Project có ProjectCharacter assignment; generation resolve immutable CharacterVersion/appearance/outfit snapshot.|
|Luồng chính|1) Chọn hoặc tạo Character trong Global Character Hub\. 2) Assign Character vào Project bằng ProjectCharacter\. 3) Chọn role/metadata và optional pinned CharacterVersion\. 4) Resolve refs/outfit/style theo project\. 5) Generate\.|
|Ngoại lệ/Alternative|Không clone Character identity và không auto-load toàn bộ library; version mới chỉ được dùng khi user/policy resolve lại, còn generation history giữ snapshot cũ.|

**UC-24 - Animate selected VisualBeat bằng Veo/Kling**

|**Thuộc tính**|**Nội dung**|
| :-: | :-: |
|Actor|Creator / AI Worker|
|Tiền điều kiện|Beat có approved KeyframeAsset hoặc text/video input hợp lệ; VideoGenerationProvider capability available.|
|Hậu điều kiện|VideoGenerationAttempt + MotionAsset được persist và có thể approve/reject/rollback.|
|Luồng chính|1) Motion Planner chấm motion/impact score\. 2) Resolve AUTO hoặc explicit provider\. 3) Estimate generated seconds/cost\. 4) Check AI-video budget\. 5) Persist ProviderOperation reservation\. 6) Submit Vertex Veo/Kling adapter\. 7) Poll/reconcile\. 8) Validate/upload clip\. 9) Review/approve\.|
|Ngoại lệ/Alternative|Provider unavailable/cost vượt budget → choose basic motion/wait/alternate provider; fallback provider chỉ tự động nếu policy + budget cho phép.|

**UC-25 - Import Story với Rights & Safety Gate**

|**Thuộc tính**|**Nội dung**|
| :- | :- |
|Actor|Creator|
|Tiền điều kiện|User đã đăng nhập; policy version hiện tại khả dụng.|
|Luồng chính|User paste/import story -> chọn/confirm rights declaration -> backend persist StoryVersion + attestation -> input moderation -> SAFE: cho Analyze; REVIEW: giữ chờ review; BLOCK: không enqueue AI.|
|Luồng thay thế / lỗi|Thiếu attestation -> 422/validation; moderation service unavailable -> fail closed cho paid generation hoặc chuyển PENDING\_SAFETY theo policy; hard-block -> không override.|
|Kết quả|Story có traceable rights/safety state trước khi AI tiêu chi phí.|

**UC-26 - Analyze Story an toàn trước Prompt Injection**

|**Thuộc tính**|**Nội dung**|
| :- | :- |
|Actor|Creator / AI Worker|
|Tiền điều kiện|StoryVersion đã SAFE và có rights attestation.|
|Luồng chính|Prompt builder đặt story trong untrusted-data boundary -> injection/security scan -> Gemini/LLM structured output -> schema/domain validation -> output safety validation -> persist StoryAnalysis proposal.|
|Luồng thay thế / lỗi|Story chứa "ignore previous instructions" hoặc tool-like payload -> coi là nội dung truyện, không cấp thêm quyền; malformed/unsafe response -> reject/repair bounded, không apply domain state.|
|Kết quả|AI analysis không thể tự thay policy, billing, ownership hoặc execute instruction embedded trong story.|

**UC-27 - Upload Real-person Reference có Consent**

|**Thuộc tính**|**Nội dung**|
| :- | :- |
|Actor|Creator|
|Tiền điều kiện|Character tồn tại; user có quyền project.|
|Luồng chính|User upload reference -> chọn REAL\_PERSON\_REFERENCE -> xác nhận consent/use right -> moderation image -> private asset storage -> optional identity template/embedding -> CharacterReference READY.|
|Luồng thay thế / lỗi|Không consent hoặc moderation block -> không identity processing; consent revoke/delete -> reference và derived identity data chuyển deletion lifecycle.|
|Kết quả|Reference người thật có consent/version/retention trace và không bị reuse chéo user.|

**UC-28 - Xử lý Moderation REVIEW/BLOCK**

|**Thuộc tính**|**Nội dung**|
| :- | :- |
|Actor|Creator / Admin|
|Tiền điều kiện|Có moderation decision REVIEW hoặc BLOCK.|
|Luồng chính|REVIEW -> hiển thị category/message\_key + allowed action -> user chỉnh nội dung hoặc authorized reviewer quyết định; BLOCK -> generation/publish bị chặn; mọi decision ghi policy\_version/audit.|
|Luồng thay thế / lỗi|Hard-block category không có override; provider-specific message được normalize, không expose raw unsafe data không cần thiết.|
|Kết quả|Chỉ content đạt policy mới quay lại generation/publish flow.|

**UC-29 - Delete Project / Delete Account**

|**Thuộc tính**|**Nội dung**|
| :- | :- |
|Actor|Creator|
|Tiền điều kiện|Authenticated owner; destructive confirmation hoàn tất.|
|Luồng chính|Create deletion request -> block new jobs -> cancel/reconcile pending work -> revoke signed URLs -> delete/expire assets/reference derivatives/identity data -> update storage/usage -> mark request COMPLETE.|
|Luồng thay thế / lỗi|External job không cancel được -> quarantine late result; storage/provider transient error -> durable retry; operation idempotent khi user submit lại.|
|Kết quả|Dữ liệu active bị xóa theo policy, backup expiry được theo dõi riêng, audit không chứa sensitive payload.|

**UC-30 - Chọn Locale và Ngôn ngữ Nội dung**

|**Thuộc tính**|**Nội dung**|
| :- | :- |
|Actor|Creator|
|Tiền điều kiện|Authenticated user hoặc anonymous locale bootstrap.|
|Luồng chính|User chọn vi-VN/en-US -> lưu preferred\_locale -> UI resolve message keys. Trong Project, user có thể chọn source\_language, narration\_language, metadata\_language độc lập.|
|Luồng thay thế / lỗi|Unsupported locale -> fallback configured; backend enum/state không thay đổi theo bản dịch.|
|Kết quả|Một project có thể dùng story tiếng Việt nhưng narration/metadata ngôn ngữ khác mà không phá canonical state.|

**UC-31 - Account Rate Limit / Abuse Throttling**

|**Thuộc tính**|**Nội dung**|
| :- | :- |
|Actor|System / Creator|
|Tiền điều kiện|Request đã qua authentication bootstrap hoặc có IP/session context.|
|Luồng chính|Evaluate route/account/IP/concurrency bucket -> nếu allow thì tiếp tục entitlement/quota/cost; nếu throttle trả 429 + retry metadata/message\_key và không tạo paid job/provider operation.|
|Luồng thay thế / lỗi|Suspicious burst có thể tăng cooldown/challenge theo policy; provider 429 vẫn được xử lý ở provider-rate layer riêng.|
|Kết quả|Spam không monopolize queue và không tạo cost reservation/provider submission không cần thiết.|

**7. KIẾN TRÚC HỆ THỐNG**

**7.1. Kiến trúc mục tiêu V1.7**

┌────────────────────────────┐\
│ Next.js + TypeScript       │\
│ Storyboard / Review / Cost │\
└─────────────┬──────────────┘\
`              `│ REST + SSE + OIDC\
`              `▼\
┌────────────────────────────────────────┐\
│ Spring Boot 4.1 Modular Monolith       │\
│ Domain + Operation/Cost/Quota/Jobs     │\
└──────┬──────────┬──────────┬───────────┘\
`       `│          │          │\
`       `▼          ▼          ▼\
` `PostgreSQL     Redis      S3/MinIO\
(authoritative) scheduler   media\
`       `│\
`       `▼ durable Job/Stage/ProviderOperation\
┌────────────────────────────────────────┐\
│ Python 3.12 AI/Media Worker            │\
│ VertexGemini / Image / Video / TTS     │\
│ Cost meter / QA / FFmpeg               │\
└──────┬──────────────┬──────────────────┘\
`       `│              │\
`       `▼              ▼\
` `Vertex AI         Optional GPU Pool\
` `Gemini / Veo      ComfyUI/self-hosted\
`       `│\
`       `└──────► Kling / future providers via adapters

**7.2. Vì sao không full microservices ngay**

- Domain còn thay đổi nhanh; tách service sớm làm tăng chi phí network contract, tracing và deployment.
- Các module Project/Story/Character/Scene có nhiều transaction và relationship; modular monolith giúp phát triển nhanh hơn.
- AI/Media Worker cần tách vì khác runtime/dependency và có lifecycle external provider/FFmpeg riêng; đây là boundary kỹ thuật rõ ràng.
- Khi có bottleneck thật, có thể tách Generation/Render/Asset dần mà không rewrite toàn hệ thống.

**7.3. Bounded modules trong Spring Boot**

|**Module**|**Trách nhiệm**|**Không nên chứa**|
| :-: | :-: | :-: |
|auth|Google OIDC identity, HttpOnly session, authorization|Provider key/AI generation logic|
|project|Lifecycle project, ownership|Image model SDK|
|story|StoryVersion, chapter, parsing request|Direct ComfyUI calls|
|character|Character/Version/Reference metadata|GPU processing|
|scene|Scene/Shot/storyboard|File encoding|
|generation|GenerationJob/StageAttempt/ProviderOperation/Attempt state machine|Vendor-specific SDK leaked into domain|
|asset|Asset metadata, signed URL policy|Binary in DB|
|render|RenderJob/RenderVersion/FinalArtifact readiness|FFmpeg execution trong request thread|
|billing|Quota/usage ledger|AI details|
|shared|cross-cutting primitives nhỏ|God utilities|
|shorts|Highlight candidate, vertical visual plan, ShortClip/render policy|Social-network SDK hoặc provider secret ở UI|
|notification|In-app notification, preferences, outbox dispatch state|Email/provider SDK trong domain entity|
|entitlement|Plan capability, export/concurrency limits, watermark policy|Pricing/UI-only flags hoặc provider billing details|
|cost|OperationPlan, CostEstimate, CostReservation, UsageLedger, internal/billable cost|Provider SDK hoặc pricing hard-code trong domain|
|provider|Capability registry/routing policy/health/circuit state|Vendor SDK implementation hoặc secrets trong domain|
|character-library|User/Workspace Character identities, CharacterVersion và ProjectCharacter assignments|Project-owned Character clone hoặc auto-mutating generation snapshot|

**7.4. Production deployment topology**

Production tách orchestration/CPU work khỏi GPU work. Managed-provider mode có thể chạy với 0 self-hosted GPU; chỉ khi enable ComfyUI/self-hosted model mới cần GPU pool. API và worker dùng cùng durable PostgreSQL contracts nhưng scale độc lập.

Internet / Browser\
`  `↓ TLS / CDN-WAF / Load Balancer\
Next.js Web (>=2 replicas when self-hosted)\
`  `↓ REST + SSE\
Spring Boot API (min 2 prod replicas)\
`  `├─ PostgreSQL HA/PITR (authoritative)\
`  `├─ Redis (queue/cache; reconstructable)\
`  `├─ S3-compatible Object Storage (versioned/private)\
`  `└─ Outbox / Notification dispatch\
`        `↓\
CPU Worker Pool (provider orchestration / TTS / FFmpeg)\
`        `├─ External Managed AI Providers\
`        `└─ GPU Queue → GPU Worker Pool 0..4 MVP (optional ComfyUI/self-hosted)\
\
Cross-cutting: Secret Manager + Metrics/Logs/Tracing + Alerting + CI/CD Registry

**7.5. Environment isolation**

Có ba environment tối thiểu: local/dev, staging và production. Artifact container được promote theo version; config/secrets/data tách riêng. Staging phải đủ giống production để chạy migration, provider sandbox/limited-real E2E, render smoke test và restore test mà không dùng dữ liệu production thật.

**7.6. Provider architecture: Vertex AI Gemini + extensible video providers**

LLM intelligence mặc định dùng VertexGeminiProvider trên Vertex AI. ImageGenerationProvider và VideoGenerationProvider là port riêng; dù Veo cũng nằm trong Vertex AI, domain vẫn xem Gemini (planning) và Veo (media generation) là hai capability khác nhau. Kling/future providers thêm qua adapter mà không thay business model.

LlmProvider → VertexGeminiProvider\
ImageGenerationProvider → VertexImageProvider | ComfyUIProvider | Future\
VideoGenerationProvider → VertexVeoProvider | KlingProvider | Future\
\
Common provider contract:\
\- getCapabilities()\
\- estimate(request)\
\- submit(request)\
\- getStatus(operation) / reconcile()\
\- cancel() when supported\
\- fetch/validate output

**7.7. Cost control plane**

Cost control là cross-cutting domain capability, không phải UI-only counter. OperationPlan xác định affected scope; CostEstimator dùng provider pricing snapshot + measured resource model; CostReservation kiểm soát authorized spend; ResourceUsageRecord đo actual compute/provider consumption; UsageLedger ghi accounting append-only. Google Cloud billing export/labels có thể dùng để reconcile invoice sau, nhưng PostgreSQL vẫn là realtime operational ledger.

**8. THIẾT KẾ DOMAIN VÀ DỮ LIỆU**

**8.1. Aggregate/Entity chính**

User\
` `├─ ExternalIdentity (Google OIDC)\
` `├─ CharacterLibrary\
` `│   └─ Character → CharacterVersion → CharacterMaster / Reference Assets\
` `├─ NotificationPreference / Notification\
` `└─ PlanEntitlement / UsageWindow\
\
Project\
` `├─ StoryVersion / Chapter / Scene / VisualBeat\
` `├─ ProjectCharacter → CharacterVersion / OutfitVersion / References\
` `├─ StyleProfile / RenderProfile\
` `├─ KeyframeAsset / MotionAsset\
` `├─ OperationPlan\
` `│   ├─ CostEstimate / CostReservation\
` `│   └─ AffectedScope\
` `├─ GenerationJob\
` `│   ├─ StageAttempt / WorkerLease\
` `│   ├─ ProviderOperation\
` `│   ├─ GenerationAttempt\
` `│   └─ VideoGenerationAttempt\
` `├─ RenderVersion → FinalArtifact\
` `├─ ShortCandidate / ShortClip\
` `└─ Asset / IdentityCheck / UsageLedger / ResourceUsageRecord

**8.2. Bảng dữ liệu đề xuất**

|**Bảng**|**Trường chính**|
| :-: | :-: |
|users|id, email, display\_name, avatar\_url, status, created\_at|
|projects|id, owner\_id, name, status, active\_story\_version\_id, default\_image\_profile\_key, created\_at, row\_version|
|story\_versions|id, project\_id, version\_no, raw\_text, status, created\_at|
|characters|id, project\_id, name, role, status|
|character\_versions|id, character\_id, version\_no, bible\_json, resolved\_prompt, status, locked\_at, row\_version|
|character\_references|id, character\_version\_id, asset\_id, view\_type, weight, status|
|locations|id, project\_id, name, description, prompt, status|
|chapters|id, story\_version\_id, source\_story\_version\_id, chapter\_no, order\_no, title, source\_text, status, estimated\_duration\_ms, generation\_progress, inherited\_bible\_snapshot\_hash, inherited\_character\_version\_ids, inherited\_location\_style\_settings\_json, row\_version|
|scenes|id, chapter\_id, order\_no, title, narration, duration\_ms, status, row\_version|
|shots|id, scene\_id, order\_no, visual\_intent, camera, duration\_ms, status, approved\_asset\_id|
|shot\_characters|shot\_id, character\_id, character\_version\_id, costume\_key|
|assets|id, project\_id, type, storage\_key, mime\_type, bytes, checksum, width, height, duration\_ms, status|
|generation\_jobs|id, operation\_plan\_id, project\_id, requested\_by\_user\_id, billed\_to\_user\_id, job\_type, entity\_type, entity\_id, status, priority, resource\_class, progress, current\_step, error\_code, final\_artifact\_id, created\_at|
|generation\_attempts|id, job\_id, visual\_beat\_id/shot\_id, model\_key, workflow\_version, provider\_operation\_id, prompt\_snapshot, seed, requested\_aspect\_ratio, quality\_tier, actual\_width, actual\_height, output\_asset\_id, status|
|audio\_tracks|id, project\_id, scene\_id, type, voice\_key, asset\_id, duration\_ms|
|subtitle\_segments|id, scene\_id, start\_ms, end\_ms, text|
|render\_versions|id, project\_id, version\_no, render\_profile\_key, aspect\_ratio, width, height, status, output\_asset\_id, manifest\_json, created\_at|
|usage\_ledger|id, user\_id, project\_id, operation\_plan\_id, job\_id, entry\_type, operation, credits, monetary\_amount, currency, idempotency\_key, created\_at|
|character\_outfits|id, character\_id, version\_no, name, description, reference\_asset\_id, status|
|project\_style\_profiles|id, project\_id, version\_no, style\_key, prompt\_template, negative\_prompt, aspect\_ratio, status|
|visual\_beats|id, scene\_id, order\_no, start\_ms, end\_ms, narration\_segment, visual\_intent, location\_id, status, approved\_asset\_id, row\_version|
|visual\_beat\_characters|visual\_beat\_id, character\_id, character\_version\_id, outfit\_version\_id, role\_in\_frame|
|identity\_checks|id, generation\_attempt\_id, character\_id, reference\_snapshot\_json, score, result, method, created\_at|
|location\_references|id, location\_id, asset\_id, view\_type, status|
|external\_identities|id, user\_id, provider, provider\_subject, email, claims\_json, created\_at|
|stage\_attempts|id, job\_id, stage\_type, attempt\_no, status, worker\_id, lease\_expires\_at, last\_heartbeat\_at, started\_at, completed\_at, error\_code|
|provider\_operations|id, stage\_attempt\_id, provider, operation\_key, provider\_operation\_id, status, request\_fingerprint, submitted\_at, resolved\_at|
|final\_artifacts|id, project\_id, render\_version\_id, asset\_id, artifact\_type, width, height, duration\_ms, manifest\_json, status|
|render\_profiles|id/key, name, aspect\_ratio, width, height, fps, video\_bitrate, audio\_bitrate, status|
|short\_candidates|id, project\_id, start\_ms, end\_ms, score, reason\_json, status|
|short\_clips|id, project\_id, candidate\_id, title, start\_ms, end\_ms, aspect\_ratio, render\_profile\_key, status, final\_artifact\_id|
|short\_visual\_items|id, short\_clip\_id, order\_no, source\_visual\_beat\_id, asset\_id, crop\_json, visual\_intent, status|
|image\_generation\_profiles|id/key, name, aspect\_ratio, quality\_tier, target\_long\_edge\_class, provider\_options\_json, status|
|visual\_generation\_overrides|visual\_beat\_id/shot\_id, aspect\_ratio nullable, quality\_tier nullable, crop\_strategy nullable, updated\_at|
|notifications|id, user\_id, project\_id nullable, event\_key UNIQUE, type, channel\_state\_json, title, message, created\_at, read\_at|
|notification\_preferences|user\_id, render\_complete\_email, render\_failed\_email, short\_complete\_email, web\_push\_enabled, updated\_at, row\_version|
|plan\_entitlements|id/key, plan\_key, watermark\_required, max\_video\_quality, max\_longform\_exports\_month, max\_short\_exports\_month, max\_concurrent\_expensive\_jobs, feature\_flags\_json, version, active\_from|
|user\_plan\_assignments|user\_id, plan\_key, entitlement\_version, status, period\_start, period\_end|
|usage\_windows|user\_id, period\_key, longform\_exports, short\_exports, expensive\_jobs\_active, credits\_used, row\_version|
|outbox\_events|id, aggregate\_type, aggregate\_id, event\_type, event\_key UNIQUE, payload\_json, status, attempts, available\_at, created\_at|
|resource\_usage\_records|id, billed\_to\_user\_id, project\_id, operation\_plan\_id, job\_id, stage\_attempt\_id, provider, model\_key, resource\_type, quantity, unit, gpu\_seconds, cpu\_seconds, provider\_cost, internal\_cost, billable\_cost, storage\_bytes, egress\_bytes, currency, created\_at|
|operation\_plans|id, user\_id, project\_id, operation\_type, affected\_scope\_json, duration\_estimate\_ms, complexity\_summary\_json, estimate\_low, estimate\_high, confidence, max\_authorized\_cost, currency, status, created\_at|
|cost\_reservations|id, operation\_plan\_id, user\_id, reserved\_amount/credits, consumed\_amount, released\_amount, status, expires\_at, created\_at|
|cost\_estimate\_items|id, operation\_plan\_id, stage\_type, provider, model\_key, quantity, unit, pricing\_version, low\_cost, high\_cost, estimate\_metadata\_json|
|character\_templates|id, owner\_user\_id, name, status, latest\_version\_no, created\_at|
|character\_template\_versions|id, template\_id, version\_no, bible\_json, reference\_manifest\_json, status, locked\_at|
|project\_character\_imports|id, project\_id, character\_id, source\_template\_version\_id, imported\_snapshot\_hash, created\_at|
|video\_generation\_attempts|id, job\_id, visual\_beat\_id, source\_keyframe\_asset\_id, provider, model\_key, provider\_operation\_id, mode, requested\_duration\_ms, actual\_duration\_ms, aspect\_ratio, resolution, prompt\_snapshot, estimated\_cost, actual\_internal\_cost, output\_asset\_id, status|
|motion\_assets|id, project\_id, visual\_beat\_id, source\_type, source\_attempt\_id, asset\_id, motion\_strategy, status, approved\_at|
|error\_catalog|code, category, retryable, user\_message\_key, recommended\_action\_key, severity, technical\_visibility, version|
|content\_rights\_attestations|id, story\_version\_id, user\_id, rights\_basis, policy\_version, accepted\_at, revoked\_at nullable|
|moderation\_decisions|id, user\_id, project\_id nullable, entity\_type, entity\_id, direction INPUT/OUTPUT, result SAFE/REVIEW/BLOCK, categories\_json, provider\_signal\_json, policy\_version, reviewer\_id nullable, created\_at, resolved\_at|
|identity\_consents|id, user\_id, character\_id/reference\_asset\_id, reference\_type, consent\_basis, policy\_version, accepted\_at, revoked\_at nullable|
|identity\_profiles|id, user\_id, project\_id, character\_id, embedding\_ref/private\_template\_ref, algorithm\_version, retention\_class, expires\_at, deleted\_at|
|ai\_audit\_events|id, user\_id, project\_id, job\_id/stage\_attempt\_id, capability, provider, model\_key, prompt\_version, schema\_version, safety\_policy\_version, input\_fingerprint, usage\_json, generation\_params\_json, created\_at|
|data\_deletion\_requests|id, user\_id, scope ACCOUNT/PROJECT/ASSET, scope\_id, status, requested\_at, started\_at, completed\_at, error\_code, retention\_deadline|
|user\_preferences|user\_id, preferred\_locale, timezone, default\_narration\_language, default\_metadata\_language, updated\_at, row\_version|
|abuse\_events|id, user\_id nullable, ip\_hash/session\_id, route\_key, signal\_type, action ALLOW/THROTTLE/BLOCK/CHALLENGE, policy\_version, created\_at|

**8.3. Trạng thái quan trọng**

|**Entity**|**State gợi ý**|
| :-: | :-: |
|Project|DRAFT → PREPARING → READY → RENDERING → COMPLETED / ARCHIVED|
|CharacterVersion|DRAFT → GENERATING → REVIEW → LOCKED / REJECTED|
|Scene/Shot|DRAFT → READY\_FOR\_VISUAL → GENERATING → REVIEW → APPROVED / FAILED / OUTDATED|
|GenerationJob|QUEUED → RUNNING → COMPLETED / FAILED / CANCELED|
|RenderVersion|QUEUED → PREPARING → RENDERING → UPLOADING → COMPLETED / FAILED|
|VisualBeat|PROPOSED → READY\_FOR\_VISUAL → GENERATING → REVIEW → APPROVED / REJECTED / OUTDATED|
|OutfitVersion|DRAFT → REVIEW → APPROVED / REJECTED|
|IdentityCheck|QUEUED → RUNNING → PASS / LOW\_SCORE / NOT\_APPLICABLE / FAILED|
|StageAttempt|QUEUED → RUNNING → COMPLETED / FAILED / CANCELED|
|ProviderOperation|RESERVED → SUBMITTED → RUNNING → COMPLETED / FAILED / UNKNOWN|
|FinalArtifact|PENDING → VALIDATING → READY / INVALID|
|ShortClip|DRAFT → PLANNING → READY → RENDERING → REVIEW → APPROVED / FAILED / OUTDATED|
|OperationPlan|DRAFT → ESTIMATED → RESERVED → RUNNING → PAUSED\_COST\_LIMIT / RECONFIRMATION\_REQUIRED → COMPLETED / CANCELED|
|VideoGenerationAttempt|QUEUED → SUBMITTED → RUNNING → REVIEW → APPROVED / REJECTED / FAILED / UNKNOWN|
|StageAttempt/Lease|QUEUED → RUNNING → STALLED → RETRY\_WAIT / RECONCILING / COMPLETED / FAILED|
|Chapter|DRAFT → ANALYZED → VISUAL\_READY → RENDERED; có thể PAUSED/FAILED/OUTDATED khi operation cần resume hoặc affected-scope replan|

**8.4. Chapter là incremental processing boundary**

Không cần thêm các field tổng hợp vào Project chỉ để phục vụ mockup hoặc progress UI nếu có thể query/aggregate từ Chapter, Job và RenderVersion. Project Overview là derived view; PostgreSQL vẫn là authoritative state và Redis chỉ tăng tốc queue/cache/progress.

Chapter phải lưu cả quan hệ về StoryVersion/source text và snapshot các dependency được inherit để mỗi lần analyze/generate/render có thể tái hiện. chapter\_no/order\_no, status, estimated\_duration\_ms và generation\_progress là dữ liệu canonical của Chapter; progress chi tiết có thể lấy từ GenerationJob/StageAttempt và được aggregate khi đọc.

**9. AI PIPELINE VÀ CHARACTER CONSISTENCY**

**9.1. Pipeline phân tích truyện**

Raw Story / Changed Scope\
`  `↓\
Normalize + Diff/Chunk only when needed\
`  `↓\
VertexGeminiProvider (Vertex AI)\
`  `↓\
Structured JSON Schema\
`  `├─ Characters / Locations\
`  `├─ Chapters / Scenes\
`  `├─ Narration / Visual hints\
`  `└─ Complexity / cost-planning signals\
`  `↓\
Domain Validation\
`  `↓\
Persist proposal + provider/request metadata for audit/cache

**9.2. Character Bible**

Mỗi nhân vật chính được biểu diễn dưới dạng dữ liệu có cấu trúc thay vì một prompt tự do. Character Bible nên lưu các đặc điểm nhận diện ổn định và tách khỏi các thuộc tính có thể thay đổi theo scene như pose, cảm xúc, ánh sáng hoặc trang phục tạm thời.

|**Nhóm**|**Ví dụ thuộc tính**|
| :-: | :-: |
|Identity|tên, tuổi, giới tính, vai trò, ethnicity/nationality nếu truyện chỉ rõ|
|Face|face shape, eyes, nose, hair, unique marks|
|Body|height range, build, proportions|
|Default outfit|áo, quần, phụ kiện, màu chủ đạo|
|Style constraints|realistic/anime/cinematic, age consistency|
|Negative constraints|không đổi hair color, không thêm beard, không đổi tuổi|
|References|front, 3/4, side, full-body, close-up|

**9.3. Character Versioning**

CHAR\_NAM v1  → draft\
CHAR\_NAM v2  → user approves\
CHAR\_NAM v2  → LOCKED\
\
Shot 001 → character\_version\_id = v2\
Shot 002 → character\_version\_id = v2\
...\
\
Nếu user tạo CHAR\_NAM v3:\
\- Shot cũ vẫn giữ v2\
\- Có thể mark OUTDATED\
\- User quyết định regenerate chọn lọc

**9.4. Resolved prompt**

Resolved Prompt =\
`  `Global Style\
\+ Character Bible Snapshot\
\+ Character Reference IDs\
\+ Location Description\
\+ Scene Visual Intent\
\+ Shot Camera / Pose / Composition\
\+ Lighting / Mood\
\+ Negative Constraints\
\+ Model-specific parameters

**9.5. Image generation settings & provider adapter**

Image generation đi qua provider/workflow adapter. Trước khi submit, backend/worker resolve ImageGenerationSettings gồm aspect ratio và quality tier. Project giữ default; VisualBeat/Shot có thể override. Preset UI tối thiểu gồm 16:9, 9:16, 1:1, 4:3 và 3:4, nhưng danh sách thực tế phải capability-aware theo provider/model. Quality tier dùng DRAFT / STANDARD / HIGH; adapter ánh xạ sang resolution/quality option vendor-specific và persist cả requested settings lẫn actual width/height. Domain không phụ thuộc node graph, SDK vendor hoặc tên resolution dễ thay đổi.

Chất lượng ảnh và chất lượng video là hai khái niệm riêng. Image Quality quyết định chất lượng asset nguồn/cost generation; RenderProfile quyết định geometry/bitrate của MP4. Long-form mặc định 16:9 + STANDARD. Short visual generation mặc định 9:16 + STANDARD; có thể dùng DRAFT cho preview/candidate iteration và nâng lên STANDARD/HIGH khi approve nếu workflow hỗ trợ. Khi ratio ảnh khác ratio video, hệ thống phải crop/fit/pad/reframe có chủ đích và preview cho user, không kéo giãn ảnh.

Provider-agnostic guidance: DRAFT ưu tiên tốc độ/chi phí cho preview; STANDARD là mức production mặc định; HIGH ưu tiên detail cho cảnh quan trọng hoặc khi cần crop/reframe nhiều. Exact pixels không hard-code trong domain vì mỗi provider/model có capability khác nhau.

Python Worker\
`  `↓\
Resolve CharacterVersion + References + ImageGenerationSettings\
`  `↓\
Build / Preview Model Prompt\
`  `↓\
Select ImageGenerationProvider / Workflow by capability + policy\
`  `├─ Managed provider adapter\
`  `└─ Optional ComfyUI/self-hosted workflow\
`  `↓\
Persist ProviderOperation reservation\
`  `↓\
Submit / Poll / Reconcile\
`  `↓\
Validate dimensions / identity signals\
`  `↓\
Upload to MinIO/S3\
`  `↓\
Create Asset + GenerationAttempt + ResourceUsageRecord

**9.6. Consistency strategy**

|**Tầng**|**Mục đích**|**Cách làm**|
| :-: | :-: | :-: |
|Identity data|Giữ mô tả nhất quán|Character Bible + version snapshot|
|Reference image|Giữ khuôn mặt/ngoại hình|IP-Adapter / face-reference compatible workflow|
|Pose/composition|Giữ bố cục hành động|ControlNet pose/depth/edge khi cần|
|Prompt policy|Tránh drift|Prompt template + negative constraints + controlled vocabulary|
|Approval|Chặn lỗi lan rộng|User lock nhân vật trước khi tạo hàng loạt scene|
|Versioning|Truy vết|Shot lưu CharacterVersion và workflow/model snapshot|

9\.7. Character Master và Reference Sheet

Mỗi nhân vật quan trọng được generate/đăng ảnh độc lập trước storyboard. User chọn một ảnh/phiên bản làm Character Master, sau đó tạo reference sheet gồm front, 3/4, side, close-up và full-body. Khi user khóa CharacterVersion, các reference này trở thành snapshot cho mọi visual beat sử dụng version đó. Không generate lại “Nam” từ prompt tự do ở từng cảnh.

Story → detect CHAR\_NAM\
`        `↓\
Generate/Upload Master candidates\
`        `↓\
User chọn Master\
`        `↓\
Create Reference Sheet\
(front / 3-4 / side / full body / close-up)\
`        `↓\
LOCK CharacterVersion\
`        `↓\
Scene 1, Scene 20, Chapter 50 đều resolve cùng CharacterVersion snapshot

9\.8. Identity khác Outfit

Identity ổn định (face, hair, body traits, unique marks) phải tách khỏi Outfit. Khi truyện ghi nhân vật thay quần áo, hệ thống chỉ đổi OutfitVersion; CharacterVersion vẫn giữ nguyên. Scene/VisualBeat lưu cả character\_version\_id và outfit\_version\_id để có thể tái tạo đúng kết quả về sau.

|**Thành phần**|**Thuộc tính ví dụ**|**Versioning**|
| :- | :- | :- |
|Character Identity|face shape, hair, eyes, body build, unique marks|CharacterVersion|
|Outfit|áo, quần, màu, phụ kiện|OutfitVersion|
|Location|kiến trúc, đồ nội thất, ánh sáng nền|Location/Reference version|
|Style|cinematic/anime/realistic, palette, lens, negative prompt|StyleProfile version|

9\.9. Visual Beat - đơn vị hình ảnh của video dài

Không áp dụng quy tắc 1 câu = 1 ảnh hoặc 1 scene = 1 ảnh. Visual Beat biểu diễn một khoảng narration mà hình ảnh có thể giữ tương đối ổn định. Beat mới được tạo khi thay đổi rõ về nhân vật, hành động, địa điểm, trạng thái cảm xúc, camera hoặc sự kiện quan trọng. Vì vậy chapter 2.000 từ có thể chỉ cần khoảng 50–80 ảnh trong case phổ biến, nhưng con số có thể thấp/cao hơn theo nội dung.

|**Tình huống**|**VisualBeat gợi ý**|
| :- | :- |
|Đoạn suy nghĩ/narration tĩnh 20–30 giây|1–2 beat; dùng pan/zoom/slow motion từ ảnh.|
|Đối thoại hoặc chuyển góc nhìn|2–4 beat tùy speaker/camera.|
|Đoạn hành động liên tục|Nhiều beat hơn vì thay đổi pose, vị trí và sự kiện.|
|Đổi địa điểm/thời gian|Tạo beat mới và resolve Location/Style context mới.|

9\.10. Reference-based conditioning và pose control

V1 ưu tiên reference-based generation/editing. Character Master/Reference được đưa vào workflow để giữ identity; pose/depth/edge control được bổ sung khi cảnh cần tư thế/composition cụ thể. Việc dùng seed cố định hoặc lặp lại mô tả prompt không đủ để đảm bảo một nhân vật nhất quán qua hàng trăm ảnh.

Character Master / References\
`          `↓\
Identity Conditioning (reference/IP-Adapter/FaceID-compatible workflow)\
`          `+\
Pose / Depth / Edge Control khi cần\
`          `+\
Scene Prompt + Location + Outfit + Style\
`          `↓\
ComfyUI Workflow\
`          `↓\
Generated Image

9\.11. Identity QA và human-in-the-loop

Generation thành công về kỹ thuật không đồng nghĩa ảnh đúng nhân vật. Sau generation, worker có thể chạy face/identity similarity nếu có thể nhận diện; kết quả chỉ dùng làm score/flag. Ảnh quay lưng, che mặt hoặc có nhiều nhân vật phải chuyển sang manual review. User luôn có thể Approve, Reject hoặc Regenerate.

Generate Image\
`   `↓\
Identity QA\
`   `├─ PASS/LIKELY\_MATCH → Review\
`   `├─ LOW\_SCORE → Flag + Suggest Regenerate\
`   `└─ NOT\_APPLICABLE → Manual Review\
`   `↓\
User Approve / Reject / Regenerate\
`   `↓\
Approved Asset

9\.12. Nhiều nhân vật trong một ảnh

Multi-character scene có nguy cơ trộn khuôn mặt/identity. V1 phải lưu rõ CharacterVersion cho từng nhân vật và dùng reference phù hợp. Hard limit là 4 tracked/named characters trong một VisualBeat/Shot; 1–3 là khuyến nghị, UI cảnh báo khi >3. Nếu story cần >4 nhân vật có identity rõ trong cùng frame, planner phải split/reframe thành nhiều beat/shot hoặc coi extras là background non-tracked. Nếu model/workflow không kiểm soát tốt, hệ thống có thể generate bố cục trước rồi inpaint/regional generation từng nhân vật ở V2. Không giả định rằng đưa nhiều reference vào một prompt sẽ luôn giữ đúng mapping người A/người B.

9\.13. Location Bible và Style Bible

Đồng nhất truyện dài không chỉ là khuôn mặt. Project phải lưu Location Bible cho các địa điểm lặp lại và Style Profile cho toàn project. Khi “nhà của Nam” xuất hiện ở chapter 1 và chapter 20, prompt resolver phải sử dụng cùng location description/reference; tương tự style, color palette và aspect ratio phải được resolve nhất quán.

9\.14. Chiến lược V1 và V2 cho consistency

|**Giai đoạn**|**Kỹ thuật chính**|**Mục tiêu**|
| :- | :- | :- |
|Current baseline|Durable job/media contract hardening: idempotency, StageAttempt/ProviderOperation, storage/final-artifact invariants, FFmpeg finalization; P0/P1 gate passed.|Đạt consistency đủ tốt mà không cần train riêng từng nhân vật.|
|Next - Production readiness|Google OIDC/session, production env separation, CI/CD, backup/PITR, object-storage DR, notification/outbox, resource-cost telemetry; optional self-hosted GPU pool with basic autoscaling.|Đủ điều kiện public launch: recoverable, observable, cost-controlled và không buộc user chờ tab mở.|
|Next - Real E2E|Enable real story/image/TTS providers when billing/access is available; run full story → visual → audio → final render E2E.|Tối ưu nhân vật xuất hiện hàng trăm/hàng nghìn ảnh và scene phức tạp.|
|Active feature - Shorts|Highlight ranking, 30s hard minimum / 45–60s default, 9:16 recompose, higher adaptive visual density, Short render/export.|Tăng chuyển động nhưng vẫn giữ image/reference pipeline làm nguồn consistency.|
|Scale-out later|Tách Generation/Render service khi bottleneck thật; multi-region/spot GPU optimization, advanced editor và collaboration presence/soft-lock nếu cần.|Tối ưu scale/cost sau khi baseline production metrics đã ổn định.|

Không có một kỹ thuật đơn lẻ đảm bảo 100% identity qua hàng trăm lần generation độc lập. Thiết kế sản phẩm phải coi consistency là một pipeline nhiều lớp: Project Bible → CharacterVersion → References → Identity conditioning → Pose/Composition control → Prompt policy → QA → Human approval → Versioning.

**9.15. Provider/model policy và secret ownership**

V1.7 dùng app-owned cloud/provider identity ở server/worker. Gemini production mặc định chạy qua Vertex AI bằng Google Cloud project/location + workload identity/ADC; không phát hành AI Studio API key cho browser/end user. Exact model name vẫn externalized. Fake provider chỉ dùng automated test/dev deterministic. Provider health phải phân biệt IAM/billing/quota/model/location/circuit state và fail rõ ràng, không fake success.

**9.16. Short highlight và vertical visual pipeline**

Short pipeline tái sử dụng story semantics, narration timing và approved long-form assets. Highlight Analyzer chấm candidate dựa trên hook/conflict/reveal/emotion/payoff; Short Visual Planner reframe sang 9:16 và tăng visual density. Asset chỉ được regenerate khi crop/reframe làm mất chủ thể hoặc scene cần thêm thông tin; simple scene có thể giữ ít visual hơn để giảm chi phí.

**9.17. Cost-optimized Visual/Motion Planning**

Planner không tạo cố định N ảnh. Mỗi VisualBeat được quyết định từ semantic change và được gán visual\_action (REUSE, REFRAME, BASIC\_MOTION, NEW\_IMAGE, AI\_VIDEO), generation\_necessity\_score và motion\_necessity\_score. Reuse có thể dùng cùng source image cho nhiều beat với crop/pan/zoom khác nhau nếu visual state không đổi đáng kể.

Scene Duration + Complexity\
`  `↓\
Visual Necessity Score\
`  `├─ REUSE / REFRAME\
`  `└─ NEW\_IMAGE\
`  `↓\
Motion Necessity + Narrative Impact\
`  `├─ STILL\
`  `├─ BASIC\_MOTION (FFmpeg/browser)\
`  `└─ AI\_VIDEO candidate\
`  `↓\
Cost/AI-video Budget Optimizer\
`  `↓\
Final Visual/Motion Plan

**9.18. AI video extension: Veo/Kling without provider lock-in**

AI video là optional motion layer. Approved image/keyframe thường là nguồn image-to-video để giữ identity trước khi animation. VideoGenerationProvider resolve capability theo mode, duration, aspect, resolution, audio/reference support và pricing unit. AUTO routing có thể chọn Veo/Kling theo quality/cost/availability nhưng phải snapshot resolved provider/model và tuân max authorized spend.

VisualBeat\
` `├─ KeyframeAsset (approved image)\
` `└─ MotionAsset\
`      `├─ BASIC\_MOTION / FFmpeg\
`      `├─ Vertex Veo attempt\
`      `└─ Kling attempt\
\
Final renderer uses approved MotionAsset when valid; otherwise KeyframeAsset + deterministic motion.

**9.19. Personal Character Library và Project snapshot**

Character thuộc User/Workspace Global Character Hub và có immutable CharacterVersion. Khi dùng cho Project, hệ thống tạo ProjectCharacter assignment; generation resolve CharacterVersion/CharacterAppearance/OutfitVersion và lưu immutable snapshot. Character update không mutate generation history; context chỉ lấy participating ProjectCharacters và required references.

**9.20. Prompt preview và cache/fingerprint**

Prompt resolver lưu auto\_resolved\_prompt, user\_override và submitted\_prompt. Deterministic-ish LLM/planning calls có thể cache theo fingerprint(model/config/template/input/relevant snapshots); explicit “Regenerate with AI” có thể bypass cache. Với edit nhỏ, Vertex Gemini chỉ nhận changed content + compact context/required snapshots thay vì gửi lại toàn project khi không cần.

**9.21. Secure AI boundary: moderation + prompt injection defense**

Story/Chapter/Character/user override không được concat như instruction ngang hàng với system prompt. Worker dùng versioned prompt template với data delimiter rõ ràng, schema-constrained structured output và post-validation. Optional Model Armor/equivalent scanner có thể bổ sung như defense-in-depth nhưng domain vẫn enforce policy độc lập.

User content\
`  `-> rights + input moderation\
`  `-> injection/security scan\
`  `-> system/task prompt + <UNTRUSTED\_STORY>data</UNTRUSTED\_STORY>\
`  `-> Vertex AI Gemini\
`  `-> schema/domain validation\
`  `-> output moderation\
`  `-> review/apply canonical state

**10. DURABLE JOB QUEUE VÀ XỬ LÝ BẤT ĐỒNG BỘ**

**10.1. Nguyên tắc**

- API tạo job và trả về nhanh; không chờ AI/provider/FFmpeg hoàn tất trong HTTP request.
- PostgreSQL giữ authoritative job/stage state; Redis chỉ dùng delivery/cache/progress acceleration. Worker claim stage theo contract và attempt policy.
- Progress cập nhật theo persisted stage milestone; parent completion phải kiểm chứng required stages + FinalArtifact.
- Frontend nhận progress qua SSE; polling là fallback. Reconnect không được thay đổi state hoặc tạo job mới.
- Mỗi external call phải persist ProviderOperation reservation trước submission. Timeout mơ hồ → UNKNOWN và không auto-resubmit cho đến khi reconcile.
- Mọi job tốn tài nguyên phải thuộc một OperationPlan có billed\_to\_user\_id và cost/budget context.
- Provider/GPU stage không được claim nếu resource lease/rate/circuit/budget guard chưa pass.
- Scheduler phân resource class và fairness; priority cao không đồng nghĩa một user được chiếm toàn bộ capacity.

**10.2. Job types**

|**Job type**|**Input**|**Output**|
| :-: | :-: | :-: |
|STORY\_ANALYZE|story\_version\_id|characters/locations/scenes|
|CHARACTER\_REF\_GENERATE|character\_version\_id|reference assets|
|SHOT\_IMAGE\_GENERATE|shot\_id + character version refs|image asset + attempt|
|SCENE\_TTS\_GENERATE|scene\_id + voice\_key|audio asset + duration|
|SCENE\_RENDER|scene\_id|scene clip|
|PROJECT\_RENDER|project\_id + render manifest|final mp4|
|VISUAL\_BEAT\_PLAN|chapter\_id/scene\_ids|visual beats + timing proposal|
|IDENTITY\_QA|generation\_attempt\_id + character snapshots|score/flag per character|
|CHAPTER\_RENDER|chapter\_id + render manifest|chapter.mp4|
|SHORT\_HIGHLIGHT\_ANALYZE|project\_id/chapter\_id + timeline|ranked ShortCandidate list|
|SHORT\_VISUAL\_PLAN|short\_candidate\_id|9:16 visual plan + reuse/regenerate decisions|
|SHORT\_RENDER|short\_clip\_id + render\_profile|vertical final MP4 + FinalArtifact|
|PROVIDER\_RECONCILE|provider\_operation\_id|resolved provider operation status/evidence|
|NOTIFICATION\_DISPATCH|outbox\_event\_id|in-app/email channel dispatch result|
|OPERATION\_COST\_PLAN|operation request + affected scope|estimate range/confidence + budget reservation request|
|ANIMATIC\_PREVIEW|timeline + approved/placeholder assets + audio|browser manifest / optional draft artifact|
|VIDEO\_MOTION\_GENERATE|visual\_beat\_id + keyframe + motion request|MotionAsset + VideoGenerationAttempt|
|USAGE\_RECONCILE|billing/provider evidence + internal usage|actual/internal/billable reconciliation records|
|ASSET\_LIFECYCLE|asset retention/lifecycle criteria|thumbnail/archive transition|

**10.3. Retry policy gợi ý**

|**Lỗi**|**Retry?**|**Hành vi**|
| :-: | :-: | :-: |
|Provider 408/5xx|Có|Initial + tối đa 2 retry; exponential backoff + jitter.|
|Provider 429|Có|Tối đa 3 retry; ưu tiên Retry-After, nếu thiếu dùng backoff 15s → 60s → 180s, cap ~5 phút.|
|Network failure chắc chắn chưa submit|Có|Initial + tối đa 2 retry.|
|Ambiguous external submit/timeout|Không resubmit|Persist UNKNOWN/RECONCILING; query provider/storage evidence trước quyết định.|
|Invalid Gemini structured JSON|Có|Tối đa 2 repair attempts; sau đó FAILED\_SCHEMA.|
|Provider auth/IAM/billing/permission|Không|Pause provider route/circuit ngay; user/admin action required.|
|Content rejected / invalid input|Không|Actionable error; user sửa input/prompt.|
|FFmpeg transient I/O|Có|Initial + tối đa 2 retry; temp output phải được cleanup/replace safely.|
|Storage transient|Có|Initial + tối đa 3 retry; không mark FinalArtifact READY khi verify chưa thành công.|
|Worker lease expired|Tùy stage|Mark STALLED. Local deterministic stage có thể retry; submitted external op → reconcile.|

**10.4. Resource-class scheduler, priority và user fairness**

Không dùng FIFO chung. Job được gán resource\_class + priority + billed\_to\_user\_id. Scheduler ưu tiên interactive work nhưng thực hiện weighted fairness/round-robin giữa user trong cùng class để bulk job của một user không chiếm toàn bộ capacity.

PROVIDER\_INTERACTIVE  → story/prompt/single action\
PROVIDER\_BATCH        → background/bulk LLM\
GPU\_HEAVY             → ComfyUI/self-hosted media (1 heavy workflow/GPU default)\
CPU\_RENDER            → FFmpeg scene/final work\
CPU\_LIGHT             → QA/metadata\
BACKGROUND            → archive/cleanup/reconcile\
NOTIFICATION          → outbox/email/in-app

**10.5. Rate limiter và circuit breaker**

Rate limiter xử lý throughput/quota; circuit breaker xử lý provider route không khỏe. Circuit key theo provider + model + capability + location/account route. Baseline: OPEN sau 5 consecutive retryable failures hoặc >=50% failure trong 20 request gần nhất; cooldown ~2 phút rồi HALF\_OPEN 1–2 probe. Auth/IAM/billing/permission failure pause ngay. Các số là configuration.

Tách rõ hai tầng: Account/API Abuse Limiter bảo vệ application (account/session/IP/route/concurrency) và chạy trước cost reservation; Provider Limiter bảo vệ quota/throughput của Vertex AI/Imagen/Veo/Kling route. Một user còn credit vẫn có thể bị throttle nếu spam; provider còn quota vẫn không được phép bypass account fairness.

**10.6. Worker lease/watchdog và atomic finalization**

**12.0. Chapter-first navigation**

UX phải coi Project là workspace dài hạn: người dùng có thể mở Project Overview, quản lý nhiều Chapter, chọn một Chapter để tiếp tục xử lý và theo dõi status/progress riêng. Mọi CTA Continue Project, Render Chapter và Render Full Project phải hiển thị rõ affected scope, dependency và phần được reuse.

Worker heartbeat baseline 30s, lease khoảng 120s. Watchdog chuyển stale RUNNING thành STALLED và quyết định retry/reconcile theo stage semantics. FFmpeg render vào .partial/temp rồi ffprobe validate; object storage dùng temp/unique object + checksum/HEAD verify + immutable promotion trước khi FinalArtifact READY.

**11. API DESIGN**

**11.1. REST endpoints chính**

|**Method**|**Endpoint**|**Mục đích**|
| :-: | :-: | :-: |
|POST|/api/projects|Tạo project|
|GET|/api/projects/{id}|Lấy project|
|POST|/api/projects/{id}/stories|Tạo StoryVersion|
|POST|/api/story-versions/{id}/analyze|Enqueue story analysis|
|GET|/api/projects/{id}/characters|Danh sách nhân vật|
|POST|/api/characters/{id}/versions|Tạo CharacterVersion|
|POST|/api/character-versions/{id}/generate-references|Generate character references|
|POST|/api/character-versions/{id}/lock|Lock version|
|GET|/api/projects/{id}/storyboard|Lấy scene/shot tree|
|PATCH|/api/scenes/{id}|Chỉnh narration/duration/order|
|PATCH|/api/shots/{id}|Chỉnh visual intent/camera/prompt override|
|POST|/api/shots/{id}/generate-image|Enqueue image generation|
|POST|/api/shots/{id}/approve-asset|Chọn image approved|
|POST|/api/scenes/{id}/generate-voice|Generate TTS|
|POST|/api/projects/{id}/render|Enqueue final render|
|GET|/api/jobs/{id}|Job status|
|GET|/api/jobs/{id}/events|SSE progress|
|POST|/api/jobs/{id}/cancel|Cancel nếu còn khả năng hủy|
|POST|/api/chapters/{id}/plan-visual-beats|Enqueue Visual Beat Analyzer|
|GET|/api/chapters/{id}/visual-beats|Lấy timeline visual beats của chapter|
|PATCH|/api/visual-beats/{id}|Chỉnh timing/visual intent/characters/location|
|POST|/api/visual-beats/{id}/generate|Generate ảnh cho visual beat|
|POST|/api/generation-attempts/{id}/identity-check|Chạy/refresh Identity QA|
|POST|/api/characters/{id}/outfits|Tạo Outfit/OutfitVersion|
|POST|/api/chapters/{id}/render|Render độc lập một chapter|
|GET|/oauth2/authorization/google|Bắt đầu Google OIDC login|
|GET|/api/auth/me|Lấy user/session hiện tại|
|POST|/api/auth/logout|Hủy server session|
|POST|/api/projects/{id}/short-candidates|Enqueue highlight analysis|
|GET|/api/projects/{id}/short-candidates|Danh sách/rank ShortCandidate|
|POST|/api/short-candidates/{id}/clips|Tạo ShortClip draft + vertical plan|
|PATCH|/api/short-clips/{id}|Chỉnh range/title/render profile/visual plan|
|POST|/api/short-clips/{id}/render|Render Short 9:16|
|GET|/api/provider-operations/{id}|Xem durable provider operation/reconciliation status|
|GET|/api/generation/image-capabilities|Lấy aspect ratios + quality tiers/resolved capability khả dụng cho provider/model hiện tại để UI render selector hợp lệ.|
|PATCH|/api/projects/{id}/image-generation-settings|Cập nhật default image aspect ratio + quality tier của Project.|
|PATCH|/api/visual-beats/{id}/generation-settings|Set/clear override aspect ratio, quality tier và crop strategy cho VisualBeat.|
|GET|/api/render-profiles|Lấy các Output Aspect Ratio + Video Quality preset hợp lệ và geometry đã resolve.|
|PATCH|/api/projects/{id}/render-settings|Cập nhật default output aspect ratio + video quality/crop strategy của Project.|
|GET|/api/notifications|Danh sách in-app notifications của user hiện tại.|
|POST|/api/notifications/{id}/read|Đánh dấu notification đã đọc; ownership theo current user.|
|GET/PATCH|/api/me/notification-preferences|Xem/cập nhật email/web-push preference.|
|GET|/api/me/entitlements|PlanEntitlement + watermark/quality/export/concurrency limits đã resolve.|
|GET|/api/me/usage|Usage window hiện tại: exports, credits, active expensive jobs và reset time.|
|GET|/api/system/limits|Các input/visual guardrail hiện hành để UI hiển thị: story chars/tokens, tracked chars/frame, upload limits.|
|POST|/api/projects/{id}/cost-estimates|Ước tính provider/GPU/TTS/render/storage cho operation manifest trước enqueue.|
|PATCH|/api/scenes/{id} (If-Match)|Update Scene với row\_version/ETag; stale version → 409 CONFLICT, không last-write-wins.|
|PATCH|/api/visual-beats/{id} (If-Match)|Update VisualBeat với optimistic concurrency token; stale → 409.|
|POST|/api/projects/{id}/operation-plans|Tạo cost/affected-scope plan cho full generation/edit/render/AI-video operation.|
|GET|/api/operation-plans/{id}|Lấy estimate range/confidence, breakdown, affected scope, reservation/spend/actual usage.|
|POST|/api/operation-plans/{id}/confirm|Confirm maxAuthorizedCost/credits và reserve budget trước enqueue.|
|POST|/api/operation-plans/{id}/increase-limit|Tăng authorized spend cho PAUSED\_COST\_LIMIT/RECONFIRMATION\_REQUIRED.|
|GET|/api/projects/{id}/cost-history|Project lifetime cost + operation-level internal/billable cost breakdown.|
|POST|/api/projects/{id}/visuals/batch-review|Batch approve/reject/regenerate; trả item-level success/conflict/invalid.|
|GET|/api/visual-beats/{id}/resolved-prompt|Preview structured auto-resolved prompt + current overrides.|
|PATCH|/api/visual-beats/{id}/prompt-override|Set/clear structured/raw prompt override trước generation.|
|GET|/api/projects/{id}/animatic|Browser animatic manifest: timing, images/placeholders, audio, subtitle, basic motion.|
|GET|/api/me/character-library|List reusable Character identities và CharacterVersion của user/workspace.|
|POST|/api/me/character-library|Tạo Character identity hoặc CharacterVersion.|
|POST|/api/projects/{id}/characters|Tạo ProjectCharacter assignment tới Character hiện có.|
|GET|/api/generation/video-capabilities|Capability/pricing-key metadata cho Veo/Kling/future providers.|
|POST|/api/visual-beats/{id}/generate-motion|Generate MotionAsset theo AUTO/explicit provider + AI-video budget.|
|GET|/api/video-generation-attempts/{id}|Attempt/provider operation/cost/status/output.|
|GET|/api/errors/{code}|Actionable Error Catalog entry cho UI/developer details.|
|POST|/api/story-versions/{id}/rights-attestation|Xác nhận quyền sử dụng nội dung trước analyze/generate|
|GET|/api/story-versions/{id}/safety|Lấy moderation state + allowed actions|
|POST|/api/moderation/{id}/review|Authorized review/resolve REVIEW khi policy cho phép|
|POST|/api/characters/{id}/references|Upload reference + reference\_type/consent metadata|
|POST|/api/identity-consents/{id}/revoke|Revoke consent và kích hoạt identity/reference lifecycle|
|DELETE|/api/projects/{id}|Durable project deletion lifecycle; không chỉ xóa row đồng bộ|
|POST|/api/account/deletion|Yêu cầu delete account/data lifecycle|
|GET/PATCH|/api/me/preferences|Locale/language preferences|
|POST|/api/projects/{id}/chapters|Add Chapter vào Project hiện hữu; lưu source text/StoryVersion relation và trả Chapter DRAFT.|
|GET|/api/projects/{id}/chapters|Danh sách Chapter theo chapter\_no/order, status, estimated duration và progress summary.|
|PATCH|/api/chapters/{id}|Sửa title/source text/metadata của Chapter với If-Match; tạo affected-scope assessment khi nội dung đã được phân tích.|
|PATCH|/api/projects/{id}/chapters/reorder|Reorder Chapter bằng optimistic concurrency; chỉ mark downstream scope OUTDATED khi dependency/ordering ảnh hưởng.|
|POST|/api/chapters/{id}/analyze|Analyze hoặc re-analyze riêng Chapter; chỉ gửi changed chapter + context/snapshots cần thiết tới planner.|
|POST|/api/chapters/{id}/generate|Tạo OperationPlan và enqueue visual/audio generation cho Chapter theo affected scope và asset reuse.|
|GET|/api/chapters/{id}/progress|Lấy durable chapter status/progress, current stage, completed/total work, active job và actionable error.|
|POST|/api/projects/{id}/continue|Resume các Chapter chưa hoàn tất hoặc tiếp tục Project từ Chapter mới; không enqueue chapter không bị ảnh hưởng.|
|POST|/api/projects/{id}/render-full|Render Full Project từ Chapter/scene clips đã sẵn sàng; trả readiness failures nếu còn Chapter bắt buộc chưa đạt.|

**11.2. Ví dụ response job**

{\
`  `"jobId": "job\_01...",\
`  `"type": "SHOT\_IMAGE\_GENERATE",\
`  `"status": "RUNNING",\
`  `"progress": 62,\
`  `"currentStep": "COMFYUI\_GENERATION",\
`  `"entityType": "SHOT",\
`  `"entityId": "shot\_123",\
`  `"errorCode": null\
}

**12. FRONTEND UX / MÀN HÌNH CHÍNH**

|**Màn hình**|**Nội dung**|
| :-: | :-: |
|Dashboard|Danh sách project, recent render, failed job cần xử lý|
|Create Project|Tên project, style mặc định, generation defaults và tùy chọn nhập Chapter đầu tiên; Image Generation defaults gồm aspect ratio + image quality.|
|Story Review|StoryVersion, chapter split hoặc Add Chapter theo đợt, source/version relation, Analyze|
|Characters|Danh sách nhân vật, status, version, lock/unlock|
|Character Editor|Character Bible + reference sheet + generation attempts|
|Storyboard|Chapter selector + Tree Chapter → Scene → VisualBeat/Shot, narration, image preview, regenerate; selector Inherit/Override cho aspect ratio và image quality ở từng visual unit.|
|Scene Editor|Prompt resolved/override, camera, characters, location, asset compare|
|Audio|Voice profile, narration preview, subtitle segments|
|Render|Readiness checklist, chọn Render Chapter hoặc Render Full Project, Output Aspect Ratio selector (16:9 / 9:16 / 1:1 / 4:3 / 3:4), Video Quality Standard/High, crop/fit/reframe preview và progress.|
|Asset Library|Ảnh/audio/video, filter theo entity/type|
|Admin Jobs|Failed jobs, retry/cancel, provider status|
|Login|Continue with Google; không form password/Keycloak cho V1.7|
|Shorts Studio|Candidate ranking, duration, Output Aspect Ratio 9:16 mặc định nhưng có thể đổi, visual density, Image Quality selector, reuse/crop/regenerate assets, safe-area preview, render/export.|
|Generation Details|StageAttempt/ProviderOperation timeline, error code, UNKNOWN/reconciliation status cho support/admin|
|Image Generation Settings|Project-level selectors: Aspect Ratio (16:9 / 9:16 / 1:1 / 4:3 / 3:4 theo capability) và Image Quality (DRAFT / STANDARD / HIGH), kèm cost/availability hint.|
|Onboarding|First-run checklist, sample/demo project, giải thích Story → Characters → Storyboard → Render và quality/cost basics; có thể skip/resume.|
|Notification Center|Render/Short completed/failed, provider/action required; unread badge, deep-link về project/job, mark read.|
|Plan & Usage|Plan entitlement, monthly export counters/reset, credits, watermark/quality availability và concurrent-job limit.|
|Conflict Resolution|Khi 409 stale version: hiển thị dữ liệu hiện tại vs thay đổi local; Reload, Copy local changes, Apply lại sau review; không silent overwrite.|
|Cost Plan / Confirm|Affected duration/scope, visual actions, provider calls/generated video seconds, reuse count, TTS/render/storage estimate, range/confidence/ETA, max authorized spend và stage breakdown.|
|Visual Review Grid|Batch approve/reject/regenerate, filters Needs Review/Identity Warning/Approved/Rejected/Failed, keyboard shortcuts và partial-result feedback.|
|Prompt Inspector|Auto-resolved layers + structured override + Advanced raw override warning; cost/capability hint trước submit.|
|Animatic|Browser timeline preview từ image/keyframe + audio + subtitle + lightweight motion; split/merge/timing adjustment trước final render.|
|Character Library|Global reusable Character identities/versions và ProjectCharacter assignments; không clone identity hoặc auto-update generation snapshots.|
|Motion / AI Video|Per-beat Still/Basic Motion/AI Video, AUTO/Veo/Kling provider, generated seconds, AI-video budget và attempt comparison.|
|Cost History|Lifetime project cost vs this-operation incremental cost; internal/billable/admin view, stage/provider breakdown và estimate-vs-actual.|
|Error Details|Human-readable error + recommended action; developer details: job/stage/correlation/provider operation without secrets.|
|Story Import Safety|Rights declaration + concise policy notice + moderation state; không làm user đọc legal wall trước mỗi thao tác.|
|Moderation Review|Hiển thị SAFE/REVIEW/BLOCK bằng human-readable message key, lý do ở mức phù hợp và action: Edit / Replace reference / Request review khi allowed.|
|Real-person Reference Consent|Reference type selector, consent/use-right checkbox, retention/deletion note trước upload/identity processing.|
|Privacy & Data|Trang quản lý reference/identity data, revoke/delete, project/account deletion status.|
|Language Settings|vi-VN/en-US UI; Project language controls tách source/narration/metadata language.|
|Rate-limit Error UX|429 hiển thị retry\_after và hành động cụ thể; không biến throttle thành generic provider error hoặc spam retry từ frontend.|
|Project Overview / Chapter Manager|Tổng quan Project, danh sách Chapter, chapter\_no/order, status DRAFT/ANALYZED/VISUAL\_READY/RENDERED, estimated duration, progress, affected-scope warnings và CTA Add Chapter / Continue Project.|
|Add Chapter|Nhập/paste Chapter mới, chọn source StoryVersion, preview rights/safety gate, xem inherited Character/Location/Style/settings snapshot trước khi lưu.|
|Chapter Workspace|Không gian tập trung cho Story Review → Analyze → Storyboard → Visual Review → Audio → Render của một Chapter; resume từ stage gần nhất.|
|Continue Project|Chọn Chapter mới hoặc Chapter đang dở, hiển thị phần đã hoàn tất/reuse, cost incremental và stages sẽ chạy; không tự regenerate Chapter không affected.|
|Chapter Selector trong Storyboard|Chuyển Chapter nhanh, giữ filter/review state theo Chapter, hiển thị trạng thái và progress; chapter order thay đổi phải phản ánh rõ affected downstream scope.|
|Render Chapter / Render Full Project|Hai CTA độc lập; readiness checklist theo scope, progress bền vững, retry/resume và cảnh báo khi Full Project còn Chapter chưa VISUAL\_READY/RENDERED.|

**12.1. UX nguyên tắc**

- Human-in-the-loop: user duyệt ở các điểm quan trọng; system không tự approve identity hoặc Short candidate chỉ vì model score cao.
- Không che giấu generation attempt; cho phép so sánh và rollback.
- Hiển thị rõ asset nào đang approved và version nào đã dùng.
- Progress theo persisted step thực tế: ANALYZING, PROVIDER\_SUBMIT, GENERATING\_IMAGE, UPLOADING, VIDEO\_COMPOSE, FINALIZE, RENDERING...
- Không bắt user regenerate toàn project khi chỉ một shot sai.
- Output Aspect Ratio và Video Quality là hai selector của render: long-form mặc định 16:9, Short mặc định 9:16, nhưng user có thể chọn 1:1, 4:3 hoặc 3:4. Standard/High map width×height theo ratio. Image Quality dùng tier riêng DRAFT/STANDARD/HIGH và không đồng nghĩa với video 720p/1080p. Image generation mặc định long-form 16:9 + STANDARD, Short 9:16 + STANDARD; DRAFT phù hợp preview khi chất lượng vẫn đủ dùng.

**12.2. Onboarding và empty states**

- Lần đăng nhập đầu tiên hiển thị checklist 4 bước: Create Project → Paste/Import Story → chọn style/aspect/quality → Analyze. User có thể Skip và mở lại từ Help.
- Dashboard rỗng phải có CTA “Create your first project” và sample/demo project; không hiển thị bảng trống không hướng dẫn.
- Characters/Storyboard/Asset Library/Shorts khi chưa có dữ liệu phải giải thích prerequisite và CTA đúng bước tiếp theo, ví dụ “Analyze story first” hoặc “Lock a character version”.
- Trước expensive generation lần đầu, UI giải thích DRAFT/STANDARD/HIGH, estimate cost và việc regenerate tạo attempt mới thay vì overwrite.

**12.3. Notification cho long-running jobs**

- Khi browser đang mở, SSE cập nhật progress realtime; khi browser đóng, job vẫn chạy vì state nằm ở backend/worker.
- Khi Render/Short COMPLETED hoặc FAILED, hệ thống luôn tạo in-app notification; email là opt-in theo preference. Web Push là extension sau MVP nếu cần.
- Notification deep-link về đúng Project/Render/Job; failure notification hiển thị error code/actionable next step, không chỉ “Something went wrong”.
- Notification dispatch dùng outbox/idempotency để job completion không bị rollback chỉ vì email provider lỗi.

**12.4. Plan, watermark và usage UX**

- UI hiển thị plan capability trước khi user chọn High/1080p hoặc export; option bị khóa phải nêu lý do và reset/upgrade path, không chỉ disable im lặng.
- FREE launch baseline hiển thị rõ: watermark, Standard 720p max, 1 long-form + 3 Short exports/tháng, 1 expensive job đồng thời.
- Watermark policy được preview trong Render/Short Studio trước enqueue. Server mới là nguồn quyết định cuối; UI không tự gỡ watermark bằng request flag.
- Usage page tách AI credits khỏi export count để user hiểu generation cost và publishing/export entitlement là hai loại giới hạn khác nhau.

**12.5. Cost confirmation UX**

- Không hiển thị một con số tổng duy nhất. Cost sheet phải nêu affected scope, reusable vs new visual, expected provider calls, generated AI-video seconds, TTS duration, render/storage và range/confidence.
- Với edit, UI tách “This operation incremental cost” khỏi “Project lifetime cost”.
- Estimate có ba mức: LOW trước Analyze, MEDIUM sau semantic analysis, HIGH sau Visual/Motion Plan + provider resolution; hệ thống re-estimate khi assumptions đổi.

**12.6. Review/prompt/animatic UX**

- Grid batch review là workflow mặc định cho hàng chục/hàng trăm visual; detail drawer chỉ mở khi cần compare/regenerate/prompt edit.
- Prompt preview tách auto-resolved context khỏi user override để không vô tình xóa Character/Location constraints.
- Animatic ưu tiên browser playback gần-zero compute; Draft MP4 có thể thêm sau nhưng không là prerequisite để duyệt pacing.

**13. CÔNG NGHỆ VÀ CÔNG CỤ PHÁT TRIỂN**

|**Layer**|**Công nghệ đề xuất**|**Vai trò**|
| :-: | :-: | :-: |
|Frontend|Next.js + TypeScript + React + Tailwind CSS + TanStack Query + React Hook Form/Zod|Web UI, server-state, forms/validation, SSE consumer|
|Core Backend|Java 21+ + Spring Boot 4.1.0 + Spring Security + Spring Data JPA|Business/domain, Google OIDC/session, API, durable orchestration|
|AI Worker|Python 3.12|LLM/image/TTS/provider adapters, identity QA, FFmpeg orchestration|
|DB|PostgreSQL|Transactional metadata|
|Queue/Cache|Redis|Work delivery/cache/progress; không là nguồn sự thật của durable state|
|Object Storage|MinIO dev / S3-compatible prod|Images, audio, video|
|AI Workflow|Vertex AI provider adapters + optional ComfyUI|Gemini planning, managed/self-hosted image/video workflow execution.|
|AI Libraries|PyTorch/Diffusers khi cần|Custom model integration/processing|
|Video|FFmpeg|Compose/mix/encode/render|
|Image Processing|Pillow/OpenCV|Pre/post-process|
|Container|Docker + Docker Compose (local) + OCI containers (staging/prod)|Reproducible local dev; same versioned images promoted to staging/production.|
|IDE|IntelliJ IDEA + VS Code/Cursor|Java + frontend/Python|
|API Tool|Bruno/Postman|API testing|
|DB GUI|DBeaver|Database inspection|
|Character Consistency V1|Reference-based workflow / IP-Adapter-compatible / FaceID-compatible tùy model|Giữ identity dựa trên Character Master và references.|
|Pose/Structure Control|ControlNet pose/depth/edge khi workflow hỗ trợ|Điều khiển tư thế/bố cục mà không đổi identity.|
|Personalization V2|LoRA/adapter per character khi cần|Tối ưu nhân vật xuất hiện rất nhiều lần; không bắt buộc cho MVP.|
|Identity QA|Face/identity embedding hoặc vision scorer + manual review|Flag ảnh có nguy cơ drift; không auto-approve tuyệt đối.|
|Authentication|Google OIDC + Spring Security HttpOnly session|No Keycloak; provider secrets không đi qua browser|
|Provider Safety|StageAttempt + ProviderOperation + reservation/reconcile + circuit/rate limit|Chống duplicate submission, UNKNOWN, provider storm và uncontrolled spend.|
|Render Profiles|FFmpeg Standard/High presets|16:9 long-form và 9:16 Shorts|
|Image Generation Profiles|Provider capability adapter + persisted profile/settings|Map aspect ratio/quality tier provider-agnostic sang request vendor-specific; validate output dimensions và cost estimate.|
|Production Runtime|Managed container platform / Kubernetes-class runtime|Chạy Next.js/API/CPU workers bằng immutable container; hỗ trợ rolling deploy và horizontal scale.|
|CI/CD|GitHub Actions (hoặc equivalent) + protected main|PR quality gates; build/test/image; staging deploy; manual production promotion.|
|Container Registry|GHCR/managed OCI registry|Lưu immutable image tag theo commit/release; prod không build trực tiếp trên server.|
|DB Migration|Flyway (backend-owned)|Versioned PostgreSQL migration; staging rehearsal; production migration có pre-backup và backward-compatible policy.|
|Secrets|Managed Secret Manager / runtime secret injection|OIDC/provider/storage/email secrets không nằm trong repo/.env shipped to browser.|
|Observability|OpenTelemetry + metrics/logs/traces backend|Correlation across UI/API/job/worker/provider; SLO alerting.|
|Notification|In-app + email provider adapter + transactional outbox|Render completion/failure delivery không coupling domain với email vendor.|
|GPU Scheduling|Dedicated GPU queue + worker pool|ComfyUI/self-hosted model only; scale 0..4 MVP, one heavy workflow/GPU default, resource usage measured per stage.|
|Primary LLM|Gemini on Vertex AI via Google Gen AI SDK / Vertex client + ADC|Story/scene/visual/prompt/highlight planning; exact model/project/location externalized.|
|Managed Video AI|Vertex AI Veo adapter (future/optional selected beats)|AI video MotionAsset; không thay image-first pipeline.|
|External Video AI|Kling adapter (future/optional)|Second VideoGenerationProvider implementation; capability/cost routed, no domain lock-in.|
|Cost/Usage|PostgreSQL OperationPlan + CostReservation + UsageLedger + ResourceUsageRecord|Realtime per-user attribution, estimate/reserve/meter/finalize; billing export used for reconciliation only.|

**13.1. Java hay Go?**

Core backend được chọn Java/Spring Boot vì domain có nhiều quan hệ, transaction, security và business rule. Go vẫn phù hợp cho các service I/O/concurrency chuyên biệt về sau (notification, websocket gateway, media upload), nhưng không mang lại lợi ích đủ lớn để thay Java trong V1.

**13.2. Vì sao Python vẫn cần**

Python Worker là boundary kỹ thuật cho AI. Nó chứa dependency GPU/model, ComfyUI client, prompt adapter, image processing, TTS integration và FFmpeg orchestration. Core domain Java không import hoặc phụ thuộc trực tiếp PyTorch/ComfyUI.

**14. CẤU TRÚC SOURCE CODE ĐỀ XUẤT**

auto-video-tool/                 # master/orchestrator workspace\
├── auto\_video\_backend/           # separate Git repo - Spring Boot modular monolith\
│   └── src/main/java/...\
├── auto\_video\_worker/            # separate Git repo - Python 3.12 AI/media worker\
│   ├── jobs/\
│   ├── providers/\
│   ├── media/\
│   └── ffmpeg/\
├── auto\_video\_ui/                # separate Git repo - Next.js\
│   ├── app/\
│   ├── components/\
│   ├── features/\
│   └── lib/\
└── docs/\
`    `└── spec/\
`        `├── PROJECT\_SPEC.md\
`        `├── DOMAIN\_MODEL.md\
`        `└── BUSINESS\_RULES.md\
\
Rule: master workspace điều phối plan/review; implementation có thể dùng worktree ở từng repo. Canonical Markdown specs đặt trong docs/spec và viết bằng English.

**14.1. Rule phụ thuộc module**

- Domain module không gọi trực tiếp provider SDK.
- generation module điều phối job thông qua port/interface; adapter nằm ở integration layer.
- asset module quản lý metadata + storage abstraction; không để các module tự nối MinIO/S3 tùy ý.
- shared chỉ chứa primitive/cross-cutting nhỏ, không chứa business logic dùng chung giả tạo.
- Python worker có model adapter để thay workflow/provider mà không sửa orchestration chung.

**15. BẢO MẬT, HIỆU NĂNG VÀ VẬN HÀNH**

**15.1. Yêu cầu phi chức năng**

|**ID**|**Nhóm**|**Yêu cầu**|
| :-: | :-: | :-: |
|NFR-01|Security|Mọi API project-scoped phải check ownership/role.|
|NFR-02|Durability|Metadata không mất khi worker restart; job state persisted.|
|NFR-03|Idempotency|Retry không tạo duplicate billing/output ngoài ý muốn.|
|NFR-04|Scalability|Có thể scale AI worker độc lập core backend.|
|NFR-05|Observability|Log có correlation\_id/job\_id/project\_id.|
|NFR-06|Recoverability|Project render có thể retry incremental từ scene đã hoàn tất.|
|NFR-07|Performance|API đọc/ghi metadata phản hồi nhanh; generation không block request thread.|
|NFR-08|Storage|Asset sử dụng checksum, lifecycle/retention và signed URL.|
|NFR-09|Audit|Ghi timestamp trạng thái generation/render quan trọng.|
|NFR-10|Maintainability|Provider/model được bọc bằng adapter; workflow có version.|
|NFR-11|Provider Safety|Mọi external submit có durable reservation; ambiguous outcome không được auto-resubmit.|
|NFR-12|Final Artifact Integrity|Parent job không COMPLETED nếu FinalArtifact thiếu/invalid hoặc required stage chưa complete.|
|NFR-13|Media Geometry|Image và final video phải lưu width/height dương; requested aspect ratio, actual dimensions và RenderProfile phải validate. Standard/High geometry phải đúng ratio và không stretch ảnh.|
|NFR-14|Auth|Google OIDC/session phải hoạt động không Keycloak; mọi project-scoped API vẫn check ownership.|
|NFR-15|Short Quality|Short đáp ứng duration policy, 9:16 profile và adaptive visual density trong quota.|
|NFR-16|Generation Capability|Aspect ratio/quality selector phải capability-aware; unsupported combination bị chặn trước provider submit để tránh request lỗi hoặc phát sinh chi phí không cần thiết.|
|NFR-17|Generation Reproducibility|Mỗi GenerationAttempt lưu requested ratio, quality tier, resolved provider option và actual dimensions để audit/regenerate/cost analysis.|
|NFR-18|Render Geometry Mapping|Mọi ratio hỗ trợ phải có deterministic mapping cho Standard/High và encoder-safe dimensions; render manifest lưu ratio + width + height + crop/reframe strategy.|
|NFR-19|Environment Isolation|Dev/staging/prod tách DB, object storage root/bucket, Redis namespace, OIDC callback và secrets; không dùng production credential trong staging.|
|NFR-20|CI/CD|PR phải pass backend/UI/worker tests + lint/type/contract build. Main deploy staging tự động; production yêu cầu manual approval và immutable image promotion.|
|NFR-21|Database Recovery|Production PostgreSQL có automated backup + PITR; target RPO ≤15 phút, RTO ≤4 giờ; retention backup tối thiểu 30 ngày và restore drill tối thiểu mỗi quý.|
|NFR-22|Critical Media DR|Character Master/Reference, Approved Asset và FinalArtifact phải có object versioning + secondary failure-domain replication/backup; target RPO ≤1 giờ, RTO ≤8 giờ.|
|NFR-23|Rebuildable Media DR|Intermediate attempts/cache có thể dùng cheaper retention với RPO ≤24 giờ hoặc regenerate nếu metadata/prompt snapshot còn; không áp SLA critical media cho mọi temporary file.|
|NFR-24|Redis Recoverability|Redis không là authoritative store. Mất Redis phải có thể reconstruct queued/retryable work từ PostgreSQL/outbox mà không double-submit provider.|
|NFR-25|Production HA|Spring Boot API production baseline tối thiểu 2 replicas khi self-hosted; health/readiness probes và rolling deployment không làm mất durable jobs.|
|NFR-26|GPU Capacity|Managed-provider mode cho phép GPU pool=0. Self-hosted ComfyUI baseline 1 warm GPU, max 4 GPU workers cho MVP; default concurrency 1 heavy generation/GPU và VRAM class được benchmark theo workflow.|
|NFR-27|GPU Autoscaling|Scale out khi oldest GPU queue age >120s hoặc queue depth/active GPU >3 trong 5 phút; scale in sau ≥15 phút không có queued GPU job và GPU idle. Threshold là config/observed metric.|
|NFR-28|Resource Accounting|Mỗi expensive stage ghi provider operation cost nếu có, gpu\_seconds, cpu\_seconds và storage/egress metrics; estimate-vs-actual sai lệch phải quan sát được.|
|NFR-29|Concurrency Integrity|Mutable entities dùng optimistic locking; stale writes trả 409 và không được silent last-write-wins. Locked/approved snapshots remain immutable.|
|NFR-30|Notification Reliability|In-app terminal notification phải được persist trong ≤30s sau job terminal commit; email dispatch target enqueue ≤2 phút. Email delivery itself là best-effort/retryable và không thay job status.|
|NFR-31|Entitlement Enforcement|Watermark, max quality, export/month và concurrent expensive-job limits phải enforce server-side atomically với usage window; race không được cho phép vượt quota.|
|NFR-32|Input Boundaries|Story input và tracked-character/frame limits được expose qua configuration endpoint; reject phải xảy ra trước provider submit để tránh phát sinh cost không cần thiết.|
|NFR-33|Cost Isolation|Mọi expensive operation/resource record truy được billed\_to\_user\_id và không thể consume credit/quota user khác do thiếu attribution.|
|NFR-34|Cost Guardrail|Budget reservation + max authorized spend được enforce trước provider/GPU billable stage; overrun chuyển pause/reconfirm, không silent continue.|
|NFR-35|Incremental Efficiency|Edit nhỏ không kích hoạt full-project regeneration khi dependency graph xác định được unaffected snapshots.|
|NFR-36|Scheduler Fairness|Priority không làm một user starve user khác; resource class isolation tránh Identity QA/background task chiếm slot main generation/render.|
|NFR-37|GPU Safety|Self-host GPU heavy concurrency mặc định 1/GPU; lease/resource scheduler chặn OOM do uncontrolled parallel ComfyUI workflow.|
|NFR-38|Provider Resilience|Rate limiter, circuit breaker và retry cap theo provider route; auth/billing hard failure không retry loop.|
|NFR-39|Stall Detection|RUNNING stage có heartbeat/lease; stale stage được phát hiện trong bounded time và chuyển STALLED/reconcile.|
|NFR-40|Atomic Media|Không expose partial/truncated output; FinalArtifact READY chỉ sau validate + immutable storage promotion.|
|NFR-41|Review Productivity|Batch visual review xử lý hàng trăm visual mà không buộc mở từng detail; item conflict không làm mất batch progress.|
|NFR-42|Provider Portability|Gemini/Veo/Kling-specific SDK/options nằm adapter layer; domain/persistence dùng provider-agnostic capability/mode/pricing snapshots.|
|NFR-43|Estimate Transparency|Estimate hiển thị range, confidence, assumptions, affected scope và breakdown; không trình bày estimate như invoice guaranteed.|
|NFR-44|Safety|Input/output moderation + policy versioning; hard-block categories fail closed for generation/publish.|
|NFR-45|Prompt Security|Untrusted-data separation, structured output, allowlist validation; LLM cannot authorize tools/billing/storage/ownership.|
|NFR-46|Privacy|Reference/identity data tenant-isolated; sensitive identity template never appears in logs/public manifests.|
|NFR-47|Abuse Resistance|Account/IP/route throttling + concurrency/fairness before cost/provider submission.|
|NFR-48|Data Lifecycle|Project/account deletion is durable, idempotent, observable and covers derivatives/late external results.|
|NFR-49|Localization|Stable codes/message keys support vi-VN/en-US without changing domain enums/state.|

**15.2. Security checklist**

- Google OIDC callback do Spring Security xử lý; authenticated state dùng HttpOnly/Secure/SameSite server session, không lưu provider token/key trong localStorage.
- Spring Security authorization theo project ownership/role.
- Không expose MinIO bucket public; sử dụng signed URL ngắn hạn.
- Provider/cloud credentials chỉ ở backend/worker runtime identity/secret store. Vertex AI production ưu tiên workload identity/ADC; không nhúng service-account JSON/API key vào frontend hoặc ship trong app. Kling/future provider secrets cũng server-side only.
- Validate file upload: type/size/checksum.
- Rate limit ở hai lớp: public generation endpoints theo user/plan và outbound provider route theo provider/model/location/capability; outbound limiter phối hợp circuit breaker.
- Sanitize filename/path; storage key do server tạo.
- Audit các thao tác billing, lock character, render và admin retry.
- Audit ProviderOperation submission/reconciliation; UNKNOWN hoặc manual resolution phải có actor/timestamp/evidence.
- AI audit trail lưu model/prompt/schema/policy version + fingerprints/usage; raw sensitive prompt/reference chỉ giữ theo retention cần thiết.
- Data deletion lifecycle revoke URL, cancel/reconcile job, delete/expire reference derivatives/identity data và quarantine late provider result.
- Account abuse limiter chạy trước quota/cost/provider submission; provider rate limit/circuit breaker vẫn là lớp riêng.
- Real-person reference có consent/reference\_type; identity embedding/template không log, không cross-tenant reuse và có retention/deletion policy.
- Rights attestation/version lưu theo StoryVersion; copyright report/takedown có audit và khả năng disable generation/publishing.
- Story text luôn được coi là untrusted data; chống prompt injection bằng system/data boundary, schema validation, allowlist và security scanner defense-in-depth.
- Sexual content involving minors là hard block; không có normal-user override.
- Input moderation cho StoryVersion/reference/prompt override trước AI planning/generation; output moderation trước publishable asset.

**15.3. Logging/metrics**

|**Tín hiệu**|**Ví dụ**|
| :-: | :-: |
|Logs|job\_started, provider\_call\_failed, asset\_uploaded, render\_completed|
|Metrics|job queue depth/oldest age, success rate, P95 job duration, provider error rate, render throughput, GPU utilization/queue age, gpu\_seconds/job, estimate-vs-actual cost, notification lag, export quota rejects; estimate-vs-actual error, cost/user/day, cost/provider/model, reserved-vs-consumed, AI-video seconds, cache/reuse ratio, GPU lease utilization, STALLED count, circuit state.|
|Tracing|request → create job → worker attempt → storage/provider|
|Alerts|queue backlog, repeated provider 5xx/429, storage unavailable, render failure spike, backup/PITR failure, GPU queue age > threshold, notification outbox stuck, staging/prod drift|

**15.4. Environment topology và production baseline**

|**Environment**|**Baseline**|**Rules**|
| :-: | :-: | :-: |
|Local/Dev|Docker Compose; local PostgreSQL/Redis/MinIO; fake provider mặc định, real dev credentials tùy developer.|Có thể reset dữ liệu; không chứa production secrets hoặc production user data.|
|Staging|Cùng OCI image với candidate release; isolated PostgreSQL/Redis/bucket; provider sandbox/limited-real; capacity nhỏ.|Tự deploy từ main; chạy migration, smoke/E2E, render test và restore rehearsal trước prod.|
|Production|LB/TLS, >=2 API replicas, private PostgreSQL HA/PITR, Redis, versioned S3-compatible storage, CPU workers, optional GPU pool, observability/secret manager.|Không build trên server; chỉ promote immutable artifact đã qua staging; single-node MinIO không được dùng làm sole copy của critical media.|

**15.5. CI/CD và release workflow**

- Pull Request gate: backend Maven tests/package, worker pytest + Ruff + mypy, UI lint/type/test/build, contract tests, dependency/security scan; fail gate thì không merge protected main.
- Merge main: build immutable OCI images theo commit SHA/release tag, tạo SBOM/build metadata, push registry và deploy staging.
- Staging: apply Flyway migrations, health/readiness checks, auth smoke, story→job contract, storage signed URL, minimal render smoke và provider health test.
- Production promotion: manual approval; snapshot/verify backup trước migration; deploy rolling/blue-green; run smoke tests; rollback application image ngay khi health/SLO fail. DB migration ưu tiên backward-compatible/forward-fix thay vì destructive rollback.
- Secrets/config được inject theo environment; không copy .env production vào build artifact hoặc frontend bundle.

**15.6. Backup và disaster recovery**

|**Data class**|**Backup/replication policy**|**Target**|
| :-: | :-: | :-: |
|PostgreSQL metadata|Managed automated backups + WAL/PITR; daily snapshot; backup retention >=30 days; pre-migration snapshot; quarterly restore drill.|RPO <=15 min; RTO <=4 h.|
|Critical object media|Object versioning + secondary bucket/failure-domain replication for Character Master/References, Approved Assets, FinalArtifacts; deleted versions retained >=30 days.|RPO <=1 h; RTO <=8 h.|
|Intermediate/rebuildable media|Lifecycle/retention theo cost; có thể backup chậm hơn hoặc regenerate từ persisted prompt/reference/model snapshots.|RPO <=24 h hoặc regenerate; restore không block critical project recovery.|
|Redis|Không coi Redis là backup source; queue/cache state rebuild từ PostgreSQL/outbox.|Mất Redis không làm mất authoritative job/provider state hoặc tạo double-submit.|

Nếu production vẫn self-host MinIO, phải chạy distributed/replicated deployment và có secondary backup/replication sang failure domain khác; một MinIO node/volume duy nhất chỉ phù hợp local/dev, không phải disaster-recovery strategy.

**15.7. Capacity planning và GPU cost model**

|**Workload**|**MVP production baseline**|**Scale/capacity rule**|
| :-: | :-: | :-: |
|Core API|2 replicas; stateless session metadata where possible, durable state in PostgreSQL.|Scale on CPU/P95 latency; generation không chạy trong request thread.|
|CPU AI/Media Worker|Min 2 processes/replicas; I/O provider jobs concurrency 4–8 tùy benchmark; FFmpeg concurrency 1–2/worker tùy CPU/RAM.|Separate queues/worker pools để FFmpeg không starve provider orchestration.|
|GPU Image/Video Worker|Optional self-hosted pool 0..4 MVP; default 1 heavy workflow/GPU via lease. Vertex AI Gemini/Veo managed execution không dùng GPU pool của app.|Scale theo GPU queue depth/oldest age + measured gpu\_seconds/VRAM. Chỉ cho 2 workflows/GPU sau benchmark chứng minh ổn định.|
|Autoscaling signal|GPU queue age/depth + GPU utilization + plan budget.|Scale out nếu oldest age >120s hoặc queue depth/active GPU >3 trong 5m; scale in sau 15m idle/no queued GPU work.|
|Capacity review|Benchmark P50/P95 seconds/image, seconds/video-second, FFmpeg real-time factor và failure rate theo workflow\_version/quality.|Review weekly khi beta; monthly khi ổn định; update estimate coefficients without changing domain logic.|
|Vertex AI / managed provider|Pay-as-you-go baseline; rate/capacity config theo model/location; no self-host GPU required.|Track provider latency/429/cost; only consider reserved/provisioned capacity when real traffic justifies it.|
|CPU scene render|Parallel-per-scene bounded by vCPU/memory; all clips normalized codec/fps/resolution/audio.|Encode scene clips in parallel then concat/stream-copy where compatible; avoid re-encoding whole long video.|

Cost model (dynamic / provider-agnostic):\
\- visual\_budget = Σ(scene\_duration × base\_density × complexity\_multiplier)\
\- new\_image\_calls = planned\_visuals - reusable - reusable\_with\_reframe/basic\_motion\
\- estimated\_gpu\_cost = estimated\_gpu\_seconds / 3600 × effective\_gpu\_hour\_rate\
\- ai\_video\_cost = generated\_motion\_seconds × resolved provider pricing function\
\- estimated\_operation\_cost = Vertex planning + image + AI-video + TTS + render + storage/egress\
\- actual\_internal\_cost = measured provider/GPU/CPU/storage/egress\
\- billable\_cost = policy-derived amount charged/credited to user; may differ from internal cost\
\
For edit operations, all formulas apply only to affected scope. Pricing/rates are versioned configuration and never hard-coded as business constants.

**15.8. Concurrency và multi-user data integrity**

- V1 dù mới có Creator vẫn phải dùng optimistic locking cho Project settings, Scene, VisualBeat, editable CharacterVersion draft và Short draft để chống lost update giữa nhiều tab/retry.
- Entity có row\_version BIGINT. API PATCH nhận expectedVersion hoặc If-Match; update atomically theo id+version và tăng version. Stale writer nhận 409 CONFLICT/STALE\_VERSION.
- UI conflict flow: Reload latest, xem thay đổi local, copy/local-diff và submit lại sau review. Không tự merge prompt/narration phức tạp ở backend.
- V2 Editor/project sharing tái sử dụng cùng optimistic-lock contract; presence/soft editing indicator có thể thêm sau, nhưng không dùng long database lock làm UX collaboration.
- Immutable snapshots (LOCKED CharacterVersion, Approved Asset, RenderVersion) không tham gia overwrite conflict; thay đổi luôn tạo version/attempt mới.

**15.9. Per-user cost accounting và reconciliation**

- Mọi OperationPlan/Job/UsageRecord có billed\_to\_user\_id; internal platform cost và billable user cost tách riêng.
- Cost history hỗ trợ user/project/operation/stage/provider/model. Vertex AI request metadata/billing labels (không dùng PII) có thể dùng để đối soát Cloud Billing export; realtime quota vẫn dựa PostgreSQL.
- Admin/internal operation vẫn ghi usage; support credit/refund tạo ledger entry riêng thay vì sửa/xóa history.

**15.10. Storage lifecycle cho generation attempts**

- APPROVED/active source assets ở hot storage; rejected recent giữ hot theo retention; rejected old có thể chuyển cold/archive. Metadata/attempt history vẫn giữ để audit.
- UI dùng thumbnail WebP/AVIF derivative; không overwrite original reject chỉ để giảm size.

**15.11. Parallel scene rendering**

- Scene clips có thể encode song song theo bounded CPU\_RENDER concurrency. RenderProfile normalize codec, resolution, fps, pixel format, audio codec/sample rate/channel layout.
- Final concat ưu tiên stream-copy/low-cost concat khi scene clips compatible; chỉ encode lại khi manifest/profile bắt buộc.

**16. MVP, TIÊU CHÍ NGHIỆM THU VÀ ROADMAP**

**16.1. MVP Release 1**

- Google OIDC + project ownership + StoryVersion lifecycle.
- Real Story Analyzer qua provider adapter, structured JSON schema validation; fake provider chỉ dùng test.
- Character Bible + CharacterVersion + lock.
- Character reference generation/upload.
- Storyboard Scene/Shot editor.
- Generate image theo shot và lưu attempts.
- Approve/rollback image.
- TTS narration + subtitle cơ bản.
- FFmpeg image motion + scene/chapter/final render với Standard 720p và High 1080p; FinalArtifact validation.
- SSE job/stage progress + durable ProviderOperation/UNKNOWN reconciliation.
- Docker Compose local/dev + reproducible OCI images; staging deploy from main and production promotion with manual approval.
- Story/chapter bất kỳ độ dài hợp lý có thể được semantic-split thành scene + visual beats và render async; baseline visual budget khoảng 2,5/phút, không hard-code theo 2.000 từ.
- Character Master/CharacterVersion đã lock có thể được tái sử dụng qua nhiều chapter; scene lưu snapshot version/reference đã dùng.
- User có thể thay Outfit cho nhân vật mà không tạo Character mới.
- User có thể regenerate đúng một visual beat/shot và giữ nguyên các attempt/asset đã approve trước đó.
- User có thể tạo Short/Reel từ ranked highlight candidate, hard minimum 30s, default 45–60s, 9:16 và adaptive visual density.
- Provider operation được reserve trước submit; timeout mơ hồ trở thành UNKNOWN và không double-submit.
- PostgreSQL backup/PITR + restore drill và critical object-storage replication/versioning đạt RPO/RTO production targets trước public launch.
- Notification Center + optional email cho render/Short terminal state; user không cần giữ tab mở.
- Optimistic locking + 409 conflict UX hoạt động cho mutable Scene/VisualBeat/Project settings trước khi bật Editor V2.
- FREE entitlement baseline enforce server-side: watermark, Standard 720p max, 1 long-form + 3 Short exports/tháng, 1 expensive job đồng thời.
- Self-hosted ComfyUI chỉ bật production khi GPU benchmark/cost telemetry đạt; basic GPU autoscaling 0/1..4 được cấu hình. Managed-provider mode không bắt buộc GPU.
- Vertex AI Gemini real adapter + ADC/workload identity production path cho story/scene/visual/prompt/highlight planning.
- Per-user OperationPlan/CostReservation/UsageLedger: estimate range + max spend + actual internal/billable usage; không dựa fixed 150-image rule.
- Affected Scope + Asset Reuse cho edit/incremental regeneration; cost preview tách this-operation khỏi lifetime project cost.
- Visual Review Grid batch approve/reject/regenerate + Prompt Inspector + browser Animatic.
- Resource-class scheduler, per-user fairness, GPU lease, retry cap, rate limiter, circuit breaker, heartbeat/watchdog, atomic finalization và Error Catalog.
- VideoGenerationProvider contract + MotionAsset/VideoGenerationAttempt sẵn sàng cho Veo/Kling; có thể feature-flag AI video nếu chưa bật provider production.
- Personal Character Library + Project snapshot import.

**16.2. Tiêu chí nghiệm thu MVP**

|**ID**|**Tiêu chí**|
| :-: | :-: |
|AC-01|Một truyện hợp lệ có thể được phân tích thành tối thiểu character + scene có cấu trúc.|
|AC-02|Một nhân vật có thể tạo nhiều version và lock một version.|
|AC-03|Khi generate nhiều scene, hệ thống luôn gắn đúng character\_version/reference snapshot vào attempt.|
|AC-04|Regenerate một shot không xóa output cũ.|
|AC-05|Job lỗi có error code và có thể retry khi phù hợp.|
|AC-06|User có thể chọn ảnh approved cho từng shot.|
|AC-07|TTS tạo duration và scene có thể render theo narration.|
|AC-08|Final render ghép được nhiều scene thành MP4.|
|AC-09|User A không truy cập được project/asset của User B.|
|AC-10|Restart worker không làm mất job đã persist/enqueue theo thiết kế.|
|AC-11|Một chapter khoảng 2.000 từ được chia thành scene + visual beats có cấu trúc, không áp dụng 1 câu = 1 ảnh.|
|AC-12|Character đã lock ở Project được dùng lại ở chapter khác mà không tạo identity mới.|
|AC-13|Outfit có thể đổi theo scene nhưng CharacterVersion vẫn được giữ nguyên.|
|AC-14|GenerationAttempt lưu đầy đủ character/outfit/reference/workflow/model snapshot.|
|AC-15|Identity QA flag không tự xóa/ghi đè ảnh; user vẫn approve/reject/regenerate được.|
|AC-16|Video dài dùng adaptive visual budget theo duration/semantic complexity/reuse; ví dụ 1 giờ có thể quanh một baseline tham chiếu nhưng không có target ảnh cố định và scene tĩnh/hành động có mật độ khác nhau.|
|AC-17|Short candidate <30s không được render; default recommendation ưu tiên 45–60s khi có đủ nội dung.|
|AC-18|Short 45s có thể dùng khoảng 8–10 visual theo baseline nhưng planner được giảm/tăng theo complexity mà không phá timeline.|
|AC-19|Google login tạo authenticated session mà không cần Keycloak và User A vẫn không truy cập project User B.|
|AC-20|Provider reservation được persist trước submission; ambiguous outcome chuyển UNKNOWN và không tạo submission thứ hai.|
|AC-21|Hai provider có cùng operation id string vẫn được lưu là hai identity khác nhau.|
|AC-22|Parent job chỉ COMPLETED sau khi FINALIZE tạo FinalArtifact hợp lệ; FFmpeg width/height phải >0.|
|AC-23|Duplicate storage key trong migrate/reconcile được quarantine/flag, không silently drop media row.|
|AC-24|MIME validation cho media không phụ thuộc letter case.|
|AC-25|User có thể chọn default image aspect ratio + quality ở Project; VisualBeat/Shot có thể inherit hoặc override mà không ảnh hưởng asset/attempt cũ.|
|AC-26|UI tối thiểu hỗ trợ 16:9, 9:16, 1:1, 4:3, 3:4 khi provider capability cho phép; unsupported ratio không được enqueue provider call.|
|AC-27|Image Quality DRAFT/STANDARD/HIGH được map qua adapter; GenerationAttempt lưu requested tier và actual width/height của output.|
|AC-28|Đổi Project image settings chỉ áp dụng cho generation mới; regenerate tạo attempt mới với snapshot setting mới và không overwrite artifact trước.|
|AC-29|Nếu image ratio khác RenderProfile, UI hiển thị preview crop/fit/reframe và render không được làm méo hình bằng stretch.|
|AC-30|User có thể chọn output 16:9, 9:16, 1:1, 4:3 hoặc 3:4; Standard/High resolve đúng width×height và FinalArtifact lưu geometry thực tế.|
|AC-31|Long-form mặc định 16:9 và Short mặc định 9:16 nhưng user có thể đổi ratio trước render; preview cho thấy crop/fit/reframe trước khi enqueue.|
|AC-32|StoryVersion 500.001 chars hoặc >120.000 estimated tokens bị reject trước AI enqueue; response cho biết current/max limit và không silently truncate.|
|AC-33|VisualBeat/Shot có 5 tracked named characters không được submit V1; UI/Planner yêu cầu split/reframe/background extras. 4 characters hợp lệ nhưng UI hiển thị identity-risk warning.|
|AC-34|Hai client cùng đọc Scene version=7: client A update thành v8; client B update với expected v7 phải nhận 409 và nội dung A không bị overwrite.|
|AC-35|Render COMPLETED/FAILED tạo đúng một in-app notification; email preference bật thì dispatch async. Email failure không rollback render và retry không tạo duplicate notification.|
|AC-36|FREE user không thể request High/1080p hoặc bỏ watermark bằng sửa payload; export thứ 2 long-form hoặc thứ 4 Short trong cùng tháng bị server reject với reset/limit info.|
|AC-37|Main branch release có thể deploy staging bằng immutable images, chạy migration + smoke/E2E, sau đó production chỉ qua manual approval; prod không build source trực tiếp.|
|AC-38|Restore drill chứng minh PostgreSQL RPO<=15m/RTO<=4h và critical media recovery target RPO<=1h/RTO<=8h trong documented exercise.|
|AC-39|Managed-provider deployment chạy production với GPU pool=0. Khi self-hosted ComfyUI enabled, queue metrics có thể scale GPU workers từ 1 tới configured max 4 và scale-in sau idle policy.|
|AC-40|Mỗi self-hosted GPU stage ghi measured gpu\_seconds; cost estimate trước job và actual usage sau job được lưu để so sánh estimate-vs-actual.|
|AC-41|First-time user thấy onboarding/empty-state CTA và có thể tạo project đầu tiên mà không cần hiểu nội bộ provider/job architecture.|
|AC-42|Dev/staging/prod có DB/storage/secrets tách biệt; automated config test fail deployment nếu staging trỏ production bucket/database/credential marker.|
|AC-43|Mọi expensive operation tạo OperationPlan có requested\_by\_user\_id/billed\_to\_user\_id, estimate range và max authorized spend trước enqueue/provider submission.|
|AC-44|30-minute new video, 30-minute edit inside 2-hour project và 2-hour new project tạo ba OperationPlan khác nhau; edit estimate chỉ tính affected scope.|
|AC-45|Cost plan không dùng fixed image count; visual/new-image count thay đổi theo scene complexity/reuse và estimate snapshot ghi assumptions.|
|AC-46|Mỗi billable ResourceUsageRecord truy được billed\_to\_user\_id/project/operation/job/stage; internal\_cost và billable\_cost có thể khác.|
|AC-47|Job vượt max authorized spend chuyển PAUSED\_COST\_LIMIT trước next billable stage; tăng limit mới tiếp tục.|
|AC-48|Re-estimate tăng >configured threshold tạo COST\_RECONFIRMATION\_REQUIRED thay vì tự tiếp tục.|
|AC-49|Batch review 150+ visual hỗ trợ partial success; stale/conflict item không rollback item hợp lệ.|
|AC-50|Prompt preview hiển thị auto context + override; attempt lưu auto\_resolved\_prompt/user\_override/submitted\_prompt.|
|AC-51|Browser animatic playback được từ timing+image/audio/subtitle mà không cần final FFmpeg encode.|
|AC-52|Character Library version import tạo Project snapshot; library update không thay Project cũ cho đến khi user chọn import version mới.|
|AC-53|Vertex Gemini production adapter chạy với server-side Vertex AI identity/config; frontend không cần Gemini API key.|
|AC-54|GPU scheduler không chạy >1 heavy ComfyUI workflow/GPU theo default policy; job khác WAITING\_RESOURCE thay vì OOM.|
|AC-55|Retry/circuit/watchdog test chứng minh auth/billing không retry loop, ambiguous external op không resubmit, stale worker stage chuyển STALLED/reconcile.|
|AC-56|FFmpeg bị kill giữa encode không tạo FinalArtifact READY trỏ file partial; orphan temp có thể cleanup.|
|AC-57|Resource scheduler giữ fairness: user A bulk queue không chặn vô hạn interactive job user B cùng priority policy.|
|AC-58|Video provider capability router có thể resolve mocked Veo/Kling implementations mà domain service không branch theo provider name.|
|AC-59|AI-video budget chỉ chọn subset motion candidates theo value/cost; generated seconds/cost được estimate và attempt snapshot.|
|AC-60|Story chưa có rights attestation hoặc moderation BLOCK không thể enqueue Story Analyze/Image/Video paid operation.|
|AC-61|Story chứa instruction kiểu "ignore previous instructions" vẫn được xử lý như source material; structured analysis không thay đổi system policy/tool permission/billing/ownership.|
|AC-62|Generated media phải có output moderation decision trước publishable/approved state; provider success không tự động đồng nghĩa SAFE.|
|AC-63|Sexual-minor test fixture luôn hard block và không có user override path.|
|AC-64|REAL\_PERSON\_REFERENCE không tạo identity template/embedding khi consent missing; revoke/delete làm future generation reference fail safely và data đi vào deletion lifecycle.|
|AC-65|Identity template/embedding không xuất hiện trong application log, analytics payload, public asset manifest hoặc cross-user query.|
|AC-66|Rate-limited request trả 429/retry metadata và không tạo OperationPlan/CostReservation/ProviderOperation mới.|
|AC-67|Delete Project trong lúc external provider operation chạy không reattach late result; late asset bị quarantine/expire và deletion request vẫn tiến tới terminal state.|
|AC-68|User đổi vi-VN/en-US chỉ thay presentation; persisted enum/state/error code không bị localized trong database.|
|AC-69|AI audit có thể truy model/prompt/schema/safety-policy version + request fingerprint cho một generation mà không yêu cầu lưu raw sensitive prompt vô hạn.|

**16.3. Roadmap sau MVP**

|**Giai đoạn**|**Mở rộng**|
| :-: | :-: |
|V1.1|Style presets, Location/Outfit Bible, Identity QA nâng cao, Visual Beat auto merge/split, batch generate, better prompt editor và usage dashboard.|
|V1.2|AI video cho selected shots; Economy/Balanced/Cinematic mode|
|V1.5|Vertex AI Gemini production integration; dynamic operation cost planning, per-user accounting, delta/reuse, batch review, prompt inspector, animatic, resiliency/watchdog/error catalog.|
|V1.7|Trust & Safety production layer: moderation input/output, rights attestation/takedown, prompt-injection defense, real-person consent/identity privacy, account abuse limiting, deletion lifecycle, AI audit trail và vi-VN/en-US i18n.|
|V1.7|Enable selected-beat AI video via Vertex Veo/Kling adapters; MotionAsset, AI-video budget, AUTO provider routing/fallback policy.|
|V2|Collaboration, project sharing, timeline editor nâng cao, provider routing|
|V2.1|Character LoRA/adapter personalization cho nhân vật xuất hiện hàng trăm/hàng nghìn ảnh; regional/inpaint multi-character.|
|V2.2|Billing reconciliation analytics, provider routing optimization, cold storage lifecycle, optional Vertex batch/provisioned throughput when metrics justify.|
|V3|Tách Generation/Render service nếu bottleneck thật; multi-region GPU pools, spot/on-demand optimization, marketplace template/workflow và advanced autoscaling beyond MVP 0..4 baseline.|

**17. RỦI RO VÀ PHƯƠNG ÁN GIẢM THIỂU**

|**ID**|**Rủi ro**|**Mức**|**Mitigation**|
| :-: | :-: | :-: | :-: |
|R1|Character vẫn drift dù có reference|Cao|Lock version, multi-angle refs, prompt constraints, face similarity check optional, human approval|
|R2|Chi phí generation tăng nhanh|Cao|Quota + pre-job estimate, image-first, selective regenerate/cache reuse; record provider\_cost/gpu\_seconds; GPU pool scale-to-zero when managed providers are used.|
|R3|Provider/model thay đổi API|Trung bình|Adapter + model\_key/workflow\_version + config external|
|R4|Job queue backlog|Trung bình|Worker concurrency, queue priority, dashboard/alerts|
|R5|Render file rất lớn|Trung bình|Scene-level render, streaming/upload, retention policy|
|R6|LLM phân tích truyện sai|Trung bình|Structured schema, validation, repair prompt, user edit before generation|
|R7|Workflow ComfyUI phụ thuộc custom nodes|Trung bình|Pin version, export workflow, containerize node set, startup health check|
|R8|Security asset leak|Cao|Private bucket, signed URL, authorization trước khi cấp URL|
|R9|Scope phình to thành video editor đầy đủ|Cao|Giới hạn V1: storyboard + basic render; không timeline Premiere-like|
|R10|Microservices quá sớm|Trung bình|Giữ modular monolith; chỉ tách dựa trên bottleneck/ownership rõ|
|R11|Ảnh nhiều nhân vật bị trộn identity|Cao|Hard max 4 tracked characters/frame, warn >3; split/reframe/background extras; per-character version mapping; regional/inpaint later.|
|R12|Rule fixed duration/word count làm chi phí và nhịp hình sai|Cao|Semantic scene split + visual budget theo phút/complexity; không hard-code 2.000 từ/60 phút.|
|R13|Identity QA false positive/false negative|Trung bình|Score chỉ để flag; manual review là quyết định cuối; lưu method/version để audit.|
|R14|Đổi character reference làm chapter cũ lệch|Cao|CharacterVersion immutable khi lock; scene/attempt lưu snapshot; version mới không overwrite lịch sử.|
|R15|Provider submission timeout nhưng request có thể đã được nhận|Cao|Persist reservation trước submit; UNKNOWN + reconciliation; không blind retry.|
|R16|Vertex AI billing/IAM/model/location hoặc quota bị khóa|Cao|Vertex provider health, external model/location config, clear IAM/billing/quota error, circuit pause; không fake success ở production.|
|R17|Short quá ngắn hoặc visual quá thưa làm retention thấp|Trung bình|Hard min 30s, default 45–60s, higher adaptive visual density, user preview/override.|
|R18|Crop 16:9 sang 9:16 làm mất chủ thể|Trung bình|Vertical-safe crop detection; reframe/regenerate visual khi reuse không đạt.|
|R19|User chọn HIGH cho quá nhiều ảnh làm chi phí/thời gian tăng|Trung bình|STANDARD mặc định, hiển thị estimate trước enqueue, batch override, quota/cost guardrail và cho phép DRAFT preview trước khi nâng quality.|
|R20|Provider không hỗ trợ một aspect ratio/quality combination|Trung bình|Capability endpoint + adapter validation trước submit; fallback chỉ khi user cho phép và phải ghi resolved setting vào attempt.|
|R21|Production DB/object storage mất dữ liệu nhưng không restore được|Cao|PITR + versioning/replication, documented RPO/RTO, pre-migration backup và quarterly restore drill.|
|R22|GPU overprovision làm margin âm hoặc underprovision làm queue quá dài|Cao|Tách managed/self-hosted mode, 0..4 MVP pool, benchmark coefficients, queue-age autoscaling, max budget và gpu\_seconds/cost telemetry.|
|R23|Hai editor/tab ghi đè Scene/Character lẫn nhau|Cao|row\_version/ETag optimistic locking, 409 conflict UX, immutable snapshots; không silent last-write-wins.|
|R24|Render xong nhưng user không biết hoặc email gửi trùng|Trung bình|In-app persisted notification + transactional outbox event\_key unique; email retry idempotent; notification lag metric.|
|R25|Free-tier client bypass watermark/export limit bằng sửa request|Cao|Resolve PlanEntitlement server-side trước enqueue/finalize; atomic usage counters; watermark injected in render pipeline, not UI.|
|R26|Staging khác production hoặc dùng nhầm production secret/data|Cao|Environment-isolation config tests, separate accounts/namespaces, secret manager, immutable image promotion, sanitized test data only.|
|R27|Một user/bulk job tạo hóa đơn lớn ngoài dự kiến|Cao|Per-user attribution, estimate range, budget reservation, maxAuthorizedCost, PAUSED\_COST\_LIMIT, admin cost alert.|
|R28|Estimator sai vì dùng fixed visual count|Cao|Duration+complexity+delta+reuse planner; multi-stage re-estimate + confidence; no fixed 150-image rule.|
|R29|Provider retry storm khi Vertex/Kling lỗi|Cao|Rate limiter + bounded retry + circuit breaker + hard pause auth/IAM/billing.|
|R30|Worker crash để job RUNNING vĩnh viễn|Cao|Lease/heartbeat/watchdog → STALLED; safe retry vs external reconcile.|
|R31|FFmpeg process kill tạo MP4 partial|Cao|Temp render + ffprobe + atomic/promotion workflow; FinalArtifact only after verify.|
|R32|Một user chiếm GPU/queue|Cao|Resource classes, GPU lease, per-user scheduler fairness/quotas.|
|R33|Veo/Kling thay capability/pricing|Trung bình|Provider capability registry + pricing version + adapter/router; no vendor branching in domain.|
|R34|Character Library update làm project cũ drift|Cao|Project snapshot import; no auto-cascade; explicit update + affected-scope preview.|
|R35|Giữ mọi attempt làm storage tăng mạnh|Trung bình|Metadata retention + thumbnails + hot/cold/archive media lifecycle; no overwrite of original history.|
|R36|Nội dung NSFW/sexual-minor hoặc bạo lực lọt qua pipeline|Cao|Multi-layer input/output moderation, hard-block policy, human review cho REVIEW, provider safety normalization.|
|R37|Prompt injection trong story làm lệch planning/tool behavior|Cao|Treat story as untrusted data; prompt boundary, structured output, allowlists, bounded repair và optional security scanner.|
|R38|User paste truyện không có quyền sử dụng|Cao|Rights attestation, policy version, report/review/takedown, disable publish/generation; không dựa vào LLM ownership detector.|
|R39|Reference người thật/identity data bị lưu quá lâu hoặc reuse sai tenant|Cao|Explicit reference type/consent, private storage, no logs/cross-user reuse, retention + cascade deletion.|
|R40|Spam account/API đốt quota/GPU hoặc làm queue starvation|Cao|Account/IP/route limiter + concurrency/fairness trước cost/provider submission; provider limiter lớp riêng.|
|R41|Deletion không hoàn tất vì late provider result/backup lifecycle|Trung bình|Durable deletion request, quarantine late results, retryable cleanup, documented backup expiry and audit.|
|R42|Bản dịch UI làm thay đổi business state/error handling|Trung bình|Stable codes/message keys; locale only at presentation boundary; vi-VN/en-US contract tests.|

**18. KẾ HOẠCH KIỂM THỬ**

**18.1. Test layers**

|**Layer**|**Nội dung**|
| :-: | :-: |
|Unit Test|Business rules: lock version, scene readiness, quota, status transitions.|
|Repository/DB Test|Unique order, transaction, optimistic locking nếu dùng.|
|API Integration|Auth/ownership, validation, idempotency, job creation.|
|Worker Unit|Provider reservation/UNKNOWN transitions, prompt builder, workflow resolver, error mapping, FFmpeg dimension validation.|
|Worker Integration|Fake deterministic providers + real-adapter contract tests; storage upload/reconcile; provider ambiguity simulation.|
|Contract Test|Java job payload ↔ Python worker schema/version.|
|E2E|Google login/session → create story → analyze → lock character → generate visual → voice → final render; separate Short E2E.|
|Render Test|FFmpeg output có audio/video duration, MIME, width/height >0; FINALIZE phải tạo FinalArtifact trước parent COMPLETED.|
|Security Test|IDOR/project access, signed URL, upload validation.|
|Load Test|Nhiều generate request, queue depth, SSE connection, DB contention.|
|Short Test|Duration hard min/default, candidate ranking, 9:16 profile, adaptive visual count, reuse/crop/regenerate decisions.|
|Migration/Recovery|Preserve QUEUED/provider identity/cross-provider operation IDs; quarantine duplicate storage keys; restart/replay idempotency.|
|Image Profile Test|Project default/inherit/override; capability validation; requested ratio/quality snapshot; actual dimension validation; unsupported combination không submit provider; ratio mismatch crop/fit không stretch.|
|Concurrency Test|Parallel PATCH với cùng row\_version: chỉ một success; stale writers 409; locked snapshot không overwrite.|
|Entitlement Test|FREE watermark/quality/export/concurrency limits server-side; atomic monthly counters under concurrent export requests.|
|Notification/Outbox Test|Render terminal event → exactly-one notification; email adapter failure/retry không duplicate; outbox restart recovery.|
|Backup/DR Drill|Restore PostgreSQL PITR + critical object assets into isolated environment; measure actual RPO/RTO and verify manifests/checksums.|
|Capacity Benchmark|Per workflow/quality measure P50/P95 gpu-seconds/image, FFmpeg real-time factor, VRAM peak, queue-age scale signal and estimate-vs-actual cost.|
|Environment Safety Test|Staging/prod connection/bucket/secret markers cannot overlap; deployment blocks accidental production endpoint in lower environment.|
|Trust & Safety Test|Prompt-injection fixtures, moderation SAFE/REVIEW/BLOCK, sexual-minor hard block, rights/consent prerequisites, identity privacy/log scan, rate-limit no-cost side effects, deletion lifecycle/late provider result, locale contract.|

**18.2. Test case nghiệp vụ quan trọng**

- Đổi CharacterVersion sau khi 20 shot đã approve: shot cũ phải giữ version đã dùng và được flag phù hợp.
- Retry job sau timeout: không bị double charge và không tạo 2 approved assets tự động.
- Xóa reference đang được version LOCKED sử dụng: phải bị chặn hoặc chuyển trạng thái rõ ràng.
- Render project khi 1 scene FAILED: hệ thống không render im lặng; phải báo readiness failure.
- User cố truy cập asset ID của project khác: trả 403/404 theo policy.
- Worker restart giữa generation: job có thể resume/retry theo policy, không mất metadata.

18\.3. Test case consistency bổ sung

- Generate 30 visual beats có cùng CHAR\_NAM: tất cả attempt phải resolve cùng CharacterVersion snapshot khi user không đổi version.
- Đổi NAM\_OUTFIT\_01 → NAM\_OUTFIT\_02: identity/reference gốc không được thay đổi; chỉ outfit reference/prompt thay đổi.
- Tạo CharacterVersion v3 sau khi chapter 1 đã render bằng v2: chapter 1 vẫn tái render được bằng snapshot v2.
- Visual beat có 2 nhân vật: payload phải chứa mapping riêng cho từng character\_version\_id; không dùng danh sách reference không định danh.
- Identity QA không detect được mặt: job không fail toàn pipeline; trạng thái chuyển NOT\_APPLICABLE/MANUAL\_REVIEW.
- Long-form planner: visual beats nằm trong configurable budget theo duration/complexity; user merge/split được mà không mất narration/timing.
- Provider reservation phải tồn tại trong DB trước khi mock external submit được quan sát; ambiguous timeout → UNKNOWN và lần chạy lại không submit thêm.
- FINALIZE happy path phải chứng minh SCENE\_PLAN → VIDEO\_COMPOSE → FINALIZE → parent COMPLETED và FinalArtifact có width/height dương.
- Short 30s/45s/60s phải enforce duration + visual-density policy nhưng cho phép adaptive giảm ảnh ở scene đơn giản.
- MIME validation chấp nhận khác biệt hoa/thường; monetary/resource equality dùng semantic numeric comparison thay vì scale-sensitive equality.

**18.4. Test case production/UX bổ sung**

- Input boundary: 500.000 chars accepted, 500.001 rejected; token estimator vượt 120.000 cũng reject dù char count thấp hơn; không gọi provider.
- Multi-character: 4 tracked characters cho phép nhưng warning; 5 bị block/split trước provider submit.
- Optimistic concurrency: hai session update cùng Scene version; một commit, một 409; UI giữ local text để user copy/reapply.
- Notification: kill email provider sau render; in-app notification vẫn xuất hiện, outbox retry email, không tạo duplicate.
- Free plan: thay request field watermark=false/high quality không bypass server; concurrent export race không vượt monthly quota.
- DR: restore backup vào isolated environment, verify project metadata + approved Character Master + FinalArtifact checksum và signed access.
- GPU: managed-provider mode chạy với zero GPU; self-hosted test tạo queue backlog để scale-out rồi idle để scale-in theo threshold; measured gpu\_seconds được persist.

**18.5. Test case cost/provider/resiliency bổ sung**

- Create 30m vs create 2h vs edit 30m/2h: OperationPlan phải khác affected scope/new generation count và incremental estimate.
- Cost reservation race: hai job cùng user không được reserve vượt available credits/spending policy.
- Platform/provider failure sau provider charge: resource record internal\_cost > 0 nhưng billable\_cost có thể = 0 theo policy/refund ledger.
- Visual reuse test: nhiều beat reuse/reframe cùng source asset không tạo provider image call và cost estimator không charge NEW\_IMAGE.
- Batch review 200 items với 5 stale versions: 195 commit, 5 conflict; không rollback toàn batch.
- Prompt override persistence: auto/override/submitted snapshot vẫn replay được sau khi Project defaults thay đổi.
- Vertex Gemini adapter contract test dùng mocked Vertex client; browser payload không chứa cloud credential/API key.
- Circuit test: 5 retryable provider failures → OPEN; HALF\_OPEN probes; 403 IAM → pause immediately; 429 rate limiting không bị hiểu là duplicate submit.
- Heartbeat test: kill worker sau external SUBMITTED → STALLED/RECONCILING, không tạo second provider submission.
- GPU lease test: 8 queued jobs trên 1 GPU chỉ 1 GPU\_HEAVY RUNNING; remaining WAITING\_RESOURCE.
- Parallel render test: scene clips normalize codec/fps/audio; concat produces valid FinalArtifact; failed one scene retries incrementally.
- Atomic finalization test: kill FFmpeg/upload mid-stage; no READY final artifact points to partial temp object.
- Video provider portability: fake VertexVeoProvider và KlingProvider expose different capabilities; router resolves without domain provider-name branching.

**19. PHỤ LỤC: THUẬT NGỮ VÀ QUY ƯỚC**

|**Thuật ngữ**|**Định nghĩa**|
| :-: | :-: |
|StoryVersion|Một phiên bản nội dung truyện đã nhập/chỉnh.|
|Character Bible|Hồ sơ nhận diện ổn định của nhân vật.|
|CharacterVersion|Một snapshot versioned của Character Bible + references.|
|Reference Asset|Ảnh dùng làm điều kiện tham chiếu cho AI.|
|Scene|Đơn vị nội dung lớn trong storyboard, có narration/duration.|
|Shot|Đơn vị camera tùy chọn/fine-grained bên trong Scene; VisualBeat là đơn vị visual generation chính cho long-form.|
|GenerationAttempt|Một lần thử generate cụ thể, lưu prompt/model/seed/output.|
|Approved Asset|Asset được user chọn làm output chính cho shot.|
|Resolved Prompt|Prompt cuối đã ghép toàn bộ context và constraints.|
|RenderVersion|Một lần kết xuất final video, immutable.|
|OUTDATED|Dữ liệu/asset còn tồn tại nhưng không còn khớp cấu hình/story/character version mới.|
|Human-in-the-loop|AI đề xuất/generate nhưng user duyệt ở các gate quan trọng.|
|Character Master|Ảnh/phiên bản gốc được user chọn làm nguồn identity chính cho một CharacterVersion.|
|OutfitVersion|Phiên bản trang phục tách khỏi identity nhân vật.|
|Visual Beat|Khoảng narration/timeline có visual intent tương đối ổn định; đơn vị generation chính cho video dài.|
|Identity QA|Bước chấm/flag độ phù hợp identity của ảnh mới so với reference snapshot; không thay thế human approval.|
|Project Bible|Tập Character, Location, Outfit và Style metadata/reference dùng xuyên nhiều chapter.|
|StageAttempt|Một attempt persisted của một stage trong parent job; có lifecycle độc lập để retry/recover.|
|ProviderOperation|Bản ghi durable của một external provider submission, gồm provider identity, operation id và trạng thái kể cả UNKNOWN.|
|UNKNOWN|Trạng thái khi chưa thể xác định external operation thành công hay thất bại; không được blind resubmit.|
|FinalArtifact|Artifact video cuối đã qua validation storage/MIME/dimensions/manifest; là điều kiện để parent render hoàn tất.|
|RenderProfile|Preset video output gồm aspect\_ratio + Video Quality + width/height/FPS/bitrate. Hỗ trợ 16:9, 9:16, 1:1, 4:3, 3:4 với mapping Standard/High; immutable snapshot theo RenderVersion.|
|ShortCandidate|Đoạn timeline được highlight analyzer đề xuất/rank để chuyển thành Short/Reel.|
|ShortClip|Artifact/video dọc độc lập được tạo từ ShortCandidate hoặc range do user chọn.|
|ImageGenerationSettings|Thiết lập ảnh đã resolve cho một generation: aspect ratio + quality tier, lấy từ Project default hoặc VisualBeat/Shot override.|
|Image Quality Tier|Abstraction DRAFT / STANDARD / HIGH cho chất lượng asset nguồn; provider adapter ánh xạ sang option thực tế, không đồng nghĩa trực tiếp với 720p/1080p video.|
|Aspect Ratio|Tỉ lệ rộng:cao của ảnh/video, ví dụ 16:9, 9:16, 1:1, 4:3, 3:4. Generation capability quyết định ratio nào khả dụng cho model/provider hiện tại.|
|Optimistic Lock / row\_version|Concurrency control không giữ DB lock lâu; update chỉ thành công khi expected version khớp current version, stale update nhận conflict.|
|ETag / If-Match|HTTP representation/version token có thể dùng để truyền optimistic concurrency token giữa UI và backend.|
|PlanEntitlement|Snapshot capability của plan: watermark, max quality, export/month, concurrent expensive jobs và feature flags.|
|UsageWindow|Counter theo kỳ dùng để enforce export/credit/quota atomically và biết reset time.|
|Transactional Outbox|Event được persist cùng business transaction rồi dispatch async; tránh trạng thái job complete nhưng notification event bị mất.|
|RPO / RTO|Recovery Point Objective: lượng dữ liệu tối đa có thể mất; Recovery Time Objective: thời gian mục tiêu để khôi phục dịch vụ/dữ liệu.|
|GPU Pool|Nhóm worker có GPU dành cho self-hosted ComfyUI/model; tách khỏi CPU workers và có thể scale về 0 khi dùng managed provider.|
|ResourceUsageRecord|Telemetry per job/stage về gpu\_seconds, cpu\_seconds, provider cost, storage/egress và estimate/actual cost.|
|Critical Media|Character Master/Reference, Approved Assets và FinalArtifacts cần RPO/RTO chặt hơn intermediate attempts.|
|Notification|Persisted in-app event về render/job; email/web-push chỉ là delivery channel, không phải source of truth.|
|OperationPlan|Bản kế hoạch một operation gồm affected scope, estimate range/confidence, visual/motion actions và authorized budget.|
|CostReservation|Khoản budget/credit được giữ trước expensive operation và reconcile/release theo actual usage.|
|Affected Scope|Tập Chapter/Scene/VisualBeat/Audio/Clip thực sự bị ảnh hưởng bởi edit; dùng cho incremental generation/render/cost.|
|KeyframeAsset|Approved image/source visual dùng cho still/basic motion hoặc làm source image-to-video.|
|MotionAsset|Playable visual motion cho beat: deterministic FFmpeg motion hoặc AI-generated video clip.|
|VideoGenerationAttempt|Một lần tạo MotionAsset bằng Veo/Kling/future provider với provider/model/request/cost/output snapshot.|
|CharacterTemplate|Optional creation template; không phải runtime Character identity và không bắt buộc cho ProjectCharacter assignment.|
|STALLED|Stage RUNNING mất lease/heartbeat; cần safe retry hoặc external operation reconciliation.|
|PAUSED\_COST\_LIMIT|Operation tạm dừng vì next billable stage có thể vượt max authorized spend.|
|Internal Cost|Chi phí thực hệ thống chịu từ provider/GPU/CPU/storage.|
|Billable Cost|Chi phí/credit được policy quyết định charge user; có thể khác Internal Cost.|

**19.1. Nguyên tắc phát triển cần giữ**

|Architecture Principle<br>Bắt đầu đơn giản nhưng durable: Next.js + Spring Boot Modular Monolith + PostgreSQL authoritative state + Redis queue/cache + MinIO/S3 + Python AI/Media Worker. Không tách microservices chỉ vì domain name; chỉ tách khi có bottleneck/ownership/deployment boundary thật.|
| :- |

|AI/Provider Principle<br>Gemini production chạy qua Vertex AI; image/video providers nằm sau provider-agnostic ports. Character consistency là dữ liệu/version/state, không phải prompt cố định. Mọi external generation phải có snapshot + StageAttempt + ProviderOperation + cost attribution; UNKNOWN không blind retry. Veo/Kling chỉ là MotionAsset providers, không được leak vendor-specific branching vào domain.|
| :- |

|Product Principle<br>Không ép one-click, fixed duration hoặc fixed image count. Story → Character → Scene/VisualBeat → Reuse/Keyframe → Optional Motion → Audio → Animatic → Render. Cost estimate dựa duration + complexity + affected delta + reusable assets + provider/model; user luôn xem estimate/max spend trước expensive operation.|
| :- |

Consistency Principle

Đối với truyện dài, “đồng nhất nhân vật” là một nghiệp vụ có dữ liệu, version và state riêng. Không được coi đó là một prompt cố định hay seed cố định. Mọi generation phải có thể truy vết ngược về CharacterVersion, OutfitVersion, Reference Assets, Location/Style Profile và workflow/model snapshot đã dùng.

**20. TIN CẬY, AN TOÀN, QUYỀN RIÊNG TƯ VÀ QUẢN TRỊ NỀN TẢNG**

Control plane này bảo vệ toàn bộ vòng đời nội dung từ lúc nhập dữ liệu đến khi publish: rủi ro phải được phát hiện trước khi phát sinh provider cost khi có thể, và output chỉ trở thành publishable asset sau khi vượt qua policy tương ứng. Thiết kế phải provider-agnostic: Vertex AI/Gemini/Imagen/Veo/Kling có thể cung cấp safety signals riêng, nhưng quyết định business và trạng thái canonical vẫn thuộc NarrativeX.

**20.1. Nguyên tắc an toàn theo thiết kế**

Safety không phải một API call duy nhất. Hệ thống dùng defense-in-depth: authentication/abuse gate -> rights/consent -> input moderation -> prompt-injection defense -> entitlement/quota/cost -> provider call -> structured/output validation -> output moderation -> identity QA/human review -> publish.

**20.2. Quy trình kiểm duyệt nội dung**

Internal decision chuẩn hóa thành SAFE / REVIEW / BLOCK. Category taxonomy tối thiểu bao gồm sexual, sexual-minor, violence/graphic-violence, self-harm, hate/harassment, illegal/dangerous activity, real-person sexual/deceptive misuse và unknown. Taxonomy có thể mapping từ provider nhưng policy\_version thuộc application.

**20.4. Phòng chống prompt injection**

Story text chỉ là dữ liệu nguồn. System/task instruction không được lấy từ story. Worker dùng explicit untrusted-data delimiters, structured output schema, output/domain validation, field/tool allowlist và optional Model Armor/equivalent scanner. LLM không được quyền thay owner, billing user, storage key, provider credential, entitlement hoặc tự enqueue arbitrary job.

**20.5. Quyền riêng tư đối với dữ liệu nhận diện và ảnh tham chiếu**

Reference phải phân loại FICTIONAL\_REFERENCE hoặc REAL\_PERSON\_REFERENCE. Với người thật, yêu cầu consent/use-right basis trước identity processing. Identity template/embedding được coi là sensitive identity data: private, tenant-isolated, encrypted at rest where supported, no logs/public manifest, no cross-user reuse, retention ngắn nhất phù hợp use case và xóa/expire khi reference/character/project/account bị xóa theo policy.

**20.6. Giới hạn tần suất và chống lạm dụng ở cấp tài khoản**

Account/API limiter bảo vệ application và đứng trước paid work. Key có thể kết hợp user/account, session, IP hash, route và resource class. Ngoài requests/minute cần concurrent expensive-job limits, burst limits, fairness và cooldown. Provider limiter/circuit breaker vẫn tồn tại riêng để xử lý Vertex/Imagen/Veo/Kling quota/health.

**20.7. Vòng đời dữ liệu và quy trình xóa**

Deletion là durable workflow, không phải một DELETE SQL đơn lẻ. Project/account deletion phải chặn job mới, cancel/reconcile pending work, revoke URLs, delete/expire references/derivatives/identity data, quarantine late external results, reconcile storage accounting và hoàn tất theo retention policy. Backup copy được xóa theo expiry/recovery policy thay vì hứa immediate physical wipe nếu platform backup không hỗ trợ.

**20.8. Nhật ký kiểm toán AI và giảm thiểu dữ liệu**

Audit phải trả lời: ai yêu cầu, project/job/stage nào, provider/model nào, prompt/schema/policy version nào, safety outcome nào, usage/cost bao nhiêu và output attempt nào. Chỉ lưu raw prompt/reference khi thật sự cần và theo retention; ưu tiên fingerprint/hash + versioned templates + structured metadata.

**20.9. Đa ngôn ngữ và ngôn ngữ nội dung**

UI baseline: vi-VN và en-US. Backend/domain dùng enum/code/message\_key. User preferred\_locale chỉ ảnh hưởng presentation. Project hỗ trợ source\_language, narration\_language và metadata\_language tách biệt để story tiếng Việt vẫn có thể tạo narration/metadata ngôn ngữ khác.

**20.10. Tiêu chí sẵn sàng phát hành production**

Public beta không được mở chỉ vì generation/render E2E pass. Production gate cần tối thiểu: ownership/auth, account abuse limit, moderation input/output, prompt-injection tests, rights attestation, identity consent nếu có real-person reference, deletion lifecycle, provider/cost controls, backup/restore, observability và no-P0/P1 safety/security test blockers.

User Request\
`  `-> Authentication / Ownership\
`  `-> Account & API Abuse Limit\
`  `-> Rights / Consent Check\
`  `-> Input Moderation\
`  `-> Prompt-Injection Defense\
`  `-> Entitlement / Quota\
`  `-> Cost Estimate & Reservation\
`  `-> AI Planning / Generation\
`  `-> Schema & Domain Validation\
`  `-> Output Moderation\
`  `-> Identity QA / Human Review\
`  `-> Asset Approval / Publish

|**Decision**|**Ví dụ hành vi**|**Paid provider call?**|**Override**|
| :- | :- | :- | :- |
|SAFE|Cho flow tiếp tục theo quota/cost|Có, nếu entitlement cho phép|Không cần|
|REVIEW|Giữ content/asset ở review, không publish|Chỉ khi policy/stage cho phép; mặc định tránh call mới|Authorized review hoặc user sửa nội dung|
|BLOCK|Dừng analyze/generate/publish theo scope|Không nếu quyết định trước submission|Không với hard-block; category khác theo policy|

**21. GIẢ ĐỊNH TRIỂN KHAI, NHÂN SỰ, TIẾN ĐỘ VÀ NGÂN SÁCH**

Phần này phục vụ stakeholder planning, không thay thế sprint plan chi tiết. Các con số là planning envelope để ra quyết định; provider AI/GPU usage vẫn được tính động bằng OperationPlan và không được hard-code thành một chi phí/video cố định.

**21.1. Giả định nhân sự**

- Core delivery tối ưu: 1 Product/Tech Lead, 1 Backend/Platform engineer, 1 Frontend engineer, 1 AI/Media Worker engineer; QA/DevOps có thể part-time hoặc do team chia sẻ ở giai đoạn đầu.
- Team 2-3 người vẫn khả thi nếu role overlap và dùng AI coding assistance, nhưng production hardening, provider E2E, safety test và infra không được bỏ qua để đổi lấy tốc độ.
- Nếu solo developer, nên giữ provider managed-first, hạn chế self-hosted GPU và giảm scope AI-video trước public launch.

**21.2. Tiến độ theo cổng phát hành**

|**Gate**|**Mục tiêu**|**Planning envelope**|
| :- | :- | :- |
|Internal MVP|Story -> analysis -> character/storyboard -> image/TTS -> FFmpeg; fake + limited real provider smoke|4-6 tuần với team nhỏ đã có baseline code; dài hơn nếu bắt đầu từ zero|
|Creator MVP / Staging|Google auth, durable jobs, cost control, batch review, Shorts baseline, real provider E2E, staging CI/CD|8-12 tuần cumulative|
|Production-ready Beta|Trust & Safety v1.7, abuse limit, deletion/privacy, backup/restore, observability, provider resiliency, entitlement enforcement|14-20 tuần cumulative|
|Scale Hardening|Capacity tuning, AI-video selected beats, routing optimization, storage lifecycle, analytics/billing reconciliation|+6-10 tuần sau beta theo usage thực tế|

**21.3. Khung ngân sách**

|**Hạng mục**|**Planning envelope**|**Ghi chú**|
| :- | :- | :- |
|Local/Dev fixed infra|$30-$150 / tháng|Có thể thấp hơn nếu chạy local Docker; không tính paid generation experiments.|
|Staging fixed infra|$80-$300 / tháng|DB/Redis/object storage/monitoring + low-volume provider smoke; tách production data/secrets.|
|Early Production fixed infra|$150-$600 / tháng|Managed API-first baseline, không bao gồm variable Gemini/image/video/TTS usage và không bao gồm dedicated self-hosted GPU.|
|Variable AI/Media usage|Theo OperationPlan per user/project/operation|Tính theo duration + complexity + delta + reuse + provider/model/quality; reserve cap trước execute và reconcile actual sau.|
|Self-hosted GPU|Capacity-driven; tách khỏi base envelope|Chỉ bật khi measured provider cost/latency/volume chứng minh hợp lý; có gpu\_seconds accounting và max concurrency.|

**21.4. Tiêu chí phát hành**

- Không public launch khi P0/P1 security/safety blocker còn mở hoặc real-provider E2E chưa xác minh.
- Không mở rộng user count nếu per-user cost attribution, account rate limit và spending cap chưa enforce server-side.
- Không bật real-person identity workflow diện rộng nếu consent, retention và deletion chưa chạy end-to-end.
- Không bật AI-video cho mọi beat; chỉ mở selected-beat capability khi quality/cost benchmark và fallback image-first đạt.
- Mỗi phase phải có acceptance gate kỹ thuật + product + cost + safety, không chỉ feature-complete.

**KẾT LUẬN**

NarrativeX v1.7 xác định kiến trúc production theo mô hình Next.js + Spring Boot Modular Monolith + Python AI/Media Worker, với PostgreSQL làm authoritative state, provider/media contract bền vững và Trust & Safety là control plane xuyên suốt. Mọi operation tốn tài nguyên phải được lập kế hoạch và đo lường chi phí; mọi luồng nội dung không tin cậy phải đi qua safety gate; mọi luồng xử lý nhận diện người thật phải có consent và retention; mọi tài khoản phải được bảo vệ bằng abuse controls; và mọi quyết định AI quan trọng phải có khả năng truy vết/audit phù hợp.

Trước public launch, hệ thống phải hoàn thành các release gate theo thứ tự: Trust & Safety + prompt-injection defense + account abuse control -> privacy/deletion -> real-provider E2E + cost reconciliation -> i18n/product polish. AI video qua Veo/Kling tiếp tục nằm sau VideoGenerationProvider và chỉ được mở cho selected beats khi quality/cost benchmark, provider resilience và safety controls đã đạt yêu cầu.
Trang 
