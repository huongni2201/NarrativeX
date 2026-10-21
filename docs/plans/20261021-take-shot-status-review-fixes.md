# Plan: Sửa các vấn đề từ review thay đổi QC video V2 và trạng thái Take/Shot

**Ngày:** 2026-10-21 · **Đối chiếu:** working tree trên `4ea50b686` (thay đổi chưa commit: scorer/thresholds V2, `refreshShotStatus`, `closeOpenTakesForJob`, gỡ dispatch video legacy, gợi ý In/Out).

**Trạng thái:** TARGET — chưa triển khai. Checkbox chỉ được đánh dấu khi có bằng chứng (test thật; PostgreSQL thật cho SQL; Electron thật cho UI). Fake provider không phải bằng chứng production.

**Quan hệ:** bổ sung cho [Video quality pipeline](20261020-video-quality-pipeline.md) mục P1.F/P1.5. Không đổi ADR nào; R1 và R2 chỉ đưa code về đúng ranh giới module đã có (ADR-0002: modular monolith) và nguyên tắc ba lớp đánh giá Take ([generation-domain](../domain/generation-domain.md)).

---

## 0. Tóm tắt và thứ tự

| # | Vấn đề | Mức | Phụ thuộc |
|---|---|---|---|
| R0 | `spotless:check` fail ở 3 file mới sửa | Chặn merge | — |
| R1 | Module generation ghi thẳng `shots.status` bằng SQL; hai đường ghi; `row_version` của Shot bị bump bởi lifecycle | Cao | — |
| R2 | `closeOpenTakes` ẩn trong `MyBatisGenerationJobPersistenceAdapter.save()` | Cao | R1 (dùng chung bộ chiếu trạng thái Shot) |
| R3 | Take chưa từng có output bị ghi `validation_status = FAILED` | Trung bình | R2 |
| R4 | Lỗi ghi sổ DB sau submit đi vào nhánh xử lý lỗi submit | Trung bình | R1 |
| R5 | Read model tải và parse toàn bộ `input_snapshot_json` mỗi lần đọc | Trung bình | — |
| R6 | Trạng thái Take/Shot là chuỗi rải rác | Trung bình | làm cùng R1 |
| R7 | Thẻ Take không chọn được bằng bàn phím | Trung bình (UI) | — |
| R8 | Việc nhỏ: thông báo render trùng tên chương, `_white_ms` ở khung cuối | Thấp | — |

Thứ tự đề xuất: **R0 → R6 + R1 → R2 → R3 → R4 → R5 → R7 → R8**. R5 và R7 độc lập (khác module) nên làm song song được với R1–R4.

**Đính chính so với review miệng:** review nói việc bump `row_version` của Shot "làm lần lưu Shot của người dùng bị 409". Kiểm tra lại: `ShotMapper.update` (câu lệnh có `WHERE row_version = #{rowVersion}`) hiện **không có caller**; không có endpoint sửa Shot nào dùng If-Match theo Shot. Vì vậy hiện tại **chưa** có lỗi 409 thực tế. Vấn đề có thật là: (a) vi phạm ranh giới module, (b) `row_version` của Shot trộn "sửa nội dung" với "đổi trạng thái vòng đời" — đã phải vá ở `GenerateShotTakeUseCase.fingerprint` (xóa `shotRowVersion`, `row_version`, `status` khỏi fingerprint), (c) sẽ thành 409 thật ngay khi có màn sửa Shot dùng optimistic lock.

---

## R0 — Định dạng (chặn merge)

- [ ] `cd app/backend-service && ./mvnw.cmd spotless:apply` rồi chỉ giữ thay đổi ở: `GetChapterProductionUseCase.java`, `TakeQualityEvaluatorTest.java`, `TakeQualityReadModelTest.java`.
- [ ] Không gom vào commit này hai vi phạm có sẵn (`ImageGenerationJobHandler`, `ComputeExecutionDispatcherTest`) — đã ghi trong `docs/current-status.md`; sửa riêng nếu muốn.
- [ ] Bằng chứng: `spotless:check` chỉ còn hai file có sẵn.

---

## R6 — Enum trạng thái (làm trước/cùng R1)

Hiện: `"FAILED".equalsIgnoreCase(take.status())` (`ChapterVideoBatchService`), chuỗi trạng thái trong `TakeMapper.xml`, `GetChapterProductionUseCase` dòng ~519–530 so chuỗi Shot status, `StoryboardProductionAccess.updateShotStatus(UUID, String)` song song với `StoryboardShotAccess.updateShotStatus(UUID, ShotStatus)`.

- [ ] Thêm `feature/generation/domain/enums/TakeStatus` (`PENDING`, `RUNNING`, `GENERATED`, `VALIDATING`, `PASSED`, `FAILED` — khớp `ck_takes_status` ở V4). Có hàm `isOpen()` (`PENDING`/`RUNNING`/`VALIDATING`).
- [ ] `TakeRecord`/`TakeRow` giữ `String` ở biên MyBatis nhưng chuyển sang enum ngay trong adapter (`TakeStatus.valueOf`), hoặc dùng TypeHandler enum nếu repo đã có quy ước — kiểm tra `NarrativeXMyBatisMapper` trước.
- [ ] Bỏ `StoryboardProductionAccess.updateShotStatus(UUID, String)`; mọi caller dùng bản `ShotStatus`. Caller hiện có: `SelectTakeUseCase:142`.
- [ ] Test: contract test enum ↔ `ck_takes_status` / `ck_shots_status` (đọc migration như `MyBatisSchemaReferenceContractTest` hoặc truy vấn `pg_constraint` trong test PostgreSQL), để thêm giá trị mới ở DB mà quên enum sẽ fail.

---

## R1 — Gom việc cập nhật trạng thái Shot về một chỗ, đi qua port storyboard

### Hiện trạng

- `TakeMapper.refreshShotStatus` (SQL `UPDATE shots ... FROM (...)` trong `TakeMapper.xml`) được gọi ở 4 nơi: `MyBatisTakeRepository.insert`, `MyBatisTakeRepository.updateStatus`, `VideoGenerationJobHandler.executeFrozen`, `VideoGenerationResultFinalizer`, cộng `MyBatisGenerationJobPersistenceAdapter.closeOpenTakes`.
- `SelectTakeUseCase` ghi `SELECTED` qua port `storyboardAccess.updateShotStatus`.
- Repository (`MyBatisTakeRepository`) đang làm side effect sang aggregate khác.

### Thiết kế đích

```
generation (application)                         storyboard
┌──────────────────────────────┐   port in   ┌─────────────────────────────┐
│ ShotStatusProjector          │────────────▶│ StoryboardShotAccess         │
│  refresh(shotId)             │             │  lockShotForStatus(shotId)   │
│   1. lock Shot (port)        │             │  updateLifecycleStatus(id,s) │
│   2. đọc Take statuses +     │             └─────────────────────────────┘
│      có selection không      │
│   3. ShotStatusDerivation    │  (hàm thuần, test bảng)
│   4. ghi nếu khác (port)     │
└──────────────────────────────┘
```

- **Generation sở hữu luật suy ra** (vì nó sở hữu `takes`, `selected_takes`), **storyboard sở hữu việc ghi** bảng `shots`. Không module nào viết SQL vào bảng của module kia.
- **Hàm thuần** `ShotStatusDerivation.derive(boolean hasSelection, Collection<TakeStatus> takes, ShotStatus current) → ShotStatus` với thứ tự ưu tiên giữ nguyên SQL hiện tại: selection → `SELECTED`; có `RUNNING` → `GENERATING`; `VALIDATING` → `VALIDATING`; `PENDING` → `QUEUED`; `PASSED` → `MANUAL_REVIEW`; `FAILED` → `FAILED`; còn lại giữ `current`.
- **Đồng thời:** khóa hàng Shot (`SELECT ... FOR UPDATE`) trước khi đọc Take, để hai Take của cùng Shot đổi trạng thái song song không ghi đè bằng ảnh chụp cũ. Thứ tự khóa Shot → Take; xác nhận admission (`ShotMapper.findAdmissionContextLocked`) cũng khóa Shot trước để không tạo deadlock.
- **`row_version`:** thêm `ShotMapper.updateLifecycleStatus` chỉ đổi `status` + `updated_at`, **không** bump `row_version`, và chỉ ghi khi `status IS DISTINCT FROM`. `row_version` của Shot từ nay chỉ phản ánh sửa nội dung. Giữ nguyên đoạn loại `row_version`/`status` khỏi fingerprint trong `GenerateShotTakeUseCase` (snapshot cũ vẫn chứa chúng).
  - Rủi ro cần kiểm trước khi bỏ bump: có thành phần nào dùng `shots.row_version` để phát hiện thay đổi (event stream, polling Desktop, cache) không? `grep` `row_version`/`rowVersion` của Shot ở backend và `app/desktop/src`; nếu có, chuyển sang `updated_at` hoặc ghi rõ lý do giữ bump.

### Task

- [ ] Test bảng cho `ShotStatusDerivation` (mỗi hàng của thứ tự ưu tiên + "không Take nào" + "selection thắng Take đang chạy" + "chỉ FAILED").
- [ ] `StoryboardShotAccess`: thêm `lockShotForStatus(UUID shotId)` và `updateLifecycleStatus(UUID shotId, ShotStatus status)`; implement trong `MyBatisStoryboardShotAccessAdapter` + `ShotMapper.xml`.
- [ ] `TakeRepository`: thêm `List<TakeStatus> findStatusesByShotId(UUID)`; `SelectedTakeRepository`: `boolean existsForShot(UUID)` (hoặc dùng `findByShotId` có sẵn).
- [ ] `ShotStatusProjector` (`feature/generation/application/service`), `@Transactional(propagation = MANDATORY)` để bắt buộc chạy trong transaction của thay đổi Take.
- [ ] Thay mọi caller:
  - `MyBatisTakeRepository.insert` / `updateStatus`: **bỏ** `refreshShotStatus` (repository không side effect).
  - Use case tạo Take (`GenerateShotTakeUseCase` / admission) gọi `projector.refresh(shotId)` sau khi insert.
  - `VideoGenerationJobHandler.executeFrozen`: xem R4 (gọi trong bước ghi sổ sau submit).
  - `VideoGenerationResultFinalizer` (đã `@Transactional`): gọi projector thay cho `takeMapper.refreshShotStatus`.
  - `SelectTakeUseCase`: thay `updateShotStatus(shotId, "SELECTED")` bằng `projector.refresh(shotId)`.
  - Đóng Take khi job kết thúc: xem R2.
- [ ] Xóa `TakeMapper.refreshShotStatus` (Java + XML).
- [ ] Rule ArchUnit (repo đã có `ArchUnitDependencyRulesTest`): `..generation.infrastructure.persistence..` không được tham chiếu bảng/ mapper của storyboard; bổ sung kiểm tra chuỗi trong `MyBatisSchemaReferenceContractTest` rằng mapper XML của generation không `UPDATE shots`.
- [ ] Giữ và chạy lại 4 test PostgreSQL mới trong `ShotTakeAdmissionPostgreSqlIntegrationTest` (`failedDispatchClosesTheTakeAndMarksTheShotFailed`, `canceledJobClosesTheTakeBeforeSubmission`, `runningTakeMakesTheShotGeneratingAndFailureAfterwardsClosesIt`, `failedRetakeNeverReplacesTheSavedSelectionStatus`); sửa phần gọi trực tiếp `takeMapper.refreshShotStatus` trong test sang projector. Thêm test: đổi trạng thái Shot **không** làm đổi `shots.row_version`.
- [ ] Thêm test đồng thời (PostgreSQL thật): hai transaction cùng đổi Take của một Shot → trạng thái cuối khớp `derive` trên dữ liệu đã commit.

### TARGET xa hơn (không làm trong plan này)

Trạng thái Shot hoàn toàn suy ra được, nên về lâu dài có thể **tính khi đọc** và bỏ lưu. Người đọc `shots.status` hiện có: `ChapterProductionStatusMapper.xml` (đếm theo status), `GetChapterProductionUseCase` (~519–530), dashboard/timeline mapper join `selected_takes`. Chỉ cân nhắc khi có số đo cho thấy cột lưu gây lỗi đồng bộ hoặc chi phí; cần ghi chú trong `docs/architecture/database.md` khi đổi.

---

## R2 — Đưa việc đóng Take khi job kết thúc ra khỏi persistence adapter

### Hiện trạng

`MyBatisGenerationJobPersistenceAdapter.save()` gọi `closeOpenTakes` cho mọi job FAILED/CANCELED. Đặt ở đây vì job chuyển sang trạng thái kết thúc ở **nhiều** nơi:

| Nơi | Dòng (xấp xỉ) |
|---|---|
| `GenerationJobTransactionService` | `requestCancellation` (~77), `markSubmissionFailed` (~173), `markCanceled` (~248) |
| `ComputeEventApplicationService` | `markFailed` (~148), `markCanceled` (~154) |
| `ComputeReconciliationService` | (~195–196 analysis), `markFailed` (~236), `markCanceled` (~242) |
| `ChapterVideoBatchService` | leaf `markCanceled` (~180), parent (~125–128) |

### Thiết kế đích

- Một application service duy nhất cho kết thúc job: `GenerationJobOutcomeRecorder.saveEnded(GenerationJob ended)` — lưu job, rồi nếu là `VIDEO`/shot-take job thì `TakeLifecycleService.closeForEndedJob(jobId, status, errorCode)` → đóng Take mở → `ShotStatusProjector.refresh(shotId)`. Cùng một transaction.
- `MyBatisGenerationJobPersistenceAdapter.save()` trở lại thuần lưu trữ; bỏ phụ thuộc `TakeMapper`.
- Mọi điểm trong bảng trên gọi `saveEnded` thay cho `repository.save(job.markFailed/markCanceled(...))`.

### Task

- [ ] Test đỏ trước (unit, mock repository): mỗi đường kết thúc trong bảng trên gọi `TakeLifecycleService` đúng một lần. Thêm test PostgreSQL cho ít nhất `ComputeEventApplicationService` (callback FAILED) và `ComputeReconciliationService` (reconcile → FAILED/CANCELED) — hai đường hiện **chưa** có test đóng Take.
- [ ] Viết `TakeLifecycleService` + `GenerationJobOutcomeRecorder`; chuyển SQL `closeOpenTakesForJob` sang `TakeRepository.closeOpenForJob(jobId, reason)`.
- [ ] Thay các call site; xóa `closeOpenTakes` khỏi adapter.
- [ ] Rule ArchUnit: chỉ `GenerationJobOutcomeRecorder` (và test) được gọi `GenerationJobRepository.save` với job vừa `markFailed`/`markCanceled` — khó biểu diễn bằng ArchUnit; thay bằng: `GenerationJob.markFailed/markCanceled` trả về kiểu `EndedGenerationJob` mà `GenerationJobRepository.save(GenerationJob)` không nhận, chỉ `saveEnded(EndedGenerationJob)` nhận. Nếu đổi kiểu quá rộng, chấp nhận test unit ở trên làm hàng rào và ghi chú lý do.
- [ ] Bằng chứng: toàn bộ test PostgreSQL ở R1 + test mới pass; `grep -n takeMapper MyBatisGenerationJobPersistenceAdapter.java` rỗng.

---

## R3 — Không ghi `validation_status = FAILED` cho Take chưa từng có output

Nguyên tắc ([generation-domain](../domain/generation-domain.md)): `validation_status` là **kiểm tra kỹ thuật** trên bằng chứng worker. Take bị đóng vì job lỗi/hủy chưa có bằng chứng để kiểm.

- [ ] Quyết định giá trị: giữ `validation_status = 'PENDING'` (không có migration — cột `VARCHAR(32)` không có CHECK) và ghi `validation_failure_category = 'EXECUTION'`, `validation_failure_reason = <lý do>`. Hoặc thêm giá trị `NOT_RUN` — nếu chọn, ghi vào `docs/architecture/database.md` và Desktop type. **Đề xuất: `NOT_RUN`**, vì `PENDING` cho Take đã đóng dễ đọc nhầm là "đang chờ".
- [ ] Sửa `closeOpenForJob` (R2) theo quyết định; cập nhật test `failedDispatchClosesTheTakeAndMarksTheShotFailed` (đang assert `validation_status = FAILED`).
- [ ] Kiểm mọi chỗ đọc `validation_status`: `SelectTakeUseCase` (yêu cầu PASSED — không ảnh hưởng), Desktop `DesktopTake`/`whisperx-status`/nhãn "Kỹ thuật" ở `TakeSelectorDrawer` → hiển thị "Chưa kiểm tra (job lỗi/hủy)" thay vì "Kỹ thuật: lỗi".
- [ ] Cập nhật bảng ba lớp trong `docs/domain/generation-domain.md`.

---

## R4 — Tách ghi sổ sau submit khỏi xử lý lỗi submit

`VideoGenerationJobHandler.executeFrozen` (~202–216): `submitTask` → `markSubmitted` → `updateStatus(RUNNING)` → `refreshShotStatus` cùng nằm trong một `try`. Lỗi DB ở hai bước cuối rơi vào `catch` → `isOutcomeAmbiguous` (exception không phải `ComputeClientException` → `true`) → `markSubmissionUnknown` hạ job đã SUBMITTED xuống UNKNOWN. Reconcile sẽ sửa lại, nên không mất dữ liệu, nhưng gây nhiễu và trái nghĩa "UNKNOWN = không biết đã submit chưa".

- [ ] Test đỏ trước: mock `submitTask` thành công, `takeMapper.updateStatus` ném `DataAccessException` → job vẫn SUBMITTED, không gọi `markSubmissionUnknown`/`markSubmissionFailed`, log lỗi.
- [ ] Tách: `try { receipt = submitTask } catch → nhánh lỗi submit hiện có`; sau đó `transactionService.markSubmittedAndStartTake(jobId, receipt, takeId)` — một transaction gồm `markSubmitted` + Take `RUNNING` + `ShotStatusProjector.refresh`. Nếu transaction này lỗi: không đổi trạng thái job, để reconcile (job đã có receipt hay chưa) quyết định; Take/Shot sẽ được callback/finalizer đưa về đúng.
- [ ] Kiểm tra cùng mẫu ở `ImageGenerationJobHandler` và handler khác dùng `isOutcomeAmbiguous`; nếu có cùng lỗi thì sửa cùng hoặc ghi task riêng.

---

## R5 — Read model: không parse toàn bộ input snapshot mỗi lần đọc

`findByShotIds` nạp `input_snapshot_json::text` cho mọi Take; `GetChapterProductionUseCase.toTakeItem` parse toàn bộ JSON chỉ để lấy `inputs.dialogue` và `inputs.audioMode`. Consumer khác của `inputSnapshotJson()` ở đường đọc này: không có (chỉ `GenerateShotTakeUseCase:186`, đường khác).

- [ ] Đo trước (benchmark nhỏ hoặc log thời gian) với chương ~50 Shot × 3 Take để có số so sánh; ghi kết quả vào PR.
- [ ] Trích trong SQL, giữ nguyên quy tắc ba trạng thái hiện tại:

  ```sql
  CASE
    WHEN jsonb_typeof(input_snapshot_json->'inputs'->'dialogue') IS DISTINCT FROM 'array' THEN 'UNKNOWN'
    WHEN jsonb_typeof(input_snapshot_json->'inputs'->'audioMode') = 'string'
         AND input_snapshot_json->'inputs'->>'audioMode' <> 'NATIVE_AV' THEN 'NOT_EXPECTED'
    WHEN jsonb_array_length(input_snapshot_json->'inputs'->'dialogue') = 0 THEN 'NOT_EXPECTED'
    ELSE 'EXPECTED'
  END AS speech_expectation
  ```

  Dùng truy vấn riêng cho production view (ví dụ `findProductionTakesByShotIds`) không chọn `input_snapshot_json`, để `findByShotIds` của các caller khác không đổi.
- [ ] `TakeQualityReadModel.speechExpectation(String)` giữ lại làm tham chiếu cho test tương đương: test PostgreSQL chạy cùng bộ snapshot (có thoại, không thoại, `audioMode` khác, thiếu `dialogue`, `dialogue` không phải mảng, snapshot `null`) qua SQL và qua Java → kết quả giống nhau. Sau đó xóa bản Java nếu không còn caller.
- [ ] Không làm cột lưu sẵn (`speech_expectation` lúc admission) trừ khi số đo cho thấy SQL vẫn chậm — tránh migration cho một giá trị suy ra được.

---

## R7 — Desktop: thẻ Take chọn được bằng bàn phím

`TakeSelectorDrawer.tsx` (~288): thẻ Take là `div` chỉ có `onClick`; lớp bọc QC chỉ chặn `click`. Plan P1.F1 ghi "Enter/Space trong vùng chi tiết không kích hoạt chọn Take" nhưng code chưa có xử lý bàn phím nào.

- [ ] Tách vùng chọn: phần đầu thẻ (tiêu đề, huy hiệu) là `<button type="button">` thật gọi `handleSelectTake`; `TakeQualityPanel` và preview nằm **ngoài** button đó → bỏ được `div onClick={stopPropagation}`. Tránh lồng phần tử tương tác trong button.
- [ ] `aria-pressed={isSelected}` hoặc `aria-current` trên button; focus ring dùng token hiện có (`.agents/rules/frontend-styling.md`).
- [ ] Test component: Tab tới thẻ → Enter chọn Take; Enter/Space trong `<summary>` "Chỉ số đã đo" và trên nút "Đặt In/Out" không đổi Take đang chọn và không reset In/Out/checklist.
- [ ] **Cổng runtime UI bắt buộc** (AGENTS.md): Electron dev + backend build mới + ≥ 2 Take có `qualityControl`; chạy: chọn bằng chuột và bàn phím, mở/đóng chỉ số khi đã chỉnh In/Out, áp In/Out gợi ý, đổi Take rồi quay lại, Take `UNMEASURED`/`UNAVAILABLE`/`speechExpectation = UNKNOWN`, Take đóng do job lỗi (sau R3), dark/light, console, screenshot. Không có automation → ghi "runtime-verification blocked".

---

## R8 — Việc nhỏ

- [ ] `CreateProjectRenderUseCase.notReadyMessage`: hai chương có thể trùng tiêu đề → hiển thị `Chương <thứ tự>: <tiêu đề>` (kiểm tra `ProductionTimelineView.Chapter` có số thứ tự; nếu không, dùng thứ tự trong danh sách). Thêm unit test cho cả nhánh `NATIVE_TAKE` lẫn nhánh còn lại (hiện chưa thấy test cho hàm này).
- [ ] `quality.py::_white_ms`: khung cuối được coi kéo dài tới `duration_s` (thời lượng container). Thay bằng thời lượng khung trung vị (`median(Δpts)`) cho khung cuối; test với clip có audio dài hơn video 0,5 s → khung trắng cuối không bị cộng dư. Không cần đổi `scorerVersion` nếu làm trước khi có Take V2 thật; nếu đã có, tăng lên `FFMPEG_TAKE_QC_V3` theo quy tắc versioned.

---

## Cổng hoàn thành

1. R0–R6 xong, `./mvnw.cmd test` (gồm Testcontainers PostgreSQL) 0 lỗi, `spotless:check` chỉ còn vi phạm có sẵn.
2. Worker `python -m pytest`, `ruff check`, `mypy src` sạch (nếu làm R8 phần Python).
3. Desktop `npm test`, `npm run type-check` sạch; R7 qua cổng runtime Electron hoặc ghi rõ "runtime-verification blocked".
4. Cập nhật tài liệu: `docs/domain/generation-domain.md` (R3, R1 nguồn trạng thái Shot), `docs/architecture/database.md` nếu thêm giá trị `validation_status`, mục 0 của [Video quality pipeline](20261020-video-quality-pipeline.md); thêm dòng plan này vào [docs/README.md](../README.md); xóa plan khi xong (quy ước `plans/`).
5. `git diff --check` sạch.
