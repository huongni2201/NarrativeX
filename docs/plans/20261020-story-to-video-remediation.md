# Plan: Sửa luồng phân tích truyện đến xuất video

**Ngày:** 2026-10-20

**Trạng thái:** PARTIAL — các sửa lỗi R01–R05 và regression backend/UI cốt lõi đã được triển khai; nghiệm thu Electron/API thật, GPU và một số điểm nối A7 còn chờ.

**Phạm vi sử dụng:** một installation local-first, Project là biên nghiệp vụ; giữ nguyên backend control plane và Electron final render.

## 1. Mục tiêu và quan hệ với các plan hiện có

Khôi phục đường chạy hiện tại `Source → CANON → STORY → Scene/StoryBeat/AudioCue/VisualBeat → Shot → Take → SelectedTake → render snapshot → Desktop MP4`. Sửa lỗi admission, ghi lựa chọn, duration và thông tin người dựng nhìn thấy; không coi unit test pass là bằng chứng luồng sản xuất đã hoàn tất.

Plan này bổ sung các lỗi được xác nhận ngày 2026-10-20 cho [production flow bug fixes](20261017-production-flow-bug-fixes.md), đặc biệt F01/F04/F05/F06. Nó không thay thế các phần F01–F09 đã triển khai và không yêu cầu làm lại toàn bộ pipeline.

Hai mốc hoàn tất độc lập:

- **Mốc A — sửa lỗi profile hiện tại:** năm phát hiện review được giải quyết; thoại nhân vật thuộc profile hỗ trợ đi qua tạo Take, đổi lựa chọn, trim và render; trường hợp không hỗ trợ có blocker trước inference.
- **Mốc B — truyện có narration đi xuyên suốt:** thực hiện các cổng audio/conditioning/render của [plan video production, đợt C–E](20261017-video-production-and-regeneration.md). Mốc A hoàn tất không đồng nghĩa Mốc B hoàn tất.

Tham chiếu: [ADR-0003](../decisions/ADR-0003-durable-compute-execution.md), [ADR-0004](../decisions/ADR-0004-desktop-client-boundary.md), [ADR-0005](../decisions/ADR-0005-local-media-and-final-render.md), [ADR-0006](../decisions/ADR-0006-story-structure-and-source-anchoring.md), [ADR-0007](../decisions/ADR-0007-narration-tts-and-alignment.md), [ADR-0008](../decisions/ADR-0008-video-first-shot-production.md), [ADR-0009](../decisions/ADR-0009-chapter-analysis-agy-cli.md), [database](../architecture/database.md), [editing pipeline](../architecture/editing-pipeline.md).

## 2. Baseline và bằng chứng review

Các kết quả dưới đây thuộc worktree được review ngày 2026-10-20, gồm thay đổi chưa commit. Phải chạy lại sau khi sửa; không lấy chúng làm CI của một commit tương lai.

| Kiểm tra | Kết quả quan sát | Giới hạn |
|---|---|---|
| Backend unit test liên quan | 83 pass | Mock không phát hiện được sai SQL/schema |
| PostgreSQL integration | 6 test: 5 pass, 1 error | `selectedTakeReviewUsesOptimisticVersionAndPersistsTrimFingerprint` dừng ở `pc.ai_name`, chưa đi tới bước chọn lại |
| Chapter Analysis PostgreSQL | 4 pass, nằm trong nhóm 6 test trên | Xác minh persistence trên DB tạm; không xác minh agy thật |
| Flyway trên PostgreSQL tạm | Áp dụng được V1–V7 và V17–V19 | Không chứng minh DB installation đã nâng cấp hoặc có thể reset |
| Desktop analysis | 72 pass, 1 skip | Runner/session fakes; không chứng minh provider health |
| Desktop production/render | 25 pass, 1 fail | Test fail đòi literal `timelineBeats={timelineBeats}` trong khi code truyền `timeline?.beats ?? []` |
| Worker video contract/recovery | 11 pass | Không sinh video GPU thật |
| FFmpeg fixture ba cut native AV | Pass | Xác minh ghép/trim hình và âm thanh, không xác minh ngữ nghĩa/khẩu hình |

Bằng chứng bổ sung:

- PostgreSQL trả `column pc.ai_name does not exist` từ `VisualPromptContextMapper.findCharactersForShot` trước khi admit Take, kể cả fixture chưa có nhân vật.
- Probe SQL độc lập: lần lưu đầu `INSERT 0 1`, version = 1; lần lưu tiếp với expected version = 1 trả `INSERT 0 0`, version vẫn = 1. Cùng cấu trúc lỗi xuất hiện ở SelectedTake và allocation set.
- Probe Java gọi validator đã compile: câu tiếng Việt 67 ký tự, Shot mặc định 4.690 ms, speech estimate 5.584 ms; bị từ chối với `NATIVE_DIALOGUE_DURATION_ESTIMATE_V1`.
- Chưa chạy hành trình Electron + agy + GPU thật từ source đến MP4. `docs/current-status.md` đang thiếu; không suy trạng thái hệ thống từ các link tới file đó.

## 3. Bản đồ lỗi và thứ tự thực hiện

| ID | Mức độ | Vấn đề | Task | Điều kiện hoàn tất |
|---|---|---|---|---|
| R01 | P1 | Query nhân vật đọc cột không tồn tại | A1 | Admission và prompt preview chạy với schema thật |
| R02a | P1 | Không đổi được Take/trim sau lần chọn đầu | A2 | Version 0 → 1 → 2; stale write bị từ chối |
| R02b | P1 | Không sửa được phân bổ cue sau lần lưu đầu | A3 | Lưu lại mapping và ghim cue revision mới thành công |
| R03 | P1 | Duration mặc định không khớp admission | A4 | Draft mới thuộc giới hạn profile qua được cùng bộ estimate |
| R04 | P2 | Read model luôn trả text cue bằng null | A5 | Panel phân biệt được câu thoại thực tế |
| R05 | P2 | Technical PASS được gọi là Word Alignment QC | A6 | UI không nhận định alignment/khẩu hình khi chưa có bằng chứng |

**Thứ tự:** A1 → A2 → A3 → A4 → A5 → A6 → A7 → A8. A1 phải xong trước khi dùng integration test admission để kết luận về A2/A4. A7 là kiểm tra các điểm nối và blocker, không bổ sung một engine điều phối mới.

## 4. Nguyên tắc thực hiện

- Dùng regression test tái hiện lỗi trước mỗi bản sửa; task SQL phải có PostgreSQL test, không chỉ mock mapper.
- Hoàn thành task và các test liên quan trước task phụ thuộc tiếp theo. Ghi riêng lỗi nền không thuộc task; không sửa assertion để bỏ qua lỗi thật.
- Giữ worktree hiện có. Không reset/stage thay đổi khác, không commit tự động trong bước viết plan.
- Giữ Take input snapshots, SelectedTake đã lưu và render snapshots bất biến theo contract tương ứng. Sửa draft hoặc lựa chọn hiện tại không ghi lại lịch sử.
- Giữ idempotency intent qua timeout, UNKNOWN fencing và serialization video hiện có. Không bật tự động submit lại để làm acceptance pass.
- Không thêm schema/migration chỉ để sửa alias SQL, CAS, text projection hoặc nhãn UI. Nếu phát hiện thật sự cần schema mới, dừng phần thiết kế đó để đối chiếu inventory/applied history và cập nhật plan.
- Tách estimate, observed technical metadata, word alignment và human review. Không dùng estimate hay forced alignment làm bằng chứng nhân vật đã nói đúng câu/đúng khẩu hình.
- Java dùng formatter của repo. UI dùng design tokens hiện có và runtime gate trong [AGENTS](../../AGENTS.md), [Playwright rules](../../.agents/rules/playwright-testing.md).

Quy ước đường dẫn trong các mục Files: **BE** = `app/backend-service`; **DE** = `app/desktop`. Đường dẫn dưới mỗi prefix tính từ root module đó. Tên file mới là đề xuất, chỉ tạo khi chưa có seam tương đương.

## 5. Mốc A — sửa lỗi trên profile hiện tại

### A1 — Sửa nguồn AI identity trong context nhân vật

**Files:**

- BE: `src/main/resources/mybatis/VisualPromptContextMapper.xml`.
- BE: `src/main/java/com/narrativex/backend/feature/generation/infrastructure/persistence/adapter/MyBatisVisualPromptContextPersistenceAdapter.java` — chỉ đổi nếu mapping cần điều chỉnh.
- BE: `src/test/java/com/narrativex/backend/feature/generation/infrastructure/persistence/ShotTakeAdmissionPostgreSqlIntegrationTest.java`.

**Cách sửa:** `project_characters` giữ participation, còn `project_character_ai_identities` giữ `ai_name`. Lấy alias từ bảng identity hiện hữu qua Project + ProjectCharacter, có xét active identity. Dùng join giữ được participation khi thiếu identity; canonical name vẫn là dữ liệu độc lập. Giữ thứ tự ổn định và không nhân bản một nhân vật bởi aliases.

- [x] Thêm PostgreSQL regression cho query không có nhân vật và query có participating character; test phải thất bại với SQL hiện tại.
- [x] Thay `pc.ai_name` bằng projection/join đúng; kiểm tra result map `aiName`, preview và admission dùng cùng nguồn.
- [x] Giữ pin CharacterVersion, appearance/outfit, current storyboard và Project scope; không mở rộng sang mọi nhân vật của Scene.
- [x] Test active/inactive identity, thiếu identity, Project khác, nhân vật không tham gia Beat, thứ tự nhân vật và snapshot provenance.
- [x] Chạy lại admission PostgreSQL và unit tests prompt compiler; xác nhận lỗi không chỉ chuyển sang một alias SQL khác.

**Đạt khi:** fixture Take hợp lệ được admit với DB thật; prompt giữ identity đúng; unsupported input vẫn bị từ chối trước job/Take/GPU.

### A2 — Sửa optimistic write của SelectedTake

**Files:**

- BE: `src/main/resources/mybatis/SelectedTakeMapper.xml`.
- BE: `src/main/java/com/narrativex/backend/feature/generation/infrastructure/persistence/mybatis/SelectedTakeMapper.java`.
- BE: `src/main/java/com/narrativex/backend/feature/generation/infrastructure/persistence/adapter/MyBatisSelectedTakeRepository.java`.
- BE: `src/test/java/com/narrativex/backend/feature/generation/infrastructure/persistence/ShotTakeAdmissionPostgreSqlIntegrationTest.java`.
- BE: `src/test/java/com/narrativex/backend/feature/generation/application/usecase/SelectTakeUseCaseTest.java`.

**Cách sửa đề xuất:** trong transaction, UPDATE theo `shot_id + expectedRowVersion`; khi chưa có hàng và expected = 0 mới thử INSERT với `ON CONFLICT DO NOTHING`. Tổng cộng phải có đúng một mutation thành công; trường hợp khác trả conflict. Cách này hỗ trợ cả selection legacy có row_version = 0, không dùng DELETE rồi INSERT và không reset version.

- [x] Sau A1, tái hiện chọn lần đầu rồi chọn lại/trim lần hai bằng test PostgreSQL hiện có.
- [x] Sửa mapper/repository theo compare-and-set; không để điều kiện của nhánh INSERT vô hiệu hóa UPDATE.
- [x] Giữ checklist, fingerprint Take+input+trim, reviewedAt và cập nhật Shot trong transaction; conflict không ghi nửa review/trim.
- [x] Test hàng mới 0 → 1 → 2, legacy row 0 → 1, expected > 0 nhưng hàng không tồn tại, expected cũ và hai transaction cùng chọn.
- [ ] Test đổi Take, trim lại cùng Take, bounds sai và checklist thiếu; input Take và render snapshot cũ giữ nguyên.
- [x] Chạy PostgreSQL và selection unit/API tests; xác nhận conflict thật vẫn trả 409 và reload lấy đúng version mới.

**Đạt khi:** có thể chọn Take A, đổi sang B, trim B rồi reload; thao tác từ cửa sổ giữ version cũ không ghi đè B.

### A3 — Sửa version và transaction khi thay phân bổ AudioCue

**Files:**

- BE: `src/main/resources/mybatis/ShotAudioCueAllocationMapper.xml`.
- BE: `src/main/java/com/narrativex/backend/feature/storyboard/infrastructure/persistence/mybatis/ShotAudioCueAllocationMapper.java`.
- BE: `src/main/java/com/narrativex/backend/feature/storyboard/infrastructure/persistence/adapter/MyBatisShotAudioCueAllocationRepository.java`.
- BE: `src/main/java/com/narrativex/backend/feature/storyboard/application/usecase/ReplaceShotAudioCueAllocationsUseCase.java` — chỉ nếu cần làm rõ transaction/validation.
- BE: `src/test/java/com/narrativex/backend/feature/generation/infrastructure/persistence/ShotTakeAdmissionPostgreSqlIntegrationTest.java`.
- BE: `src/test/java/com/narrativex/backend/feature/storyboard/application/usecase/ReplaceShotAudioCueAllocationsUseCaseTest.java`.

**Cách sửa:** sửa compare-and-set cho allocation set theo cùng nguyên tắc A2 nhưng giữ mapper riêng cho nghiệp vụ này. Advance version, xóa mapping cũ và chèn mapping mới phải là một transaction. Không tạo abstraction persistence chung chỉ vì hai query có cùng dạng lỗi.

- [x] Thêm PostgreSQL test lưu lần đầu, chuyển cue sang Shot khác rồi lưu lần hai; hiện test chỉ kiểm lần lưu đầu chưa đủ.
- [x] Sửa UPDATE/INSERT version; lỗi version xảy ra trước khi xóa mapping cũ.
- [x] Test stale expected version, hai cửa sổ cùng lưu, constraint failure trong insertBatch làm rollback cả version và mapping.
- [x] Test cue vừa chỉnh row version: generation bị chặn, lưu lại mapping ghim revision mới, generation nhận lại đúng subset.
- [x] Giữ reject cue/Shot khác scope, duplicate owner và thiếu coverage; kiểm cả sequence một Shot và nhiều Shot khi mapping đã stale.
- [x] Chạy PostgreSQL và allocation unit tests; kiểm admission không âm thầm biến cue stale thành video không thoại.

**Đạt khi:** thay phân bổ nhiều lần được; mapping cũ còn nguyên sau conflict/failure; mỗi cue hợp lệ chỉ có một playback owner.

### A4 — Thống nhất duration estimate giữa materialization và admission

**Files:**

- BE: `src/main/java/com/narrativex/backend/feature/generation/infrastructure/dispatch/ChapterAnalysisArtifactMaterializer.java`.
- BE: `src/main/java/com/narrativex/backend/feature/generation/application/usecase/GenerateShotTakeUseCase.java`.
- BE: tạo helper thuần `src/main/java/com/narrativex/backend/feature/generation/application/service/NativeDialogueDurationEstimator.java` nếu chưa có estimator dùng chung phù hợp.
- BE: các test `ChapterAnalysisAudioCueMaterializationTest`, `ChapterAnalysisDefaultShotInputTest`, `GenerateShotTakeUseCaseTest` và PostgreSQL admission trong các package hiện có.

**Cách sửa:** dùng một thuật toán estimate có version cho text thực sẽ nói, ngôn ngữ và pause giữa các cue. Materializer dùng thuật toán đó khi tạo default Shot; admission dùng lại cùng semantics. Tách estimate cho narration khỏi estimate của Native AV; không dùng tổng source prose làm thay thế cho tập dialogue được phân bổ.

- [x] Viết regression xuyên materializer → persisted Shot → admission cho câu tiếng Việt 67 ký tự: 4.690 ms cũ phải tái hiện lỗi 5.584 ms.
- [x] Chuyển phép tính speech estimate hiện tại vào helper thuần; xử lý Unicode code points, vi/en/fallback, text trống và nhiều cue theo cùng quy tắc.
- [ ] Với default Shot mới thuộc giới hạn profile, cấp đủ thời lượng cho estimate và rounding cần thiết của profile hiện hữu; giữ shot không thoại có duration hình ảnh hợp lệ.
- [x] Nếu speech vượt giới hạn clip, ghi rõ cần biên tập/chia Shot và chặn generation; không clamp về 10 giây rồi báo ready, không truncate câu hoặc tự tăng tốc tiếng.
- [ ] Giữ duration người dựng đã đặt làm đầu vào cần validate; không tự sửa hàng loạt Shot cũ, Take đã admit hoặc snapshot. Nếu cần thao tác tính lại draft, xác định endpoint hiện có và expected row version trước khi thêm UI mới.
- [ ] Test biên min/max, đúng ngưỡng/vượt ngưỡng, nhiều cue/pause, emoji/dấu tiếng Việt, narrator tách khỏi native dialogue và idempotent replay của snapshot cũ.
- [x] Chạy tests helper/materializer/admission và thêm PostgreSQL seam chứng minh default mới không tự bị validator từ chối.

**Đạt khi:** mọi default Shot mới có native dialogue thuộc giới hạn được cả planner và admission đánh giá nhất quán. Đây vẫn là ước lượng, không phải timing đo thật hoặc bằng chứng khẩu hình.

### A5 — Đưa văn bản cue thực tới màn phân bổ

**Files:**

- BE: `src/main/java/com/narrativex/backend/feature/storyboard/application/port/in/StoryboardProductionAccess.java`.
- BE: `src/main/java/com/narrativex/backend/feature/storyboard/infrastructure/persistence/adapter/MyBatisStoryboardProductionAccessAdapter.java`.
- BE: `src/main/resources/mybatis/StoryboardMapper.xml` — kiểm tra projection đang có trước khi sửa.
- BE: `src/main/java/com/narrativex/backend/feature/generation/application/usecase/GetChapterProductionUseCase.java` và test cùng tên.
- DE: `src/renderer/features/storyboard/components/ShotAudioCueAllocationPanel.tsx`, API types liên quan nếu cần.
- Tests: bổ sung integration fixture riêng cho panel theo test harness Desktop hiện có.

**Cách sửa:** mang adapted text từ AudioCue qua port/read model; bỏ giá trị null gán cứng. Không tự đổi ý nghĩa null thành câu thoại đã duyệt. Với KEEP_EXACT chưa có adapted text, chỉ dùng source slice đã được backend resolve theo anchor hợp lệ nếu contract hiện tại quy định như vậy; không để renderer đoán offsets hoặc sửa source.

- [x] Thêm test backend: hai cue cùng speaker nhưng text khác nhau phải được API trả phân biệt được, đúng cue ID và thứ tự.
- [x] Bổ sung field text cần thiết vào AudioCueInfo và sửa mọi constructor/caller/fixture; tái dùng projection hiện có khi đủ dữ liệu.
- [x] Panel hiển thị text dưới dạng dữ liệu thuần, có cách xem toàn câu dài; trạng thái thiếu text thật khác với đã có text nhưng chưa duyệt.
- [ ] Test empty/null/long text và markup không tin cậy; chọn Shot, lưu, reload và sửa allocation dùng đúng cue ID/version.
- [ ] Chạy backend/API tests và Desktop component/integration tests; thực hiện Electron flow panel theo gate A8.

**Đạt khi:** người dựng nhìn thấy câu cụ thể để phân bổ, không phải nhiều dòng cùng tên người nói và thông báo thiếu text giả.

### A6 — Sửa nhãn QC và cập nhật test source đã lỗi thời

**Files:**

- DE: `src/renderer/features/chapters/model/production-stage-status.ts`.
- DE: `src/renderer/features/chapters/components/stages/ChapterProductionStage.tsx`.
- DE: `test/production-stage-status.test.mjs`, `test/video-production-components.test.mjs` và fixture runtime liên quan.

**Cách sửa:** đổi counter đang lấy từ passedShots thành tên/nhãn kiểm định kỹ thuật. Chỉ hiển thị trạng thái alignment từ bằng chứng alignment thực; thiếu metrics phải là chưa có dữ liệu. Giữ human content review riêng, không gộp thành technical PASS.

- [x] Đổi `qcPassedCount` thành tên phản ánh technical validation; sửa label và tooltip “Word Alignment QC”.
- [x] Test Take technical PASS nhưng chưa có WhisperX metrics: UI không được báo alignment/khẩu hình đã đạt.
- [x] Kiểm có metrics thật, metrics fail và không có dữ liệu; không thêm scoring engine hoặc gọi inference chỉ để lấp counter.
- [x] Thay assertion literal `timelineBeats={timelineBeats}` bằng kiểm tra hành vi truyền timeline cho Shotboard; giữ regression nhiều Shot và timeline null.
- [ ] Chạy Desktop tests/type-check/build và Electron gate A8, chụp ảnh trạng thái technical pass nhưng alignment chưa có.

**Đạt khi:** người dựng phân biệt được video hợp lệ về kỹ thuật, timing đã đo và nội dung đã duyệt.

### A7 — Kiểm tra điểm nối, capability và trạng thái fail-closed

**Files cần kiểm, chỉ sửa khi test phát hiện lệch:**

- BE: `GenerateShotTakeUseCase`, `GenerationPreflightEvaluator`, `GetChapterProductionUseCase`, `ChapterProductionStatusMapper.xml`, `ShotMapper.xml`, `ProductionTimelineMapper.xml`.
- DE: `ShotActionToolbar.tsx`, `VideoShotboard.tsx`, `ShotAudioCueAllocationPanel.tsx`, `render-readiness.ts`, queries production.
- Tests: preflight/status equivalence, ShotTakeAdmissionPostgreSqlIntegrationTest và các test renderer hiện có.

- [ ] Kiểm readiness/UI và admission cùng báo unsupported NARRATOR/INNER_MONOLOGUE/SYSTEM, strategy ngoài T2V, reference conditioning và audio mode chưa có profile; không bật nút chỉ để backend trả lỗi không giải thích được.
- [ ] Kiểm Beat nhiều Shot: mỗi cue phát đúng một lần và theo thứ tự source/script; allocation đảo thứ tự phải được báo rõ hoặc chặn theo contract, không tự sắp xếp lại văn bản.
- [ ] Kiểm response mất sau submit: dùng lại intent cũ để reconcile, không tạo Take thứ hai. UNKNOWN tiếp tục chặn attempt mới cho tới khi có kết quả đối soát.
- [ ] Kiểm Retake không làm mất SelectedTake cũ; đổi selection/trim invalidates đúng draft/cache và không sửa render snapshot đã freeze.
- [ ] Kiểm timeline gồm mọi Shot theo thứ tự, thiếu một selected cut làm render unready; native export không tự chuyển sang narration hoặc hình preview để vượt gate.
- [ ] Bổ sung regression ở seam thực cho sai lệch phát hiện trong bước này; ghi vấn đề mới vào plan, không tự mở rộng sang orchestration/automatic semantic retry.

**Đạt khi:** pipeline hỗ trợ gì và chặn gì là nhất quán giữa status, nút thao tác, admission và render snapshot.

### A8 — Full gate và nghiệm thu runtime

**Files:** tests tương ứng A1–A7; tài liệu [generation routing](../architecture/generation-routing.md), [editing pipeline](../architecture/editing-pipeline.md), plan này và [documentation map](../README.md) tại phần thay đổi thực tế.

- [ ] Chạy full checks ở mục 7; PostgreSQL integration phải chạy thật, không đóng task nếu bị skip vì Docker.
- [ ] Chạy các scenario E1–E8 trong Electron/Vite thật dùng API thật; fixture riêng chỉ là test tự động bổ sung.
- [ ] Kiểm console, failed API, fake/mock data lọt vào runtime, loading/error/empty, keyboard, overflow và màn hình bị ảnh hưởng; chụp screenshot sau triển khai.
- [ ] Xuất MP4 từ ít nhất ba selected native cuts; ffprobe kiểm duration/streams/FPS và nghe/xem output, không chỉ xác nhận file tồn tại.
- [ ] Ghi rõ phần nào mới chạy bằng fixture, phần nào có agy/GPU thật; chỉ đánh dấu Mốc A IMPLEMENTED khi các gate của Mốc A đủ bằng chứng.
- [ ] Đồng bộ tài liệu sở hữu hành vi và bảng trạng thái plan; nếu khôi phục `docs/current-status.md`, chỉ ghi facts đã kiểm chứng và để Mốc B là TARGET/PARTIAL theo thực tế.

## 6. Mốc B — đóng khoảng trống narration, không lẫn với bug fix

**Trạng thái:** TARGET. Không bỏ guard `requireNativeDialogueCue` để làm truyện có narrator chạy được. Không đổi NARRATOR thành DIALOGUE, không bỏ cue và không ghép VieNeu như clock ngầm vào native takes.

Các bước sau triển khai trong đợt C–E của [plan tổng](20261017-video-production-and-regeneration.md); dùng một backlog chung, không tạo thêm bản triển khai song song.

| Bước | Công việc cụ thể | Phụ thuộc/cổng bắt buộc |
|---|---|---|
| B1 — chốt clock và contract | Refine ADR-0005/0006/0007/0008 cho mode audio-first, speech/VO, review và render snapshot; giữ schema 1.1 native và render schema 3/4 đọc/khôi phục được | Quyết định được chấp nhận trước khi đổi timing/execution boundary |
| B2 — audio master được duyệt | Assemble script theo chương từ ordered AudioCues; pin voice binding/model/reference; synth hoặc dùng audio nhập có chủ đích; align đúng WAV và text; lưu asset/hash/timing/revision | Không synth theo VisualBeat; retry hình không synth lại audio đã duyệt; narrator và nhân vật giữ vai trò riêng |
| B3 — conditioning khả dụng thật | Spike workflow image/audio conditioning trên runtime được pin; đo VRAM/runtime; version task schema/profile và advertise capability đúng | Không fallback T2V; không tuyên bố worker hiện tại đã hỗ trợ; thiếu capability vẫn blocked |
| B4 — timeline và mix | Snapshot ordered cuts trên audio master; source speech không phát chồng lên master; VO không điều khiển miệng; subtitle từ timing thật; pin mọi dependency/cache key | Không lặp/mất câu, drift trong giới hạn contract, snapshot cũ bất biến |
| B5 — pilot thật | Một chương có 2 nhân vật + narrator + reaction/B-roll, ít nhất 3 Shot; tạo lại Shot giữa, đổi selection, restart và xuất MP4 | Người dựng nghe/xem duyệt nội dung/continuity; ghi failure cases và giới hạn, không chỉ benchmark kỹ thuật |

**Tiêu chí Mốc B:** truyện có lời kể đi từ source đến MP4 với đủ câu đúng thứ tự, giọng và vai trò audio đúng, không lấy narration làm thoại miệng nhân vật. Mặt/trang phục/khẩu hình phải được duyệt trên output thực. Technical PASS hay forced alignment không tự thay thế việc này.

## 7. Kiểm thử và lệnh kiểm tra

Chạy từ từng module theo [CONTRIBUTING](../../CONTRIBUTING.md). Dùng output directory riêng khi IDE đang compile. Windows từng chặn Mockito attach/Docker named pipe trong sandbox: xử lý quyền môi trường hoặc setup test agent đúng, không sửa logic sản phẩm và không coi skip là pass.

```powershell
# Từ app/backend-service: feedback nhanh A1/A2/A3
./mvnw.cmd test '-Dnarrativex.buildDirectory=target/verification/target' '-Dtest=ShotTakeAdmissionPostgreSqlIntegrationTest'

# Gate đầy đủ backend, gồm PostgreSQL tests
./mvnw.cmd test '-Dnarrativex.buildDirectory=target/verification/target'

# Từ app/desktop: feedback nhanh, chưa thay cho full gate/runtime
node --experimental-strip-types --experimental-transform-types --test test/production-stage-status.test.mjs test/video-production-components.test.mjs test/shot-take-admission-api.test.mjs test/render-readiness.test.mjs test/render-native-av.integration.test.mjs

# Gate đầy đủ Desktop
npm ci
npm test
npm run type-check
npm run build

# Từ app/generation-service: bắt buộc khi sửa worker/contracts ở Mốc B
python -m pytest
python -m ruff check .
python -m mypy src

# Từ repository root
git diff --check
```

Các test mới cho helper duration và cue panel phải được đưa vào full gate; không giới hạn acceptance vào danh sách feedback nhanh trên. Ordinary tests dùng fakes/mocks ở provider boundary; health/provider/GPU thật được báo riêng.

### Ma trận nghiệm thu

| ID | Scenario | Kết quả bắt buộc | Loại bằng chứng |
|---|---|---|---|
| E1 | Source ngắn → CANON/STORY → storyboard | Source anchors hợp lệ, toàn bộ materialization commit hoặc rollback, không mất source | Backend/runner tests + agy thật khi nghiệm thu provider |
| E2 | Generate một Shot dialogue hợp lệ | Admit thành công với schema thật; đúng một Take/job/intent | PostgreSQL + API/Electron; GPU thật báo riêng |
| E3 | Chọn A → B → trim B → reload | Lưu đủ ba thao tác; review gắn đúng trim/input; snapshot cũ giữ nguyên | PostgreSQL + Electron |
| E4 | Hai cửa sổ cùng chọn | Một mutation thắng, cửa sổ stale nhận conflict rồi reload được | Concurrent PostgreSQL + Electron |
| E5 | Beat ba Shot, nhiều câu cùng speaker | Nhìn thấy text từng cue; sửa mapping lần hai được; cue edit làm stale, lưu lại ghim version mới | PostgreSQL + panel integration + Electron |
| E6 | Default Shot tiếng Việt và sát duration limit | Planner/admission dùng cùng estimate; quá dài bị chặn trước GPU, không cắt câu | Unit + materialize/admission integration |
| E7 | Technical PASS nhưng chưa word timing; narrator/unsupported strategy | Nhãn đúng khả năng, blocker rõ trước inference, không fallback âm thầm | API + renderer tests + Electron |
| E8 | Ba SelectedTake → MP4, mất response/restart | Đúng thứ tự/trim hình và tiếng; intent được reconcile; không trùng việc, không finalize lease đã mất | FFmpeg fixture + runtime/native evidence |

## 8. Triển khai dữ liệu, hoàn tất và theo dõi

Các sửa A1–A6 dự kiến không cần migration. Inventory hiện tại là V1–V7 + V17–V19; không chỉnh baseline, thêm `ai_name` vào sai bảng hoặc reset installation để né lỗi query. DB tạm áp dụng được migrations không đồng nghĩa DB người dùng có thể nâng cấp trực tiếp. Trước rollout, audit applied Flyway history và backup theo quy trình hiện có.

**Theo dõi:** checkbox chỉ đánh dấu khi có bằng chứng tương ứng; phát hiện bổ sung ghi `[+]`, blocker ghi `[!]`. Không đánh dấu toàn plan hoàn tất khi chỉ xong Mốc A. Theo quy tắc repo, plan đã hoàn tất được loại khỏi active map; kiến thức lâu dài chuyển vào tài liệu sở hữu thay vì lưu thêm báo cáo trùng.

**Bằng chứng cập nhật 2026-10-20:** backend full gate `./mvnw.cmd test '-Dnarrativex.buildDirectory=target/verification/target'` — 936 pass, 0 fail/error/skip, PostgreSQL 18/Testcontainers chạy thật. Desktop `npm test`, `npm run type-check` và `npm run build` đều pass từ dependency tree hiện có; các regression FFmpeg chỉ dùng fixture. `npm ci` vẫn lỗi Windows `EPERM` khi xóa `app/desktop/node_modules/.bin`, kể cả khi Vite đã dừng. Playwright mở được renderer Vite nhưng không có Electron preload (`window.narrativeX` undefined), nên không thể vào Project; backend API tại `localhost:8080` không chạy. Không có agy/GPU thật và chưa xuất MP4 từ ba selected cuts. Các điểm nối A7 và runtime A8 chưa nghiệm thu; Mốc A chưa IMPLEMENTED và Mốc B giữ TARGET. `docs/current-status.md` vẫn thiếu; không tạo lại từ phỏng đoán.

- [x] Ghi rõ phần nào mới chạy bằng fixture, phần nào có agy/GPU thật; chỉ đánh dấu Mốc A IMPLEMENTED khi các gate của Mốc A đủ bằng chứng.
- [x] Đồng bộ tài liệu sở hữu hành vi và bảng trạng thái plan; nếu khôi phục `docs/current-status.md`, chỉ ghi facts đã kiểm chứng và để Mốc B là TARGET/PARTIAL theo thực tế.

**Ngoài phạm vi:** automatic semantic QA/retry, tự chọn Take, tự dựng lại toàn chương, nâng model hàng loạt, retention engine và thêm broker/cache/service. Reference conditioning/audio-first chỉ triển khai theo cổng Mốc B, không phải bản sửa nóng của các query/validator hiện tại.
