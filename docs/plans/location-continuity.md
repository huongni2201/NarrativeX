# Plan: Đồng nhất bối cảnh giữa các Beat/Shot

**Ngày:** 2026-10-16

**Trạng thái:** PARTIAL. Giai đoạn 0 (T01–T05) đã implement và qua unit test cùng integration test PostgreSQL; chưa so sánh trước/sau bằng một Scene thật trên T2V (cổng của Giai đoạn 0). Giai đoạn 1–5: TARGET, chưa bắt đầu. Plan dựa trên khảo sát code ngày 2026-10-16; worktree đang có nhiều thay đổi khác, phải khảo sát lại trước khi implement tiếp và bảo toàn các thay đổi đó.

**Ghi chú implement Giai đoạn 0:** projection là `ShotLocationContextRepository` (một truy vấn window `LAG` cho mỗi batch); `VideoLocationContext` là builder thuần cho `Setting`/continuity/hash; `VideoPromptCompiler.compile` có overload 4 tham số nhận ngữ cảnh Location. Provenance nằm ở `context.locationContext` của Take snapshot và tham gia request fingerprint; replay của Take cũ vẫn khớp. Chi tiết: [Generation routing](../architecture/generation-routing.md) mục 2a. `GenerationRouter` (đường legacy) chưa dùng ngữ cảnh này.

## 1. Kết quả cần đạt

Các Shot diễn ra ở cùng một nơi phải ra **cùng một nơi**, không chỉ "nơi có mô tả giống nhau". Ví dụ: Scene ở Chính điện của hoàng cung A thì mọi Beat/Shot tiếp theo trong Scene đó giữ đúng kiến trúc, vị trí ngai, hàng cột, vật liệu, ánh sáng và thời điểm, dù đổi góc máy. Chỉ phần câu chuyện thay đổi (hành động, góc máy, trạng thái như "cửa mở") mới được phép khác.

Thứ tự ưu tiên khi bị giới hạn:

1. **Định danh đúng:** ứng dụng biết chắc hai Shot cùng một Location. Đây là điều kiện cần cho mọi bước sau.
2. **Văn bản chuẩn đúng:** prompt video luôn nhận cùng một đặc tả Location, không để mỗi Beat tự mô tả lại.
3. **Hình chuẩn đúng:** ảnh tham chiếu đã duyệt được truyền thật vào bước sinh. Bước này cần năng lực GPU worker mà hiện chưa có.

## 2. Hiện trạng đã khảo sát

Đường dẫn tính từ repository root. `.../generation/` là `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/`.

| Vị trí | Hiện trạng | Hệ quả |
| --- | --- | --- |
| `.../generation/application/service/VideoPromptCompiler.java` | Chỉ chèn `Location: <shot.locationRef()>`, tức là một chuỗi tên | Prompt video không có đặc tả Location; mỗi Take tự tưởng tượng ra nơi chốn |
| `.../generation/application/service/VisualPromptComposer.java` (`appendEnvironment`) | Luồng **ảnh** có chèn `location.visualPrompt()` từ `Scene.project_location_id` | Luồng ảnh và luồng video không dùng chung nguồn Location |
| `.../generation/application/usecase/GenerateShotTakeUseCase.java`, `.../infrastructure/prompt/BackendPromptPreviewSource.java` | Luôn gọi `compile(shot, settings, null)` | `continuityContext` không bao giờ được điền |
| `.../infrastructure/dispatch/ChapterAnalysisArtifactMaterializer.java` | Contract 1.2 không sinh `shots`; Shot mặc định lấy `location_ref = scene.location_text` | `location_ref` là chuỗi tự do, không phải khóa tới `project_locations` |
| `analysis/chapter-analysis/1.2/response.schema.json` | `scene.location_ai_name` không bắt buộc; mỗi Beat có `visual_direction.background` tự do | LLM mô tả lại bối cảnh ở từng Beat, gây trôi |
| `db/migration/V1__project_story_and_planning.sql` | `project_locations(name, description, visual_prompt)`; `scenes.project_location_id`; `project_location_ai_identities` | Đã có định danh Location ở cấp Scene. Chưa có bảng ảnh tham chiếu cho Location (Character có `character_version_reference_assets`) |
| `.../generation/application/service/ReferencePlanner.java` | T2V không có reference; I2V thiếu ảnh Location thì bỏ qua âm thầm, khớp theo chuỗi tên | Không có ràng buộc bối cảnh bằng hình |
| `.../infrastructure/prompt/VisualBeatPromptContextAdapter.java` | `MAX_REFERENCE_IMAGES = 3`, chỉ đếm nhân vật | Chưa có chỗ cho ảnh Location trong ngân sách reference |
| [Generation routing](../architecture/generation-routing.md), [GPU worker runtime](../operations/gpu-worker-runtime.md) | `video.generate:1.1` chỉ admit T2V; ComfyUI `image.generate` là text-to-image, chưa có reference conditioning | Phương án dùng ảnh tham chiếu **chưa chạy được** cho đến khi worker được mở rộng |
| `app/desktop/.../chapters/components/stages/ChapterCanonStage.tsx` | Hiển thị `locationText` của Scene, nhãn tĩnh "Đã đối chiếu" | Chưa có màn quản lý Location, chưa hiện Location trên thẻ Shot |

## 3. Nguyên tắc thiết kế

- **Location thuộc Scene.** Một Scene là một nơi liên tục trong một khoảng thời gian liên tục. Đổi nơi thì tách Scene mới, không đổi ngầm giữa các Beat. Khu vực khác trong cùng công trình (Chính điện, sân, hành lang) là các `ProjectLocation` riêng.
- **Resolve bằng ID, không bằng chuỗi.** Đi theo đường Shot → ShotSequence → VisualBeat → Scene → `project_location_id`. `shots.location_ref` chỉ còn là fallback hiển thị khi Scene chưa có Location.
- **Một nguồn đặc tả.** Luồng ảnh và luồng video dùng cùng `LocationCanon`. Đặc tả được chèn **nguyên văn và giống hệt nhau** cho mọi Shot trong Scene.
- **Beat chỉ mô tả phần thay đổi:** phần nào của Location lọt vào khung, ánh sáng có đổi không, đạo cụ nào đổi trạng thái. Beat không mô tả lại kiến trúc.
- **Đổi góc máy thì neo về chuẩn gốc.** Chỉ nối khung cuối của Shot trước khi hành động liền mạch và giữ cùng setup máy; nếu không thì neo lại về đặc tả hoặc bộ ảnh gốc để tránh sai lệch tích lũy.
- **Snapshot bất biến.** Take đã admit giữ Location ID, hash của đặc tả và ID/checksum ảnh tham chiếu đã dùng. Sửa Location chỉ ảnh hưởng operation mới.
- **Chỉ tốn tiền khi có lợi.** Không sinh keyframe cho mọi Beat. Lập kế hoạch theo độ phức tạp và khả năng tái dùng.

## 4. Các giai đoạn

Mỗi giai đoạn tự mang lại giá trị và có cổng kiểm tra riêng. Giai đoạn 0–2 chạy được với runtime hiện tại (T2V). Giai đoạn 3 có giá trị một phần ngay. Giai đoạn 4–5 phụ thuộc năng lực GPU worker.

### Giai đoạn 0: Khóa bối cảnh trong prompt video (backend, quy mô S)

| ID | Công việc |
| --- | --- |
| T01 | Thêm read projection cho Shot, theo pattern của `VisualPromptContextRepository`. Projection batch-resolve `LocationCanon` qua Scene, cùng Shot liền trước trong cùng Scene (theo thứ tự Beat → Sequence → Shot) và `end_state` của Shot đó. Một truy vấn cho mỗi batch, không truy vấn theo từng Shot. |
| T02 | `VideoPromptCompiler` nhận thêm ngữ cảnh Location. Mục `Setting:` chứa tên và `visual_prompt` chuẩn, giống hệt nhau giữa các Shot cùng Scene. Fallback về `locationRef` khi Scene chưa có Location. Đặt giới hạn độ dài và cắt theo ranh giới câu để đặc tả không lấn át hành động. |
| T03 | Builder thuần cho `continuityContext`. Cùng Scene và có Shot trước: "same <location>, keep architecture, prop layout, lighting and time of day unchanged" kèm `end_state` của Shot trước. Shot đầu Scene: không có. Kết quả phải deterministic. |
| T04 | Đưa Location ID, hash đặc tả và continuity vào request semantics/fingerprint và provenance của `GenerateShotTakeUseCase`. Preview "Compiled Video Prompt" dùng cùng đường để hiển thị đúng prompt thật. |
| T05 | Unit test cho compiler/builder: hai Shot cùng Scene có `Setting` giống hệt nhau; trường hợp fallback và không có Location. Integration test (PostgreSQL) cho thứ tự Shot trước. Test fingerprint đổi khi đặc tả Location đổi. Take cũ giữ nguyên. |

**Cổng:** với dữ liệu chương hiện có, prompt của các Shot cùng Scene chứa cùng một đoạn `Setting`. So sánh trước/sau bằng một Scene thật trên T2V. Không được báo cáo đây là "đã đồng nhất bằng hình".

### Giai đoạn 1: Phân tích chương sinh dữ liệu đúng (contract 1.3, quy mô M)

| ID | Công việc |
| --- | --- |
| T06 | `locations.visual_prompt` viết bằng tiếng Anh, gồm các mốc cố định: bố cục, vật thể trung tâm và vị trí của nó, số lượng và hướng cột/cửa, vật liệu, bảng màu, nguồn sáng. Có giới hạn độ dài. `description` vẫn theo `sourceLanguage`. |
| T07 | Bắt buộc `scene.location_ai_name` khi Scene diễn ra ở một nơi xác định. Quy tắc: đổi nơi hoặc nhảy thời gian thì tách Scene. |
| T08 | Định nghĩa lại `visual_direction.background` là "phần Location lọt khung và phần thay đổi"; cấm mô tả lại kiến trúc. Giữ tên trường để giảm thay đổi contract. |
| T09 | Đưa Location đã có của Project vào input phân tích để chương sau dùng lại Location cũ thay vì tạo bản trùng. Cần **kiểm chứng** input hiện tại đã có canon Project hay chưa. |
| T10 | Materializer ghi diagnostic khi `location_ai_name` không resolve được. Tăng version contract và hash theo `ChapterAnalysisContractResources`. |

**Cổng:** fixture contract test. Chạy lại một chương thật: không Scene nào có nơi chốn mà thiếu Location, và không có Location trùng. Chương cũ chỉ được hưởng lợi khi người dùng chủ động phân tích lại; Giai đoạn 0 vẫn chạy với dữ liệu cũ.

### Giai đoạn 2: Quản lý Location trên Desktop (quy mô M)

| ID | Công việc |
| --- | --- |
| T11 | Khảo sát API Location hiện có trong `feature/storyboard`; bổ sung phần còn thiếu: danh sách, sửa `name/description/visual_prompt`, lưu trữ (archive) và **gộp Location trùng** (cập nhật `scenes.project_location_id` và AI identity trong một transaction). |
| T12 | Màn thư viện Location trong Project, dùng API thật và design tokens. |
| T13 | Chọn hoặc đổi Location ở cấp Scene. Thẻ Shot hiện chip "Bối cảnh: <tên>"; Scene chưa có Location thì hiện cảnh báo. Thay nhãn tĩnh "Đã đối chiếu" bằng trạng thái thật. |
| T14 | Xác minh UI theo gate trong `AGENTS.md`: chạy Electron/Vite, đi qua luồng thật, kiểm tra console/network/overflow/empty state, chụp ảnh bằng chứng. |

**Cổng:** người dùng sửa đặc tả Chính điện một lần thì preview prompt của mọi Shot trong các Scene liên quan đổi theo.

### Giai đoạn 3: Bộ ảnh tham chiếu Location (dữ liệu và duyệt, quy mô M)

| ID | Công việc |
| --- | --- |
| T15 | Bảng `project_location_reference_assets` theo mẫu `character_version_reference_assets`: `project_location_id`, `media_asset_id`, `slot` (`ESTABLISHING_WIDE`, `REVERSE_ANGLE`, `SIDE_ANGLE`, `DETAIL`), `priority`, thời điểm duyệt. Theo quy tắc baseline trước release: fold vào migration sở hữu, index vào V6, cập nhật inventory trong [database](../architecture/database.md). |
| T16 | Sinh ảnh `ESTABLISHING_WIDE` bằng `image.generate` text-to-image hiện có từ đặc tả Location. Người dùng duyệt hoặc tạo lại. Ảnh đã duyệt là bất biến; thay ảnh tạo asset mới. Cho phép import ảnh do người dùng tự cung cấp. |
| T17 | Composer chia ngân sách reference: khi có ảnh Location thì dành 1 chỗ, chọn slot theo `camera_angle` của Beat; nhân vật tối đa 2 chỗ. Cập nhật thông điệp `REFERENCE_BUDGET_EXCEEDED`. |
| T18 | `ReferencePlanner`: strategy cần reference mà Scene có Location chưa duyệt ảnh thì trả blocker `MISSING_LOCATION_REFERENCE`, không bỏ qua âm thầm. Khớp theo Location ID thay vì chuỗi tên. Snapshot ghi asset ID và sha256. |

Giá trị trước khi worker có conditioning: người dùng **nhìn thấy và duyệt** được "hoàng cung trông thế nào", nhờ đó sửa được đặc tả văn bản cho đúng ý. Các góc khác ngoài toàn cảnh chưa nên sinh bằng text-to-image, vì mỗi ảnh sẽ là một kiến trúc khác. Chờ Giai đoạn 4.

### Giai đoạn 4: Năng lực GPU worker và thí điểm (quy mô L, có cổng đo)

| ID | Công việc |
| --- | --- |
| T19 | `image.generate` có reference conditioning trong `app/generation-service`: ảnh Location và nhân vật làm điều kiện; chọn model hoặc workflow qua benchmark. Phiên bản profile mới, capability truth và preflight. Cập nhật [compute protocol](../architecture/compute-protocol.md). |
| T20 | `video.generate` cho I2V với LTX (khung đầu làm điều kiện), profile mới. Đường T2V cũ giữ nguyên. |
| T21 | **Thí điểm trước khi mở rộng:** 1 Scene × 3 góc × 3 Take. So sánh T2V + Giai đoạn 0 với I2V + ảnh Location. Đo bằng chấm điểm của người duyệt (1–5 về độ giữ bối cảnh), kèm độ tương đồng embedding với ảnh `ESTABLISHING_WIDE` làm chỉ số chẩn đoán. Ghi kết quả vào [benchmarks](../operations/benchmarks/). |

**Cổng:** chỉ làm Giai đoạn 5 khi thí điểm cho cải thiện rõ ràng. Không báo cáo kết quả từ fake provider là năng lực production.

### Giai đoạn 5: Sản xuất neo theo keyframe, có chọn lọc (quy mô M)

| ID | Công việc |
| --- | --- |
| T22 | Ảnh Beat đã duyệt (sinh từ ảnh Location và nhân vật) trở thành `START_FRAME` cho I2V của Shot. |
| T23 | Quy tắc chọn neo: hành động liền mạch và cùng setup máy dùng khung cuối của SelectedTake Shot trước (`continuity_from_shot_id`); đổi góc dùng ảnh Location đúng slot; Shot đơn giản giữ T2V cùng đặc tả Giai đoạn 0. |
| T24 | Chỉ sinh keyframe cho Beat đổi góc hoặc có hành động then chốt. Ghi intent trước I/O, có idempotency và snapshot theo ADR-0003/ADR-0008. |

## 5. Quyết định cần chốt

| ID | Câu hỏi | Đề xuất |
| --- | --- | --- |
| D1 | Location gắn ở cấp nào? | Scene. Khu vực con là Location riêng. Chưa làm override theo Beat. |
| D2 | Lưu ánh sáng, thời điểm, trạng thái đạo cụ ở đâu? | Trước mắt suy ra từ đặc tả Location và `end_state` của Shot trước, không thêm schema. `scenes.lighting/time_of_day` đã bị retire ([database](../architecture/database.md)); nếu đưa lại trạng thái có cấu trúc thì phải sửa ADR-0006. |
| D3 | `visual_direction.background` | Giữ tên, đổi ý nghĩa sang "phần lọt khung và phần thay đổi" trong contract 1.3. |
| D4 | Model conditioning cho worker | Quyết định bằng benchmark ở T21, không chốt trước. |

## 6. Rủi ro

- Đặc tả Location quá dài làm LTX bỏ qua hành động. Cần giới hạn độ dài ở contract và compiler, rồi kiểm chứng bằng Take thật.
- LLM tạo Location trùng giữa các chương. Giảm bằng T09 và công cụ gộp ở T11.
- T2V về bản chất không đảm bảo cùng kiến trúc. Giai đoạn 0–1 chỉ giảm sai lệch, không loại bỏ. Phải ghi rõ PARTIAL.
- Phân tích lại chương tốn chi phí và có thể đổi Beat. Chỉ chạy khi người dùng chủ động yêu cầu.

## 7. Tài liệu cần cập nhật khi implement

- [Generation routing](../architecture/generation-routing.md): thứ tự prompt video, Location và continuity.
- ADR-0008: không cần ADR mới cho `LOCATION_REFERENCE` (đã có); cập nhật nếu thêm profile I2V. ADR-0006: chỉ sửa nếu D2 đưa lại trạng thái Scene có cấu trúc.
- [Database](../architecture/database.md): inventory khi thêm bảng ở T15.
- Bảng plan trong [docs README](../README.md).
