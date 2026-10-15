# Plan chi tiết: tab Account, Google OAuth và Antigravity API trực tiếp

**Ngày cập nhật:** 2026-10-14. **Phiên bản:** 2. **Trạng thái:** PARTIAL route / TARGET OAuth, registry và chapter selection.

**Yêu cầu đã xác nhận:** Đăng nhập Google và quản lý account từ NarrativeX, sau đó gọi **API Antigravity trực tiếp bằng Google OAuth**, giống mô hình kết nối của 9Router/Cockpit. Không cần cài/mở/đăng nhập trong Antigravity IDE hoặc chạy CLI. Gemini CLI, API key và Vertex không thay thế flow đã chọn.

Plan này sở hữu Account UX/login lifecycle; [plan phân tích bản 3](ANTIGRAVITY_STORY_ANALYSIS_IMPLEMENTATION_PLAN.md) sở hữu execution, scheduler, journal, recovery và materialization. [Research OAuth/API](ANTIGRAVITY_OAUTH_API_RESEARCH.md) ghi reference và giới hạn provider. Tên file/route hiện có được giữ.

## 1. Kết quả người dùng nhận được

1. Mục **Account** ở Projects và link từ Settings, vào được khi chưa tạo project; sidebar workspace giữ các mục thuộc project.
2. **Thêm tài khoản → Đăng nhập Google** ngay từ Account; trang Google authorization mở bằng system browser, callback tự về NarrativeX. App hiển thị tiến độ/kết quả; không yêu cầu chuyển sang Antigravity/terminal hoặc copy token.
3. Account list/detail có tên, email an toàn nếu lấy được, trạng thái đăng nhập, provider binding, model và quota observations.
4. Chọn account/model mặc định; Chapter Source thấy lựa chọn trước Analyze và cho pin account khi phù hợp.
5. Đổi tên, pause, reconnect, disconnect/retire đúng lifecycle, giữ project/kết quả cũ.
6. Nhiều account có token độc lập; backend chọn account và áp limits. Một account và pool nghiệm thu riêng.

**V1:** Account, OAuth/reconnect, protected tokens, registry/defaults, một chapter thật và recovery. Batch/round-robin là mốc kế tiếp của plan gốc. Account là provider connection, không tạo đăng nhập hoặc User/Session/tenant của NarrativeX theo ADR-0020.

## 2. Hiện trạng, TARGET và các khái niệm

| Thành phần | Hiện trạng trong source | TARGET |
| --- | --- | --- |
| Routing | `/account` và `/settings` là route cấp ứng dụng; có Projects entry và validated return context; workspace sidebar chỉ có các mục project | Reuse route/navigation |
| AccountScreen | Restriction notice, Connect disabled; chưa có danh sách hoặc login thật | List/detail, Google OAuth CTA và actual state |
| Shared contracts | Runtime/credential/quota/provenance foundations còn dùng `ANTIGRAVITY_CLI` | Thêm `ANTIGRAVITY_API`/OAuth operations; giữ legacy decoding |
| PostgreSQL | V13 runtime/credential/snapshot/attempt store | Reuse metadata store; forward migration nếu constraints/fields cần đổi |
| Electron main | Chưa có OAuth callback/vault/direct API client cho feature | T06/T07 của plan phân tích |
| Backend | Admission/Vertex materialization và foundations đã có | Registry/config/device API/snapshot selection/finalizer còn TARGET |
| Runtime evidence | Browser restriction screen có evidence cũ; native Electron gate chưa đạt | Login/API thật và screenshots các flow mới chưa kiểm chứng |

| Khái niệm | Hiển thị / ý nghĩa |
| --- | --- |
| Provider | `Antigravity · Google OAuth`; HTTP API transport do Electron main thực hiện |
| Account connection | Label/email an toàn, opaque `credentialRef`; không phải NarrativeX account |
| Google AI Pro/Ultra | Gói subscription; nhãn tự khai báo phải ghi rõ, không mặc định verified entitlement |
| Provider project | Binding upstream riêng từng credential; khác Project NarrativeX, không bắt người dùng nhập project ID vào form |
| Model | Slug thực tế/capability đã kiểm chứng; gói Pro/Ultra không phải tên model |
| Quota | Observation có thời điểm; không suy quota % từ usage hoặc tự khai báo gói |

Thay transport không làm UI hiện tại tự hoạt động. Bản sửa này chỉ cập nhật tài liệu. Điều khoản/provider support được ghi trong research; code mới không được hard-code kết luận “mọi Google account không thể kết nối” từ phương án binary cũ. Auth và API readiness phải có trạng thái riêng theo bằng chứng.

## 3. Thiết kế Account

- Route chuẩn `#/account`, application-scoped; entry ở Projects và link từ Settings, không đặt trong sidebar workspace. Không tải project dataset để vào. Return context là internal route đã validate, giữ project/chapter khi quay lại.
- Header **Account**, mô tả `Kết nối tài khoản AI dùng để phân tích chapter`; nút **Thêm tài khoản** và **Kiểm tra lại**.
- List + detail, màn hình hẹp xếp dọc. Empty state có **Đăng nhập Google**; không có bước “Cài Antigravity CLI”.
- Dialog kết nối ghi provider **Antigravity · Google OAuth**, label tùy chọn; một CTA đăng nhập. Gói tự khai báo chỉnh sau login, không làm precondition cho OAuth.
- Detail hiển thị auth/binding/model/quota freshness, reconnect/pause/disconnect/retire; **Dùng mặc định** chỉ active khi account/model ready.
- Panel **Mặc định phân tích chapter**: account/model/effort được hỗ trợ và concurrency. Advanced pool settings chỉ bật sau isolation evidence.
- Thay restriction-only placeholder bằng flow trên khi code OAuth/registry có thật; không chỉ enable nút để giả lập login. Thông tin giới hạn provider đặt trong phần trợ giúp, không hiển thị như kết luận đăng nhập thành công/không thành công của mọi account.
- Reuse Button/Dialog/Select/Badge, semantic tokens và accessibility conventions. Không hard-code màu theo gói.

```text
Account                                 [Kiểm tra lại] [Thêm tài khoản]
Kết nối tài khoản AI dùng để phân tích chapter

KẾT NỐI                                 CHI TIẾT
Google chính · email đã xác minh         Antigravity · Google OAuth
Sẵn sàng · Quota chưa rõ                 Model [model khả dụng]
                                        Kiểm tra gần nhất: ...
Google phụ                              [Dùng mặc định] [Kết nối lại]
Cần đăng nhập lại                        [Tạm ngưng] [Ngắt kết nối] [Gỡ]

MẶC ĐỊNH PHÂN TÍCH CHAPTER
Account [Google chính] Model [model] Effort [nếu hỗ trợ]
Chạy đồng thời [1]                                    [Lưu mặc định]
```

Wireframe là TARGET, không phải screenshot đã triển khai.

| Trạng thái | Nội dung / hành động |
| --- | --- |
| Loading | Skeleton; không flash danh sách rỗng |
| Empty | Giải thích ngắn + Đăng nhập Google |
| OAuth config chưa sẵn sàng | Reason code cấu hình client/callback/scopes; không hướng dẫn cài binary |
| Opening browser / Awaiting consent | Progress, hủy và timeout; tab khác vẫn dùng được |
| Exchanging / Verifying / Saving | Phân biệt auth, binding và backend registry ACK |
| Signed in / Binding chưa ready | Đã đăng nhập Google; API/model chưa sẵn sàng; lý do/recheck |
| Ready | Auth + binding + model + runtime observation còn mới |
| AUTH_REQUIRED | Metadata được giữ, reconnect; dừng assignment mới |
| Rate limited / Exhausted | Scope/thời điểm/reset thực nếu có; không fabricated countdown |
| Quota unknown | “Chưa rõ”; không progress bar 0% hoặc 100% giả |
| Draining / UNKNOWN | Giữ credential phục vụ run/reconcile; disable destructive lifecycle action |
| Backend offline / CAS conflict | Giữ stale data có nhãn, retry/refetch; không báo đã lưu |
| Rejected / restricted provider access | Mã lỗi đã redaction của kết nối/API; không tự đổi provider/account |

## 4. Luồng người dùng

### 4.1. Thêm account và Google login

1. **Thêm tài khoản → Đăng nhập Google.** Preload gọi main với operation ID và metadata an toàn; không nhận arbitrary URL/scopes/tokens từ renderer.
2. Main tạo state/PKCE S256/loopback callback + timeout; system browser mở Google account chooser/consent của client profile tương thích Antigravity. NarrativeX chờ callback và hiển thị progress.
3. Callback chỉ vào main; validate state/path/operation generation/verifier và identity/scopes. Hủy/timeout đóng listener, callback muộn không tạo connection. Double click chỉ có một operation đang active.
4. Main bảo vệ refresh token trong local store riêng từng credential; access token ưu tiên memory. Plaintext fallback bị từ chối. Lấy identity/provider project/model theo adapter đã pin; onboarding có checkpoint/reconcile như plan gốc.
5. Report opaque binding/capability, backend upsert registry/dedup và ACK. Token/code/verifier/raw Google subject không đi qua renderer hoặc PostgreSQL. Email hiển thị chỉ từ metadata đã xác minh và được tối thiểu hóa.
6. UI tách **Đăng nhập Google thành công**, **Đã lưu account** và **Sẵn sàng phân tích**. Backend offline sau OAuth hiển thị registration pending và retry metadata, không bắt login lại hoặc tạo account mới.
7. **Dùng mặc định** lưu config revision/CAS riêng; không tự Analyze hoặc mở inference để kiểm quota sau login.

Refresh single-flight theo credential, không thay generation cho routine token rotation. `invalid_grant` yêu cầu reconnect; job không tự mở login window. Cùng verified identity không tăng quota capacity bằng label/ref mới.

### 4.2. Chọn account và Analyze chapter

1. Chapter Source hiển thị `Antigravity · <account label> · <model>`, trạng thái và link **Quản lý Account** có return context.
2. Người dùng chọn mặc định hoặc pin account cho request; backend validate enabled/readiness/model/current revision.
3. Enqueue giữ Idempotency-Key và freeze `ANTIGRAVITY_API`, model/effort, config/source/prompt/schema và selection policy. Replay dùng snapshot cũ; explicit input/selection khác trả conflict.
4. Backend claim chốt credentialRef/generation/lease/fence. Main lấy token đúng binding, gọi HTTP API một lần và journal result. Backend validate/materialize nguyên tử.
5. UI hiển thị Queued/Running/Delivery pending/Completed hoặc typed error/UNKNOWN. Đổi mặc định không đổi job đã enqueue.
6. Kết quả giữ opaque account/model/attempt provenance và usage thực. Không fabrication timing hoặc thay approved/locked data.

Pinned account bị disable trước claim: job chờ với lý do; user có thể cancel/enqueue lại bằng lựa chọn khác. Timeout/UNKNOWN không tự đổi account/model hoặc gọi Vertex. Batch/pool dùng scheduler plan gốc.

### 4.3. Reconnect, pause, disconnect và retire

- Rename/gói tự khai báo: metadata-only, CAS; không đổi identity/entitlement.
- Pause: dừng assignment mới; job hiện có tiếp tục, bật lại kiểm observation mới.
- Reconnect: drain nếu có thể thay binding đang dùng; cùng identity tăng credential generation, khác identity tạo connection mới. Callback cũ không ghi đè vault mới.
- Disconnect: drain active và UNKNOWN trước khi xóa/revoke tokens cần cho recovery. Revoke có thể tác động toàn OAuth grant/client; kiểm chứng và hiển thị scope thực trước thao tác.
- Retire: metadata tombstone, giữ historical run refs; local token deletion và Google grant revocation là kết quả khác nhau phải báo đúng.
- UNKNOWN: giữ fence/binding đến reconcile; abort/timeout/socket close không chứng minh provider dừng. Result đã journal chỉ retry delivery.
- Settings reset layout và project backup/export không xóa hoặc mang provider tokens/journal.

## 5. Phân chia kỹ thuật và contracts

| Lớp | Trách nhiệm |
| --- | --- |
| Renderer | Route/list/detail/forms/defaults/chapter selection; redacted DTO/query cache |
| Preload | Typed OAuth operations/events và sender validation; không token getter/generic proxy |
| Main | Callback/PKCE, vault, refresh/binding/probe/API client, journal và device reporting |
| Backend | Desired config/registry/admission/selection/jobs/leases/materialization |
| PostgreSQL | Opaque metadata/snapshots/attempts; không provider secrets |
| Generation service | Không tham gia Google login hoặc chapter analysis |

Reuse mục 8 của plan gốc. Bridge TARGET: `storyAnalysis.connect/cancelConnect/reconnect/disconnect/status/subscribeStatus`; CRUD/defaults qua backend transport hiện có. OAuth callback listener chỉ loopback trong thời gian operation; không tạo server inference/proxy riêng.

DTO cần chốt: redacted operation ID/stage/reason, auth state tách analysis readiness, safe display metadata, credential generation, tier source, quota freshness, models/effort capabilities, drain/retired và config revision. Backend observations dùng paired device + runtimeEpoch + monotonic sequence/expiry; renderer không tự đặt verified flags.

Reuse V13/MyBatis; thêm API enums/checkpoints/provenance khi cần bằng migration phù hợp applied history. Không sửa checksum đã apply/reset DB/tạo business accounts table. Token vault không là nguồn cấu hình scheduling thứ hai.

## 6. Checklist triển khai

Ký hiệu `D/DT/B/BT/C` theo plan gốc. Tên file mới là đề xuất; reuse seam hiện có. Tests/checks dưới đây thuộc implementation, chưa chạy lại trong lần sửa tài liệu.

### A00 — Khóa scope và OAuth/API evidence

**Files:** Hai plan, research OAuth/API và ADR-0033 Proposed.

- [x] Xác nhận scope trực tiếp Antigravity API/Google OAuth, không dependency binary.
- [ ] Pin client profile/scopes/redirect/API adapter và sanitized fixtures; đối chiếu provider access classification.
- [ ] Ghi riêng auth/binding/inference/multi-account readiness; bỏ gate binary/keyring/process sandbox của plan cũ.

### A01 — Shared contracts và account operations

**Files:** `C/story-analysis.ts`, `C/index.ts`, safe IPC DTOs; contract tests.

- [ ] API execution mode/provenance; OAuth operation stages/reasons, redacted summaries và default/pinned selection.
- [ ] Legacy CLI profiles không bị hiểu thành API; ordinary refresh không đổi generation của attempt.
- [ ] Test redaction, unknown quota/usage, tier source, stale operation và legacy decoding; typecheck.

### A02 — Backend registry/config/defaults

**Files:** T02/T03 store/services/controllers, client backend API/queries; backend/PostgreSQL tests.

- [ ] Registry/list/metadata/CAS/defaults và monotonic device observations; duplicate binding không tăng slots.
- [ ] Drain/retire preserves historical refs; stale report không bật lại disabled account.
- [ ] Test conflict/reconnect/UNKNOWN/offline metadata delivery; kiểm migration/apply history khi schema đổi.

### A03 — Main OAuth, vault và typed bridge

**Files:** T06 OAuth/token store/credential registry/capabilities; `story-analysis-ipc.ts`, bootstrap/preload; OAuth/IPC/credential tests.

- [ ] PKCE/state/loopback callback, system browser, cancel/timeout/correlation; safe operation events.
- [ ] Per-account protected storage/refresh; scopes/identity/binding verification; pending metadata replay.
- [ ] Test callback attacks/races, double click, storage unavailable, invalid_grant, wrong identity và redaction; native evidence riêng.

### A04 — Reuse route/navigation đã có

**Files:** `DesktopRouter.tsx`, `WorkspaceShell.tsx`, `ProjectsScreen.tsx`, `SettingsScreen.tsx`, account navigation; navigation tests.

- [x] `/account`, Projects entry và FeaturePage header đã có; sidebar Workspace giữ các mục project.
- [x] Return context validation; Account và Settings không cần project data.
- [ ] Verify actual Projects/Chapter → Account → quay lại, no-project/refresh/back/forward và invalid return route.
- [ ] Capture native screenshots, console/API/layout evidence.

**Evidence trước bản sửa này:** Plan cũ ghi Desktop tests 351 passed/7 skipped, typecheck/build pass ngày 2026-10-14; Electron launch chưa có native surface nên gate vẫn runtime-verification blocked. Các checks đó không được chạy lại trong lần sửa plan và không chứng minh OAuth/API mới.

**UI scope follow-up 2026-10-14:** Account and Settings are application-scoped and reachable from Projects before opening a project. Neither shortcut belongs in the project-only workspace sidebar. Settings retains the Account link and application reset controls, and the legacy project Settings URL redirects to application Settings while preserving the workspace return path. This follow-up has not received runtime verification.

### A05 — Account list/detail/connect/defaults UI

**Files:** `AccountScreen.tsx`, `AccountList.tsx`, `AccountDetails.tsx`, `ConnectAccountDialog.tsx`, `AnalysisDefaultsPanel.tsx`, accounts API/queries; account tests.

- [ ] Thay restriction-only screen bằng list/detail/Google login CTA nối contracts thật; empty state không yêu cầu cài CLI.
- [ ] Connect/cancel/reconnect/rename/pause/drain/disconnect/retire/defaults và toàn bộ states mục 3; report đúng auth/binding/save/readiness.
- [ ] Test loading/empty/stale/errors/offline/CAS/quota unknown, keyboard/focus/event cleanup; runtime dialogs/forms/themes/viewport/screenshots.

### A06 — Account selection tại Chapter Analyze

**Files:** `ChapterSourceStage.tsx`, generation API/types/queries và T04 enqueue/profile/request; enqueue/Desktop tests.

- [ ] Hiện account/model + Account return link, default/pinned selection và backend validation.
- [ ] Freeze API mode/selection; legacy snapshots giữ route, không inference fallback khi account mất readiness.
- [ ] Test disabled/deleted/pinned account, default/source change, duplicate Analyze và round trip Account; native real-backend flow.

### A07 — Nghiệm thu một account thật

**Files:** T05–T11 plan gốc, opt-in live tests và sanitized review evidence.

- [ ] Account → Google OAuth → model/default → chapter Analyze → scenes/storybeats/cues thật → reload/provenance.
- [ ] Intent trước HTTP request, journal trước complete; restart/cancel/timeout/UNKNOWN/delivery và source race.
- [ ] Auth refresh/invalid_grant/quota/refusal/output limit/schema; verify secrets storage/IPC, không trả success từ fixture như production.
- [ ] Native evidence/adapter/client profile revisions đầy đủ; một account pass không hoàn thành pool.

### A08 — Nhiều account và điều phối

**Files:** T12 scheduler/vault, Account capability controls và isolation/live scenarios.

- [ ] A/B đúng token/identity/binding; refresh/reconnect/logout riêng, verify grant-wide revocation scope và duplicate dedup.
- [ ] Bật thêm account/manual pin/AUTO_READY/round-robin bằng backend limits; benchmark trước tăng concurrency.
- [ ] Test all exhausted/stale quota/two projects/drain/UNKNOWN; không rotate để blind-resubmit hoặc vượt refusal.

### A09 — Completion gate và tài liệu

**Files:** Hai plan, CURRENT_STATUS/README, ADR-0033; DATABASE/inventory nếu schema đổi.

- [ ] Scoped backend/Desktop checks khi implementation; full `pwsh -File scripts/verify-local.ps1` trước push/merge.
- [ ] Runtime automation mọi màn hình/flow bị ảnh hưởng với real APIs, console/failed requests/loading/error/empty/overflow và screenshots.
- [ ] Native OAuth/vault/callback được verify; browser fixtures không thay Electron evidence. Không có automation thì runtime-verification blocked.
- [ ] Docs drift/links/inventory/whitespace pass; trạng thái IMPLEMENTED/PARTIAL/TARGET/DEFERRED đúng evidence.

## 7. Phụ thuộc, nghiệm thu và rollout

**Thứ tự:** A00 → A01 → A02/A03 → A04/A05 → A06 → A07 → A09 cho một account; A08 cần isolation proof và A07. Provider-independent UI/contracts có thể chuẩn bị trước live-account tests. Không yêu cầu sub-agent hoặc worktree mới.

**Nghiệm thu:** Account dùng được trước project; login bắt đầu/kết thúc trong flow NarrativeX; Google authorization dùng system browser; không binary dependency; auth/binding/readiness riêng; secrets được bảo vệ; backend xác nhận defaults/pinned selection; chapter thật có validated result/provenance; drain/reconnect/UNKNOWN không double-submit; A/B và concurrency kiểm riêng; native UI/full gate đầy đủ trước merge.

**Rollout:** API mode opt-in cho job mới sau runtime evidence/ADR review. Job cũ và unresolved attempts giữ snapshot/transport/binding. Rollback ngừng admission API mới, giữ journals/refs/fences để reconcile, không chuyển job sang Vertex hoặc xóa evidence.

**Giới hạn lần sửa:** Chỉ thay plan và tài liệu liên quan; chưa sửa Account UI, cài tool, đăng nhập, lấy token hoặc gọi inference thật. [Research](ANTIGRAVITY_OAUTH_API_RESEARCH.md) tiếp tục ghi rõ giới hạn kỹ thuật và provider support của hướng API trực tiếp.
