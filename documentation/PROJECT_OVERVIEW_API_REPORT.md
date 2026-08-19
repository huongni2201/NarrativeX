# Báo Cáo Hiện Trạng Tích Hợp API & Thiết Kế Giao Diện Project Overview (Screen 01)

> **Mã màn hình:** `01. Project Overview (Quản lý dự án)`  
> **Phạm vi:** `app/frontend-web` + Backend Spring Boot  
> **Nguyên tắc cốt lõi:** Các dữ liệu nghiệp vụ đã có backend phải lấy từ API thật. Thành phần chưa có API phải hiển thị trạng thái unavailable/disabled rõ ràng và không được dùng giá trị hardcode để giả lập dữ liệu production.

---

## 1. Trạng thái tổng thể

Screen `01. Project Overview` đã được tích hợp với các API backend hiện có cho Project, Project Overview, Story Version, Chapter và Auth Session.

Không sử dụng câu mô tả **“100% API backend thật”** cho toàn bộ màn hình vì một số chức năng trong thiết kế như Quota/Credit, Notification, Job History, Locations detail, Project Assets detail và Batch Chapter Import hiện chưa có đầy đủ backend endpoint.

Quy ước hiện tại:

- Có API backend: FE gọi API thật và render dữ liệu trả về.
- Chưa có API backend: FE hiển thị disabled/unavailable state hoặc thông báo rõ ràng.
- Không dùng số liệu giả như số credit, ngày hết hạn, notification count hoặc subscription tier để khiến người dùng hiểu nhầm rằng dữ liệu đến từ backend.

---

## 2. Thành phần giao diện và nguồn dữ liệu

### 2.1. Sidebar

**User Profile**

- Avatar, display name và email lấy từ `GET /api/auth/me`.
- Không fallback sang tên người dùng giả khi API không trả `displayName`.
- Không hiển thị `Creator Pro` cho đến khi backend có subscription/quota contract tương ứng.

**Navigation**

- `Tổng quan`
- `Dự án của tôi`
- `Thư viện nhân vật`
- `Thư viện tài sản`
- `Mẫu & Phong cách`
- `Lịch sử công việc`
- `Thông báo`
- `Cài đặt`

Các mục chưa có backend được disabled và có tooltip giải thích trạng thái.

**Usage / Quota**

Backend hiện chưa có contract quota/subscription. FE vì vậy chỉ hiển thị trạng thái `Chưa có API` và không hiển thị các giá trị hardcode như:

- `12,450 credits`
- `Creator Pro`
- `15/09/2026`

---

### 2.2. Project Hero / Overview Metrics

Nguồn dữ liệu chính:

```http
GET /api/v1/projects/{projectId}/overview
```

Hiển thị:

- tên dự án
- description
- coverImageUrl
- createdAt / updatedAt
- totalChapters
- estimatedDurationSeconds
- totalScenes
- approvedVisuals
- readyChapters
- renderedChapters
- processingJobs
- overallProgress
- counts.characters
- counts.locations
- counts.assets
- chapter summaries

Nếu `coverImageUrl` chưa tồn tại, FE có thể dùng artwork trang trí trung tính để giữ layout; artwork này không được xem là dữ liệu nghiệp vụ.

Subscription badge như `PRO` không được xem là dữ liệu thật nếu backend chưa trả subscription tier.

---

### 2.3. Project Configuration

Nguồn dữ liệu:

```http
GET /api/v1/projects/{projectId}
```

Các field có backend thật:

- `sourceLanguage`
- `narrationLanguage`
- `metadataLanguage`
- `imageAspectRatio`
- `imageQualityTier`
- `status`
- `rowVersion`

FE không nên hardcode `16:9`, `vi-VN` hoặc `STANDARD` nếu API đã có các field tương ứng.

---

### 2.4. Chapters

Danh sách Chapter được đọc từ Project Overview read model.

Tạo Chapter bằng:

```http
POST /api/v1/projects/{projectId}/chapters
```

Payload hiện tại:

```json
{
  "storyVersionId": 123,
  "orderIndex": 0,
  "title": "Chapter 1",
  "sourceText": "..."
}
```

Sau khi tạo thành công FE:

1. cập nhật cache Chapter,
2. invalidate Project Overview,
3. invalidate Story Version khi cần,
4. điều hướng sang Chapter Workspace.

### Lưu ý về “kế thừa context”

Modal có thể giải thích rằng Chapter **thuộc cùng Project và sử dụng cấu hình Project hiện tại**, nhưng không được khẳng định backend tự động snapshot/kế thừa Character Bible, Location Bible, Outfit, Voice hoặc Visual settings nếu backend chưa thực sự thực hiện các bước đó.

---

## 3. API thật đang sử dụng

| STT | Method | Endpoint | Trạng thái |
|---:|---|---|---|
| 1 | `GET` | `/api/auth/me` | ✅ Đang sử dụng |
| 2 | `GET` | `/api/v1/projects` | ✅ Đang sử dụng |
| 3 | `GET` | `/api/v1/projects/{id}` | ✅ Đang sử dụng |
| 4 | `GET` | `/api/v1/projects/{id}/overview` | ✅ Đang sử dụng |
| 5 | `GET` | `/api/v1/projects/{id}/stories/latest` | ✅ Đang sử dụng |
| 6 | `POST` | `/api/v1/projects/{id}/stories` | ✅ Đang sử dụng |
| 7 | `POST` | `/api/v1/projects/{id}/chapters` | ✅ Đang sử dụng |
| 8 | `GET` | `/api/v1/characters` | ✅ Backend đã có / dùng cho Character Library |

---

## 4. Backend Gap Analysis

### P1 — Project Locations

```http
GET /api/v1/projects/{projectId}/locations
```

Mục tiêu: trả danh sách Location/Location Bible thực sự thuộc hoặc được liên kết với Project.

### P1 — Project Assets

```http
GET /api/v1/projects/{projectId}/assets
```

Mục tiêu: trả assets theo Project thay vì chỉ điều hướng tới global asset library.

### P2 — Job History

```http
GET /api/v1/jobs/history?cursor={cursor}&limit=20
```

Dùng cho lịch sử Story Analysis, visual generation, audio và render.

### P3 — Quota / Subscription

```http
GET /api/v1/users/me/quota
```

Chỉ nên thêm badge subscription, số credit và ngày hết hạn sau khi endpoint này tồn tại.

Ví dụ response dự kiến:

```json
{
  "tier": "CREATOR_PRO",
  "tierDisplayName": "Creator Pro",
  "remainingCredits": 12450,
  "totalCredits": 20000,
  "expiresAt": "2026-09-15T23:59:59Z"
}
```

Các giá trị trên chỉ là **contract example**, không phải dữ liệu runtime hiện tại.

### P3 — Notifications

```http
GET /api/v1/notifications?limit=20&unreadOnly=false
PATCH /api/v1/notifications/{id}/read
POST /api/v1/notifications/read-all
```

Notification badge chỉ được hiển thị khi lấy được unread count thật.

### P4 — Batch Chapter Import

```http
POST /api/v1/projects/{projectId}/chapters/batch-import
Content-Type: multipart/form-data
```

Có thể hỗ trợ `.docx`, `.pdf`, `.txt` ở phase sau. Đây không phải blocker cho MVP vì user đã có thể tạo Chapter thủ công.

---

## 5. MVP Priority

Thứ tự ưu tiên đề xuất:

1. Project Overview + Chapter CRUD/Workspace hoạt động thật.
2. Chapter Story Analysis vertical slice.
3. Locations / Assets phục vụ continuity và Storyboard.
4. Job History phục vụ observability.
5. Quota / Subscription khi chuẩn bị billing hoặc generation limits.
6. Notifications.
7. Batch import.

Quota, Notification và Batch Import không nên chặn flow MVP cốt lõi.

---

## 6. Definition of Done cho Screen 01

Screen `01. Project Overview` được xem là hoàn thiện ở mức MVP khi flow sau chạy bằng dữ liệu thật:

```text
Project Overview
    ↓
Add Chapter
    ↓
Chapter Workspace
    ↓
Nhập / cập nhật sourceText
    ↓
Analyze
    ↓
Generation Job: QUEUED → RUNNING → COMPLETED
    ↓
Chapter/Scene/VisualBeat được cập nhật
    ↓
Project Overview refresh metrics
```

Các điều kiện bắt buộc:

- Không hardcode dữ liệu nghiệp vụ để giả lập API.
- Auth user phải đến từ session backend.
- Project metadata phải đến từ Project API.
- Overview metrics/chapter list phải đến từ Overview API.
- Tạo Chapter phải gọi backend thật.
- Sau mutation phải invalidate/read lại dữ liệu cần thiết.
- Thành phần chưa có API phải ở disabled/unavailable state.
- Không mô tả chức năng backend chưa tồn tại như thể đã hoàn thành.

---

## 7. Kết luận

Project Overview hiện là một **real-API vertical slice cho những backend capability đã được triển khai**, không phải toàn bộ thiết kế đều đã có backend.

Cách mô tả chính xác là:

> **Project Overview đã được tích hợp hoàn toàn với các API backend hiện có. Những chức năng chưa có backend contract được hiển thị ở trạng thái unavailable/disabled và không sử dụng mock business data.**

Đây là trạng thái phù hợp cho MVP và giữ FE, backend, tài liệu cùng một source of truth.
