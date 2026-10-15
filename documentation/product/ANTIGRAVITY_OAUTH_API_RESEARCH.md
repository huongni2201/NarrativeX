# Research: Antigravity HTTP API và Google OAuth

**Ngày đối chiếu:** 2026-10-14. **Trạng thái:** RESEARCH / TARGET. Chưa đăng nhập, lấy token hoặc gửi inference bằng account thật trong NarrativeX.

**Scope đã xác nhận:** API Antigravity trực tiếp qua Google OAuth, do NarrativeX khởi động/quản lý từ Account. Đây là bản nghiên cứu cho [plan phân tích v3](ANTIGRAVITY_STORY_ANALYSIS_IMPLEMENTATION_PLAN.md) và [Account plan v2](ACCOUNT_TAB_IMPLEMENTATION_PLAN.md). Cài/chạy Antigravity IDE hoặc CLI không thuộc hướng đã chọn.

## 1. Bằng chứng nguồn

| Nguồn primary | Quan sát | Cách sử dụng trong plan |
| --- | --- | --- |
| [9Router OAuth service](https://github.com/decolua/9router/blob/master/src/lib/oauth/services/antigravity.js) | Tạo Google authorization URL, exchange code, lấy user info; dùng loadCodeAssist/onboardUser cho provider project/tier | Reference luồng OAuth → account → provider binding |
| [9Router Antigravity executor](https://github.com/decolua/9router/blob/master/open-sse/executors/antigravity.js) | Bearer-auth HTTP inference qua v1internal generateContent/streamGenerateContent; request gắn project/model/request và có refresh credentials | Reference transport trực tiếp; không cần binary/phiên IDE để adapter thực hiện HTTP |
| [9Router provider guide](https://github.com/decolua/9router/blob/master/gitbook/content/en/providers/subscription.md) | Kết nối Antigravity bằng Google OAuth từ dashboard | Reference UX connect/reconnect do ứng dụng quản lý |
| [Google desktop OAuth](https://developers.google.com/identity/protocols/oauth2/native-app) | Installed apps dùng authorization code, PKCE và system browser/local redirect | Thiết kế callback an toàn trong Electron main |
| [Antigravity Terms, mục 6](https://www.antigravity.google/terms) | Hạn chế truy cập dịch vụ bằng phần mềm bên thứ ba; có rủi ro đình chỉ/chấm dứt account | Provider support/access classification vẫn RESTRICTED theo văn bản đang công bố |

Đã dùng Context7 resolve-library-id rồi query-docs cho `/decolua/9router`; đối chiếu source gốc và docs Google. Các link code ở branch master có thể thay đổi; **chưa pin commit**. Implementation phải ghi commit/adapter revision và sanitized fixtures trước coi giao thức ổn định.

Cockpit là tham chiếu trải nghiệm người dùng nêu ra; lần đối chiếu này dùng 9Router làm bằng chứng kỹ thuật. Không khẳng định mọi sản phẩm tên Cockpit có cùng OAuth client, API hoặc storage.

## 2. Kết luận cho hướng được chọn

Có bằng chứng triển khai bên thứ ba cho mô hình **Google OAuth → tokens/account → provider binding → HTTP inference trực tiếp**. Đây là cơ sở thiết kế bản 3; chưa chứng minh NarrativeX đã tương thích, được provider hỗ trợ hoặc dùng được quota Pro/Ultra.

“Không thông qua Antigravity” được hiểu là bỏ dependency ứng dụng/CLI/session local của Antigravity. Dịch vụ upstream vẫn là Antigravity. Đổi sang HTTP không thay điều khoản dịch vụ; không ghi SUPPORTED chỉ từ việc OAuth trả tokens hoặc router có source public.

`ANTIGRAVITY_API` là tên execution mode TARGET của NarrativeX. Gemini CLI, Vertex và Gemini API key là các auth/transport khác; không thay vào flow này hoặc dùng làm fallback ngầm.

## 3. Những điểm phải khóa trong spike implementation

### OAuth client và provider binding

- Xác định client profile tương thích Antigravity: client identity/quyền sử dụng, scopes thực cần, redirect, PKCE và exchange/refresh contract. Một Google Sign-In client/token bất kỳ không mặc định được quyền gọi dịch vụ này.
- Desktop OAuth do NarrativeX bắt đầu; Google authorization dùng system browser, callback loopback chỉ vào main. State/PKCE/operation generation, one-time callback, cancel/timeout và scope/identity verification cần regression coverage.
- Main quản lý protected tokens riêng từng credential. Không copy Antigravity cookie/cache/keyring, không thu mật khẩu, không đưa secrets vào renderer/PostgreSQL/logs/export/fixtures.
- Lấy provider project/eligibility từ response thật; không sinh ID thay thế hoặc tự tạo GCP project/bật billing. Onboarding có operation checkpoint và reconcile khi mất ACK.
- Không sao chép cách lưu/gửi tokens lên server của reference: NarrativeX giữ tokens local theo ADR-0020. Cùng provider identity phải dedup, routine refresh không nhân đôi connection/capacity.

### Inference contract

- Pin upstream host/API revision, headers, model/effort mapping, request envelope và actual response schema. Không giả định endpoint là public SDK contract.
- Chọn JSON hoặc SSE đã kiểm chứng; test malformed/truncated stream, terminal outcome, usage/refusal và structured JSON. Giữ shared semantic schema 1.1/domain validation của backend.
- Không copy các nhánh router tự retry, fake project binding, đổi account/model hoặc nới safety. Request ID là correlation cho đến khi có evidence dedup/read-only lookup.
- Byte/context/output/runtime limits phải benchmark với corpus; thiếu usage/quota là UNKNOWN. Không biến tokens thành quota % hoặc cam kết số chapter/ngày theo gói.

## 4. Matrix evidence

| Mốc | Trạng thái lần sửa plan | Evidence cần có |
| --- | --- | --- |
| Reference OAuth/API | Đã đối chiếu source/docs; chưa pin commit | Pinned client/adapter/source revision + sanitized fixtures |
| Login một account | CHƯA CHẠY | Native Account → Google → callback → identity/scopes/token protection |
| Provider binding/model | CHƯA CHẠY | Actual project/eligibility/model và observation timestamp |
| Inference/schema | CHƯA CHẠY | Chapter thật, terminal result, semantic validation/provenance |
| Recovery | TARGET | Intent-before-I/O, stored-result delivery, timeout/UNKNOWN không blind-resubmit |
| Isolation A/B | CHƯA ĐÁNH GIÁ | Refresh/reconnect/disconnect độc lập, dedup và revoke scope |
| Pool/concurrency | CHƯA ĐÁNH GIÁ | Backend scheduling/limits và throughput/failure evidence |
| Provider support/policy | RESTRICTED theo Terms đang công bố | Nguồn hiện hành trong release review; không ghi approved integration khi chưa có evidence |
| Native UI gate | Chưa có evidence cho flow mới | Real APIs, OAuth/vault/callback, loading/error/empty/layout/console/screenshots |

Các kết quả thử binary CLI không đánh giá API adapter này. Hạn chế truy cập theo Terms vẫn áp dụng với dịch vụ bất kể transport; phần này chưa chứng minh quyền truy cập hoặc hỗ trợ API.

## 5. Giới hạn lần cập nhật

Chỉ sửa tài liệu và ADR Proposed. Chưa cài Antigravity/9Router/Gemini CLI, chưa tạo OAuth client, chưa lấy credential, chưa thay Account screen/Java/TypeScript/SQL và chưa chạy provider thật. Migrations vẫn V1–V13; mọi API mode/checkpoint/provenance mới trong plan là TARGET.
