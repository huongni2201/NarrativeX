# Thay thế Gemini Web bằng ChatGPT Web cho Desktop Image Generation

- **Ngày:** 2026-09-13
- **Trạng thái:** Draft — đã chốt hướng kỹ thuật, chưa được phép phát hành production
- **Testing approach:** Regular — code theo lát cắt nhỏ, thêm deterministic tests ngay trong từng task, rồi runtime/UI verification
- **Phạm vi đã chốt:** ChatGPT Web tự động qua Chrome/CDP; không gọi OpenAI API; hỗ trợ cả `CHARACTER` và `STORYBOARD`, gồm Generate All; Gemini Web chỉ bị xóa sau khi ChatGPT Web vượt stability gate

## Overview

Thay đường sinh ảnh Desktop `GEMINI_WEB` bằng `CHATGPT_WEB` mà không đưa OpenAI API key, ChatGPT cookie, Chrome profile path, CDP port hoặc filesystem capability vào renderer/backend/worker. Electron main tiếp tục sở hữu browser lifecycle và privileged media handling; backend tiếp tục sở hữu exact prompt, immutable Storyboard generation batch, stale checks và stable asset metadata; ảnh thành phẩm tiếp tục được commit vào ProjectStorage theo local-first contract.

Plan dùng migration hai giai đoạn:

1. **Dark launch và ổn định ChatGPT Web:** thêm implementation riêng, giữ Gemini Web làm rollback nội bộ nhưng không nhân đôi business authority.
2. **Cutover và cleanup:** sau khi đạt stability gate, tắt rồi xóa operational Gemini code/config/profile; giữ nguyên generated media và durable audit/history cũ.

### Compliance gate bắt buộc

Tại ngày lập plan, [OpenAI Terms of Use](https://openai.com/policies/row-terms-of-use/) cấm tự động/programmatically trích xuất data hoặc Output từ ChatGPT. OpenAI mô tả thao tác lưu ảnh Web như một hành động người dùng qua nút Save trong [Images in ChatGPT](https://help.openai.com/en/articles/11084440-chatgpt-image-library). Vì vậy:

- plan này có thể dùng cho spike, thiết kế và deterministic local tests;
- **không bật production automation hoặc phân phối tính năng** trước khi legal/product xác nhận quyền sử dụng phù hợp, có chấp thuận bằng văn bản từ OpenAI, hoặc điều khoản thay đổi;
- không reverse-engineer private ChatGPT APIs, không né CAPTCHA/login challenge/rate limit/safety controls, không tự động đổi account để replay một submission đã đi qua external boundary;
- nếu gate không đạt, fallback sản phẩm là assisted flow có người dùng bấm Generate/Save, không phải API và không phải unattended Generate All.

Đây là release blocker, không phải ghi chú tùy chọn.

## Context (from discovery)

### Stack và boundaries hiện có

- `app/desktop` là Electron + React + TypeScript và là editor duy nhất.
- Electron main hiện sở hữu Chrome/CDP automation tại `app/desktop/src/main/gemini-web/`; renderer dùng typed preload bridge.
- Backend là Spring modular monolith, dùng MyBatis/PostgreSQL cho durable generation state; Amplicode dependency scan không nhận module dependencies, nhưng source/migrations xác nhận đây không phải JPA hoặc Spring Data JDBC task.
- Python worker sở hữu API image providers, nhưng browser-product execution đã được ADR-0003/ADR-0021 đặt tại Electron main. ChatGPT Web không được thêm vào worker provider factory.
- Working tree sạch tại lúc lập plan.

### Luồng Gemini Web AS-IS cần thay thế

```text
Backend exact prompt + immutable batch
  -> renderer Character/Storyboard queue
  -> typed window.narrativex.geminiWeb bridge
  -> Electron main Gemini browser pool + attempt journal
  -> visible Chrome profile + Gemini UI/CDP
  -> staged validated image + sender-bound selection token
  -> backend LOCAL_ONLY MediaAsset metadata
  -> Electron main ProjectStorage commit
  -> attach Character identity / Visual Beat preview
```

Các điểm sở hữu chính:

- Main/browser: `app/desktop/src/main/gemini-web/`, `app/desktop/src/main/bootstrap-core.ts`.
- Preferences/IPC: `app/desktop/src/main/preferences/desktop-preferences.ts`, `desktop-preferences-ipc.ts`, `app/desktop/src/preload/index.ts`, `types.ts`.
- Renderer queues: `features/characters/**/character-gemini-queue*`, `features/storyboard/**/gemini-queue*`, `CharactersScreen.tsx`, `StoryboardScreen.tsx`.
- Backend prompt snapshots: `PrepareStoryboardGenerationBatchUseCase`, `VisualBeatPromptContextAdapter`, `ProjectGenerationController`, `VisualBeatGeminiContextResponse`.
- Provider selection: `GenerationJob`, `EnqueueStoryAnalysisCommand`, `CreateMediaJobUseCase`, API requests và `packages/client-contracts`.
- Database constraint gốc: `V3__generation_quota_and_media.sql` chấp nhận `GEMINI_WEB|API`; migration mới kế tiếp hiện là V9.
- Worker analysis contract: `app/ai-worker/src/narrativex_worker/schema.py`; web generation không đi qua `image_generation_worker.py`.
- Kiểm thử hiện có: nhóm `gemini-*`, `storyboard-gemini-*`, `character-gemini-*`, preferences/IPC/boundary tests trong `app/desktop/test/`; backend generation contract/use-case tests; worker chapter analysis prompt tests.

### Ràng buộc cần giữ nguyên

- Backend là sole owner của exact final prompt và immutable provenance/fingerprint.
- Story/prompt/reference/provider output đều là untrusted data.
- Persist local attempt ở `SUBMITTING` trước khi submit; outcome mơ hồ thành `UNKNOWN`; không blind-resubmit.
- Renderer không nhận browser credentials, cookies, filesystem path, DevTools endpoint hoặc process handle.
- Reference files được resolve theo stable asset identity và re-hash ngay trước upload; giữ đúng order/role.
- Kết quả mới phải validate MIME/decode/dimensions/size/checksum, dùng single-use sender-bound selection token và commit atomically.
- Generated asset mới đặt review về `NEEDS_REVIEW`; output stale có thể giữ để review nhưng không attach vào revision mới.
- Không xóa historical MediaAsset, prompt snapshot, generation audit hoặc project bytes khi gỡ Gemini.

## Alternatives considered

### A. ChatGPT Web adapter riêng, migration hai giai đoạn — chọn

- Tạo `chatgpt-web` implementation độc lập trong Electron main.
- Tạm chấp nhận duplication ở low-level Chrome/CDP thay vì làm Gemini và ChatGPT phụ thuộc vào abstraction lớn giữa migration.
- Dark launch ChatGPT, giữ Gemini làm rollback, rồi xóa Gemini sau stability gate.
- Ưu điểm: blast radius rõ, rollback được, cleanup cuối sạch; lỗi selector/session ChatGPT không làm hỏng Gemini trong giai đoạn chứng minh.
- Nhược điểm: có duplication tạm thời và cần migration preferences/queue/provider contracts.

### B. Đổi tên toàn bộ `gemini-web` thành generic `web-image` trước

- Tách framework provider-neutral rồi cắm Gemini và ChatGPT adapter.
- Không chọn vì refactor lớn trước khi chứng minh ChatGPT automation, tăng coupling và làm rollback khó hơn.

### C. OpenAI Image API trong Python worker

- Là integration chính thức, phù hợp durable ProviderOperation nhưng trái yêu cầu “không call API”.
- Không thuộc scope này.

## Development Approach

- **Testing approach:** Regular.
- Hoàn tất và test từng task trước khi sang task tiếp theo.
- Mỗi behavior mới/sửa phải có deterministic unit/contract tests cho success, rejection, timeout, login loss, stale input, lease/concurrency và `UNKNOWN`.
- Browser tests dùng fake CDP transport, sanitized HTML/accessibility fixtures và fake downloads; ordinary CI không đăng nhập ChatGPT thật.
- Không dùng mock/fake provider từ runtime configuration.
- Update plan ngay khi ChatGPT Web behavior hoặc scope khác discovery.
- Không đổi Python worker thành chủ browser automation.
- Không xóa Gemini implementation trước khi tất cả stability gate và rollback rehearsal hoàn tất.

## Solution Overview

```text
PostgreSQL/backend                         Desktop renderer
exact prompt + refs + policy version  ->  provider-neutral queue orchestration
        ^                                      |
        | stale/ownership/asset metadata       | typed CHATGPT_WEB request
        |                                      v
ProjectStorage commit <- selection token <- Electron main
                                           ChatGPT browser pool
                                           + isolated Chrome profiles
                                           + PREPARED/SUBMITTING/UNKNOWN journal
                                           + visible ChatGPT UI automation
                                           + Save/download capture
```

### Chosen runtime boundary

- `CHATGPT_WEB` là Desktop-only browser-product provider, không tạo API media job hoặc fake backend ProviderOperation ledger.
- Electron main mở visible Chrome với persistent profile riêng theo NarrativeX user/browser entry. Người dùng tự đăng nhập; NarrativeX không đọc/autofill password, token hoặc cookie.
- Mỗi attempt mở/fresh conversation context để tránh memory bleed giữa project/character/beat.
- Automation attach refs theo order đã pin, submit exact backend prompt không append provider wrapper, chờ terminal state rồi dùng first-party Save/download interaction làm capture path ưu tiên.
- Không gọi undocumented ChatGPT JSON endpoints. DOM/accessibility selectors được cô lập trong một adapter contract có version/canary; selector mismatch fail closed trước submit khi có thể.
- Ảnh download được giữ nguyên bytes/provenance metadata. Không dùng Gemini watermark remover/postprocessor cho ChatGPT và không xóa C2PA/provenance metadata.
- Global `CHARACTER`/`STORYBOARD` concurrency tiếp tục áp dụng trên toàn browser pool. Dark launch bắt đầu `1/1`; chỉ tăng sau soak evidence, tối đa không vượt policy/config đã duyệt.

### Stable provider and migration semantics

- Canonical new provider key: `CHATGPT_WEB`.
- Trong compatibility window, backend có thể rehydrate historical `GEMINI_WEB`, nhưng new Desktop writes và new analysis requests dùng `CHATGPT_WEB`.
- Không rewrite historical Gemini audit thành ChatGPT. `GEMINI_WEB` sau cleanup chỉ được phép tồn tại như legacy persisted history, không còn selectable/dispatchable.
- Batch/snapshot có provider policy `chatgpt-web-images-v1`. Batch Gemini cũ trở thành stale/non-dispatchable và không tự chuyển provider.
- Queue chưa submit có thể prepare lại cho ChatGPT; `SUBMITTING`/`UNKNOWN` Gemini attempt bị quarantine và yêu cầu reconcile/skip thủ công, tuyệt đối không auto-submit sang ChatGPT.
- Gemini Chrome profile/cookie không được migrate sang ChatGPT profile. ChatGPT cần profile mới và login mới.

## Technical Details

### ChatGPT automation state machine

```text
PREPARED
  -> LOGIN_REQUIRED | READY
READY
  -> journal SUBMITTING (durable local write)
  -> attach refs + exact prompt + submit
  -> SUBMITTED
SUBMITTED
  -> COMPLETED | REJECTED | RATE_LIMITED | LOGIN_REQUIRED | UNKNOWN
COMPLETED
  -> download observed -> media validated -> token issued -> asset committed
```

- Lỗi trước external submit có thể retry có kiểm soát.
- Sau submit, crash/timeout/CDP disconnect trở thành `UNKNOWN`; cùng `attemptId` không được submit lại.
- Refusal/safety/rate-limit/login challenge có error code riêng và không bị parse thành success.
- Stop/pause chỉ chặn work mới; không hứa cancel request đã gửi.

### Selector and capture contract

- Dùng semantic/accessibility probes nhiều ngôn ngữ cho composer, file input, send/generate, generation progress, refusal và Save; không dựa duy nhất vào obfuscated CSS class.
- Có pre-submit capability probe: signed-in, composer ready, image generation available, attachment count supported, Save/download path detectable.
- Snapshot DOM/output identity trước submit để không nhầm ảnh reference/history với output mới.
- Download capture phải bind với attempt/browser/lane/slot và chỉ nhận file tạo sau submit; reject duplicate, unsupported MIME, oversized, empty hoặc ambiguous multiple outputs.
- Network observation chỉ dùng cho correlation nếu compliance cho phép; không gọi private endpoints hoặc dùng network body extraction làm đường mặc định.

### Stability gate trước khi xóa Gemini

Tất cả điều kiện sau phải đạt:

1. Compliance gate được sign off và ghi vào ADR/release evidence.
2. Toàn bộ deterministic Desktop/backend/worker checks xanh.
3. Packaged Windows Electron runtime flow được chạy cho Character single/all, Storyboard single/all, pause/resume/skip, restart recovery, stale output và local asset commit.
4. Ít nhất 50 attempt thật trên tối thiểu 2 browser profiles, phủ cả hai lane; automation completion/capture rate đạt ít nhất 95% sau khi loại user cancellation, policy refusal và intentional offline tests.
5. Không có blind duplicate submit, cross-user/profile/project data leak, secret/cookie/path leak hoặc corrupt asset trong soak.
6. `UNKNOWN`, login expiry, rate limit, selector drift, ChatGPT refusal và Chrome crash đều fail closed với hướng dẫn recovery đúng.
7. Dark launch tối thiểu 7 ngày liên tiếp không có Sev-1/Sev-2; rollback sang Gemini đã rehearsal một lần trước cleanup.
8. Mandatory Desktop UI verification có screenshots và kiểm tra console/failed requests/loading/error/empty/overflow states.

## What Goes Where

- **Implementation Steps:** code, migration, tests, docs và cleanup có thể thực hiện trong repo; dùng `[ ]` để theo dõi.
- **Post-Completion:** legal approval, authenticated-account soak, release observation và external policy monitoring; không dùng checkbox vì phụ thuộc hệ thống/người ngoài repo.

## Implementation Steps

### Task 1: Ghi ADR, compliance gate và compatibility matrix

**Files:**
- Create: `documentation/decisions/ADR-0027-desktop-chatgpt-web-image-generation.md`
- Create: `documentation/release/CHATGPT_WEB_COMPATIBILITY_MATRIX.md`
- Modify: `documentation/decisions/README.md`
- Modify: `documentation/decisions/ADR-0003-media-storage-generation-pipelines-and-external-integrations.md`
- Modify: `documentation/decisions/ADR-0021-desktop-gemini-web-image-generation.md`
- Modify: `documentation/workflows/IMAGE_GENERATION.md`

- [ ] Ghi quyết định Desktop-only, no API, user-owned login, exact backend prompt, local-first commit, `UNKNOWN` semantics và prohibition on safety/rate-limit bypass.
- [ ] Ghi ADR-0027 ở trạng thái `Proposed/Blocked for production` cho tới khi compliance gate được sign off; ADR-0021 vẫn Accepted trong dark launch.
- [ ] Định nghĩa ChatGPT UI capability probes, supported Chrome/platform/account matrix và error taxonomy.
- [ ] Chốt stability thresholds, rollback trigger, data retention và tiêu chí xóa Gemini operational code.
- [ ] Link chính xác OpenAI public terms/help evidence và ngày kiểm tra; không tuyên bố browser automation được hỗ trợ nếu chưa có xác nhận.
- [ ] Chạy `python scripts/check-docs-drift.py`; sửa docs test nếu decision index/schema thay đổi.

### Task 2: Tạo ChatGPT browser session, profile storage và pool độc lập

**Files:**
- Create: `app/desktop/src/shared/chatgpt-web-lanes.ts`
- Create: `app/desktop/src/main/chatgpt-web/chatgpt-browser-registry.ts`
- Create: `app/desktop/src/main/chatgpt-web/chatgpt-browser-storage.ts`
- Create: `app/desktop/src/main/chatgpt-web/chatgpt-browser-session.ts`
- Create: `app/desktop/src/main/chatgpt-web/chatgpt-browser-cdp.ts`
- Create: `app/desktop/src/main/chatgpt-web/chatgpt-web-slot-pool.ts`
- Create: `app/desktop/src/main/chatgpt-web/chatgpt-concurrency-policy.ts`
- Create: `app/desktop/src/main/chatgpt-web/chatgpt-browser-host.ts`
- Create: `app/desktop/src/main/chatgpt-web/chatgpt-browser-pool.ts`
- Create: `app/desktop/test/chatgpt-web-lanes.test.mjs`
- Create: `app/desktop/test/chatgpt-browser-registry.test.mjs`
- Create: `app/desktop/test/chatgpt-browser-storage.test.mjs`
- Create: `app/desktop/test/chatgpt-browser-session.test.mjs`
- Create: `app/desktop/test/chatgpt-browser-pool.test.mjs`
- Create: `app/desktop/test/chatgpt-concurrency-policy.test.mjs`

- [ ] Tạo browser root riêng dưới Electron `userData`, keyed theo stable NarrativeX user và validated browser id; không reuse/move Gemini cookies.
- [ ] Chỉ allowlist `https://chatgpt.com/` và required first-party auth/navigation origins đã được compatibility matrix duyệt; reject arbitrary navigation.
- [ ] Khởi chạy visible Chrome với dedicated `--user-data-dir`, loopback CDP port, isolated lane/slot/download namespaces và deterministic cleanup.
- [ ] Hỗ trợ nhiều browser profiles, least-active scheduling, fair tie rotation và global lane concurrency; bắt đầu dark-launch default `1/1`.
- [ ] Derive login/capability state từ live UI; persisted preference không được tự nhận `LOGGED_IN`.
- [ ] Reset/remove bị chặn khi có active lease; path deletion phải resolve và chứng minh nằm trong exact ChatGPT browser root.
- [ ] Viết tests cho user isolation, invalid ids/path traversal, start/reconnect/stop, login expiry, fair scheduling, global capacity và active-lease rejection.
- [ ] Chạy toàn bộ tests Task 2 trước Task 3.

### Task 3: Implement single-attempt ChatGPT image automation và safe output capture

**Files:**
- Create: `app/desktop/src/main/chatgpt-web/chatgpt-web-dom-contract.ts`
- Create: `app/desktop/src/main/chatgpt-web/chatgpt-web-generation-state.ts`
- Create: `app/desktop/src/main/chatgpt-web/chatgpt-web-download-capture.ts`
- Create: `app/desktop/src/main/chatgpt-web/chatgpt-image-quality.ts`
- Create: `app/desktop/src/main/chatgpt-web/chatgpt-web-automation.ts`
- Create: `app/desktop/src/main/chatgpt-web/chatgpt-web-attached-automation.ts`
- Create: `app/desktop/test/fixtures/chatgpt-web/README.md`
- Create: `app/desktop/test/chatgpt-web-dom-contract.test.mjs`
- Create: `app/desktop/test/chatgpt-web-generation-state.test.mjs`
- Create: `app/desktop/test/chatgpt-web-download-capture.test.mjs`
- Create: `app/desktop/test/chatgpt-web-cinematic-flow.test.mjs`
- Create: `app/desktop/test/chatgpt-web-background.test.mjs`

- [ ] Implement pre-submit probe cho signed-in/composer/image capability/attachment/Save path; mismatch fail trước external side effect.
- [ ] Mỗi attempt dùng fresh conversation/context, clear attachment state và capture baseline trước upload.
- [ ] Re-hash reference bytes, enforce stable ordered bindings, detect missing/duplicate/reordered refs và upload đúng `REF_01...N`.
- [ ] Submit exact prompt từ backend snapshot/character version; không thêm hidden wrapper hoặc đọc story data ngoài request.
- [ ] Detect progress, completion, refusal, moderation block, rate limit, login challenge và timeout bằng semantic multi-signal contract.
- [ ] Trigger first-party Save/download, correlate file với attempt/lane/slot, validate type/decode/dimensions/size/SHA-256 và preserve provenance metadata.
- [ ] Không dùng undocumented endpoints, network response-body extraction, CAPTCHA bypass hoặc account rotation replay.
- [ ] Viết fixture-based tests cho success, refs, pre-submit selector drift, false historical image, multiple candidates, invalid media, refusal/rate limit/login loss, timeout và cancellation.
- [ ] Chạy toàn bộ tests Task 3 trước Task 4.

### Task 4: Thêm durable local attempt journal và trusted ChatGPT IPC

**Files:**
- Create: `app/desktop/src/main/chatgpt-web/chatgpt-generation-attempt-journal.ts`
- Create: `app/desktop/src/main/chatgpt-web/chatgpt-browser-ipc.ts`
- Create: `app/desktop/src/main/chatgpt-web/chatgpt-web-ipc.ts`
- Modify: `app/desktop/src/main/bootstrap-core.ts`
- Modify: `app/desktop/src/preload/types.ts`
- Modify: `app/desktop/src/preload/index.ts`
- Modify: `app/desktop/src/renderer/env.d.ts`
- Create: `app/desktop/test/chatgpt-generation-attempt-journal.test.mjs`
- Create: `app/desktop/test/chatgpt-browser-ipc-contract.test.mjs`
- Create: `app/desktop/test/chatgpt-web-ipc-contract.test.mjs`
- Modify: `app/desktop/test/desktop-main-boundaries.test.mjs`

- [ ] Định nghĩa typed `window.narrativex.chatgptWeb` capability chỉ gồm browser management, generate, attempt status và protected image commit.
- [ ] Validate sender, project/user scope, lane, batch/snapshot/attempt ids, policy version, prompt length, refs/checksums và selection-token ownership tại main boundary.
- [ ] Journal atomically `PREPARED -> SUBMITTING` trước khi thao tác Submit; bind attempt id với immutable fingerprints.
- [ ] Map crash/disconnect/timeout sau boundary thành `UNKNOWN`; replay cùng attempt chỉ trả journal state, không submit lại.
- [ ] Staged file nằm trong attempt-scoped root; renderer chỉ nhận safe metadata và single-use token, không nhận source path/URL/CDP/session.
- [ ] Commit qua ProjectStorage giữ atomicity/checksum và stale/provenance checks hiện có.
- [ ] Cho Gemini và ChatGPT IPC cùng tồn tại chỉ khi dark-launch flag bật; production selector chỉ chọn một provider cho một attempt.
- [ ] Viết tests cho malformed IPC, cross-window token, attempt conflict, concurrent begin, restart recovery, `UNKNOWN`, stale snapshot, commit mismatch và secret/path redaction.
- [ ] Chạy toàn bộ tests Task 4 trước Task 5.

### Task 5: Migrate Desktop preferences, Settings và browser management UI

**Files:**
- Modify: `app/desktop/src/main/preferences/desktop-preferences.ts`
- Modify: `app/desktop/src/main/preferences/desktop-preferences-ipc.ts`
- Modify: `app/desktop/src/main/preferences/preferences-bootstrap.ts`
- Create: `app/desktop/src/renderer/features/settings/components/ChatGptBrowserSettings.tsx`
- Create: `app/desktop/src/renderer/features/settings/components/ChatGptConcurrencySettings.tsx`
- Modify: `app/desktop/src/renderer/features/settings/screens/SettingsScreen.tsx`
- Modify: `app/desktop/.env.example`
- Modify: `app/desktop/README.md`
- Modify: `app/desktop/test/desktop-preferences.test.mjs`
- Modify: `app/desktop/test/personalized-settings-contract.test.mjs`
- Create: `app/desktop/test/chatgpt-settings-ui-contract.test.mjs`

- [ ] Tăng preferences schema version và thêm `chatgpt` browser registry/concurrency, giữ user isolation và window settings.
- [ ] Copy only safe numeric concurrency preference từ Gemini nếu hợp lệ; không copy browser ids, profile paths, cookies, sessions hoặc login-confirmed state.
- [ ] Thêm `NARRATIVEX_CHATGPT_CHARACTER_TAB_COUNT` và `NARRATIVEX_CHATGPT_STORYBOARD_TAB_COUNT`; dark launch default `1/1`, validate bounded values.
- [ ] Settings hỗ trợ Add/Open/Login state/Reset/Remove cho ChatGPT profiles và hiển thị adapter health/capability mismatch.
- [ ] UI nêu rõ login do người dùng thực hiện, in-flight attempts không bị cancel khi pause và local profiles chứa ChatGPT session data.
- [ ] Dùng semantic design tokens; không thêm ad-hoc color/layout values.
- [ ] Viết tests cho schema migration, invalid persisted data, user switching, reset preservation, active-lease errors và loading/error/empty states.
- [ ] Chạy Desktop tests/type-check/build; runtime mở Settings và thực hiện add/open/reset/remove flow trước Task 6.

### Task 6: Cut provider contracts và backend prepared snapshots sang `CHATGPT_WEB`

**Files:**
- Modify: `packages/client-contracts/src/generation.ts`
- Modify: `packages/client-contracts/src/chapter.ts`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/api/request/AnalyzeChapterRequest.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/api/request/CreateMediaJobRequest.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/command/EnqueueStoryAnalysisCommand.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/domain/aggregate/GenerationJob.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/usecase/CreateMediaJobUseCase.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/usecase/PrepareStoryboardGenerationBatchUseCase.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/infrastructure/prompt/VisualBeatPromptContextAdapter.java`
- Rename: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/api/response/VisualBeatGeminiContextResponse.java` -> `VisualBeatWebGenerationContextResponse.java`
- Modify: `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/api/controller/ProjectGenerationController.java`
- Create: `app/backend-service/src/main/resources/db/migration/V9__chatgpt_web_provider_cutover.sql`
- Modify: `app/ai-worker/src/narrativex_worker/schema.py`
- Modify: corresponding backend generation tests and `app/ai-worker/tests/test_chapter_analysis_prompts.py`

- [ ] Canonicalize new IMAGE requests to `CHATGPT_WEB`; reject new selectable `GEMINI_WEB` after compatibility deadline while still rehydrating historical rows safely.
- [ ] Keep API image path `API` unchanged; `CHATGPT_WEB` returns the existing “per-beat Desktop generation; no API media job” behavior.
- [ ] Add provider-neutral Web generation context/batch routes; keep old Gemini route aliases only during compatibility window and mark them deprecated.
- [ ] Change provider policy to `chatgpt-web-images-v1`, include provider key/version in fingerprints và make Gemini-prepared batches stale/non-dispatchable.
- [ ] Replace provider-specific validation text and reference-cap message; keep conservative max 3 until compatibility matrix proves a different bound.
- [ ] V9 expands DB constraint to accept `CHATGPT_WEB` while preserving historical `GEMINI_WEB`; do not falsify immutable/audit history.
- [ ] Worker accepts `CHATGPT_WEB` only as chapter-analysis preference; do not register a ChatGPT image provider or execute browser work in Python.
- [ ] Add/update contract, domain, idempotency, stale-policy, legacy-rehydrate and migration tests for both fresh DB and supported upgrade path.
- [ ] Run backend targeted tests, PostgreSQL migration integration when Docker is available, worker prompt/schema tests, then continue only when green.

### Task 7: Migrate Character and Storyboard queues/UI to ChatGPT Web

**Files:**
- Rename/create equivalents under `app/desktop/src/renderer/features/characters/` for `character-gemini-queue*` and `CharacterGeminiQueueBanner.tsx`
- Rename/create equivalents under `app/desktop/src/renderer/features/storyboard/` for `gemini-queue*`, `GeminiQueueBanner.tsx` and run controller
- Modify: `app/desktop/src/renderer/features/characters/screens/CharactersScreen.tsx`
- Modify: `app/desktop/src/renderer/features/storyboard/screens/StoryboardScreen.tsx`
- Modify: `app/desktop/src/renderer/features/storyboard/components/VisualBeatGrid.tsx`
- Modify: `app/desktop/src/renderer/features/storyboard/queries/storyboard-media.mutations.ts`
- Modify: `app/desktop/src/renderer/features/storyboard/api/storyboard.api.ts`
- Modify: `app/desktop/src/renderer/features/generation/api/generation.api.ts`
- Modify: `app/desktop/src/renderer/features/generation/screens/ImagesScreen.tsx`
- Modify: `app/desktop/src/renderer/features/chapters/api/chapter-workspace-contract.ts`
- Modify: `app/desktop/src/renderer/features/chapters/queries/chapter-analysis.queries.ts`
- Modify: `app/desktop/src/renderer/features/chapters/components/AnalyzeChapterDialog.tsx`
- Modify: `app/desktop/src/renderer/features/chapters/components/ChapterEditorPanel.tsx`
- Modify: `app/desktop/src/renderer/features/chapters/screens/ChaptersScreen.tsx`
- Rename/update corresponding `character-gemini-*`, `storyboard-gemini-*`, voice contract, UI refinement and media workflow tests under `app/desktop/test/`

- [ ] Replace selectable provider/labels/defaults with `CHATGPT_WEB`; API remains optional separate provider.
- [ ] Preserve Character single/all and Storyboard single/all, bounded parallelism, pause/resume/skip, progress counts và navigation survival.
- [ ] Storyboard uses immutable prepared ChatGPT batch prompt/ref bindings; character path uses backend-owned CharacterVersion prompt and same trusted main capability.
- [ ] Persist renderer `SUBMITTING` before IPC; reconcile journal on restart before dispatch.
- [ ] Migrate only unsubmitted legacy queue work; quarantine Gemini `SUBMITTING/UNKNOWN`, surface manual reconcile/skip and never transfer attempt id across providers.
- [ ] Completed generated asset commit remains success even if subsequent cache invalidation fails; newly attached preview resets review to `NEEDS_REVIEW`.
- [ ] Add loading/error/empty/stale/login-required/rate-limited/selector-drift/unknown states with actionable Vietnamese copy.
- [ ] Update tests for queue migration, crash windows, stale output, cache invalidation, concurrency, no browser id in renderer request and no absolute path/cookie exposure.
- [ ] Run Desktop tests/type-check/build; perform real runtime flows on all affected screens and capture screenshots.

### Task 8: Dark launch observability, soak và rollback readiness

**Files:**
- Create: `app/desktop/src/main/chatgpt-web/chatgpt-web-health.ts`
- Modify: `app/desktop/src/main/chatgpt-web/chatgpt-web-ipc.ts`
- Modify: `app/desktop/src/main/chatgpt-web/chatgpt-browser-pool.ts`
- Modify: `app/desktop/src/renderer/features/settings/components/ChatGptBrowserSettings.tsx`
- Create: `app/desktop/test/chatgpt-web-health.test.mjs`
- Modify: `documentation/release/CHATGPT_WEB_COMPATIBILITY_MATRIX.md`

- [ ] Record device-local privacy-safe metrics: attempt stage counts, lane, duration bucket, capture outcome và sanitized error code; never prompt/ref text, URL query, cookie/token/path.
- [ ] Add startup/runtime capability canary; selector drift disables new submissions but does not mutate pending journal entries.
- [ ] Implement one release-scoped dark-launch flag and explicit rollback selector; no attempt can switch provider after `SUBMITTING`.
- [ ] Exercise Chrome crash, app restart, login expiry, offline, rate limit, refusal, stale batch and ambiguous post-submit outcome.
- [ ] Add deterministic health/redaction/rollback tests and verify no fake success is exposed as production health.
- [ ] Record actual soak evidence against every stability criterion; unresolved gaps use `[!]` and block Task 9.

### Task 9: Xóa operational Gemini Web sau stability gate

**Precondition:** Task 8 evidence đạt toàn bộ stability gate và ADR-0027 đã được chuyển sang Accepted. Nếu chưa đạt, không bắt đầu task này.

**Files:**
- Delete: `app/desktop/src/main/gemini-web/` operational implementation
- Delete: `app/desktop/src/shared/gemini-web-lanes.ts`
- Delete/rename: Gemini renderer queue/hooks/components and Gemini-specific tests under `app/desktop/src/renderer/` and `app/desktop/test/`
- Modify: `app/desktop/src/main/bootstrap-core.ts`
- Modify: `app/desktop/src/main/preferences/desktop-preferences.ts`
- Modify: `app/desktop/src/main/preferences/desktop-preferences-ipc.ts`
- Modify: `app/desktop/src/preload/index.ts`
- Modify: `app/desktop/src/preload/types.ts`
- Modify: `app/desktop/.env.example`
- Modify: root `.env.example`
- Create: `app/backend-service/src/main/resources/db/migration/V10__retire_gemini_web_provider.sql`
- Modify: backend/client/worker compatibility code and tests from Task 6

- [ ] Remove Gemini browser bootstrap, IPC, preferences, env vars, selector/automation/pool/journal and selectable provider branches.
- [ ] Remove deprecated Gemini-named backend route aliases and client calls; keep provider-neutral ChatGPT/Web routes.
- [ ] V10 blocks new `GEMINI_WEB` writes while preserving historical audit readability; do not relabel old Gemini outputs as ChatGPT.
- [ ] Purge only known legacy Gemini browser-profile/session roots after stopping owned Chrome processes, resolving absolute targets under Electron userData và honoring the recorded cleanup approval; never touch ProjectStorage/generated assets or unknown directories.
- [ ] Remove or genericize Gemini watermark/postprocessing utilities only after proving no non-Gemini/historical-media consumer remains; never strip ChatGPT provenance metadata.
- [ ] Delete legacy queue storage keys only after `SUBMITTING/UNKNOWN` attempts have been reconciled or explicitly retained for audit.
- [ ] Update tests to assert no operational `window.narrativex.geminiWeb`, `GEMINI_WEB` selection, Gemini env config or Gemini runtime import remains.
- [ ] Run all Desktop/backend/worker tests and supported DB upgrade tests before documentation cleanup.

### Task 10: Final documentation, runtime verification và quality gate

**Files:**
- Modify: `README.md`
- Modify: `AI_CONTEXT.md`
- Modify: `CONTRIBUTING.md`
- Modify: `app/desktop/README.md`
- Modify: `documentation/README.md`
- Modify: `documentation/TRACEABILITY.md`
- Modify: `documentation/architecture/SYSTEM_ARCHITECTURE.md`
- Modify: `documentation/architecture/TECHNOLOGY_STACK.md`
- Modify: `documentation/codebase/CODEBASE_MAP.md`
- Modify: `documentation/codebase/DESKTOP_RENDERER_STRUCTURE.md`
- Modify: `documentation/product/PRODUCT_SPEC.md`
- Modify: `documentation/product/FEATURE_CATALOG.md`
- Modify: `documentation/product/ROADMAP.md`
- Modify: `documentation/workflows/IMAGE_GENERATION.md`
- Modify: `documentation/decisions/ADR-0027-desktop-chatgpt-web-image-generation.md`
- Modify: `documentation/decisions/ADR-0021-desktop-gemini-web-image-generation.md`
- Modify: this plan

- [ ] Mark ADR-0027 Accepted and ADR-0021 Superseded only after cutover evidence exists; historical plan/release records remain historical.
- [ ] Update current-state docs from actual code and migration directory; remove Gemini operational claims without rewriting history.
- [ ] Backend: run `app/backend-service/mvnw.cmd verify` and record pass/skip counts.
- [ ] Worker: run `python -m pytest`, `python -m ruff check .`, `python -m mypy src` from `app/ai-worker`.
- [ ] Desktop: run `npm run check` from `app/desktop`.
- [ ] Root: run `powershell -File scripts/verify-local.ps1` and `python scripts/check-docs-drift.py`.
- [ ] Run fresh and supported-upgrade PostgreSQL migration tests; skipped Testcontainers are a gap, not a pass.
- [ ] Start/reuse Electron/Vite, navigate Settings/Characters/Chapters/Images/Storyboard, execute actual ChatGPT flows, inspect console/failed network/loading/error/empty/overflow and capture screenshot evidence.
- [ ] Verify packaged Windows build with real Chrome and authorized ChatGPT account; no credentials/secrets/absolute paths appear in logs, renderer or backend payloads.
- [ ] Update every checkbox/evidence/blocker; move plan to `docs/plans/completed/` only when all required gates genuinely pass.

## Post-Completion

**External approval**

- Legal/product must confirm that the intended ChatGPT Web automation and automated output saving are permitted for the target account/product/distribution model. Current public terms are a blocker without that confirmation.

**Authenticated runtime validation**

- Use test accounts/profiles authorized for this purpose; never ask developers to provide passwords/tokens to NarrativeX.
- Re-run the compatibility matrix after material ChatGPT UI/model/Save-flow changes.
- Observe first production cohort for selector drift, login challenges, rate limits and `UNKNOWN` attempts before widening rollout.

**Operational recovery**

- If compliance is withdrawn or UI compatibility falls below the gate before Gemini cleanup, roll back to Gemini without replaying in-flight ChatGPT attempts.
- After Gemini cleanup, disable new ChatGPT submissions and preserve journals/assets if a regression occurs; do not silently switch an existing attempt to API or another account.

## Acceptance Criteria

- ChatGPT Web, not OpenAI API, creates Character identity and Storyboard images through visible user-owned Chrome profiles.
- Backend exact prompts, references, revisions, policy versions and fingerprints remain authoritative and immutable.
- Renderer never receives credentials, cookies, CDP endpoint, browser profile path, staged absolute path or general filesystem/browser control.
- `SUBMITTING/UNKNOWN` attempts cannot blind-resubmit across app/browser crash, restart, pause/resume or provider migration.
- Generated images validate and commit local-first with stable metadata/checksum; stale output is not attached to newer state.
- Generate All preserves bounded global concurrency, pause/resume/skip and multi-profile isolation.
- ChatGPT refusal/rate-limit/login/selector/output errors are distinguishable and recoverable without bypass.
- Gemini operational code/config/profile is removed only after the measurable stability gate; historical generated media and audit history remain intact.
- Automated gates pass and every affected Desktop flow has runtime screenshot evidence, otherwise the work remains runtime-verification blocked.
