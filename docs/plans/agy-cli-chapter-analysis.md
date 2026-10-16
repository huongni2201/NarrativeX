# Plan: Phân tích chương qua `agy` CLI

**Trạng thái:** PARTIAL. Quyết định: [ADR-0009](../decisions/ADR-0009-chapter-analysis-agy-cli.md).
Runner, session, journal và tab Tài khoản đã viết xong. Phép thử cô lập trên agy 1.3.5 đã đạt; kiểm chứng trọn luồng chương thật đang BLOCKED do môi trường local được reset trong lúc chạy.
**Cập nhật:** 2026-10-16. Bản này gộp plan triển khai và bản tóm tắt trạng thái trước đây. Lịch sử nằm trong Git.

## 1. Mục tiêu và nguyên tắc

Bấm "Phân tích chương" → Desktop chạy prompt qua `agy` bằng tài khoản Google AI Pro đang đăng nhập → backend validate rồi ghi storyboard.

1. Chạy đúng một chương trước, song song sau. Song song chỉ là tham số N của cùng một runner.
2. Giữ nguyên recovery contract: claim → complete/observation → recover, lease, journal, UNKNOWN (ADR-0003).
3. NarrativeX không giữ token Google. `agy` tự đăng nhập và giữ phiên trong Credential Manager (`gemini:antigravity`).
4. Một tài khoản, N tiến trình (1–3). Xoay nhiều tài khoản là hướng **DEFERRED** (xem §7).
5. Văn bản truyện là dữ liệu không tin cậy: profile cô lập, thư mục tạm, `--sandbox`, headless.

## 2. Sự thật đã kiểm (spike lần 1, `agy` 1.3.5)

| Hạng mục | Kết quả |
|---|---|
| Bản cài | `%LOCALAPPDATA%\agy\bin\agy.exe` hoặc `~\.gemini\bin\agy.exe` |
| Flag headless | `--input-format stream-json`, `--output-format stream-json`, `--json-schema`, `--model`, `--print-timeout`, `--disable-slash-commands`, `--sandbox`; stdin is one NDJSON `user` event |
| Profile cô lập | Đổi `USERPROFILE`/`HOME` sang thư mục riêng vẫn giữ được đăng nhập; config, tool và skill của người dùng không bị dùng |
| Structured output | Envelope: `conversation_id, status, response, structured_output, usage{…}, denied_actions[]` |
| Khoá tool | Yêu cầu ghi file bị tự từ chối, file không được tạo |
| Song song | 3 tiến trình cùng một tài khoản: đều SUCCESS, không 429 |
| Hạn mức | `agy -p /usage --output-format json` trả về 2 nhóm (Gemini; Claude và GPT), mỗi nhóm có bucket `5h` và `weekly` |
| Model | `agy models`: `gemini-3.8-flash-high/medium/low`, `claude-sonnet-4-6`, `claude-opus-4-6-thinking`, `gpt-oss-120b-medium` |
| Chi phí cố định | ~13k input token, 11–21 giây mỗi lần gọi |

**Đã kiểm ngày 2026-10-16:** tiếng Việt qua stream-json stdin giữ nguyên dấu; `read_file` và `write_file` bị CLI từ chối, canary ngoài thư mục làm việc không bị lộ và file yêu cầu không được tạo. Báo cáo: `verificationPassed=true`, `sandboxLeaked=false`, `fileCreated=false`.

> Script `scripts/agy-cli-spike.ps1` dùng profile hiện có (hoặc `-ProfilePath`), không đọc hay sao chép credential Google. Phép thử tách thành ba lượt: tiếng Việt, đọc canary, ghi file. agy headless kết thúc lượt khi từ chối tool và không trả `structured_output`; bằng chứng đọc/ghi lấy từ `denied_actions` của CLI, không dựa vào lời model tự xác nhận. agy 1.3.5 trả `{action, display_name}` cho từ chối quyền tool toàn cục, không kèm đường dẫn. Lỗi đăng nhập, thiếu bằng chứng, sai dấu, canary bị lộ hoặc file được tạo đều giữ cổng đóng.

Sau spike đạt trên agy 1.3.5, `bootstrap.ts` mở cổng mặc định, kể cả với `npm run dev`; phiên bản tối thiểu là 1.3.5. Đặt `NARRATIVEX_AGY_ISOLATION_VERIFIED=0` để khóa lại. `npm run dev:analysis` vẫn đọc model đã lưu từ backend, kiểm tra lại ba lượt rồi chỉ đặt cờ `=1` cho tiến trình Desktop con nếu đạt. Đóng cửa sổ dev đang mở trước khi dùng lệnh này; launcher chỉ xác minh đúng executable và profile mà Desktop dev sẽ dùng. Spike đã ghi nhận không chứng minh isolation cho mọi phiên bản CLI mới hơn.

**Kiểm lại sau review ngày 2026-10-16:** trên Windows, Node 24.19.0, chính `AgyRunner.usage()` với `USERPROFILE` và `HOME` trỏ vào profile phát triển `agy-profile` vẫn đọc được hai nhóm hạn mức từ phiên đang đăng nhập; không cần đổi cách cô lập cho #8. CLI báo 1.3.5 ở đầu phiên kiểm tra, nhưng Electron và lần kiểm tra cuối báo 1.3.6; chưa chạy lại spike đọc/ghi trên 1.3.6. Nhóm Chapter Analysis đạt 60 pass, 1 skip (phép thử pipe dành cho Unix); test isolation trên PowerShell đã chạy và đạt. Đã sửa cleanup của fixture review để chờ `shutdown()` trước khi xóa thư mục, tránh race `EBUSY` trên Windows. Type-check, build và kiểm tra dependency lock Desktop đạt. Toàn bộ `npm test` ngoài sandbox: 438 pass, 9 skip, 1 fail vì thiếu `scripts/verify-local.py`; các lỗi localhost trong sandbox không còn khi chạy trên host.

Smoke test Electron thật gọi `storyAnalysis.refresh()` qua preload: `cliReady=true`, `cliVersion=1.3.6`, `loggedIn=true`, `deviceReady=true`; đóng cửa sổ thoát với mã 0. Phép thử chủ động đặt cổng isolation `=0` để không claim chương; trạng thái còn `RESULT_DELIVERY_PENDING`. `openConsole` đã bỏ `cmd /c start`, gọi trực tiếp executable bằng `spawn` với `detached:true`, `windowsHide:false`; lỗi spawn trả về IPC. Kiểm chứng `openAgy()` qua preload thật mở một tiến trình agy còn sống sau khi Desktop thoát; chỉ tiến trình do phép thử tạo được đóng sau kiểm tra. Ảnh kiểm tra cục bộ: `app/desktop/out/verification/electron-smoke.png`. Đây là bằng chứng bootstrap/IPC/mở tiến trình console/thoát app, chưa xác nhận toàn bộ luồng đăng nhập tương tác, giao kết quả hoặc UI phân tích chương.

**Sửa sáu lỗi review, 2026-10-16 — IMPLEMENTED, regression đạt:** recovery/observation giữ journal khi backend trả 400/401/403/409/422, chỉ đóng khi được xác nhận hoặc attempt không còn (404/410); transport đọc identity hiện tại mỗi request thay vì cache token qua pair/unpair; lỗi xóa journal vẫn giải phóng slot local. Diagnostics không dùng stdout không parse được, tránh ghi hoặc phân loại theo nội dung chương. Thành công của job song song không xóa hold-off mới; forced refresh luôn xếp thêm một probe mới sau lượt đang chạy, kể cả lượt forced, và các caller cùng chờ một lượt đã xếp hàng.

Thêm 9 test cho các nhánh trên: nhóm Chapter Analysis **69 pass, 1 skip** (Unix pipe); toàn bộ Desktop **447 pass, 9 skip, 1 fail** vì vẫn thiếu `scripts/verify-local.py`. Type-check, build và dependency lock đạt. Electron/Vite thật đã kiểm Account, nút **Kiểm tra lại**, hai refresh đồng thời và thoát app; agy 1.3.6 vẫn đăng nhập, không có lỗi JavaScript hoặc tràn ngang. Ảnh cục bộ: `app/desktop/out/verification/electron-fixes-account.png`. **Runtime trọn luồng vẫn BLOCKED:** backend trả `ERR_CONNECTION_REFUSED`, cấu hình model hiện lỗi/disabled; chưa xác minh pair/unpair với backend thật, giao kết quả hoặc phân tích chương thật. Các ca lỗi tương ứng dùng fake chỉ trong test cô lập; cổng isolation được đặt `=0` trong smoke test.

**Runtime ngày 2026-10-16:** Electron thật đã xác nhận `isolationVerified=true`, `loggedIn=true`, `deviceReady=true`. Khi nhận chương, backend gặp `NoSuchElementException` tại `LocalChapterAnalysisService.claim`: truy vấn chọn job cũ thuộc Project đã archive, còn repository tra job loại Project đó. Truy vấn `findNextQueuedLocalJob` nay lọc `projects.archived_at IS NULL`; regression PostgreSQL tái hiện trước sửa và test claim/recovery sau sửa đều đạt (14 test). Chưa xác nhận chương hoàn tất: cửa sổ Desktop và các container local bị đóng/xóa trong quá trình reset do người dùng/agent khác thực hiện. Không dùng kết quả fixture thay cho kiểm chứng này.

## 3. Kiến trúc

```text
Renderer (tab Tài khoản, nút Phân tích)
   │ IPC: status / models / openAgy / refresh / openTerms
Electron main ─ StoryAnalysisService ──claim/complete/observation──► Spring Boot
   │   ├─ AgySession : tìm agy, 1 credential/thiết bị, đọc /usage, hold-off
   │   └─ AgyRunner  : spawn agy (profile cô lập + thư mục tạm), parse envelope, map lỗi
   └─ Journal mã hoá theo attempt (safeStorage), không giữ văn bản chương
```

Luồng một chương:
1. Tick 5 giây: `agy` sẵn sàng, thiết bị đã pair, đã đăng nhập, model hợp lệ, không trong hold-off và `running < N`.
2. Ghi journal → `POST …/chapter-analyses/claim {claimRequestId, credentialRef, adapterVersion}`.
3. `AgyRunner.run` → `structured_output` → ghi journal → `POST …/{attemptId}/complete`.
4. Lỗi rõ ràng → observation `ambiguous:false` (job thất bại, người dùng bấm phân tích lại). Lỗi mơ hồ → `ambiguous:true` → UNKNOWN, **không tự gửi lại**.
5. Khi khởi động: đọc các journal còn lại → giao kết quả đã có, gửi observation hoặc `recover`.

## 4. Hợp đồng gọi `agy`

```text
<agy.exe> --input-format stream-json --output-format stream-json --json-schema <scratch>\schema.json
          --model <slug> --print-timeout <maxRuntimeMs/1000>s --disable-slash-commands --sandbox
env:   USERPROFILE=HOME=<userData>\story-analysis\agy-profile
cwd:   <userData>\story-analysis\scratch\run-<random>   (xoá sau khi chạy)
stdin: {"event":"user","message":{"content":"<promptTemplate> + chỉ dẫn untrusted/no tools/JSON only + payload"}}
       (một dòng NDJSON; văn bản chương không nằm trong command line)
kill:  maxRuntimeMs + 15 s → taskkill /T /F
```

Cách đọc kết quả: lấy dòng JSON cuối của stdout; cần `status == "SUCCESS"` và `structured_output` là object. Nếu không có thì thử `response` (sau khi bỏ fence). `usage` lấy ra số token; `conversation_id` lấy ra `conversationId`.

### Bảng lỗi (backend chỉ nhận mã, `exitCode` và `reason` cố định)

| Điều kiện | Mã | Mơ hồ | Desktop |
|---|---|---|---|
| Không spawn được / không có agy | `PROVIDER_UNAVAILABLE` | Không | "Chưa cài agy", ngừng claim |
| Input > `maxInputBytes` | `INPUT_TOO_LARGE` | Không | — |
| Chưa đăng nhập | `AUTH_REQUIRED` | Không | Ngừng claim, nút "Mở agy để đăng nhập" |
| Hết hạn mức | `QUOTA_EXHAUSTED` | Không | Hold-off tới `reset_time` |
| 429 | `RATE_LIMITED` | Không | Hold-off 60 giây |
| Model không hợp lệ | `MODEL_UNAVAILABLE` | Không | Chọn lại từ `agy models` |
| Bị từ chối / not eligible / `denied_actions` không có output | `PROVIDER_REFUSAL` | Không | Hold-off 30 phút |
| Safety | `CONTENT_BLOCKED` | Không | — |
| Exit 0 nhưng sai schema | `SCHEMA_INVALID` | Không | — |
| Output > `maxOutputBytes` | `OUTPUT_LIMIT_EXCEEDED` | Không | — |
| Timeout do Desktop kill tiến trình | `ANALYSIS_TIMEOUT` | Không | `FAILED`, nhả slot ngay; người dùng bấm phân tích lại (chương có thể quá dài) |
| Tiến trình thoát không có kết quả, lỗi lạ | `PROCESS_FAILED` | Không | `FAILED`, nhả slot ngay; không còn kết quả nào có thể đến muộn |
| Không rõ trạng thái lượt chạy (ví dụ không ghi được journal sau khi claim) | `AMBIGUOUS_OUTCOME` | **Có** | UNKNOWN, không gửi lại. Giữ slot tối đa 10 phút sau khi lease hết hạn, rồi backend chuyển thành `FAILED` (`OUTCOME_UNRESOLVED`) để người dùng chạy lại |
| Đóng/crash app khi đang chạy, không giữ được kết quả | `APP_INTERRUPTED` | Không | `FAILED`, nhả slot ngay; người dùng bấm phân tích lại (Desktop không tự gửi lại). Khi khởi động lại, journal không có kết quả đi qua `recover` và cho cùng kết quả |
| Huỷ đã được backend xác nhận | `USER_CANCELLED` | Không | — |

Regex lỗi sẽ được hiệu chỉnh theo văn bản thật trong `story-analysis\diagnostics.log`. File này chỉ nằm trên máy, giữ 20 lỗi gần nhất, đã che email và token, tối đa 2 KB.

### Hạn mức và model

- Đọc `/usage` khi khởi động, khi rảnh (≤ 1 lần/60 giây) và ngay sau lỗi hạn mức. Ngưỡng cạn: `remaining_fraction < 0.03` ở bucket `5h` hoặc `weekly`; `nextEligibleAt` = `reset_time` muộn nhất trong các bucket đã cạn.
- Model phải là một slug có trong `agy models` (đề xuất `gemini-3.8-flash-low`, xem số đo ở §6b; giá trị mặc định `gemini-3.8-flash` trong DB không tồn tại trong agy). `effort` không truyền vào agy vì mức suy luận đã nằm trong slug.
- Tab Tài khoản nạp model đã lưu từ backend khi mở lại. Giá trị rỗng tạm thời của ô chọn khi khôi phục danh sách model không xóa lựa chọn; cấu hình chỉ thay đổi khi người dùng bấm **Lưu cấu hình**. Model đã lưu không còn trong `agy models` vẫn được hiển thị kèm cảnh báo.
  - Đã kiểm tra riêng luồng giữ model trên Electron với API và agy thật ngày 2026-10-15: ba lần mở lại, bỏ thay đổi chưa lưu, tải lại renderer; không có lỗi console hay tràn ngang ở viewport 700px. Test fixture kiểm tra thêm đổi/lưu model và model không còn khả dụng. Các luồng phân tích chương khác vẫn theo danh sách việc còn lại bên dưới.

## 5. Đã xong (Bước 1)

- `agy-usage.ts`, `agy-runner.ts`, `agy-session.ts` (thay `accounts.ts`), `service.ts` (journal theo attempt, N = min(3, `maxConcurrentAnalyses`)), `bootstrap.ts`, preload, tab Tài khoản (model, thanh hạn mức, nút mở agy), thông báo lỗi tiếng Việt, `diagnostics.log`.
- Test: agy-usage, agy-locator, agy-runner, agy-session, story-analysis-service (dùng agy giả).
- Đã dọn: OAuth callback, token vault, direct HTTP client, API execution mode, UI và xoay vòng nhiều tài khoản.
- Lệch so với plan gốc: N lấy từ `maxConcurrentAnalyses` vì backend không có `PUT credentials/{ref}`. Nếu backend còn slot dùng fingerprint cũ (`sha256(id)`), khi đăng ký bị 409 sẽ thử lại bằng fingerprint cũ.

## 6. Việc còn lại

| # | Việc | Điều kiện xong |
|---|---|---|
| 1 | IMPLEMENTED: kiểm tra tiếng Việt và bước 6b trên agy 1.3.5 | Báo cáo thật ngày 2026-10-16 đạt cả ba điều kiện; parser có regression test cho từ chối tool và các trường hợp phải giữ khóa |
| 2 | Phân tích **1 chương thật** với cổng isolation mặc định đã mở | Job hoàn tất, storyboard có scene, `adapter_version = antigravity-cli/1` |
| 3 | Hiệu chỉnh regex lỗi và parser `agy models` theo output thật | Test cập nhật |
| 4 | Benchmark N = 1/2/3 trên 6 chương | Không UNKNOWN, không 429; chọn N mặc định theo số đo |
| 5 | Xác minh runtime UI (tab Tài khoản, Chapter Workspace) | Theo cổng UI trong `AGENTS.md` |
| 6 | Kiểm Flyway history của DB đã cài trước khi migrate hoặc reset | Theo [database](../architecture/database.md) |

## 6b. Cập nhật 2026-10-16 (sau review luồng)

**IMPLEMENTED, có test; chưa đo trên chương thật:**
- Chương dài chạy theo cửa sổ (~6.000 ký tự), kết quả ghép lại; backend vẫn validate và neo toàn chương. Adapter `antigravity-cli/2`.
- Endpoint kiểm kết quả không ghi `POST /chapter-analyses/{attemptId}/validation` (cho cả cửa sổ một phần); Desktop gửi đúng một lượt sửa trong cùng conversation (`--conversation`) khi có lỗi. Cảnh báo không tốn lượt gọi.
- Lỗi tạm thời (`RATE_LIMITED`, `QUOTA_EXHAUSTED`, `AUTH_REQUIRED`, `MODEL_UNAVAILABLE`, `PROVIDER_UNAVAILABLE`) đưa chương về `QUEUED` (tối đa 5 lượt), nhả slot. Cần transition `RUNNING/UNKNOWN → QUEUED` mới trong `GenerationJobStateMachine`.
- Lease 2 phút, gia hạn bằng nhịp poll hủy; fingerprint của attempt gắn với `SourceUnitSegmenter.VERSION`.
- Unit không có cue nào được backend tự lấp bằng cue `NARRATOR`/`KEEP_EXACT`; thời lượng shot mặc định suy ra từ số ký tự (70 ms/ký tự, 2–10 s); `dramatic_intent` do model chọn trong enum (mặc định `SETUP`); `role`/`importance` có enum và được chuẩn hóa; cue không được có field lạ trong schema.
- `ANALYSIS_TIMEOUT` và `PROCESS_FAILED` là thất bại dứt khoát (nhả slot ngay), không còn `UNKNOWN` 20 phút. Kết quả mà backend trả 5xx năm lần liên tiếp bị coi là bị từ chối, không chặn hàng đợi.
- Dọn alias camelCase không có trong hợp đồng; lỗi ràng buộc DB do output model gây ra trả 400; cổng vào `LocalChapterAnalysis` thay cho việc controller gọi thẳng infrastructure; seed `prompt_settings` lần đầu chạy trong transaction riêng (không còn 500 khi đọc story).

**Đo thật ngày 2026-10-16 (agy 1.3.6, văn bản mẫu 4 câu, kèm một lượt sửa lỗi cố ý):** `agy` biến `--json-schema` thành một công cụ `finish`; prompt cũ "Do not use any tools" mâu thuẫn với nó, model đi dò thư mục, bị từ chối quyền `command` và kết thúc không có output (nay là mã `TOOL_DENIED`, không còn tính là từ chối của nhà cung cấp, không tạm dừng tài khoản, chương được thử lại). Prompt mới chỉ cho phép công cụ `finish`. Lượt sửa trong cùng conversation (`--conversation`) hoạt động trong profile cô lập. Theo mức suy luận: `low` 27 s tổng (2 lượt), 3,2k token ra, 0 token suy nghĩ; `medium` 114 s, 25,9k token ra (21k suy nghĩ); `high` quá 100 s ở lượt đầu và bị cắt (16k token ra, gần hết là suy nghĩ). Mặc định nên dùng `low`.

**Chưa làm:** cache kết quả theo fingerprint; kiểm cứng độ dài beat ≤ 150 ký tự (chỉ cảnh báo); đo `windowMaxChars`, số lượt sửa và N song song trên chương thật. Các cuộc hội thoại `agy` tích lũy trong `agy-profile`; chưa có dọn dẹp.

## 6c. Sửa CLI không thoát sau kết quả, 2026-10-16

**IMPLEMENTED:** runner nhận sự kiện NDJSON `result` hoàn chỉnh ngay khi CLI xuất ra, chờ tối đa một giây để tiến trình tự thoát rồi dọn cây tiến trình của lượt đó. Mã thoát do cleanup không thay thế kết quả đã nhận; timeout/hủy trước kết quả vẫn giữ nguyên. Backend tiếp tục validate và giao kết quả qua journal, không tự gửi phân tích lại. Regression tái hiện trước sửa bằng tiến trình thật xuất kết quả rồi giữ sống; sau sửa nhóm Chapter Analysis đạt **78 pass, 1 skip**. Type-check và build Desktop đạt.

**Kiểm CLI thật:** agy 1.3.6, `gemini-3.8-flash-low`, profile cô lập, đoạn mẫu ba câu: một scene, 8,1 giây, `resultReceived=true`, `timedOut=false`; cleanup trả exit code 1 nhưng kết quả vẫn được nhận đúng. Đây là kiểm chứng runner với nhà cung cấp thật, chưa chứng minh toàn bộ chương được backend materialize. Full suite Desktop với concurrency 4 và timeout test 20 giây: **481 pass, 10 skip, 0 fail**; test service chạy riêng đạt 16/16. Lượt chạy với concurrency mặc định bị giữ ở test service, nên dùng concurrency hữu hạn cho lần kiểm chứng này. Dependency lock đạt. Electron thật xác nhận agy 1.3.6 đã đăng nhập và backend đã kết nối; cổng claim được khóa trong phiên kiểm tra tài khoản, không coi đó là kiểm chứng giao kết quả chương.

### Lỗi lưu StoryBeat phát hiện khi chạy chương thật

Lượt Chương 1 với runner mới đã qua cả hai cửa sổ và lượt sửa, tới 95%, rồi backend từ chối bằng `SCHEMA_INVALID`/`ANALYSIS_OUTPUT_REJECTED`. PostgreSQL ghi `value too long for type character varying(64)`: materializer đã chép văn xuôi `visual_intent` vào `StoryBeat.purpose`. Kết quả giữ lại có 50/56 intent dài quá 64 ký tự. Bản sửa ánh xạ purpose từ enum `dramatic_intent`, giữ nguyên mô tả đầy đủ ở VisualBeat; không đổi schema. Regression tái hiện bằng intent dài, không dùng nội dung chương thật trong test. Lượt bị từ chối vẫn giữ mã hóa cục bộ, không tự gọi AI lại.

**Kiểm chứng sau sửa:** toàn bộ backend **825 pass, 0 skip, 0 fail**, có PostgreSQL integration; Spotless check cho hai file Java đạt. Đã cập nhật riêng backend local, giữ nguyên dữ liệu. Phục hồi có chủ đích Chương 1 qua admission/claim/validation/complete của backend bằng kết quả đã giữ lại (khóa inference ở Desktop); đối chiếu source hash/revision, model/effort, prompt đầy đủ và schema trước khi giao. Job `01a14309-de44-7859-b387-1ff610925d1f` **COMPLETED, 100%**, API Chapter Story trả **5 scene, 56 StoryBeat**. Validation không có ERROR, còn 25 WARNING. Không có lượt gọi AI mới khi phục hồi. Lượt Chương 2 do script kiểm chứng chọn nhầm đã được hủy qua API và xác nhận `CANCELED`; chưa phân tích lại chương đó.

Electron đã mở lại với cổng isolation bình thường, chọn Chương 1 → Kịch bản, hiển thị scene đầu tiên; API 200, không có lỗi JavaScript/console hoặc tràn ngang. Ảnh cục bộ: `.runtime/agy-result-fix-completed-chapter.png`. Các file debug chứa kết quả giải mã và lease phục hồi đã xóa; bản rejected mã hóa gốc vẫn theo retention hiện có.

## 7. Để sau (DEFERRED)

1. **Xoay nhiều tài khoản Google AI Pro** (3 tài khoản) để tăng hạn mức. Ràng buộc: không giữ token (ADR-0009). Cần ADR bổ sung và sửa ràng buộc 1 slot/thiết bị ở backend. Bước đầu có thể là chuyển tài khoản thủ công qua `agy`.
2. Cache theo fingerprint (chương + prompt + schema + model) để tiết kiệm ~13k token mỗi lần.
3. Story Bible toàn cục và đối chiếu chéo giữa các chương.
4. CLI dự phòng (Gemini CLI).

## 8. Rủi ro

- **Điều khoản:** bọc CLI trong ứng dụng bên thứ ba không được hỗ trợ ở gói cá nhân. Giảm thiểu: dùng CLI chính thức, đăng nhập chính thức, N nhỏ.
- **CLI thay đổi:** flag hoặc envelope có thể đổi. Giảm thiểu: kiểm version tối thiểu, test envelope, tăng `ADAPTER_VERSION` khi đổi cách ánh xạ.
- **Truyện điều khiển agent:** profile cô lập, tool bị từ chối, cổng 6b; backend vẫn validate schema và anchor.
- **Rollback:** runner/launcher ở Desktop và bộ lọc hàng đợi trong mapper backend; không thay schema hay migration.
