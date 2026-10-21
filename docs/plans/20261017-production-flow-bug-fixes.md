# Plan: Sửa lỗi flow sản xuất và retry từng Shot

**Ngày:** 2026-10-17

**Trạng thái:** PARTIAL — prompt/admission/Shotboard, cue allocation và một phần review/trim đã triển khai; PostgreSQL và runtime acceptance còn lại.

Đã triển khai trong lượt implement: prompt canon nhân vật theo VisualBeat và phiên bản appearance/outfit; map visual direction vào Shot mặc định; chặn cue ngoài hình; allocation V19 lưu một AudioCue đầy đủ cho đúng một Shot và chặn cue stale/duplicate; ước lượng thoại Native AV; Shotboard hiển thị mọi Shot; giữ idempotency intent local qua timeout. Selection yêu cầu 5 mục human review, lưu fingerprint input + trim và dùng optimistic row version. Take drawer có preview quanh trim và Take đã chọn của Shot trước/sau trong sequence, kèm cảnh báo chưa có word timing. Còn thiếu: PostgreSQL verification V17/V19, runtime flow với Scene/Shot có thật và một số test/acceptance F06–F09.

Kiểm tra: 94 backend unit/API tests liên quan pass; 2 PostgreSQL integration tests bị skip vì Docker named pipe không khả dụng; Desktop type-check/build pass. `FlywayBaselineStructureTest` hiện fail ở assertion `supportsSpeakingRate` trong V7 seed; V7 và test đó đã bị sửa trước lượt implement này. Electron mở được, nhưng chapter đang xem chưa có Scene/Shot để chạy flow. Mình không nhấn nút phân tích; sau reload, UI báo agy đang chạy 32% (nguồn chưa xác định) và mình để nguyên. Runtime acceptance còn blocked. V17/V19 chưa được áp dụng lên database thật.

**Plan tổng:** [Video production and regeneration](20261017-video-production-and-regeneration.md).

**Review bổ sung 2026-10-20:** [Story-to-video remediation](20261020-story-to-video-remediation.md) ghi các lỗi còn lại đã xác nhận: query AI identity sai schema, optimistic write của selection/allocation chỉ lưu được lần đầu, duration estimate không nhất quán, thiếu cue text và nhãn QC sai khả năng thực tế. Kết quả review mới không nâng trạng thái các phần runtime chưa nghiệm thu trong plan này.

## 1. Phạm vi và ranh giới

Sửa các lỗi đã tìm trong audit, ưu tiên regression tests và thay đổi nhỏ trên luồng hiện có. Giữ native AV/schema 1.1/schema render 4 cho phần sửa tương thích; audio-first và reference conditioning thuộc đợt C/D/E của plan tổng. Chưa có profile tương ứng thì UI/backend phải nêu rõ blocker.

Preserve worktree đang có, source revision, Take input snapshots, SelectedTake và render snapshots. Không chạy AI trả phí, tạo lại chương hoặc reset DB chỉ để kiểm tra plan.

## 2. Liên hệ với 7 phát hiện trước

| Phát hiện audit | Loại | Công việc |
|---|---|---|
| Canon nhân vật chưa ảnh hưởng video prompt; hình chưa được neo | Bug truyền dữ liệu + capability gap | F01; reference conditioning ở đợt D |
| Shot mặc định mất visual direction và trạng thái hành động | Bug truyền dữ liệu | F02 |
| Narrator/inner monologue thành dialogue | Bug contract | F03 |
| Mọi Shot của Beat nhận lại tất cả cue | Bug phân bổ | F04 |
| Lượng lời không khớp thời lượng | Bug admission + thiếu clock đo thật | F05; audio đã duyệt ở đợt C |
| Technical PASS chưa kiểm nội dung/khẩu hình | Quality gap, không phải bằng chứng semantic QA đã có | F06; chỉ số tự động DEFERRED |
| Trim/hard cut chưa được duyệt theo câu/hành động | Quality gap | F07; audio master/mix ở đợt E |
| Mới phát hiện: board/drawer chỉ lấy `shots[0]`, preview phụ thuộc Shot status | UI/data presentation gap | F08 |
| Nút Retake chưa đồng bộ capability/blocking và operation recovery | UI/lifecycle gap | F09 |

F01/F03/F05 có probe thực ở bước chuẩn bị input trong lượt audit. F02/F04/F06–F09 được đối chiếu source; cần regression và runtime tương ứng trước khi kết luận đã sửa. Hard cut tự nó hợp lệ; không thêm transition hàng loạt như cách chữa mặc định.

## 3. Danh sách công việc

### F01 — Chèn đúng canon nhân vật vào prompt video

**Điểm sửa:** `VideoPromptCompiler`, `GenerateShotTakeUseCase`, `BackendPromptPreviewSource`, projection từ `ShotMapper.xml`; tái dùng Character identity composer khi phù hợp.

- [ ] Lấy nhân vật thực sự xuất hiện ở Shot; dùng participation của Beat như fallback cho Shot mặc định, không tự thêm mọi người có mặt trong Scene. Phân biệt người nói ngoài hình với người xuất hiện.
- [ ] Pin CharacterVersion và appearance/outfit đã resolve; chèn visual prompt/bible/profile có giới hạn độ dài và thứ tự ổn định. Preview và admission dùng chung nguồn/composer.
- [ ] Snapshot/fingerprint phản ánh đúng mô tả/reference của operation mới, giữ idempotent replay và input cũ. Không coi cùng seed là khóa nhận diện.
- [ ] Test đổi ngoại hình làm đổi prompt; unrelated/offscreen character không làm sai subject; preview khớp admission; pin/replay/backward compatibility.

**Đạt khi:** hai Shot cùng nhân vật có cùng identity text; đổi outfit có chủ đích chỉ đổi operation mới. Không tuyên bố đồng nhất hình khi worker chỉ T2V.

### F02 — Giữ chỉ dẫn Beat trong Shot mặc định

**Điểm sửa:** `ChapterAnalysisArtifactMaterializer`, `NativeVideoInputMapper`, `VideoPromptCompiler`, analysis contract resources và tests.

- [ ] Map shot_size/camera_angle/lens/focus/placement/background/light/palette/camera movement sang các field có consumer thực. Chuẩn hóa JSON keys giữa materializer và compiler/mapper.
- [ ] Giữ action_phase và hành động theo source; chỉ ghi start/end state nếu có bằng chứng. Trạng thái không suy ra được phải hiện cần biên tập, không tự bịa trạng thái của nhân vật/đạo cụ.
- [ ] Default Shot nhận subject IDs đúng; chỉ dẫn Beat chỉ bổ sung khi Shot chưa override. Beat không mô tả lại Location canon.
- [ ] Dữ liệu cũ: read fallback hoặc thao tác backfill tường minh chỉ cho Shot mặc định chưa chỉnh/chưa admit; không tự re-analyze hay sửa Shot đã sản xuất. Nếu đổi contract, phát hành schema/prompt hash mới.
- [ ] Test từ fixture analysis qua materialize tới input worker; bảo toàn explicit Shot override, nguồn cũ và snapshots.

**Đạt khi:** góc máy/chuyển động trong analysis xuất hiện đúng trong input video thực, bao gồm Shot mặc định.

### F03 — Bảo toàn vai trò audio và người nói

**Điểm sửa:** `GenerateShotTakeUseCase`, `NativeVideoInputMapper`, compute schemas/task DTOs, `ltx/workflow.py`, preflight.

- [ ] Giữ cue ID/type/speaker/delivery; compile thoại trong hình khác lời kể, suy nghĩ và system voice. Một primary voice không thay mọi speaker.
- [ ] Native profile cũ chỉ chạy trường hợp nó thể hiện đúng. Case không hỗ trợ phải bị chặn với hướng giải quyết; không âm thầm bỏ cue hoặc chuyển narrator thành miệng nhân vật.
- [ ] Contract mở rộng dùng schema/profile mới khi cần; giữ replay đầu vào 1.1, không nhận field mới rồi bỏ qua ở worker. Audio stem ngoài hình thuộc đợt C/D/E.
- [ ] Test narrator chỉ dẫn ngoài hình, inner monologue không mở miệng, hai speaker đúng identity, thiếu voice, unsupported cue/profile và regression native dialogue.

**Đạt khi:** NARRATOR không còn thành dialogue vô danh. Mọi cue được render đúng vai trò hoặc có blocker trước GPU.

### F04 — Phân bổ cue cho Shot, không đọc lại

**Điểm sửa:** projection `ShotMapper.xml`, `StoryboardProductionAccess`, `GenerateShotTakeUseCase`, Shot authoring/admission và tests.

- [ ] Tạo mapping tường minh Shot ↔ cue/text range, dùng ID và offsets của script được duyệt; chỉ thêm persistence tối thiểu sau khi kiểm tra schema hiện có. Một Shot mặc định có thể nhận toàn bộ Beat; nhiều Shot chưa phân bổ thì báo blocker, không chia tùy tiện theo số ký tự.
- [ ] Coverage validator phát hiện cue bị phát hai lần hoặc bị bỏ; reaction/B-roll được phép phủ hình lên audio liên tục, không tạo bản đọc trùng. Tham chiếu cùng cue để hình dung không đồng nghĩa sở hữu playback.
- [ ] Snapshot mapping; source/script revision đổi làm draft cần xem lại. Cue ngoài source/Beat hoặc speaker khác Project bị từ chối.
- [ ] Test một Beat ba Shot nói/phản ứng/nói tiếp; cắt câu giữa hai shot; overlap hình hợp lệ; double ownership và uncovered cue bị chặn. PostgreSQL test query trả đúng subset.

**Đạt khi:** toàn timeline có đủ câu đúng thứ tự, mỗi khoảng audio phát đúng một lần. Trong native mode, không giả vờ bảo đảm nối một câu qua hai lần sinh độc lập; giữ câu trong một take hoặc yêu cầu mode đã hỗ trợ.

### F05 — Admission kiểm tra thoại vừa thời lượng

**Điểm sửa:** `validateNativeVideoInputs`, duration estimator ở materializer, production blockers/readiness, worker contract.

- [ ] Đo duration/alignment khi audio tồn tại. Native text-only dùng ước lượng có version theo ngôn ngữ, tốc độ và khoảng nghỉ; hiển thị estimate, không dùng nó làm bằng chứng render ready.
- [ ] Chặn trường hợp rõ ràng bất khả thi; trả số lượng lời, thời lượng cần/dự kiến và giới hạn profile. Cho sửa độ dài/chia Shot; không tự cắt câu, truncate hay tăng tốc tiếng để qua gate.
- [ ] Không clamp thời lượng vượt giới hạn rồi coi đã hợp lệ. Với audio-first, bao gồm handles/pause và frame rounding; audio gốc giữ nguyên.
- [ ] Test 4.999 ký tự/4 giây bị chặn, câu ngắn hợp lệ, tiếng Việt/ngôn ngữ chưa có calibration, nhiều cue/pause, min/max duration, measured duration và replay cũ.

**Đạt khi:** input quá dài không tạo Take/job/GPU submission; phần gần ngưỡng được báo rõ ước lượng, chưa cam kết lời đọc chính xác.

### F06 — Duyệt nội dung tách khỏi technical validation

**Điểm sửa:** `VideoGenerationResultFinalizer`, `SelectTakeUseCase`, production read models/readiness, `TakeSelectorDrawer`.

- [ ] Giữ technical PASS đúng nghĩa file/streams/decode, không đổi tên thành đạt khẩu hình. Bổ sung review tối thiểu gắn Take+trim+input fingerprint để biết phiên bản nào đã được người dựng duyệt, không đưa user/account ID vào domain.
- [ ] UI checklist: nhân vật/trang phục, bối cảnh, hành động/chuyển động, câu thoại/giọng, khẩu hình. Cho failed/rejected candidate lý do và nút tạo lại.
- [ ] Selection mới yêu cầu technical PASS và người dựng duyệt; nếu thao tác Chọn cũng là duyệt thì backend lưu review trong cùng transaction. Dữ liệu legacy có chính sách chuyển tiếp tường minh, không tự nhận đã qua semantic QA.
- [ ] Test technical valid nhưng người dựng reject không thành selected; đổi trim/dependency làm review cần xem lại; optimistic conflict. Không thêm automatic semantic retry engine.

**Đạt khi:** UI/backend phân biệt được xuất được file và người dựng đã xem/nghe duyệt.

### F07 — Trim và điểm nối có ngữ cảnh

**Điểm sửa:** `SelectTakeUseCase`, `TakeSelectorDrawer`, Editor preview, render profile/manifest và tests.

- [ ] Dùng word timings nếu có để cảnh báo cắt giữa chữ/câu; khi chưa có timings hiển thị chưa kiểm chứng, không tạo timing giả.
- [ ] Cho xem/nghe trước/sau cut và cuối Shot trước → đầu Shot sau. Người dựng kiểm hướng nhìn, vị trí, đạo cụ, động tác, tiếng nền và khoảng nghỉ.
- [ ] Giữ đồng thời video/audio trim trong native mode. Cut/overlap/mix AUDIO_FIRST đi theo snapshot mới của đợt E; thay selection chỉ invalidates draft/review phụ thuộc.
- [ ] Test bounds/frame rounding/câu bị cắt/không timing; FFmpeg fixture giữ thứ tự hình/tiếng; Electron preview và xuất kiểm tra không mất/lặp âm tiết ngoài cut được duyệt.

**Đạt khi:** người dựng có thể phát hiện và sửa một cut cụt câu hoặc nhảy hành động; không có tuyên bố tự động dựng mượt.

### F08 — Hiển thị đầy đủ Shot và giữ preview đã chọn

**Điểm sửa:** Desktop `VideoShotboard`, `ChapterProductionStage`, `TakeSelectorDrawer`, production types/queries và preview selection.

- [ ] Map Beat tới danh sách ordered Shot; drawer/action dùng shotId; timeline media map dùng cut/shot identity thay vì một `visualBeatId` ghi đè nhiều cuts.
- [ ] SelectedTake là nguồn preview chính độc lập status của Shot; trong khi take mới chạy vẫn phát video đã chọn. Không để ảnh hoặc video bị render sai phần tử do suy `isVideo` từ generating status.
- [ ] Thẻ Beat có action tạo video và chọn tập Shot cần chạy. Một Beat một Shot thao tác trực tiếp; nhiều Shot cho chọn subset, preview số lượng trước submit. Không có Shot thì nêu bước cần chuẩn bị.
- [ ] Test ba Shot đều có nút, retry Shot giữa đúng ID, drawer đúng takes/trim, preview SelectedTake không đổi khi pending/failed/success mới và refresh/reload.

**Đạt khi:** không còn `shots[0]` trên đường chọn/action chính; mọi Shot đều tạo lại được từ UI.

### F09 — Retry an toàn và trạng thái nhất quán

**Điểm sửa:** `ShotActionToolbar`, `video-production.queries.ts`, `video-production.api.ts`, `GenerateShotTakeUseCase`, frozen batch service/read models.

- [ ] Tái dùng endpoint tạo Take hiện có, source Take được chọn rõ và reason. Tạo lại cùng input dùng seed mới mặc định; retry kỹ thuật giữ seed phải hiển thị lựa chọn, không hứa seed khóa giọng/mặt.
- [ ] Generate/Retake có cùng capability/readiness guard. Backend serialize admission của cùng Shot, giới hạn active/UNKNOWN; video execution vẫn một slot toàn hệ thống. Đồng thời batch/standalone không sinh trùng.
- [ ] Lưu operation intent/idempotency key ở Desktop qua timeout/reload để reconcile; key mới chỉ cho thao tác mới đã biết kết quả. Không mutate input ngầm và tạo key mới mỗi lần người dùng thử lấy lại response.
- [ ] UNKNOWN/CANCEL_REQUESTED tiếp tục được reconcile; hủy request không chứng minh remote đã dừng. Terminal failed có thể tạo lại; unsupported strategy/profile bị chặn trước write.
- [ ] Giữ selection cũ khi finalizer của Take mới cập nhật Shot status; chọn lại với expected row version. Query invalidation đúng scope, refresh failure báo trạng thái có thể phục hồi.
- [ ] Tests request timeout/replay/new action, double click, hai cửa sổ, batch-vs-standalone, UNKNOWN, canceled chưa xác nhận, capacity và missing capability; Electron flow retry failed rồi chọn Take mới.

**Đạt khi:** một click có tối đa một admitted attempt; timeout không gây blind resubmit; mọi retry đúng Shot, có thể theo dõi và giữ nguyên bản đang dùng.

## 4. Thứ tự, tests và hoàn tất

1. F01/F02 sửa prompt và mapping; F03/F04 chốt cue contract trước F05.
2. F08/F09 giao sớm nút tạo lại từng Shot. Action Beat nhiều Shot dùng cùng leaf admission và selection semantics.
3. F06/F07 đưa người dựng vào cổng chất lượng; audio/reference capabilities tiếp tục theo plan tổng.

Mỗi F phải có test đỏ bắt lỗi trước sửa và pass sau sửa ở seam đúng; runtime UI gate theo [AGENTS](../../AGENTS.md), [Playwright rules](../../.agents/rules/playwright-testing.md) và full module checks theo [CONTRIBUTING](../../CONTRIBUTING.md). Java formatter theo formatter của repo cho file thay đổi. Không thêm test chỉ soi chuỗi source thay cho hành vi khi có seam thực.

Schema có thể cần mapping cue-shot, review và versioned selection. Trước khi thêm, kiểm tra migrations V1–V7 hiện tại; dùng [database policy](../architecture/database.md), bổ sung PostgreSQL constraints/transaction tests và inventory. Tất cả local bytes vẫn do Electron sở hữu; provider SDK vẫn trong worker.

**Nghiệm thu:** đủ 7 phát hiện được xử lý hoặc có giới hạn/blocker tường minh; Beat nhiều Shot truy cập được đầy đủ; tạo lại giữ asset/selection cũ; không lặp thoại hoặc submit mù. Chụp runtime evidence và báo GPU/khẩu hình chưa kiểm chứng nếu chưa có clip thật. Kết quả unit/fixture pass không đóng cổng video production.
