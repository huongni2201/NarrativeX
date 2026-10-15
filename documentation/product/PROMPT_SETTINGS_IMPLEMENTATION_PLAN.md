# Plan: Settings → Prompt, cấu hình dùng chung cho toàn ứng dụng

**Ngày:** 2026-10-14

**Trạng thái:** PARTIAL (2026-10-14). Backend T01–T04 và Desktop T05 đã có trong working tree với unit/contract/node tests; chưa xác nhận Spring/Flyway trên PostgreSQL 18, Testcontainers, UI Electron thật hay chất lượng provider. Xem [CURRENT_STATUS](../CURRENT_STATUS.md).

**Phạm vi đã chốt với người dùng:** Một cấu hình dùng chung; thay đổi áp dụng cho mọi project. Không tạo cấu hình hoặc bản pin riêng cho project.

## 1. Kết quả cần đạt

Người dùng mở **Settings → Prompt**, chọn style, sửa prompt/style và negative prompt, xem prompt hoàn chỉnh, rồi lưu. Mọi lần phân tích hoặc tạo ảnh/video mới ở mọi project dùng cấu hình vừa lưu, không cần sửa Java, build lại hay khởi động lại ứng dụng.

“Áp dụng cho mọi project” nghĩa là áp dụng cho **operation mới sau khi lưu**. Không tự chạy lại phân tích, tạo lại media, thay ảnh đã duyệt, đổi CharacterVersion, sửa Take/SelectedTake hoặc snapshot render. Operation đã admission, kể cả đang chờ chạy, giữ cấu hình đã chốt; replay/recovery giữ nguyên input. Retake có chủ đích là operation mới và dùng cấu hình hiện hành.

## 2. Hiện trạng đã khảo sát

Đường dẫn dưới đây tính từ repository root. Code/migrations/tests là nguồn xác nhận; worktree đang có nhiều thay đổi khác, phải khảo sát lại trước implementation và bảo toàn các thay đổi đó.

| Vị trí | Hiện trạng | Công việc cần làm |
| --- | --- | --- |
| `app/desktop/src/renderer/features/settings/screens/SettingsScreen.tsx` | Runtime diagnostics và reset Desktop preferences; chưa có Prompt | Bổ sung tab/mục Prompt và form dùng API thật |
| `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/domain/enums/ImageStyle.java` | Ba style với positive/negative text trong enum | Chuyển nội dung sang cấu hình; giữ mapping ID cũ cho tương thích |
| `.../generation/application/service/StoryboardVisualPromptComposer.java` | Cố định `CINEMATIC_ANIME` | Resolve style hiện hành một lần cho operation/preview |
| `.../generation/infrastructure/prompt/BackendCharacterIdentityPromptProvider.java` | Cố định `CINEMATIC_ANIME` | Dùng cùng cấu hình với storyboard/video |
| `.../generation/application/service/VisualPromptComposer.java` | `styleLanguage()` hardcode một bộ mô tả khác với enum | Bỏ nguồn style trùng lặp; dùng cấu hình đã resolve |
| `.../generation/application/service/CharacterIdentityPromptComposer.java` | Có câu ép 3D CGI ngay trong task/composition/purpose | Tách chỉ dẫn sáng tạo ra cấu hình, không để style khác vẫn bị ép 3D |
| `.../generation/application/service/SharedCharacterRenderingLanguage.java` | Rendering language chỉ dành cho `CINEMATIC_ANIME` | Đưa phần rendering sáng tạo vào profile; giữ bảo toàn identity ở backend |
| `.../generation/application/service/VideoPromptCompiler.java` | Negative prompt cố định có `2D flat cel animation`; phụ thuộc shared rendering language | Dùng negative/rendering theo style, không cấm nhầm style vừa chọn |
| `.../generation/application/usecase/GenerateShotTakeUseCase.java` | `prepare()` truyền cố định `ImageStyle.CINEMATIC`; inputs được snapshot/fingerprint | Resolve cấu hình trước compile và freeze trong admission |
| `.../generation/application/service/MediaPlanSceneResolver.java` | Materialize prompt trong immutable media plan | Freeze cấu hình ở cấp plan, không resolve lại khi dispatch |
| `.../generation/infrastructure/analysis/ChapterAnalysisContractResources.java` | Đọc prompt/schema 1.1 từ resources, có hashes | Tách editable analysis instructions khỏi schema/contract bắt buộc |
| `.../generation/infrastructure/analysis/vertex/VertexGeminiClient.java` | Tự tạo resources và ghép system/user prompt tại client | Nhận effective prompt đã chốt; không tự đọc defaults khi thực thi |

`.../generation/` ở bảng là `app/backend-service/src/main/java/com/narrativex/backend/feature/generation/`.

Chapter Analysis đã có foundations snapshot/attempt V13, nhưng Antigravity OAuth/direct API còn PARTIAL/TARGET theo [status](../CURRENT_STATUS.md) và [plan liên quan](ANTIGRAVITY_STORY_ANALYSIS_IMPLEMENTATION_PLAN.md). Tính năng Prompt phải hoạt động với đường Vertex hiện có; không phụ thuộc việc hoàn tất OAuth, và không tuyên bố các provider khác đã hoạt động.

## 3. Thiết kế đề xuất

### 3.1. Một nguồn cấu hình chung

- Backend sở hữu một `PromptSettings` cho installation, lưu PostgreSQL theo pattern singleton + revision hiện có. Không có user/account/project owner.
- Renderer đọc/ghi qua typed client và backend transport hiện có của Electron main. Không lưu bản authoritative trong localStorage hoặc Desktop preferences JSON.
- Một row cấu hình với JSON có schema rõ ràng là đủ cho bản đầu; snapshot operation giữ nội dung lịch sử. Không cần thêm dịch vụ, Redis, engine template hay hệ thống quản lý version độc lập.
- Mỗi lần lưu thành công tăng revision bằng compare-and-set; client giữ revision dạng decimal string để không mất độ chính xác BIGINT. Form cũ không được ghi đè form mới.
- Các use case đọc một revision nhất quán cho toàn bộ operation/batch. Bản đầu không cache cấu hình giữa các operation để tránh thay đổi bị chậm áp dụng.

### 3.2. Nội dung cho phép sửa

| Nhóm | Các trường |
| --- | --- |
| Style | Style đang áp dụng; tên style; positive style prompt; negative style prompt; character rendering instructions |
| Phân tích truyện | Chỉ dẫn sáng tạo/phân tích bổ sung cho Chapter Analysis |
| Ảnh nhân vật | Chỉ dẫn tạo reference và bố cục mặc định |
| Storyboard / ảnh cảnh | Chỉ dẫn sáng tạo và bố cục mặc định |
| Video | Chỉ dẫn sáng tạo, chuyển động và negative prompt bổ sung cho video |

Seed ba preset hiện có: `CINEMATIC`, `STORYBOOK_WATERCOLOR`, `CINEMATIC_ANIME`. Cho phép chọn, sửa, tạo style riêng bằng sao chép và khôi phục mặc định của preset. Style riêng dùng stable ID, không mở rộng enum Java mỗi lần tạo. Chỉ cần một style active cho toàn ứng dụng; không thêm override từng project/shot/provider trong bản này.

Mặc định đề xuất khi khởi tạo là `CINEMATIC_ANIME`, phù hợp đường ảnh hiện tại. Đây là thay đổi có chủ đích đối với **video mới**, vì đường Take hiện truyền `CINEMATIC`; cần test và mô tả rõ trong rollout. Job/snapshot cũ giữ nguyên. Positive/negative phải chuyển đồng bộ để cinematic/watercolor không còn bị câu 3D hoặc negative anime cũ phủ định.

Toàn bộ prose sáng tạo tương ứng phải ra khỏi code hardcode và xuất hiện trong editor, thay vì chỉ cho sửa một suffix trong khi các composer khác vẫn ép style. Defaults nằm trong versioned resources để seed/reset; runtime sử dụng cấu hình đã lưu. Chuyển nội dung hiện có sang defaults trước, chỉ chỉnh những mâu thuẫn cần thiết để style hoạt động.

**Phần backend tiếp tục kiểm soát:** response schema, source anchors, trường bắt buộc, participating characters, identity/version locks, continuity, consent/media safety, validation, giới hạn input/output và execution capability. Chỉ dẫn người dùng không được tắt các kiểm tra này. Phân tách protected instructions và editable instructions; enforcement nằm trong validation/schema, không chỉ dựa vào thứ tự câu prompt.

Bản đầu dùng các instruction block văn bản thuần và context sections do backend dựng. Không chạy expression, script, include file, URL fetch hoặc template engine. UI hiển thị phần sáng tạo có thể sửa và prompt hiệu lực read-only; dữ liệu truyện vẫn là untrusted data.

### 3.3. Resolve → preview → freeze → execute

1. Settings đọc/sửa bản draft; chưa Save thì không tác động project nào.
2. Preview backend ghép draft hoặc cấu hình đã lưu với context thật của project/character/beat/shot được chọn. Không gọi provider, không sinh media hoặc admission job.
3. Save validate toàn bộ object và CAS revision trong transaction ngắn. Sau Save, các operation mới ở mọi project đọc revision mới.
4. Admission resolve một lần, compile prompt và đóng băng final positive/negative prompt, settings revision, style ID, effective prompt hash và contract/schema version cần thiết vào snapshot hiện có, trước external I/O.
5. Dispatcher/provider adapters dùng snapshot; không đọc Settings hiện hành hoặc tự thêm lại style mặc định. Worker tiếp tục chỉ nhận typed materialized inputs, không nhận business settings hay truy cập DB.
6. Replay cùng idempotency key trả operation gốc trước khi resolve Settings mới; không làm replay xung đột chỉ vì global revision đã đổi. Nếu người dùng chủ động gửi input khác với cùng key thì conflict theo contract hiện tại. Operation mới cần key mới.
7. Nếu cấu hình đổi giữa preview và admission, request có expected prompt revision phải báo conflict để người dùng xem lại; không tạo job với prompt khác preview một cách im lặng. Preview hiển thị context/version/hash; không hứa byte-identical nếu context cũng đã đổi.

Media plan đã admission là một operation có snapshot riêng: giữ nguyên khi execute/recover. Muốn dùng cấu hình mới phải tạo plan/operation mới, không sửa snapshot cũ. Selected Take preview hiển thị kết quả lịch sử; preview “lần tạo mới” dùng cấu hình hiện hành và phân biệt rõ hai ý nghĩa.

### 3.4. API và shared contracts dự kiến

| API | Hành vi |
| --- | --- |
| `GET /api/v1/settings/prompts` | Settings hiện hành, revision, danh mục loại prompt và defaults để khôi phục |
| `PUT /api/v1/settings/prompts` | Validate và lưu nguyên cấu hình với expected revision; trả bản đã lưu |
| `POST /api/v1/settings/prompts/preview` | Compile draft/saved config cùng typed context IDs; trả final prompts, revision/hash và lỗi validation |

Shape đề xuất: `formatVersion`, `revision`, `activeStyleId`, `styles[]`, `instructions{chapterAnalysis,characterReference,storyboard,video}`, `videoNegativePrompt`. Mỗi style chứa `id`, `name`, `positivePrompt`, `negativePrompt`, `characterRenderingPrompt`. Hash chỉ tính semantic content, không gồm timestamp; revision là provenance, không thay thế hash input.

Giới hạn đề xuất: tối đa 32 style; tên 1–120 ký tự; tối đa 32 KiB UTF-8 mỗi instruction/style block và 512 KiB toàn config. Negative prompt được phép rỗng; active style phải tồn tại; ID duy nhất; format version/fields lạ bị từ chối. Provider input budget vẫn được kiểm tra trên prompt hoàn chỉnh trước dispatch. Chốt các giới hạn bằng tests với defaults thật; không tăng giới hạn provider chỉ để nhận prompt quá dài.

Reset trong Prompt là đưa defaults vào draft, chỉ áp dụng khi Save. Reset Desktop/window hiện tại giữ đúng phạm vi Desktop và được ghi nhãn rõ, không ngầm xóa backend prompt configuration.

### 3.5. Tương thích và migration

- Khảo sát tất cả usages `ImageStyle`, payload `imageStyle`, enum/schema checks, render settings, client contracts, fixtures và SQL trước đổi kiểu. ID preset cũ tiếp tục đọc được; snapshots lịch sử không được diễn giải lại qua style text mới.
- API tạo operation mới resolve global active style. Desktop bỏ việc gửi lựa chọn style hardcode. Nếu legacy request còn gửi style khác active global style, trả lỗi rõ ràng yêu cầu refresh client/settings thay vì âm thầm override; chỉ nhận legacy field khớp preset active trong giai đoạn tương thích.
- Không backfill prompt provenance giả cho job cũ. Đường replay legacy dùng frozen payload/resources đúng version cũ; nếu thiếu dữ liệu để tái tạo chính xác thì báo không thể replay an toàn, không thay bằng defaults mới.
- Thêm persistence theo MyBatis hiện có. Trước chọn migration file, kiểm tra Flyway applied history và baseline đã freeze chưa theo [DATABASE.md](../architecture/DATABASE.md). Không tự reset DB. Không mặc định V14 nếu inventory đã tiến thêm.
- Nếu baseline còn editable, đặt schema trong migration sở hữu tương ứng; nếu đã freeze, dùng migration forward mới và seed an toàn. Giữ ba preset ID cũ, seed chỉ khi chưa có cấu hình; app upgrade không ghi đè tùy chỉnh.
- Giữ lịch sử prompt resources cần cho replay. Xóa nguồn hardcode runtime sau khi mọi caller đã chuyển, không xóa resources lịch sử đang được snapshot tham chiếu.

## 4. Settings → Prompt UX

- Dùng mục/tab Prompt trong Settings, ví dụ `/settings?tab=prompt`; giữ navigation/returnTo của workspace và Account hiện có.
- Form đầu trang: **Style áp dụng cho tất cả project**; chọn preset/custom style; sửa tên/nội dung; sao chép thành style mới.
- Các phần có nhãn rõ: **Style**, **Phân tích truyện**, **Ảnh nhân vật**, **Storyboard**, **Video**. Textarea có copy, đếm dung lượng, validation tại field; không thêm code editor dependency.
- Preview chọn context thuộc project có thật, xem final positive/negative và phần protected instructions. Chưa có dữ liệu thì chỉ rõ context cần chọn/tạo, không chèn fake data vào app.
- Nút **Lưu**, **Hủy thay đổi**, **Khôi phục mặc định**. Save/loading/error/conflict/retry và trạng thái chưa lưu phải rõ; back/navigation khi dirty cần bảo toàn hoặc xác nhận bỏ draft.
- Chú thích: “Áp dụng cho lần phân tích/tạo mới trên mọi project. Job đã tạo và kết quả hiện có giữ nguyên.” Hiển thị sau Save khi đã có response thành công.
- API unavailable phải có retry và giữ draft; không hiện thông báo thành công giả. Response save/preview cũ không được ghi đè chỉnh sửa mới hoặc context vừa chuyển.
- Dùng centralized semantic tokens và components hiện có; kiểm tra focus/keyboard, light/dark, màn hình nhỏ, prompt dài và overflow theo [styling rule](../../.agents/rules/frontend-styling.md).

## 5. Các bước triển khai

Aliases: `B` = `app/backend-service/src/main/java/com/narrativex/backend/feature/generation`; `R` = `app/backend-service/src/main/resources`; `BT` = package test tương ứng; `D` = `app/desktop/src`; `DT` = `app/desktop/test`; `C` = `packages/client-contracts/src`. File mới dưới đây là đề xuất, reuse seam hiện có nếu cùng trách nhiệm.

### T01 — Chốt contract, defaults và boundary

**Files:** `B/domain/enums/ImageStyle.java`, `B/application/model/prompt/*` mới, `R/prompts/defaults/v1/*` mới, `C/prompt-settings.ts` mới, `C/index.ts`; ADR mới trong `documentation/decisions/`.

- [ ] Inventory đầy đủ hardcode/callers/persistence/fixtures; xác nhận defaults cho ảnh và video, tách prose sáng tạo khỏi invariants.
- [ ] Ghi ADR Proposed với số kế tiếp lúc thực hiện: installation-wide config, mọi project dùng active style, backend authority và per-operation snapshots. Không ghi Accepted thay người dùng/reviewer.
- [ ] Định nghĩa typed config/preview/snapshot và validation, mapping legacy IDs; chuyển creative defaults sang resources.
- [ ] Viết tests defaults đầy đủ, style khác không nhận câu 3D/negative cũ, unknown fields/IDs/size limits và BIGINT revision.

### T02 — Persistence và Settings API

**Files:** `B/application/port/out/PromptSettingsRepository.java`, `B/application/usecase/PromptSettingsUseCase.java`, `B/api/controller/PromptSettingsController.java`, `B/infrastructure/persistence/adapter/MyBatisPromptSettingsAdapter.java`, mapper/row tương ứng mới; `R/mybatis/PromptSettingsMapper.xml` mới; Flyway file xác định theo mục 3.5.

- [ ] Thêm singleton config, constraints, revision/CAS và initialization an toàn; không tạo identity/project override.
- [ ] Implement GET/PUT; atomic save/reset-through-draft; không external I/O trong transaction.
- [ ] Test API success/validation/conflict, concurrent first initialization, seed không overwrite, DB restart vẫn giữ cấu hình và migration với database hiện có.

### T03 — Một đường compose cho ảnh, nhân vật và video

**Files:** `B/application/service/{VisualPromptComposer,StoryboardVisualPromptComposer,CharacterIdentityPromptComposer,SharedCharacterRenderingLanguage,VideoPromptCompiler,MediaPlanSceneResolver,GenerationRouter}.java`; `B/infrastructure/prompt/{BackendVisualBeatPromptProvider,BackendCharacterIdentityPromptProvider,VisualBeatPromptContextAdapter}.java`; resolver/preview use case mới; tests composer/provider hiện có và mới.

- [ ] Truyền resolved configuration bằng typed value; không để composer tự gọi Settings repository hoặc hardcode chọn style.
- [ ] Thay mọi nhánh prose/style/negative cố định; giữ structured camera/motion, source/canon/continuity, reference selection và shot-aware negatives hợp lệ.
- [ ] Implement preview bằng cùng composer; batch load cấu hình một lần, tránh N+1; bảo toàn sanitization đúng một lần.
- [ ] Test cả ba preset và custom style xuyên character/storyboard/video; không duplicate style, không xung đột positive/negative, context chỉ chứa participating characters.
- [ ] Test preview bằng prompt thực tế trong materialized provider inputs với cùng config/context; test lỗi context/archived project và prompt budget.

### T04 — Freeze cấu hình ở admission và Chapter Analysis

**Files:** `B/application/usecase/GenerateShotTakeUseCase.java`, các media-plan/admission/job handlers liên quan; `B/infrastructure/analysis/{ChapterAnalysisContractResources,vertex/VertexGeminiClient}.java`; `B/application/model/analysis/{ChapterAnalysisExecutionProfile,ChapterAnalysisExecutionSnapshot}.java`; store/mapper/snapshot schema liên quan; `C/generation.ts`, `C/story-analysis.ts` khi contract cần đổi.

- [ ] Snapshot final prompts + provenance tại operation/plan admission; workers/adapters chỉ dùng frozen inputs. Không đổi Compute Protocol chỉ để gửi business settings.
- [ ] Truyền analysis effective instructions qua đường Vertex hiện tại; schema 1.1, semantic validation/source anchors vẫn bắt buộc; input-budget tính cả custom instructions.
- [ ] Chuẩn bị seam dùng cùng snapshot cho Antigravity khi runner tồn tại; không triển khai OAuth/provider mới trong task này.
- [ ] Dùng current settings cho operation/retake mới ở mọi project; replay/recovery/job đã queued dùng original inputs; đổi Settings không trigger generation.
- [ ] Test CAS/preview-admission race, batch revision nhất quán, idempotency replay sau Save/reset, UNKNOWN recovery, old snapshots và operation mới với key mới.
- [ ] Test custom analysis instructions đến actual provider request builder, schema không đổi, output sai vẫn bị từ chối, provider không tự đọc defaults mới khi retry.

### T05 — Desktop Settings → Prompt và caller cut-over

**Files:** `D/renderer/features/settings/screens/SettingsScreen.tsx`, `D/renderer/features/settings/components/PromptSettingsPanel.tsx` mới, API/hooks trong feature settings mới; `D/renderer/api/client.ts`, `D/renderer/app` hoặc router hiện có nếu cần; generation/analysis caller components hiện có; `C/prompt-settings.ts`; tests tại `DT/`.

- [ ] Xây form/preview/save/reset theo mục 4, reuse backend bridge và semantic tokens; không phát triển storage/IPC song song.
- [ ] Cập nhật create/retake/analysis callers bỏ fixed style; truyền expected revision khi xuất phát từ preview; invalidate/refetch prompt previews giữa các workspace sau Save.
- [ ] Test save/refetch/restart, default/custom styles, dirty navigation, reset draft, API errors, conflict và out-of-order save/preview responses.
- [ ] Test bridge transport thật cho endpoints mới; đảm bảo không mở quyền filesystem/process hoặc provider credentials cho renderer.

### T06 — Runtime verification và tài liệu

**Files:** `DT/` integration tests, script/evidence theo convention hiện có; `documentation/architecture/DATABASE.md`, `documentation/product/PRODUCT_SPEC.md`, tài liệu workflow sở hữu prompt; `documentation/CURRENT_STATUS.md`, ADR index và plan này.

- [ ] Start/reuse Electron + Vite + backend + PostgreSQL; làm flow Settings → Prompt → preview → Save → tạo operation ở **hai project đã tồn tại**; xác nhận inputs dùng style mới.
- [ ] Đổi style trong khi có job queued/running; xác nhận frozen payload/replay không đổi. Không tốn provider/GPU chỉ để kiểm tra Save/preview; kiểm actual persisted admission payload và runtime provider riêng khi môi trường sẵn sàng.
- [ ] Xác minh restart, reset, concurrent edit, loading/error/empty states, Account/back navigation, keyboard, light/dark, viewport nhỏ và prompt dài.
- [ ] Kiểm console errors, failed API requests, unexpected fake data và layout overflow; capture screenshots sau implementation theo [browser rule](../../.agents/rules/playwright-testing.md).
- [ ] Chạy checks phù hợp và full gate bên dưới; ghi kết quả thật. Thiếu runtime UI automation thì ghi **runtime-verification blocked**, không đánh dấu UI DONE.
- [ ] Cập nhật docs đúng trạng thái; kiểm local links/migration inventory/docs drift. Chỉ chuyển trạng thái IMPLEMENTED sau evidence; không gộp thành claim Antigravity đã production-ready.

Mỗi task runtime phải có tests success/error/race tương ứng và targeted checks pass trước bước tiếp theo. Không tick task implementation trong lần chỉ viết kế hoạch này.

## 6. Acceptance criteria

1. Có Settings → Prompt; sửa, lưu, reload/restart vẫn giữ cấu hình.
2. Chọn cinematic/watercolor/anime hoặc style riêng không cần sửa source/rebuild; final prompt không bị style hardcode khác phủ định.
3. Lưu cấu hình một lần rồi tạo operation mới ở hai project cũ: cả hai dùng revision/style mới; không phải lưu settings riêng từng project.
4. Custom analysis/character/storyboard/video instructions xuất hiện ở đúng final request; preview và execution cùng input phải khớp.
5. Save không tạo chi phí/provider call, không tự tái tạo media hoặc phân tích lại truyện.
6. Job queued/running/replay/UNKNOWN recovery giữ nguyên frozen prompt; assets/Take/render snapshots cũ không đổi.
7. Stale save/preview conflict có thông báo rõ, không ghi đè dữ liệu hoặc âm thầm tạo bằng revision khác.
8. Backend vẫn enforce schema/source/identity/consent/safety/capability; worker không biết business settings và không đọc DB.
9. Có runtime UI evidence; fixtures/unit tests riêng không được dùng để khẳng định production provider health.

## 7. Checks và rollout

Theo [CONTRIBUTING.md](../../CONTRIBUTING.md): targeted backend `./mvnw.cmd test` (dùng output directory riêng nếu IDE đang compile), Desktop `npm test`, `npm run type-check`, `npm run build`. Database tests cần PostgreSQL thật hoặc môi trường integration hợp lệ; thiếu môi trường phải ghi rõ.

Full gate trước push/merge: `pwsh -File scripts/verify-local.ps1`. Docs: `python -B scripts/check-docs-drift.py`, `git diff --check` và edited local links. Nếu thật sự sửa compute contracts/worker thì chạy checks tương ứng của repo; thiết kế này ưu tiên giữ wire contract hiện tại.

Rollout thứ tự: contract/defaults → schema/API → shared composition + snapshot admission → provider/caller cut-over → Settings UI → runtime verification. Release UI editing chỉ khi các execution paths đã dùng resolver/snapshot, tránh tình trạng Save thành công nhưng provider vẫn dùng hardcode. Khi cần dừng rollout, chặn operation mới và bảo toàn cấu hình/journals/snapshots; chỉ rollback application/schema khi tương thích, không xóa tùy chỉnh hoặc replay bằng binary cũ không hiểu snapshot mới.

## 8. Giới hạn phạm vi

Không thêm project override, cloud sync, prompt marketplace, A/B evaluation, model training, lịch sử editor đầy đủ hoặc provider/OAuth mới. Các điểm này không cần để hoàn thành yêu cầu sửa prompt/style dùng chung. Chưa đổi runtime/UI/schema trong lần lập kế hoạch; các commands và runtime flows trên là công việc implementation phải thực hiện.
