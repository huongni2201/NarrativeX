# Plan: làm sạch và củng cố generation-service

## Trạng thái và phạm vi

- Ngày: 2026-09-15. Trạng thái: PLANNED; chưa triển khai các mục dưới đây.
- Review dựa trên worktree hiện tại, bao gồm file chưa commit. Không reset/stash hoặc ghi đè thay đổi đang có.
- Mục tiêu: một nguồn implementation cho mỗi trách nhiệm, adapter thật/fake tách rõ, recovery không blind-resubmit, test bảo vệ được kiến trúc.
- Giữ Light DDD + Hexagonal theo ADR-0029. PostgreSQL vẫn thuộc backend; SQLite chỉ là execution-local journal. Không thêm broker, microservice, generic plugin framework hay base-executor hierarchy.
- Không mở rộng sang hoàn tất migration ai-worker, bật production provider, đổi Desktop hoặc viết lại toàn bộ provider integration.
- Plan này bổ sung cho `docs/plans/20260914-compute-execution-plane-migration.md`; không thay thế kế hoạch cut-over đó.

## Bằng chứng hiện tại

1. `adapters/executors/catalog.py` và `registry.py` cùng định nghĩa `ExecutorRegistry`; package export hiện trỏ catalog.
2. `runtime/`, `api/`, `domain/models.py` còn file placeholder; `domain/fingerprint.py` còn compatibility import. README nói đã xóa hết legacy.
3. `WhisperXClient.align()` bỏ qua audio, dựng timestamp 0.5 giây/từ; executor mặc định ready=True. Bootstrap mặc định dùng registry rỗng.
4. ComfyUI submit trước khi persist handle; recovery lên lịch chạy lại attempt thiếu handle. Timeout và generic exception bị biến thành terminal FAILED dù external outcome có thể chưa rõ.
5. Architecture test quét `app/gpu-worker/*` không tồn tại; legacy test bỏ qua chính một số đường dẫn cần kiểm tra.
6. Lần review trước chạy pytest bằng Python 3.14: 58 pass, 1 fail. Test expired recovery đặt deadline 150 ms trước initialize/submit; chạy riêng vẫn fail. Đây là baseline quan sát được, chưa chứng minh runtime recovery sai.

## Quyết định thiết kế

### Cấu trúc đích

Các đường dẫn dưới đây tương đối với `app/generation-service/`.

```text
src/narrativex_gpu_worker/
  __init__.py
  __main__.py
  config.py
  bootstrap.py
  contracts/                 # wire models, validation, fingerprint
    artifact.py
    task.py
    observation.py
    fingerprint.py
  domain/                    # execution invariants; stdlib only
    execution_attempt.py
    submission.py            # thêm khi triển khai submission checkpoint
  application/
    errors.py
    services/execution.py    # use case/lifecycle coordination
    ports/
      execution.py
      executors.py
      journal.py
      artifacts.py
  adapters/
    inbound/http/
    persistence/sqlite_execution_journal.py
    artifacts/http.py
    executors/
      catalog.py             # một implementation: ExecutorCatalog
      comfyui/
      voicestudio/
      whisperx/
      media_validation/
tests/
  test_architecture.py
  test_domain.py
  test_runtime.py
  test_journal.py
  test_api.py
  test_models.py
  test_artifacts.py
  test_executor_catalog.py
  executors/                 # tests riêng theo provider
```

- Giữ tên test hiện có để giảm diff. Chỉ thêm nhóm tests/executors khi có test tương ứng.
- `__init__.py` có thể export API ổn định bằng danh sách tường minh. Không bắt buộc cấm mọi re-export.
- Xóa `contracts/models.py`, `application/ports/outbound.py` và các compatibility module sau khi migrate hết consumer; không để một lớp re-export thứ hai chỉ để giữ đường import cũ vô thời hạn.
- Không tách execution service chỉ vì số dòng. Chỉ tách policy có invariant/test riêng khi logic recovery thực tế đòi hỏi.
- Không gộp domain enum với Pydantic contract bằng cách kéo framework vào domain; dùng mapping tường minh ở boundary và test kiểm tra tính nhất quán.

### Recovery: phân biệt attempt lifecycle với external submission

Đề xuất checkpoint nội bộ, độc lập với wire ExecutionState:

| Checkpoint | Ý nghĩa | Hành động khi recovery |
|---|---|---|
| NOT_SUBMITTED | Chưa bắt đầu external submission | Có thể submit nếu deadline/cancel cho phép |
| SUBMITTING | Intent đã commit; external outcome có thể chưa rõ | Reconcile trước; tuyệt đối không suy ra chưa submit từ handle rỗng |
| SUBMITTED | Đã lưu handle/checkpoint có thể tra cứu | Resume/poll handle, không submit lại |
| UNKNOWN | Không đủ bằng chứng xác định external outcome | Chỉ reconcile; không tạo lần submit mới |

- Checkpoint gồm phase, correlation key ổn định theo đầy đủ taskId + attemptId, optional opaque handle. Không đưa URL capability/secret vào correlation key.
- Persist SUBMITTING thành công trước I/O; persist handle và SUBMITTED nguyên tử sau acknowledgement.
- Crash sau ghi intent nhưng trước I/O vẫn phải xử lý thận trọng: local state không chứng minh request chưa đến provider.
- Không cam kết exactly-once nếu provider không có idempotency hoặc lookup đáng tin cậy. Không coi ComfyUI client_id hiện tại là idempotency key nếu chưa chứng minh bằng implementation/protocol thực tế.
- Deadline/cancel không chứng minh external work đã dừng. Không tự biến UNKNOWN thành retryable FAILED hoặc confirmed CANCELED để giải phóng đường retry.
- Journal cũ: ACCEPTED chưa từng bắt đầu có thể map NOT_SUBMITTED; RUNNING có handle map SUBMITTED; RUNNING thiếu handle map UNKNOWN. Phải xác minh cách lưu cũ trước khi áp dụng mapping; trường hợp không chứng minh được ưu tiên UNKNOWN.

**Gate về contract:** Compute Protocol v1 hiện chỉ có ACCEPTED/RUNNING/SUCCEEDED/FAILED/CANCELED; UNKNOWN thuộc backend ProviderOperation. Trước triển khai recovery, kiểm tra consumer và ghi ADR cách backend nhận biết ambiguity phía worker. Không thêm enum/state hoặc đổi ý nghĩa FAILED âm thầm trong v1. Nếu chưa có biểu diễn tương thích, giữ provider unavailable và triển khai thay đổi protocol có version/cửa sổ tương thích theo COMPUTE_PROTOCOL.md. Không coi UNKNOWN nội bộ là đủ nếu backend vẫn có thể retry sau deadline.

## Thứ tự triển khai

### Đợt 0 — Khóa baseline và chốt recovery contract

**Files:** README, COMPUTE_PROTOCOL.md, ADR-0028/0029, config/bootstrap, journal, backend compute consumers, schemas/OpenAPI và scripts verification liên quan.

- [ ] Ghi snapshot git status/diff phạm vi generation-service; xác nhận file nào đang được sửa song song trước khi edit.
- [ ] Dùng CodeGraph tìm tất cả consumer của registry/legacy imports, execution observations và retry/reconciliation phía backend.
- [ ] Kiểm tra runtime Python/container của repo; ghi rõ phiên bản dùng để test, không tự nâng dependency để làm xanh test.
- [ ] Đọc journal schema hiện hành và xác định migration checkpoint không mất attempts.
- [ ] Ghi ADR mới với số tiếp theo còn trống: submission/reconciliation ownership, checkpoint, old-journal mapping, timeout/cancel, protocol compatibility.
- [ ] Chốt bằng chứng nào cho phép resubmit: chỉ khi provider xác nhận chưa nhận hoặc hỗ trợ dedup đã kiểm chứng. Không có bằng chứng thì giữ UNKNOWN.

**Nghiệm thu:** có bảng trạng thái/ownership được test hóa ở các đợt sau; adapter chưa an toàn vẫn không thể nhận production work. Không cần cài IDE/plugin để lập hoặc thực hiện plan Python này.

### Đợt 1 — Sửa nền test và chặn fake success

**Modify:** `tests/test_runtime.py`, `adapters/executors/whisperx/client.py`, `whisperx/executor.py`, `tests/test_api.py`, `tests/test_container.py` khi cần.

**Create:** `tests/executors/test_whisperx.py`; fake chỉ trong tests/fixtures nếu test thực sự cần.

- [ ] Sửa expired-recovery test bằng cách seed accepted/running journal với deadline đã hết, rồi start service để kiểm tra recovery; không chờ 150 ms ngoài đời thực.
- [ ] Nếu test deadline khác cần clock điều khiển được, inject callable now với default UTC; không thêm framework thời gian riêng.
- [ ] Xóa timestamp giả khỏi production client. Client chưa triển khai trả lỗi unavailable rõ ràng, không trả alignment thành công.
- [ ] Mặc định WhisperX unavailable; không chỉ đổi ready=False trong khi client vẫn có thể bị gọi trực tiếp và trả dữ liệu giả.
- [ ] Test default capabilities không quảng bá WhisperX ready; request không được accepted với provider unavailable.
- [ ] Test audio không bị thay bằng timestamp giả, không upload output sau unavailable; fake nằm riêng và chỉ được inject từ test.

**Nghiệm thu:** không có false success; test recovery kiểm tra đúng nhánh mà không phụ thuộc tốc độ initialize/submit. Chưa triển khai WhisperX thật trong đợt này.

### Đợt 2 — Dọn cấu trúc và thiết lập một đường import chính thức

**Modify:** `adapters/executors/catalog.py`, `__init__.py`, `bootstrap.py`, application imports, contracts exports và tests liên quan.

**Delete sau khi hết consumer:** `adapters/executors/registry.py`, `runtime/`, `api/`, `domain/models.py`, `domain/fingerprint.py`, `contracts/models.py`, `application/ports/outbound.py`.

- [ ] Dùng `ExecutorCatalog` trong `catalog.py` làm implementation duy nhất; giữ `ExecutorCatalogPort` làm boundary application.
- [ ] Migrate tất cả import/call site trong repo, entrypoint/container và test; kiểm tra consumer ngoài service trong repo trước khi xóa.
- [ ] Đổi wildcard export thành export tường minh khi cần public API; không thêm alias để che import chưa migrate.
- [ ] Xóa file placeholder thực sự, không thay nội dung bằng comment DELETED.
- [ ] Test catalog: trùng tên bị từ chối, unsupported task/model/revision bị từ chối, unavailable bị từ chối, capability output chính xác.
- [ ] Smoke test import entrypoint/build_application; replay stored observation vẫn hoạt động khi provider không ready.

**Nghiệm thu:** tìm symbol chỉ có một implementation catalog; không còn legacy consumer; không đổi HTTP payload/fingerprint do cleanup.

### Đợt 3 — Làm architecture tests bảo vệ đúng invariant

**Modify:** `tests/test_architecture.py`, `scripts/check_architecture_residue.py` nếu script thực sự thuộc gate; cấu hình verification được xác định ở Đợt 0.

- [ ] Sửa đường quét environment/container về generation-service; assert danh sách file cần kiểm tra không rỗng.
- [ ] Kiểm tra package legacy không tồn tại; không bỏ qua runtime/api/models khi test legacy removal.
- [ ] Resolve cả absolute và relative imports trong AST, tránh chỉ chặn chuỗi prefix nhưng lọt `from ...adapters`.
- [ ] Domain không import application/adapters/contracts có Pydantic; contracts không import domain/application/adapters; application không import concrete adapter; adapter không import bootstrap.
- [ ] Bootstrap là nơi lựa chọn concrete deployment adapters. Không cấm executor import client/workflow trong chính provider package.
- [ ] Nếu phải viết helper phân tích import, test helper bằng source fixture vi phạm thật để chứng minh rule bắt được lỗi; tránh scan keyword toàn source gây false positive từ comment/docstring.

**Nghiệm thu:** test fail với fixture import sai/legacy hiện diện, pass với layout đích; không có check pass vì scan rỗng.

### Đợt 4 — Durable submission checkpoint và recovery policy

**Modify:** `domain/execution_attempt.py` khi cần, `application/ports/execution.py`, `journal.py`, `services/execution.py`, `application/errors.py`, `adapters/persistence/sqlite_execution_journal.py`.

**Create:** `domain/submission.py`, test checkpoint/migration và fault-injection recovery. Chỉ tạo thêm service riêng nếu một policy đủ độc lập.

- [ ] Thực hiện schema migration SQLite additive/versioned; đọc journal cũ mà không drop/reset data. Migration idempotent và không default mọi attempt cũ thành chưa submit.
- [ ] Thêm typed checkpoint và thao tác journal bảo đảm intent commit trước external call.
- [ ] Bắt buộc cung cấp durable context với remote side-effect executor; thiếu callback/context phải fail trước external I/O.
- [ ] Tách lỗi chắc chắn chưa thực thi khỏi lỗi outcome mơ hồ. Timeout/disconnect sau dispatch không đi qua generic FAILED/TRANSIENT.
- [ ] Recovery chạy theo checkpoint; reconcile không phụ thuộc khả năng nhận NEW work của provider. Không dùng riêng ready=False làm lý do bỏ status lookup của attempt cũ.
- [ ] Sequence tiếp tục từ observation đã lưu, không hardcode mãi RUNNING=1/terminal=2 khi bổ sung nhiều bước reconcile.
- [ ] Cancel/deadline/stop phải giữ checkpoint; ambiguous attempt không giải phóng quyền resubmit. Chốt cách theo dõi pending external work và capacity theo ADR.
- [ ] Với nhiều process chung journal: hoặc enforce single-owner rõ ràng hoặc có claim nguyên tử; không chỉ dựa trên asyncio lock trong một process.
- [ ] Triển khai mapping backend/protocol đã chốt ở Đợt 0 trong cùng đợt nếu cần; test backend không tạo attempt mới cho outcome unresolved.

**Nghiệm thu:** mọi crash window được bao phủ trong ma trận dưới đây; không có path tự submit lại chỉ vì handle rỗng. Rollback binary phải được kiểm chứng với schema mới; nếu không tương thích, dùng rollout hạn chế và backup journal, không xóa journal để rollback.

### Đợt 5 — Áp dụng vào executor và củng cố boundary tests

**Modify:** ComfyUI client/executor, VoiceStudio client/executor, readiness/bootstrap chỉ khi cần để giữ gate.

**Create:** tests cho ComfyUI, VoiceStudio, media validation trong `tests/executors/`.

- [ ] ComfyUI lưu correlation/intent trước submit; response handle được lưu nguyên tử trước poll/download. Có handle thì resume; thiếu handle sau intent thì reconcile, không submit mới.
- [ ] Dùng HTTP mock/fake transport kiểm tra request count và crash windows. Không giả định lookup queue/history là đầy đủ nếu provider đã purge record.
- [ ] VoiceStudio không coi `voicestudio:{task_id}` tạo sau hoàn thành là bằng chứng provider resume; nếu API không hỗ trợ lookup/dedup thì outcome mơ hồ được giữ unresolved và provider chưa đạt readiness gate.
- [ ] Classify provider errors bằng dữ liệu đã được chuẩn hóa; không đưa raw provider body, signed URL, prompt hoặc exception chứa secret vào log/error. Kiểm tra cả LOGGER.exception trong application.
- [ ] Test input/output boundary hiện tại: thiếu artifact role, upload lỗi, cancel, timeout, output không hợp lệ. Nếu phát hiện bug độc lập, thêm task rõ vào plan trước khi mở rộng phạm vi sửa.
- [ ] Không triển khai registry plugin discovery hoặc chia mỗi model thành nhiều lớp khi chưa có nhu cầu.

**Nghiệm thu:** adapter có test thật qua mock HTTP; mock chỉ nằm trong tests; provider chưa được chứng minh readiness/reconciliation vẫn không được bật.

## Ma trận kiểm thử recovery bắt buộc

| Tình huống | Kết quả mong đợi |
|---|---|
| Journal persist intent lỗi | External submit count = 0 |
| Crash sau intent, trước HTTP | Recovery reconcile/UNKNOWN; không blind submit |
| Provider nhận request, response bị mất | Không tạo external work thứ hai |
| Có response, lưu handle lỗi | UNKNOWN; tìm bằng correlation nếu provider hỗ trợ |
| Restart với handle | Poll/resume; submit count không tăng |
| Provider lookup timeout/404 không đủ bằng chứng | Giữ unresolved, không suy ra chưa từng chạy |
| Upload output lỗi sau provider hoàn thành | Không regenerate chỉ để retry upload |
| Replay POST cùng fingerprint | Trả state đã lưu; không thực thi lần hai |
| Cùng identity khác fingerprint | Conflict; không external submit |
| Deadline/cancel khi outcome mơ hồ | Không xác nhận false failure/cancellation cho phép retry |
| Restart journal phiên bản cũ, RUNNING thiếu handle | Conservative UNKNOWN |
| Observation duplicate/out-of-order | No-op; terminal invariant được giữ |
| Backend reconcile unresolved worker outcome | Không tạo attempt mới trước khi resolve |

## Đợt 6 — Tài liệu và verification cuối

**Modify:** service README, `documentation/COMPUTE_PROTOCOL.md`, ADR mới và clarification ADR-0029/index, `CONTRIBUTING.md`/verification scripts nếu đường worker hiện hành sai.

- [ ] README phản ánh layout thật, provider IMPLEMENTED/PARTIAL/UNAVAILABLE và cách đăng ký adapter.
- [ ] Sửa mô tả ExecutionContext trong COMPUTE_PROTOCOL.md theo API thực tế; phân biệt Python API với wire protocol.
- [ ] Ghi rõ journal local, single-owner/concurrency assumption, recovery và hạn chế provider đã xác minh.
- [ ] Cập nhật references tới gpu-worker khi mô tả current path; giữ lịch sử ADR bằng clarification/superseding ADR, không viết lại lịch sử như đã luôn là thế.
- [ ] Chạy narrow tests mỗi đợt, cuối cùng full service và quality gate toàn repo. Lỗi do worktree ngoài phạm vi phải báo riêng, không âm thầm sửa hoặc bỏ qua.
- [ ] Kiểm tra diff cuối, không có unrelated code, fake runtime success, absolute project paths trong protocol hoặc secrets.

### Lệnh verification

Từ `app/generation-service`:

```powershell
python -m pytest -q
python -m ruff check .
python -m mypy src
```

Nếu pytest temp mặc định bị chặn quyền, dùng `--basetemp` là một thư mục mới, dành riêng cho lần chạy, bên trong workspace. Không trỏ vào thư mục có dữ liệu vì pytest có thể dọn basetemp.

Từ repo root, xác nhận script tồn tại và đọc CLI trước khi chạy:

```powershell
python scripts/check_compute_contracts.py
python scripts/check-docs-drift.py
pwsh -File scripts/verify-local.ps1
```

Nếu sửa backend consumer/protocol: chạy test module backend tương ứng, shared contract examples và full gate. Không thay contract mà chỉ test Python.

## Chia commit/PR đề xuất

1. Stabilize recovery test và disable fake WhisperX success.
2. Canonical catalog, legacy deletion và architecture tests.
3. ADR/contract decision, journal migration và recovery policy cùng các consumer bắt buộc.
4. Executor integration, fault-injection tests và docs hoàn chỉnh.

Mỗi phần build/test độc lập; không commit alias deletion trước khi consumer được migrate. Tránh tách worker/backend semantic change thành hai release không tương thích.

## Definition of Done

- [ ] Mỗi trách nhiệm có một implementation chính thức; không còn legacy placeholder/module hoặc import gây nhầm.
- [ ] Production adapter không trả fake success; capability phản ánh đúng mức sẵn sàng.
- [ ] Ambiguous external outcome không blind-resubmit qua restart, timeout, cancel hoặc backend retry.
- [ ] Existing journals được migrate an toàn; rollout/rollback và ownership được ghi rõ.
- [ ] Architecture tests bắt đúng vi phạm; recovery tests xác định; executor tests bao phủ failure paths.
- [ ] Pytest, lint, typecheck, contract checks và required repo gate được chạy; mọi failure còn lại được nêu rõ, không báo DONE khi gate liên quan chưa pass.
- [ ] Docs phân biệt triển khai xong với provider còn unavailable. Live provider enablement thuộc cut-over gate riêng, cần smoke test với engine thật trước khi bật.
