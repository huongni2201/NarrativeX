# NarrativeX — Implementation Timeline Tuần 1–2

> Nguồn: nội dung timeline chi tiết do người dùng cung cấp.
>
> Mục tiêu: biến codebase + UI hiện tại thành nền tảng đủ chắc để bắt đầu AI pipeline ở Tuần 3.

Tham chiếu roadmap tổng thể: [`NARRATIVEX_TIMELINE.md`](./NARRATIVEX_TIMELINE.md).

## 1. Tóm tắt theo ngày

| Ngày | Trọng tâm | Công việc chính | Deliverable |
|---|---|---|---|
| W1-D1 | Audit codebase | Review FE/BE/Worker, dependency, config, technical debt | Audit report + issue list |
| W1-D2 | Architecture cleanup | Chuẩn hóa module, package, API conventions | Project structure ổn định |
| W1-D3 | Local environment | Docker Compose, PostgreSQL, Redis, storage | `docker compose up` chạy toàn stack |
| W1-D4 | Database foundation | Schema, migration, audit/version fields | DB baseline |
| W1-D5 | Auth + Security | Auth flow, authorization, workspace ownership | Auth foundation |
| W2-D1 | Project API | Project/Story CRUD + validation | FE có thể quản lý project |
| W2-D2 | Asset/Upload | Upload, metadata, storage abstraction | Asset pipeline |
| W2-D3 | Job foundation | Job model, queue, worker skeleton | Async infrastructure |
| W2-D4 | FE ↔ BE integration | Nối UI thật với API, SSE progress skeleton | End-to-end skeleton |
| W2-D5 | CI/CD + staging | Test, observability, deploy staging | Week 3 ready |

## 2. Tuần 1 — Foundation & Clean

Kế hoạch triển khai chi tiết theo file: [`documentation/plans/week-1/README.md`](../plans/week-1/README.md).

### W1-D1 — Audit toàn bộ repository

Chưa refactor ngay. Trước tiên cần map toàn bộ frontend, Spring Boot backend và Python worker; xác định:

- Module nào đã production-ready.
- Module nào còn mock.
- API nào UI đang giả lập.
- Migration hiện tại.
- Authentication, storage và các dependency không còn dùng.

Thực hiện toàn bộ test hiện có và lưu baseline.

Deliverable cuối ngày:

- Architecture Map.
- Danh sách P0/P1/P2 technical debt.
- Danh sách các phần không được refactor để tránh scope creep.

### W1-D2 — Chuẩn hóa backend architecture

Giữ Spring Boot theo modular monolith và xác lập boundary rõ ràng:

```text
backend
├── identity
├── workspace
├── project
├── story
├── character
├── scene
├── asset
├── generation
├── job
├── entitlement
├── usage
└── shared
```

Nguyên tắc backend:

- Domain không import OpenAI, Runway, Pika hoặc provider SDK.
- Có convention chung cho request/response DTO.
- Chuẩn hóa error response, pagination, validation, transaction và exception handling.

Song song, frontend nên chuẩn hóa theo hướng giữ lại UI hiện có và loại dần mock API:

```text
frontend
├── app
├── features
│   ├── auth
│   ├── projects
│   ├── editor
│   ├── characters
│   └── generation
├── components
├── services
├── hooks
└── lib
```

Mục tiêu không phải rewrite UI mà là chuẩn bị một API layer thống nhất.

### W1-D3 — Local development environment

Tạo development stack có thể khởi động bằng một command:

```text
Frontend
   ↓
Backend
   ├── PostgreSQL
   ├── Redis
   └── S3-compatible Storage
             ↓
         AI Worker
```

Docker Compose tối thiểu cần có PostgreSQL, Redis và object storage local/S3-compatible. Backend và worker phải có health check.

Chuẩn hóa thêm:

- `.env.example`.
- Profile `local`, `dev`, `staging`, `prod`.
- Secret handling.
- CORS.

Definition of Done quan trọng nhất: một developer clone repository mới có thể dựng môi trường mà không cần cấu hình thủ công hàng chục bước.

### W1-D4 — Database baseline

Chưa cần implement toàn bộ generation schema, nhưng foundation cần hỗ trợ quan hệ:

```text
User
└── Workspace
    └── Project
        ├── Story
        ├── Character
        ├── Scene
        ├── Asset
        ├── GenerationJob
        └── Render
```

Baseline dữ liệu:

- UUID.
- `created_at`, `updated_at`.
- Optimistic/version field nơi cần thiết.
- Soft-delete chỉ ở entity thực sự cần.
- Ownership/workspace scope.
- Migration bằng Flyway hoặc Liquibase.

Nguyên tắc lưu trữ:

```text
PostgreSQL = business truth
Redis      = queue/cache/progress
S3/R2      = binary assets
```

Redis mất dữ liệu không được làm mất trạng thái nghiệp vụ của project.

### W1-D5 — Authentication, authorization và ownership

Hoàn thiện login/session/token flow theo authentication hiện có. Trọng tâm quan trọng hơn login là authorization server-side: user không được truy cập project, story, asset hoặc generation của workspace khác.

Security boundary:

```text
Request
 ↓
Authentication
 ↓
Workspace Membership
 ↓
Entitlement
 ↓
Resource Ownership
 ↓
Business Operation
```

Cuối Tuần 1, nền tảng cần đạt:

```text
UI
 ↓
Authenticated Backend
 ↓
PostgreSQL
Redis
Storage

+ Docker local
+ Migration
+ Standard API errors
+ Security baseline
+ Test baseline
```

Chưa cần generation AI hoạt động ở thời điểm này.

## 3. Tuần 2 — Core Platform Skeleton

### W2-D1 — Project & Story API

Nối UI thật vào backend cho flow đầu tiên:

```text
Dashboard
 ↓
Create Project
 ↓
Open Project
 ↓
Input Story
 ↓
Save
 ↓
Reload
```

Implement Project/Story CRUD, autosave hoặc explicit save tùy UI hiện tại, validation, ownership và optimistic locking nếu editor có nhiều lần update.

Đây là vertical slice đầu tiên của NarrativeX.

### W2-D2 — Asset & Upload foundation

Xây storage abstraction:

```text
AssetService
     │
     ├── Local/S3-compatible
     └── S3/R2 production
```

Không lưu binary vào PostgreSQL. Database chỉ giữ metadata:

```text
asset_id
workspace_id
project_id
type
storage_key
mime_type
size
checksum
source
status
version
created_at
```

Upload phải có file-size limit, MIME validation, quyền truy cập và signed URL/presigned upload nếu kiến trúc sử dụng direct upload.

CharacterReference, generated image/video và final render về sau đều phải dựa trên Asset model này.

### W2-D3 — Job & Worker foundation

Đưa job foundation từ Phase 3 lên Tuần 2:

```text
GenerationJob
      ↓
Operation
      ↓
Queue
      ↓
Worker
      ↓
Provider
```

State machine tối thiểu:

```text
PENDING
   ↓
QUEUED
   ↓
RUNNING
   ├──→ SUCCEEDED
   ├──→ FAILED
   ├──→ UNKNOWN
   └──→ CANCELLED
```

`UNKNOWN` là trạng thái bắt buộc. Nếu worker submit video tới provider rồi timeout trước khi nhận response, NarrativeX không được retry ngay vì provider có thể đã nhận request và bắt đầu tính tiền.

Cần lưu provider operation ID/idempotency key để các tuần 3–5 có thể reconcile.

Worker Tuần 2 chưa cần tạo video thật. Một fake/test job chạy xuyên suốt là đủ:

```text
POST /jobs/test
      ↓
PostgreSQL
      ↓
Redis
      ↓
Worker
      ↓
Complete
      ↓
PostgreSQL
```

### W2-D4 — Realtime + UI integration

Backend cung cấp SSE trước; chỉ dùng WebSocket nếu thực sự cần bidirectional communication.

```text
Worker
 ↓
Job state
 ↓
PostgreSQL
 ↓
Progress Event
 ↓
SSE
 ↓
Frontend
```

UI bắt đầu có các component dùng chung:

- `GenerationProgress`.
- `JobStatus`.
- `JobError`.
- `RetryAction`.
- `CancelAction`.

Fake generation có thể mô phỏng:

```text
Analyzing story       20%
Planning scenes       40%
Generating assets     60%
Rendering             80%
Completed            100%
```

Nhờ vậy, Tuần 3 chỉ cần thay fake worker bằng Story Analysis thật mà không phải sửa architecture hoặc UI progress.

### W2-D5 — CI/CD, staging và Week-3 readiness

Pipeline đề xuất:

```text
Push / PR
   ↓
Lint
   ↓
Unit Test
   ↓
Integration Test
   ↓
Build FE
   ↓
Build Backend
   ↓
Build Worker
   ↓
Docker Images
   ↓
Deploy Staging
   ↓
Smoke Test
```

Đồng thời thêm:

- Error tracking.
- Structured logging.
- Request ID/correlation ID.
- Metrics cơ bản.

Smoke E2E cuối Tuần 2:

```text
Login
 ↓
Create Project
 ↓
Paste Story
 ↓
Save Story
 ↓
Upload Reference
 ↓
Start Fake Generation
 ↓
Queue
 ↓
Worker
 ↓
Realtime Progress
 ↓
Complete
```

Nếu flow chạy ổn định trên staging, Phase 1 có thể coi là hoàn thành.

## 4. Gate bắt buộc trước Tuần 3

Không bắt đầu tích hợp AI thật nếu chưa đạt các điều kiện sau:

- `docker compose up` dựng được local stack; migration DB chạy sạch từ empty database.
- FE không còn phụ thuộc mock cho Project/Story flow chính.
- Authentication và resource ownership được enforce từ backend.
- PostgreSQL là source of truth; Redis có thể flush mà không mất business state.
- Upload → Storage → Asset metadata chạy end-to-end.
- Queue → Worker → Job state chạy được với fake job.
- Job hỗ trợ `UNKNOWN`, idempotency và recovery/reconciliation foundation.
- SSE hiển thị progress lên UI.
- CI chạy test/build thành công và staging deploy được.
- Có structured log/correlation ID để trace HTTP request → job → worker.
- Không có provider secret nằm trong frontend hoặc repository.

## 5. Milestone cuối Tuần 2

```text
              NarrativeX
                   │
           ┌───────▼────────┐
           │    Next.js     │
           └───────┬────────┘
                   │ REST / SSE
           ┌───────▼────────┐
           │  Spring Boot   │
           │ Modular Mono.  │
           └─┬────┬─────┬───┘
             │    │     │
       PostgreSQL │    Storage
                  │
                Redis
                  │
           ┌──────▼───────┐
           │ Python Worker│
           └──────────────┘
```

```text
↓ READY FOR WEEK 3 ↓

Script → Story Analysis → Character Bible
       → Scene Plan → Shot Plan
```

Tuần 1–2 không chỉ là hai tuần setup. Kết thúc Tuần 2, NarrativeX phải có một vertical slice chạy thật trên staging; chỉ phần AI generation còn được fake. Đây là nền tảng để Tuần 3 bắt đầu AI mà không phải đồng thời sửa architecture.
