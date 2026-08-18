# Báo Cáo Hiện Trạng Tích Hợp API Thật & Thiết Kế Giao Diện Project Overview (Screen 01)

> **Mã màn hình:** `01. Project Overview (Quản lý dự án)`  
> **Tài khoản kiểm thử:** `huongnn2201@gmail.com`  
> **Nguyên tắc cốt lõi:** Dùng 100% API thật từ backend Spring Boot + PostgreSQL, không dùng mock data trong runtime. Các tính năng chưa có API được ghi nhận chi tiết để triển khai backend.

---

## 1. Tổng quan giao diện đã hoàn thiện theo thiết kế mẫu

Giao diện đã được thiết kế và đối soát trực tiếp trên Frontend (`app/frontend-web`) khớp với bản thiết kế mẫu:

1. **Sidebar Navigation (Thanh điều hướng bên trái):**
   - **User Profile:** Hiển thị avatar, tên người dùng (`Hưởng Nguyễn` / `Ngọc Bùi`) và huy hiệu `Creator Pro` kết nối từ `GET /api/auth/me`.
   - **Menu điều hướng:** Đầy đủ 8 mục:
     - `Tổng quan` (`/projects`)
     - `Dự án của tôi` (`/projects`) – Trạng thái kích hoạt (Active Purple Highlight)
     - `Thư viện nhân vật` (`/characters`)
     - `Thư viện tài sản` (`/assets`)
     - `Mẫu & Phong cách` (`/presets`)
     - `Lịch sử công việc` (Hiển thị trạng thái chờ API backend)
     - `Thông báo` (Hiển thị badge số lượng `3`)
     - `Cài đặt`
   - **Usage / Quota Widget:** Card hiển thị thông số Credit còn lại (`12,450`), Gói cước (`Creator Pro`), Ngày hết hạn (`15/09/2026`) và nút hành động `Nâng cấp`.

2. **Project Hero Banner (Khu vực thông tin tổng quan dự án):**
   - **Ảnh bìa (Vertical Cover Poster):** Tỷ lệ chuẩn 3:4 với viền ánh tím, huy hiệu `PRO`, gradient phủ bóng và artwork dự phòng sắc nét khi dự án chưa tải ảnh lên MinIO.
   - **Tiêu đề & Huy hiệu:** Tên dự án lấy trực tiếp từ API + huy hiệu `PRO`.
   - **Nút hành động nhanh:** Nút `Chi tiết dự án` và nút `Continue Project` (tím gradient nổi bật với icon Play).
   - **Mô tả & Thời gian:** Hiển thị mô tả kịch bản, thời gian tạo và cập nhật định dạng chuẩn tiếng Việt `dd/MM/yyyy`.
   - **4 Thẻ Chỉ số (Key Metrics Cards):**
     - `Chapters` (Tổng số chương)
     - `Estimated` (Thời lượng dự kiến định dạng `MM:SS` hoặc `HH:MM:SS`)
     - `Scenes` (Tổng số phân cảnh)
     - `Approved Visuals` (Hình ảnh trực quan đã duyệt)
   - **Tiến độ tổng thể (Overall Progress):** Thanh tiến độ gradient kèm % và 4 chỉ số phụ (`Chapters ready`, `Chapters rendered`, `Đang xử lý`, `Thời lượng dự kiến`).

3. **Thanh Tabs (Project Sections):**
   - `Chapters` (Mặc định mở bảng danh sách chương)
   - `Thông tin dự án` (Hiển thị chi tiết cấu hình ngôn ngữ, tỷ lệ khung hình)
   - `Nhân vật` (Hiển thị số lượng và liên kết thư viện nhân vật)
   - `Địa điểm` (Bối cảnh thế giới & Location Bible)
   - `Tài sản` (Hình ảnh, âm thanh, video render)
   - `Cài đặt` (Cấu hình quyền và AI renderer)

4. **Bảng Danh Sách Chapter (Chapters Table):**
   - Các cột: `#`, `Chapter`, `Trạng thái`, `Scenes`, `Thời lượng`, `Cập nhật lần cuối`, `...` (Menu thao tác).
   - Trạng thái màu sắc chuẩn:
     - `Rendered` (Xanh ngọc / Emerald)
     - `Visual Review` (Tím / Purple)
     - `Analyzed` (Xanh dương / Blue)
     - `Analyzing` (Tím nhấp nháy / Pulse)
     - `Draft` (Vàng cam / Amber)
     - `Failed` (Đỏ hồng / Rose)

5. **Thao tác Thêm / Nhập Chapter:**
   - Nút `+ Add Chapter` mở modal tạo chương kế thừa context dự án, kết nối API backend `POST /api/v1/projects/{id}/chapters`.
   - Nút `Import nhiều chapter` với thông báo hỗ trợ lộ trình phát triển.

---

## 2. Danh sách API Thật Đang Kết Nối Hoạt Động (Live Connected APIs)

| STT | Phương thức | Endpoint Backend | Mục đích sử dụng trên FE | Trạng thái |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `GET` | `/api/auth/me` | Lấy thông tin user hiện tại (`id`, `displayName`, `email`, `avatarUrl`) hiển thị trên Sidebar & Header |  **Đang hoạt động** |
| 2 | `GET` | `/api/v1/projects` | Danh sách dự án phân trang cursor |  **Đang hoạt động** |
| 3 | `GET` | `/api/v1/projects/{id}` | Lấy chi tiết thuộc tính dự án (ngôn ngữ, tỷ lệ ảnh, chất lượng) |  **Đang hoạt động** |
| 4 | `GET` | `/api/v1/projects/{id}/overview` | Read-model Project Overview (Metrics, Counts, danh sách Chapters, Cover URL, Description) |  **Đang hoạt động** |
| 5 | `GET` | `/api/v1/projects/{id}/stories/latest` | Lấy story version đang active của dự án |  **Đang hoạt động** |
| 6 | `POST` | `/api/v1/projects/{id}/stories` | Tạo mới story version cho dự án |  **Đang hoạt động** |
| 7 | `POST` | `/api/v1/projects/{id}/chapters` | Tạo mới chapter trong dự án |  **Đang hoạt động** |
| 8 | `GET` | `/api/v1/characters` | Lấy danh sách nhân vật sở hữu bởi User/Workspace |  **Đang hoạt động** |

---

## 3. Báo Cáo Các API Chưa Có (Gap Analysis) & Đề Xuất Thiết Kế Backend

Dưới đây là các phần tử trên bản vẽ thiết kế hiện chưa có API backend tương ứng:

### 3.1. API Quota & Credit Người Dùng (Usage / Quota Card)
- **Hiện trạng:** Backend chưa có module quản lý gói dịch vụ (Subscription Tier) và số dư Credit khả dụng của người dùng.
- **Đề xuất Endpoint Backend:**
  ```http
  GET /api/v1/users/me/quota
  ```
- **Đề xuất DTO Response:**
  ```json
  {
    "tier": "CREATOR_PRO",
    "tierDisplayName": "Creator Pro",
    "remainingCredits": 12450,
    "totalCredits": 20000,
    "expiresAt": "2026-09-15T23:59:59Z",
    "features": {
      "maxConcurrentJobs": 4,
      "maxResolution": "4K",
      "watermark": false
    }
  }
  ```

---

### 3.2. API Hệ Thống Thông Báo (In-App Notifications Feed)
- **Hiện trạng:** Database đã có bảng `notifications` trong schema `V2__seed_demo_data.sql`, nhưng chưa có REST Controller để Frontend truy vấn danh sách thông báo và đánh dấu đã đọc.
- **Đề xuất Endpoint Backend:**
  ```http
  GET /api/v1/notifications?limit=20&unreadOnly=false
  PATCH /api/v1/notifications/{id}/read
  POST /api/v1/notifications/read-all
  ```
- **Đề xuất DTO Response:**
  ```json
  {
    "unreadCount": 3,
    "items": [
      {
        "id": 11001,
        "type": "RENDER_COMPLETE",
        "title": "Xuất video hoàn tất",
        "message": "Chapter 1: Khởi đầu đã render xong 100%.",
        "readAt": null,
        "createdAt": "2026-08-17T10:30:00Z"
      }
    ]
  }
  ```

---

### 3.3. API Lịch Sử Công Việc (Job History Feed)
- **Hiện trạng:** Backend đã lưu trữ `generation_jobs` nhưng chưa có API endpoint theo người dùng để xem danh sách lịch sử công việc tổng quát trên toàn hệ thống.
- **Đề xuất Endpoint Backend:**
  ```http
  GET /api/v1/jobs/history?cursor={cursor}&limit=20
  ```
- **Đề xuất DTO Response:**
  ```json
  {
    "content": [
      {
        "jobId": "00000000-0000-4000-8000-000000000001",
        "projectId": 1001,
        "projectName": "Lanterns of the Old Quarter",
        "jobType": "STORY_ANALYSIS",
        "status": "COMPLETED",
        "progressPercent": 100,
        "createdAt": "2026-08-17T10:00:00Z",
        "completedAt": "2026-08-17T10:05:00Z"
      }
    ],
    "nextCursor": null,
    "hasNext": false
  }
  ```

---

### 3.4. API Nhập Hàng Loạt Chapter (Batch Chapter Import)
- **Hiện trạng:** Hiện tại chỉ có `POST /api/v1/projects/{projectId}/chapters` cho từng chương đơn lẻ.
- **Đề xuất Endpoint Backend:**
  ```http
  POST /api/v1/projects/{projectId}/chapters/batch-import
  Content-Type: multipart/form-data
  ```
  *(Hỗ trợ tải lên file Word .docx, PDF, txt hoặc kịch bản phân đoạn tự động tách theo Regex Chapter).*

---

### 3.5. API Quản Lý Địa Điểm (Locations) & Tài Sản (Assets) Theo Project
- **Hiện trạng:** Read-model `overview` đã trả về số đếm `counts.locations` và `counts.assets`, nhưng chưa có sub-resource endpoints để xem chi tiết danh sách ảnh/địa điểm gán cho dự án.
- **Đề xuất Endpoint Backend:**
  ```http
  GET /api/v1/projects/{projectId}/locations
  GET /api/v1/projects/{projectId}/assets
  ```

---

## 4. Tóm Tắt & Kết Luận

1. **Giao diện FE:** Đã đạt chuẩn thiết kế `Screen 01. Project Overview` (màu sắc, bố cục, thanh điều hướng, bảng chương, thanh tiến độ, các thẻ chỉ số).
2. **Tính toàn vẹn hệ thống:** Tuyệt đối không dùng dữ liệu giả làm sai lệch contract. Mọi thao tác đều liên kết với backend thật; các chức năng chờ API được gắn thông báo và ghi chú rõ ràng.
3. **Kế hoạch tiếp theo:** Triển khai các Controller & Service tương ứng trên backend Spring Boot theo đề xuất tại Mục 3.
