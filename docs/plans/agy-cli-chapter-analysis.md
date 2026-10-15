# Plan: Phân tích chương qua `agy` CLI

**Trạng thái:** PARTIAL. Quyết định: [ADR-0009](../decisions/ADR-0009-chapter-analysis-agy-cli.md).
Runner, session, journal và tab Tài khoản đã viết xong (Bước 1, chỉ đổi Desktop). Chưa chạy inference với truyện thật: cổng cô lập vẫn đóng.
**Cập nhật:** 2026-10-15. Bản này gộp plan triển khai và bản tóm tắt trạng thái trước đây. Lịch sử nằm trong Git.

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
| Flag headless | `-p`, `--input-format text`, `--output-format json`, `--json-schema`, `--model`, `--print-timeout`, `--disable-slash-commands`, `--sandbox` |
| Profile cô lập | Đổi `USERPROFILE`/`HOME` sang thư mục riêng vẫn giữ được đăng nhập; config, tool và skill của người dùng không bị dùng |
| Structured output | Envelope: `conversation_id, status, response, structured_output, usage{…}, denied_actions[]` |
| Khoá tool | Yêu cầu ghi file bị tự từ chối, file không được tạo |
| Song song | 3 tiến trình cùng một tài khoản: đều SUCCESS, không 429 |
| Hạn mức | `agy -p /usage --output-format json` trả về 2 nhóm (Gemini; Claude và GPT), mỗi nhóm có bucket `5h` và `weekly` |
| Model | `agy models`: `gemini-3.8-flash-high/medium/low`, `claude-sonnet-4-6`, `claude-opus-4-6-thinking`, `gpt-oss-120b-medium` |
| Chi phí cố định | ~13k input token, 11–21 giây mỗi lần gọi |

**Chưa kiểm:** (a) tiếng Việt qua stdin có giữ nguyên dấu không; (b) **bước 6b**: model có đọc được file nằm ngoài thư mục làm việc không. Bước (b) là cổng an toàn.

> Script spike `scripts/agy-cli-spike.ps1` đã mất cùng thư mục `scripts/` (chưa từng được Git theo dõi). Cần viết lại trước khi chạy 6b. Đề xuất đặt ở `app/desktop/tools/agy-cli-spike.ps1` để gần runner.

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
<agy.exe> --input-format text --output-format json --json-schema <scratch>\schema.json
          --model <slug> --print-timeout <maxRuntimeMs/1000>s --disable-slash-commands --sandbox
env:   USERPROFILE=HOME=<userData>\story-analysis\agy-profile
cwd:   <userData>\story-analysis\scratch\run-<random>   (xoá sau khi chạy)
stdin: <promptTemplate từ snapshot> + chỉ dẫn "untrusted / no tools / JSON only"
       + {"sourceLanguage": "...", "sourceText": "..."}
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
| Timeout, bị kill, lỗi lạ sau khi đã chạy | `AMBIGUOUS_OUTCOME` | **Có** | UNKNOWN, không gửi lại |
| Huỷ đã được backend xác nhận | `USER_CANCELLED` | Không | — |

Regex lỗi sẽ được hiệu chỉnh theo văn bản thật trong `story-analysis\diagnostics.log`. File này chỉ nằm trên máy, giữ 20 lỗi gần nhất, đã che email và token, tối đa 2 KB.

### Hạn mức và model

- Đọc `/usage` khi khởi động, khi rảnh (≤ 1 lần/60 giây) và ngay sau lỗi hạn mức. Ngưỡng cạn: `remaining_fraction < 0.03` ở bucket `5h` hoặc `weekly`; `nextEligibleAt` = `reset_time` muộn nhất trong các bucket đã cạn.
- Model phải là một slug có trong `agy models` (đề xuất `gemini-3.8-flash-high`; giá trị mặc định `gemini-3.8-flash` trong DB không tồn tại trong agy). `effort` không truyền vào agy vì mức suy luận đã nằm trong slug.

## 5. Đã xong (Bước 1)

- `agy-usage.ts`, `agy-runner.ts`, `agy-session.ts` (thay `accounts.ts`), `service.ts` (journal theo attempt, N = min(3, `maxConcurrentAnalyses`)), `bootstrap.ts`, preload, tab Tài khoản (model, thanh hạn mức, nút mở agy), thông báo lỗi tiếng Việt, `diagnostics.log`.
- Test: agy-usage, agy-locator, agy-runner, agy-session, story-analysis-service (dùng agy giả).
- Đã dọn: OAuth callback, token vault, direct HTTP client, API execution mode, UI và xoay vòng nhiều tài khoản.
- Lệch so với plan gốc: N lấy từ `maxConcurrentAnalyses` vì backend không có `PUT credentials/{ref}`. Nếu backend còn slot dùng fingerprint cũ (`sha256(id)`), khi đăng ký bị 409 sẽ thử lại bằng fingerprint cũ.

## 6. Việc còn lại

| # | Việc | Điều kiện xong |
|---|---|---|
| 1 | Viết lại script spike, chạy (a) tiếng Việt và (b) bước 6b | `sandboxLeaked=false`, `fileCreated=false`; ghi evidence đã che thông tin vào [current status](../current-status.md) |
| 2 | Bật `NARRATIVEX_AGY_ISOLATION_VERIFIED=1`, phân tích **1 chương thật** | Job hoàn tất, storyboard có scene, `adapter_version = antigravity-cli/1` |
| 3 | Hiệu chỉnh regex lỗi và parser `agy models` theo output thật | Test cập nhật |
| 4 | Benchmark N = 1/2/3 trên 6 chương | Không UNKNOWN, không 429; chọn N mặc định theo số đo |
| 5 | Xác minh runtime UI (tab Tài khoản, Chapter Workspace) | Theo cổng UI trong `AGENTS.md` |
| 6 | Kiểm Flyway history của DB đã cài trước khi migrate hoặc reset | Theo [database](../architecture/database.md) |

## 7. Để sau (DEFERRED)

1. **Xoay nhiều tài khoản Google AI Pro** (3 tài khoản) để tăng hạn mức. Ràng buộc: không giữ token (ADR-0009). Cần ADR bổ sung và sửa ràng buộc 1 slot/thiết bị ở backend. Bước đầu có thể là chuyển tài khoản thủ công qua `agy`.
2. Cache theo fingerprint (chương + prompt + schema + model) để tiết kiệm ~13k token mỗi lần.
3. Story Bible toàn cục và đối chiếu chéo giữa các chương.
4. CLI dự phòng (Gemini CLI).

## 8. Rủi ro

- **Điều khoản:** bọc CLI trong ứng dụng bên thứ ba không được hỗ trợ ở gói cá nhân. Giảm thiểu: dùng CLI chính thức, đăng nhập chính thức, N nhỏ.
- **CLI thay đổi:** flag hoặc envelope có thể đổi. Giảm thiểu: kiểm version tối thiểu, test envelope, tăng `ADAPTER_VERSION` khi đổi cách ánh xạ.
- **Truyện điều khiển agent:** profile cô lập, tool bị từ chối, cổng 6b; backend vẫn validate schema và anchor.
- **Rollback:** chỉ Desktop thay đổi, backend và DB giữ nguyên.
