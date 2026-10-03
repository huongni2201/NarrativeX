# Codebase Maintainability — Refactor Plan

> **For agentic workers:** Dùng `superpowers:executing-plans` khi được yêu cầu triển khai. Mọi checkbox là công việc TARGET; lần khảo sát này chỉ tạo kế hoạch, chưa refactor runtime.

**Status:** PARTIAL — implementation và evidence theo [execution record](codebase-maintainability-execution.md); các checkbox chưa nghiệm thu vẫn là TARGET. Không áp dụng dependency mới.

**Reviewed:** 2026-10-02, HEAD `06e381d8e` và working tree có thay đổi chưa commit.

**Goal:** Giảm code lặp và số nơi phải sửa cho một thay đổi nghiệp vụ; giữ code dễ đọc, dễ kiểm thử và mở rộng provider/runtime mà không làm recovery phức tạp hơn.

**Architecture:** Giữ Spring modular monolith, PostgreSQL business authority, worker domain-neutral và Electron main sở hữu bytes/process. Refactor theo từng luồng đang tồn tại; tận dụng Lombok, Java records, TanStack Query, ArchUnit và các helper hiện hữu.

**Tech Stack:** Java 25 / Spring Boot 4.1.1 / MyBatis / Flyway; Python 3.14 / FastAPI / Pydantic / SQLite; Electron / React 19 / TypeScript / TanStack Query 5.

**Spec:** Yêu cầu tối ưu khả năng bảo trì, mở rộng và đọc hiểu code; [repository guidance](../../AGENTS.md), [current status](../CURRENT_STATUS.md), [compute protocol](../COMPUTE_PROTOCOL.md), ADR-0018/0019/0020/0021/0025. Kế hoạch này bổ sung cho [Video production reliability plan](../product/VIDEO_PRODUCTION_RELIABILITY_PLAN.md).

## 1. Phạm vi và bằng chứng

Khảo sát inventory toàn bộ source, dependency/build configuration, architecture tests và các hotspot; đọc luồng production từ renderer/query/API đến use case, dispatch, compute lifecycle và persistence. Đây là phân tích tĩnh có đọc source cụ thể, không phải kết quả profiling, coverage mới hay E2E production. Không khẳng định đã đọc từng dòng của mọi file.

| Source được thống kê | File | Dòng vật lý, gồm comment/dòng trống |
|---|---:|---:|
| Backend `src/main/java`, `.java` | 781 | 40.792 |
| Desktop `src`, `.ts` và `.tsx` | 194 | 23.109 |
| Generation service `src`, `.py` | 63 | 5.160 |

Các số này mô tả working tree lúc khảo sát; không dùng số dòng làm thước đo duy nhất của chất lượng.

| Ưu tiên | Quan sát từ source | Hướng xử lý |
|---|---|---|
| P1 | [GenerationJob](../../app/backend-service/src/main/java/com/narrativex/backend/feature/generation/domain/aggregate/GenerationJob.java) có 1.211 dòng, 35 getter thuần, nhiều overload `rehydrate`, `toBuilder` và builder viết tay | Sinh phần boilerplate; giữ factory, constructor validation và lifecycle method tường minh |
| P1 | [Maven configuration](../../app/backend-service/pom.xml) đã có Lombok 1.18.46 và annotation processor; source đã có 180 lần `@RequiredArgsConstructor`, 75 `@Getter`, 74 `@Setter` | Mở rộng có chọn lọc, không cài lại hoặc đổi version trong cùng PR refactor |
| P1 | Quét Java main tìm thấy 273 getter chỉ `return field`, trong 35 file, tương ứng 819 dòng method | Đây là danh sách ứng viên, không phải 819 dòng net có thể xóa chắc chắn |
| P1 | [GetChapterProductionUseCase](../../app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/usecase/GetChapterProductionUseCase.java) có 442 dòng: đọc dữ liệu, voice lookup, preflight, dựng response, status và parse metrics | Tập trung preflight dùng chung, memoize voice trong một request, tách projection khỏi transport |
| P1 | Production read hiện **đã** dùng `findByShotIds` cho takes/selected takes; voice lookup vẫn nằm trong vòng lặp cue | Giữ batch reads hiện có; đo và tối ưu phần lookup còn lặp |
| P1 | [GenerateShotTakeUseCase](../../app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/usecase/GenerateShotTakeUseCase.java) và production read cùng kiểm tra unsupported strategy/voice readiness | Một evaluator thuần dùng ở read và admission, tránh sửa hai nơi |
| P1 | [VideoGenerationJobHandler](../../app/backend-service/src/main/java/com/narrativex/backend/feature/generation/infrastructure/dispatch/VideoGenerationJobHandler.java) có 511 dòng: chọn shot, parse JSON trong `sourceText`, routing, reference, persistence, HTTP submit và phân loại lỗi | Typed intent/snapshot; handler điều phối, transaction service giữ state; phối hợp reliability plan |
| P1 | [video-production queries](../../app/desktop/src/renderer/features/production/queries/video-production.queries.ts) và [chapter-production queries](../../app/desktop/src/renderer/features/storyboard/queries/chapter-production.queries.ts) gọi cùng endpoints với hai key family | Một API module, một key family và một quy tắc refresh |
| P1 | [project-events](../../app/desktop/src/renderer/features/generation/realtime/project-events.ts) invalidate generation rộng; danh sách refresh chưa nêu production/story family đầy đủ | Refresh đúng Project/Chapter; reconnect lấy snapshot; gom progress ticks |
| P2 | [bootstrap-core](../../app/desktop/src/main/bootstrap-core.ts) có 585 dòng; [ProjectStorage](../../app/desktop/src/main/local-storage/project-storage.ts) có 1.055 dòng | Tách IPC registration theo feature; giữ storage facade và lock ownership |
| P2 | [ProjectsScreen](../../app/desktop/src/renderer/features/projects/screens/ProjectsScreen.tsx) có 608 dòng, nhiều dialog/empty-state JSX; [ChapterProductionStage](../../app/desktop/src/renderer/features/chapters/components/stages/ChapterProductionStage.tsx) có 472 dòng và tự suy diễn một phần readiness | Tách khối giao diện có trách nhiệm rõ; hiển thị trạng thái backend |
| P2 | [ExecutionApplicationService](../../app/generation-service/src/narrativex_gpu_worker/application/services/execution.py) có 430 dòng với nhiều nhánh tạo observation; journal có 554 dòng và giữ state/outbox trong một transaction | Rút phần tạo observation lặp sau khi khóa semantics bằng tests; giữ journal atomicity |
| P2 | 23 file application import `api.response`; [ArchitectureRulesTest](../../app/backend-service/src/test/java/com/narrativex/backend/architecture/ArchitectureRulesTest.java) hiện cho phép response của cùng feature | Đổi production slice sang application view trước; tăng dần dependency rule |
| P2 | [video-production-components tests](../../app/desktop/test/video-production-components.test.mjs) và [SSE contract test](../../app/desktop/test/sse-subscription-contract.test.mjs) chủ yếu kiểm tra source bằng regex | Giữ các structural checks cần thiết, bổ sung test chạy logic và runtime flow |

Các file marker `domain/models.py`, `domain/fingerprint.py`, `api/app.py` của worker chỉ còn comment xóa/removed; không tìm thấy import bằng đường module đầy đủ trong repo được quét. Có thể xóa sau khi kiểm tra cả relative imports và package/export entrypoints, nhưng tác động nhỏ.

**Docs drift đã thấy:** `CURRENT_STATUS.md` nói V1–V9, source có V1–V10. `DATABASE.md` liệt kê V1–V10 nhưng đoạn post-production vẫn nói freeze V1–V8/forward từ V9. Script docs drift hiện pass; nó chưa bắt hết mâu thuẫn nội dung này. Chưa kết luận database đang dùng đã migrate hay baseline đã frozen.

## 2. Quyết định về thư viện

| Công cụ | Quyết định | Phạm vi phù hợp |
|---|---|---|
| Lombok | Dùng dependency đã có | `@Getter` cho accessor thuần; `@RequiredArgsConstructor` cho DI không có logic; constructor-level `@Builder(toBuilder = true)` sau pilot |
| Java records / enums / stdlib | Ưu tiên khi đủ | DTO/view/value carrier; enum thuộc đúng domain; `Map` memoization trong request |
| TanStack Query | Dùng bản đã có | Key factory, `queryOptions`, targeted invalidation; không lưu thêm bản sao server state trong Zustand |
| ArchUnit | Dùng dependency test đã có | Bảo vệ dependency direction và feature ownership sau từng slice |
| MapStruct | **OPTIONAL**, pilot một mapper trước | Mapping field thuần từ domain sang mutable persistence row; không đưa business rules vào generated mapper |

[Lombok Getter/Setter](https://projectlombok.org/features/GetterSetter) hỗ trợ sinh accessor. Dùng annotation ở field nếu class không được phép expose toàn bộ field. Giữ getter có transform, defensive copy hoặc logic. Không áp dụng `@Data` hàng loạt cho aggregate: annotation còn sinh equality, setters và `toString`, có thể thay đổi mutation/identity và cách dữ liệu được log. Xem [Lombok Data](https://projectlombok.org/features/Data).

[Lombok Builder](https://projectlombok.org/features/Builder) có thể đặt trên constructor có validation và sinh `toBuilder`. Với `GenerationJob`, `id`/`rowVersion` kế thừa phải lấy qua accessor bằng `@Builder.ObtainVia`; giữ tên builder/public surface khi có caller. Kiểm tra generated code, không mặc định `@SuperBuilder` cho toàn bộ inheritance tree.

[TanStack query options](https://tanstack.com/query/latest/docs/framework/react/guides/query-options) cho phép đặt key và fetch function cùng nhau. [Targeted invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation) dùng key có biến Project/Chapter để tránh refresh tất cả cache.

Nếu pilot MapStruct có lợi, cấu hình `unmappedTargetPolicy = ReportingPolicy.ERROR`, kiểm tra generated code và annotation processors trên **Java 25 hiện dùng**. Lombok integration cần `lombok-mapstruct-binding` theo [MapStruct reference](https://mapstruct.org/documentation/stable/reference/html/#_lombok). Chưa xác nhận compatibility bằng compile trong lần lập plan này. Không đổi sang ORM để giảm mapping.

## 3. Global constraints và review focus

- Giữ Project là business boundary và single-user local-first theo [ADR-0020](../decisions/ADR-0020-single-user-local-first-architecture.md).
- Giữ backend business authority và worker domain-neutral theo [ADR-0018](../decisions/ADR-0018-backend-control-plane-and-domain-agnostic-gpu-execution-plane.md) / [ADR-0019](../decisions/ADR-0019-generation-service-light-ddd-hexagonal-structure.md).
- Intent/checkpoint phải durable trước external I/O; UNKNOWN không cấp phép blind retry; terminal state không regress, sequence không đi lùi theo [ADR-0021](../decisions/ADR-0021-submission-checkpoint-and-worker-recovery-semantics.md) / [ADR-0025](../decisions/ADR-0025-event-driven-compute-orchestration-and-reconciliation.md).
- Giữ immutable versions, approved takes/assets, provider/render snapshots, CAS và local-storage checksum/path/symlink checks.
- Không thay schema/wire contract để làm một PR boilerplate ngắn hơn. Schema work phải theo baseline policy đã được xác minh và review riêng.
- Không xóa inbound/outbound ports chỉ vì hiện có một implementation: chúng còn bảo vệ ownership, external I/O và test seams. Chỉ bỏ wrapper khi không có policy, invariant hoặc caller cần nó.
- Domain setters không thay thế `rename`, `approve`, `select`, `markCompleted` và các business methods tương tự.
- Không dùng một enum chung cho backend job status, shot/take status và worker wire state: chúng có semantics khác nhau.

Các điều kiện phải được test trong task sở hữu: builder không mất ID/version; preflight read và admission cùng kết luận; thiếu production status không mở Render; lost ACK/restart không tạo compute thứ hai; concurrent storage mutation/restore không mất manifest hoặc thoát project root.

## 4. Tasks triển khai

### Task 0 — Khóa baseline và phối hợp công việc hiện hữu

**Files:** [CONTRIBUTING](../../CONTRIBUTING.md), [local gate](../../scripts/verify-local.py), reliability plan; docs status/database khi sửa drift.

**Deliverable:** Baseline có evidence thật và danh sách những lỗi đã thuộc reliability plan. Không tạo một plan sửa lỗi song song với khác semantics.

- [ ] Đọc lại HEAD, dirty files và caller trước mỗi PR; giữ thay đổi hiện hữu, đặc biệt POM, production use case/tests và worker supervisor.
- [ ] Chạy relevant tests trước refactor, ghi PASS/FAIL/SKIP và lý do. Không biến skipped PostgreSQL/native/GPU tests thành pass.
- [ ] Đối chiếu reliability Tasks 3/5/9/11/12 trước khi sửa admission, recovery, readiness, UI và cache refresh; một implementation chung sở hữu mỗi thay đổi.
- [ ] Sửa factual migration inventory/docs trong PR docs riêng; xác minh freeze policy từ deployment evidence, không reset DB.
- [ ] Mỗi PR có diff đọc được, gate phù hợp và rollback bằng revert; tránh PR format toàn repo trộn semantic changes.

### Task 1 — Pilot getter cleanup bằng Lombok

**Files:** `generation/domain/entity/Take.java`, `generation/domain/aggregate/GenerationJob.java`, sau đó `storyboard/domain/entity/{Shot,VisualBeat}.java`. Các path backend feature tương đối với `app/backend-service/src/main/java/com/narrativex/backend/feature/`.

**Interface:** Giữ chính xác public accessor names, return types, visibility và constructor/business methods.

- [ ] Bắt đầu `Take` và `GenerationJob`; thay getter `return field` bằng `@Getter` có phạm vi tương ứng. Không thêm setter cho immutable domain.
- [ ] Giữ accessor defensive copy/transform và getter của superclass nếu chúng có contract riêng. Không thêm getter cho field trước đây chưa public.
- [ ] Chạy `TakeDomainTest`, `GenerationJobMediaPlanTest`, `GenerationJobStateMachineTest` và API/persistence tests liên quan; chỉ thêm regression nếu annotation làm khác property naming/serialization.
- [ ] Chạy Spotless và backend verify. Khi pilot pass mới mở rộng từng feature, không sửa cả 35 class một lần.

**Acceptance:** Caller và serialization không đổi; constructor validation còn nguyên; diff chỉ bỏ accessor boilerplate. Đếm net diff sau pilot, không đặt KPI phải đạt 819 dòng.

### Task 2 — Rút builder của GenerationJob

**Files:** `generation/domain/aggregate/GenerationJob.java`; existing domain tests, `GenerationJobRepositoryIntegrationTest`; create `generation/domain/aggregate/GenerationJobCopyTest.java` trong test tree.

**Interface:** Giữ `create*`, `rehydrate*`, `toBuilder()` và lifecycle methods. Constructor canonical vẫn là nơi kiểm tra progress/media-plan pointer/analysis preferences.

- [ ] Viết một round-trip test với đầy đủ snapshot/checkpoint fields: `toBuilder().build()` giữ ID, rowVersion, source, compute handles/sequences và timestamps; thay một field không làm mất các field khác.
- [ ] Pilot `@Builder(toBuilder = true)` trên validating constructor; xử lý inherited fields bằng `@Builder.ObtainVia(method = "getId")` và `getRowVersion` tương ứng, giữ tên builder khi cần.
- [ ] Kiểm tra generated `toString` của builder để tránh tự động log source/prompt; không mở thêm construction path bỏ qua factory validation. Giữ constructor/business validation tường minh.
- [ ] Xóa builder/copy boilerplate đã được thay; chỉ gộp `rehydrate` overload khi đã migrate mọi caller thật và fixture.
- [ ] Chạy domain, reconciliation, repository integration và backend verify. Nếu inheritance/custom builder làm diff khó đọc hơn, giữ builder tay và chỉ nhận getter cleanup.

### Task 3 — Một preflight và một nơi tính readiness

**Files:** `generation/application/usecase/{GetChapterProductionUseCase,GenerateShotTakeUseCase}.java`, `character/application/service/SpeakerVoiceResolver.java`; create `generation/application/service/GenerationPreflightEvaluator.java` nếu reliability work chưa có evaluator dùng chung.

**Interface dự kiến:** `Preflight evaluate(ShotInfo shot, List<AudioCueInfo> cues, Map<UUID, Optional<ResolvedSpeakerVoice>> voices)`; `Preflight` chứa `ready`, `blockers`, `warnings`. Dùng record/enum hiện hữu ở các ports. Evaluator không làm SQL/HTTP.

- [ ] Test cả read và admission cho unsupported strategy, dialogue/voiceover thiếu speaker/profile, và profile text-only/reference-conditioned đúng capability/policy của reliability plan; không tự nâng yêu cầu thành voice cloning.
- [ ] Memoize `resolveSpeakerVoice` theo participating speaker ID trong một request, bao gồm kết quả `Optional.empty()`. Giữ batch takes/selected takes hiện có.
- [ ] Di chuyển rule generation preflight sang evaluator, dùng ở cả hai use case; voice/profile lookup ở bên ngoài evaluator.
- [ ] Readiness timeline/render dùng evaluator authoritative mà reliability Task 9 sở hữu; phân biệt generation-ready, QC, selected take, timing/media-ready. Renderer chỉ trình bày kết quả, missing status là chưa có evidence.
- [ ] Test nhiều VisualBeats dùng cùng StoryBeat và 100 cue lặp cùng speaker: voice resolver gọi một lần/speaker trong request; legacy VisualBeat chưa có StoryBeat vẫn đọc được đúng compatibility contract.
- [ ] Chạy `GetChapterProductionUseCaseTest`, `GenerateShotTakeUseCaseTest`, timeline/render admission tests và PostgreSQL suites liên quan. Nếu số distinct speakers lớn gây fan-out đo được, mở rộng port/SQL batch ở PR sau.

### Task 4 — Hợp nhất production API/query/refresh

**Files:** `app/desktop/src/renderer/features/production/{api/video-production.api.ts,queries/video-production.queries.ts}`, các `features/storyboard/{api/chapter-production.api.ts,queries/chapter-production.queries.ts}`, `features/generation/realtime/project-events.ts`, callers trong chapter workspace/shotboard.

**Interface:** Giữ module production làm canonical owner, các thao tác `getProductionStatus`, `getProduction`, `generateTake`, `selectTake`, `updateStrategy`. Dùng một key family và `queryOptions`; giữ `expectedShotRowVersion`, retry inputs và idempotency policy khi migrate callers.

- [ ] Thêm test chạy `QueryClient`/refresh logic: mutation và SSE completion cập nhật cùng production/status/timeline keys; không ảnh hưởng Project khác.
- [ ] Migrate caller từ storyboard hooks/API sang canonical module, rồi xóa bản trùng. Chỉ để re-export tạm khi có caller chưa migrate, ghi task xóa cụ thể.
- [ ] Dùng một helper refresh theo Project/Chapter cho generate/select/strategy/SSE; cập nhật story sau analysis completion. Không invalidate mọi generation cache theo mỗi tick.
- [ ] Test reconnect, duplicate connected event, disconnect/unmount; connection tracking không tăng vô hạn. Fallback polling có bound và dừng khi terminal, không chỉ dựa vào cached response đã busy.
- [ ] Chạy Desktop checks và runtime flow: enqueue → completion → take xuất hiện → select → timeline refresh, cả cold reload/lost SSE/error/empty states; lưu screenshots.

**Acceptance:** Mỗi endpoint có một implementation client; một response không tồn tại dưới hai production keys; state đổi không cần focus/remount. Đây cũng là deliverable của reliability Task 12, chỉ thực thi một lần.

### Task 5 — Typed intent và dispatch dễ thay đổi

**Files:** `generation/application/{command/GenerateShotTakeCommand.java,usecase/GenerateShotTakeUseCase.java}`, `generation/infrastructure/dispatch/VideoGenerationJobHandler.java`, transaction service/finalizers theo reliability Tasks 3/5. Create `generation/application/model/VideoGenerationIntent.java` và codec/snapshot mapping tối thiểu khi chưa có type tương đương.

**Interface:** Typed intent mang `shotId`, `strategy`, `seed`, `retryFromTakeId`, `retryReason`; durable execution snapshot sở hữu attempt, fingerprint, deadline và immutable inputs. Wire Compute Protocol giữ nguyên trừ khi có ADR/contract change được review riêng.

- [ ] Tái sử dụng snapshot/admission đang được sửa trong reliability plan; một logical attempt replay không tính lại source/deadline/seed và không resubmit UNKNOWN.
- [ ] Thay `Map<String,Object>` + heuristic `sourceText.startsWith("{")` bằng parse/mapping có schema và version phù hợp. Giữ reader cho persisted legacy jobs; đánh giá storage column hiện hữu trước khi đề xuất schema mới.
- [ ] Để handler chỉ load snapshot → submit qua execution port → ghi observation; transaction service sở hữu durable state, routing/compiler sở hữu prompt/reference plan. DI dependency bắt buộc qua constructor; fixture xây dependency thật/fake ở test.
- [ ] Tập trung phân loại lỗi ở boundary đã có. Lỗi persist/admission/schema phải surfaced; metrics enrichment tùy chọn có fallback và diagnostic rõ. Không dùng blanket retry wrapper cho ambiguous submits.
- [ ] Batch reads trong `selectTargetShot` nếu còn dùng đường bulk: reuse `findByShotIds` đã có thay SQL theo shot. Bảo vệ allocation/CAS/unique constraints; bulk scheduling correctness thuộc reliability plan.
- [ ] Chạy dispatch, callback/reconciliation/finalizer, duplicate/restart/UNKNOWN và PostgreSQL tests; real provider smoke chỉ khi có môi trường và authorization phù hợp.

### Task 6 — Làm mỏng Electron bootstrap và storage internals

**Files:** `app/desktop/src/main/bootstrap-core.ts`, `local-storage/project-storage.ts`, `local-storage/project-catalog-ipc.ts`, `preferences/desktop-preferences-ipc.ts`; create `local-storage/project-storage-ipc.ts` cho các handler đang nằm inline.

**Interface:** Giữ preload channels/payloads và `ProjectStorage` public surface. Bootstrap khởi tạo dependencies và gọi feature registration theo pattern hiện hữu.

- [ ] Tách storage IPC handlers theo feature, tái sử dụng `registerTrustedIpcHandler*`, selection tokens và existing renderer trust policy. Không tạo DI container hoặc generic IPC framework.
- [ ] Tách pure file/path/checksum helpers của storage khi chúng làm class khó đọc; dùng một module nội bộ, không thêm interface cho mỗi helper. Giữ facade và đúng lifetime của project/snapshot locks.
- [ ] Giữ asset/artifact immutable registration, verified repair, atomic manifest behavior và backup/restore safeguards. Không bỏ checksum/symlink/path validation để giảm dòng.
- [ ] Chạy `project-storage-backup.test.mjs`, `remote-asset-materializer.test.mjs`, `project-catalog.test.mjs`, renderer trust/recovery tests; bổ sung concurrent mutation/restore regression nếu refactor di chuyển lock/transaction ownership.
- [ ] Thực thi Electron/native import → preview → render → backup → restore, bao gồm corrupt/missing input và cancel; browser-only checks không đủ để nghiệm thu IPC/filesystem.

### Task 7 — Renderer ít logic và dễ đọc hơn

**Files:** `ProjectsScreen.tsx`, `ChapterProductionStage.tsx`, existing project components và `VideoShotboard`/`TakeSelectorDrawer`; `app/desktop/src/renderer/styles.css` chỉ khi thiếu semantic token thực sự.

**Interface:** Screen giữ routing và orchestration; component con nhận data/action props. Server state ở TanStack Query, view/filter/draft state tại component hoặc store hiện hữu.

- [ ] Tách create/delete project dialog và empty-state block nếu thay đổi độc lập; các thẻ aspect ratio lặp dùng array + render chung nhỏ. Không tách mỗi khối vài dòng thành một file.
- [ ] Production stage dùng authoritative status/preflight, tái sử dụng take/shot components đã có; gỡ local readiness inference sau khi backend contract của Task 3/reliability Task 9 ổn định.
- [ ] Dùng semantic tokens/component variants hiện hữu; kiểm tra keyboard/focus, disabled/loading/error và overflow. Không đổi visual design cùng PR di chuyển code nếu không cần.
- [ ] Bổ sung test logic/interaction thực sự cho affected flow; regex source tests không được thay cho runtime evidence. Dùng `node:test` cho pure models và automation môi trường hiện có cho UI.
- [ ] Chạy Desktop checks, vào mọi screen bị ảnh hưởng, thử create/delete project, generation/retake/select/trim và cold reload; kiểm console/API và screenshot theo repository gate.

### Task 8 — Worker cleanup sau khi recovery đúng

**Files:** `app/generation-service/src/narrativex_gpu_worker/application/services/execution.py`, `adapters/persistence/sqlite_execution_journal.py`; tombstone modules ở `domain/{models,fingerprint}.py`, `api/app.py`; existing worker tests.

**Interface:** Giữ `ExecutorPort`, `ExecutionJournalPort`, `ExecutionContext`, capabilities và wire state. Provider adapters không nhập business domain.

- [ ] Hoàn tất ambiguity/restart fixes của reliability Task 5 trước khi gom exception branches. Viết case lost ACK/restart/cancel/timeout giữ không-resubmit và monotonic sequence.
- [ ] Gom đoạn tạo canceled/failed observation lặp thành private helper nhỏ trong service; giữ policy từng error code/category tại call site dễ đọc. Không biến mọi exception thành một nhánh generic.
- [ ] Giữ state update và outbox insert cùng SQLite connection/transaction. Chỉ tách initialization/schema helper nếu cải thiện rõ; không chia journal thành hai store làm mất atomicity.
- [ ] Xóa tombstone modules khi không còn absolute/relative import, packaging entrypoint hoặc consumer được hỗ trợ; không dựng compatibility layer mới cho file hiện chỉ có comment.
- [ ] Chạy `test_runtime.py`, `test_journal.py`, `application/test_execution_cancellation.py`, `test_architecture.py`, executor tests, Ruff/Mypy và compute contract check.

### Task 9 — Optional MapStruct pilot và dependency rules

**Files:** `app/backend-service/pom.xml`, `generation/infrastructure/persistence/adapter/MyBatisGenerationJobPersistenceAdapter.java`; create `generation/infrastructure/persistence/mapper/GenerationJobRowMapper.java`; production view/controller và architecture tests nếu migrate delivery coupling.

**Interface:** Pilot `GenerationJobRow toRow(GenerationJob job)`; `toDomain` vẫn đi qua validating `rehydrate`/factory. Database-assigned timestamps phải được ignore có chủ đích và giữ null/default semantics.

- [ ] Thử mapping một chiều `GenerationJob → GenerationJobRow`; dùng strict unmapped-target policy. Generated mapping không được tạo ID mới, increment version hoặc đổi timestamps.
- [ ] Cấu hình processor/binding đúng toolchain; test round-trip bằng repository integration, bao gồm null fields, enum fields và optimistic conflict/missing row.
- [ ] So sánh handwritten code cần duy trì, explicit annotations/custom mapping và mức dễ debug. Chỉ giữ dependency khi pilot đơn giản hơn; nếu không, named-field mapping viết tay vẫn phù hợp.
- [ ] Di chuyển production result sang `application/query/ChapterProductionView` và status view khi transport coupling gây change fan-out. Controller có thể serialize view trực tiếp nếu shape giống hệt; không tạo DTO/map lớp nữa chỉ để đủ tầng.
- [ ] Tăng rule ArchUnit cho slice đã migrate; 23 application imports là inventory migration, không bật rule toàn repo rồi bypass lỗi. Source checks cho schema/resource strings giữ riêng với compiled dependency tests.
- [ ] Chạy controller contract, persistence, architecture tests và backend verify; không thay API shape hoặc semantics trong PR pilot mapping.

## 5. Thứ tự thực hiện và cách nghiệm thu

**Đợt A — lợi ích nhanh, ít coupling:** Task 0 → Task 1; Task 2 là PR riêng sau getter pilot. Có thể làm cleanup thuần trong lúc reliability work tiếp tục.

**Đợt B — giảm số nơi phải sửa:** Task 3 và Task 4 phối hợp reliability Tasks 9/12; Task 5 đi cùng admission/recovery fixes. Đây là phần có tác động lớn nhất đến bảo trì vì tập trung rules, inputs và cache ownership.

**Đợt C — locality và testability:** Tasks 6/7/8 theo luồng đã ổn định; Task 9 là lựa chọn sau pilot, không là điều kiện để các đợt trước có ích.

Mỗi PR sửa một trách nhiệm, cập nhật test hành vi có rủi ro và relevant doc. Ưu tiên xóa code lặp sau khi migrate caller; không giữ hai implementation chạy lâu dài. Đo query/request count trước/sau cùng fixture/workload, không suy diễn giảm LOC thành tăng tốc runtime.

| Nghiệm thu | Evidence bắt buộc |
|---|---|
| Boilerplate | Public surface/validation không đổi; net diff và relevant tests |
| Maintainability | Một rule preflight, một production key family; thay strategy/status không phải sửa nhiều bản trùng |
| Persistence/worker | CAS, snapshots, idempotency, checkpoint/outbox/recovery tests thực sự chạy |
| Runtime performance | Query/request counts và timing có baseline; index/parallelism chỉ thêm khi measurement chứng minh |
| Desktop | Affected screens + actual flows + console/API/layout/loading/error/empty states + screenshot; thiếu automation thì runtime-verification BLOCKED |
| Libraries | Toolchain compile và behavior tests; dependency pilot có lợi rõ trước khi mở rộng |

## 6. Verification commands và trạng thái lần lập plan

Theo [CONTRIBUTING](../../CONTRIBUTING.md), chạy lệnh ở đúng working directory:

- Backend: từ `app/backend-service`, `./mvnw.cmd verify`; dùng `-Dnarrativex.buildDirectory=target/verification` khi IDE cũng compile vào `target/`.
- Desktop: từ `app/desktop`, `npm run check` (lock, tests, type-check, build), cộng mandatory runtime/native gate theo phạm vi.
- Worker: từ `app/generation-service`, `python -m pytest`, `python -m ruff check src tests`, `python -m mypy src`.
- Cross-language: từ repo root, `python scripts/check_compute_contracts.py`.
- Full provider-independent gate trước merge: từ repo root, `pwsh -File scripts/verify-local.ps1` (hoặc wrapper Windows PowerShell).
- Docs-only: `python -B scripts/check-docs-drift.py`, `git diff --check`, kiểm tra edited local links và migration inventory.

Full gate mặc định không thay thế evidence PostgreSQL suites thực sự chạy. Không dùng `--with-db` trước khi environment xác nhận database disposable theo script; không reset dữ liệu từ refactor plan.

**Planning verification:** Source/dependency/migration inventory và baseline docs drift đã được kiểm tra. Không chạy full backend/worker/Desktop tests hoặc runtime UI/GPU trong lần khảo sát này. Tất cả refactor tasks còn TARGET; không có claim tăng tốc, coverage mới hoặc production health.

## 7. Bổ sung: common classes, helpers và test support

**Common audit:** 2026-10-02, theo yêu cầu tìm phần dùng chung. Đây vẫn là đề xuất TARGET. Các thay đổi runtime đang diễn ra ở working tree khác phải được kiểm tra lại trước khi triển khai.

Một helper nên dùng chung khi cùng semantics, có caller thật và giúp sửa policy tại một nơi. Vị trí theo phạm vi: nhiều backend features → `feature/common`; nhiều Electron main modules → `main/local-storage` hoặc `main/api`; logic thuần main + renderer → `src/shared`; business rules → feature sở hữu; test infrastructure → test `support`. Dùng nhiều không tự động khiến một business rule thành `common`.

### 7.1. Common đã có — dùng lại, không tạo bản thứ hai

| Phần có sẵn | Bằng chứng/vai trò | Quyết định |
|---|---|---|
| [ApiResponse](../../app/backend-service/src/main/java/com/narrativex/backend/feature/common/response/ApiResponse.java) | Generic record, factory success; controllers Project/Generation/Production đã dùng | Giữ làm success envelope chung; không thêm `BaseController` hoặc wrapper chỉ bọc một dòng |
| [ApiExceptionHandler](../../app/backend-service/src/main/java/com/narrativex/backend/feature/common/api/ApiExceptionHandler.java), [ErrorResponse](../../app/backend-service/src/main/java/com/narrativex/backend/feature/common/api/ErrorResponse.java), correlation/field violations | Central exception → HTTP status/code/message; error body đã có correlation ID | Dùng lại; sửa dependency về generation subtype theo C3 bên dưới |
| [CursorPage](../../app/backend-service/src/main/java/com/narrativex/backend/feature/common/pagination/CursorPage.java), [CursorCodec](../../app/backend-service/src/main/java/com/narrativex/backend/feature/common/pagination/CursorCodec.java) | Cursor contract, validation, immutable content và `map` đã dùng chung | Dùng `page.map(...)` khi chỉ đổi item type; không viết lại cursor/page DTO trong từng feature |
| [UuidV7](../../app/backend-service/src/main/java/com/narrativex/backend/feature/common/uuid/UuidV7.java), [OptimisticConcurrency](../../app/backend-service/src/main/java/com/narrativex/backend/feature/common/infrastructure/persistence/OptimisticConcurrency.java) | ID policy và present/version guards | Reuse khi error semantics tương ứng; giữ phân biệt missing row/optimistic conflict ở adapter cần hai loại lỗi |
| [Desktop api client](../../app/desktop/src/renderer/api/client.ts), [pagination](../../app/desktop/src/renderer/api/pagination.ts), [guards](../../app/desktop/src/renderer/api/guards.ts) | Request/command, error details, repeated cursor protection và input predicates | Giữ transport tập trung. Main không import renderer; logic thuần có thể chuyển sang shared theo C4 |
| [PostgreSqlIntegrationTestSupport](../../app/backend-service/src/test/java/com/narrativex/backend/support/PostgreSqlIntegrationTestSupport.java), [FlywayMigrationContract](../../app/backend-service/src/test/java/com/narrativex/backend/support/FlywayMigrationContract.java) | Shared test container/configuration và migration inventory | Migrate setup trùng sang đây nếu lifecycle tương đương; không thêm base test chung khác |
| [Worker conftest](../../app/generation-service/tests/conftest.py) | `task_payload`, `compute_task`, `FakeExecutor`, `fake_executor` hiện có; payload tính lại fingerprint sau đổi deadline | Reuse cho task/fake cùng semantics. Fakes kiểm checkpoint/cancellation riêng vẫn đặt gần test |

`ApiResponse`, error DTO và pagination có bản TypeScript tại [client-contracts/api.ts](../../packages/client-contracts/src/api.ts). Đây là contract hai ngôn ngữ, không phải hai Java implementations cần gộp. Backend và Desktop nên được kiểm chứng cùng payload examples.

### 7.2. Phần nên gom — có duplication hoặc dependency cụ thể

| Ưu tiên | Đề xuất | Caller/bằng chứng | Phạm vi và test |
|---|---|---|---|
| P1 | Backend `Sha256.hexUtf8(String)` / `hex(byte[])` | [ChapterSourceHasher](../../app/backend-service/src/main/java/com/narrativex/backend/feature/storyboard/application/service/ChapterSourceHasher.java), [SourceAnchorResolver](../../app/backend-service/src/main/java/com/narrativex/backend/feature/storyboard/application/service/SourceAnchorResolver.java), [NarrationRequestFingerprint](../../app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/service/NarrationRequestFingerprint.java) lặp SHA-256/UTF-8/hex; CreateChapterWithStory còn format hex theo từng byte | New `common/hashing/Sha256.java`; JDK `MessageDigest` + `HexFormat`. Known digest, UTF-8 Vietnamese, byte equivalence và existing fingerprint/source-anchor tests |
| P1 | `sha256File(path)` + `isMissingFile(error)` | [ProjectStorage](../../app/desktop/src/main/local-storage/project-storage.ts) và [RemoteAssetMaterializer](../../app/desktop/src/main/local-storage/remote-asset-materializer.ts) trùng streaming hash; [ProjectCatalog](../../app/desktop/src/main/local-storage/project-catalog.ts) cũng có ENOENT predicate | New `main/local-storage/file-integrity.ts`; stream/checksum tests và existing storage/materializer/catalog suites. Không đưa Node filesystem vào renderer |
| P1 | Test database setup/fixtures | Ngoài shared support còn 11 class trực tiếp tạo PostgreSQLContainer khi khảo sát; SQL tạo Project/StoryVersion/Chapter lặp trong storyboard/generation/render integration tests | Reuse support trước; thêm factory fixture nhỏ trong test support khi setup giống nhau. Fresh IDs, data isolation, không thay test scenarios |
| P2 | Common exception reason/code | `ApiExceptionHandler.handleDomainConflict` hiện `instanceof` fully-qualified generation `GenerationAdmissionDeniedException` | Thêm code contract vào common `DomainConflictException`, subclass forward code; handler không cần biết feature subtype. HTTP contract + compiled dependency rule tests |
| P2 | Pure API envelope/JSON object helpers giữa main và renderer | Main materializer `parseApiData`, renderer `parseApiResponseBody` parse success/data riêng. `isRecord` renderer nhận cả array, bản main materializer loại array | New `shared/api-envelope.ts` nếu thống nhất policy; decode `unknown`, không tin generic `T` là runtime validation. Tests object/array/null, malformed JSON, no data, HTTP 204/error và per-feature payload guards |
| P1, feature-local | Production refresh/preflight helpers | Hai query modules và read/admission đã có duplication trong Tasks 3/4 | Giữ ở production/generation feature, không chuyển business logic sang common |

SHA helper **chỉ** làm digest. CRLF normalization thuộc `ChapterSourceHasher`; source anchoring thuộc storyboard; order/field selection/separator/canonical JSON của fingerprint vẫn thuộc owner. Không đổi fingerprint đang lưu, idempotency key hoặc normalization policy khi gom primitive này. Có thể reuse `ChapterSourceHasher` trực tiếp cho các caller cùng source-text policy; không ép device-token hoặc compute fingerprint dùng source normalization.

### 7.3. Tasks common cụ thể

#### C1 — Backend hashing primitive và Electron file integrity

**Create:** `app/backend-service/src/main/java/com/narrativex/backend/feature/common/hashing/Sha256.java`, corresponding `Sha256Test.java`; `app/desktop/src/main/local-storage/file-integrity.ts`, `app/desktop/test/file-integrity.test.mjs`.

**Modify:** Các hashing callers trong bảng 7.2; mở rộng sang callers khác sau khi đã trace input composition. Hai ngôn ngữ có implementation riêng, cùng known vectors khi cần.

- [ ] Khóa digest trước refactor: empty input, `abc`, Vietnamese/emoji UTF-8, CRLF/LF đúng policy hiện hữu và fingerprint representative.
- [ ] Tạo helper static/pure dùng JDK/Node native APIs; giữ `MessageDigest`/stream mới cho mỗi invocation, không dùng mutable digest singleton.
- [ ] Migrate callers và xóa body trùng. `isMissingFile` chỉ nhận ENOENT; permission/I/O errors phải propagate; checksum không đọc toàn bộ video vào RAM.
- [ ] Chạy hash/source-anchor/fingerprint/compute golden tests, file-integrity và storage/materializer/catalog tests; native import/preview/render khi refactor main theo repo gate.

#### C2 — Test support dùng chung, fixtures có giới hạn

**Modify:** `PostgreSqlIntegrationTestSupport`, các persistence/API integration test có cấu hình container tương đương; dùng `FlywayMigrationContract` làm migration inventory duy nhất.

**Create khi có setup trùng:** `app/backend-service/src/test/java/com/narrativex/backend/support/StoryDatabaseFixtures.java`, gồm các factory nhỏ `createProject(JdbcTemplate)`, `createStoryVersion(JdbcTemplate, UUID projectId)`, `createChapter(JdbcTemplate, UUID storyVersionId, String sourceText)` trả fresh UUID. Không thêm một fixture object chứa toàn bộ hệ thống.

- [ ] Migrate hai Spring integration tests đại diện trước, giữ `@DirtiesContext`/profile/Flyway/isolation semantics. Migration bootstrap tests có lifecycle riêng giữ setup riêng nếu cần.
- [ ] Gom SQL setup hợp lệ đang trùng, để invalid SQL/input và assertion tại test kiểm invariant. Test factory không tạo global state hoặc tự cleanup dữ liệu khác.
- [ ] Worker reuse existing `conftest`; tạo payload mới mỗi test và recompute fingerprint sau sửa input. Shared fake không che mất checkpoint/remote-I/O semantics của executor.
- [ ] Desktop chỉ thêm `test/support/temp-workspace.mjs` nếu lifecycle create/cleanup thực sự giống nhau; test đăng ký teardown, chỉ xóa directory chính nó tạo. Không gom mọi temporary filesystem operation vào production common.
- [ ] Chạy affected tests thực sự trên PostgreSQL; test không leak data giữa classes/order. Docker-unavailable SKIP được ghi là SKIP.

#### C3 — Common error mapping không biết generation subtype

**Modify:** `common/domain/exception/DomainConflictException.java`, `generation/domain/exception/GenerationAdmissionDeniedException.java`, `common/api/ApiExceptionHandler.java`, common API tests và ArchUnit rules.

- [ ] Giữ các constructor đang dùng; thêm `getCode()` với default `RESOURCE_CONFLICT` ở base common. Generation subclass forward reason code thay vì common handler inspect subtype.
- [ ] Test default conflict, known admission reason và unknown reason giữ safe fallback/HTTP 409, message/correlation payload không đổi.
- [ ] Thêm compiled rule common không phụ thuộc business feature. Không chỉ scan `import`: dependency hiện tại dùng fully-qualified type ở body nên import-only scan không phát hiện.
- [ ] Chạy common exception/MockMvc và admission tests. Giữ wire error codes đang có consumers; không đổi names chỉ vì gom common.

#### C4 — Shared API envelope/parser và contract examples

**Create:** `app/desktop/src/shared/api-envelope.ts`; shared predicate module nhỏ chỉ khi cần cho cả hai surfaces. **Modify:** renderer `api/client.ts`/`guards.ts`, main materializer/parser callers; API/client/materializer tests.

**Interface:** Pure success-envelope parser trả `ApiResponse<unknown>` sau validation; `data` guard và feature payload schema vẫn ở caller. HTTP status/204 handling, Electron transport, path-aware error mapping nằm ngoài helper thuần.

- [ ] Định nghĩa object semantics trước khi migrate: plain JSON object, loại array/null. Test các trường required và optional data; không mặc định null/malformed response thành success.
- [ ] Test cùng success/error/validation/pagination payload examples ở backend và Desktop. Tái sử dụng test cases hiện có; chỉ thêm fixture files chung nếu hai suites thực sự đọc chúng.
- [ ] Giữ `apiRequest` cần field data còn `apiCommand` nhận empty/204; main không import renderer hoặc truy cập `window` qua shared parser.
- [ ] Chạy common API/MockMvc, `api-client-contracts.test.mjs`, `backend-api-service.test.mjs`, materializer tests và type-check/build; runtime flow khi client/main behavior bị ảnh hưởng.

### 7.4. Chưa cần gom hoặc tạo mới

- **Global `CommonUtils`/`BaseService`/generic CRUD repository/controller:** chưa thấy nhu cầu tương ứng; dễ che ownership, transaction/admission và error semantics. Giữ helpers nhỏ có tên cụ thể.
- **Một `JsonUtils.parseOrDefault` cho mọi JSON:** chưa phù hợp. Character/continuity persistence fail khi dữ liệu hỏng, chapter canon parser hiện trả empty; compute fingerprint còn cần canonical serialization. Có thể reuse configured mapper ở beans phù hợp, nhưng default/null/error policy phải rõ tại owner.
- **Mọi `required`, `hasText`, `trim`:** vài dòng giống hình thức chưa đủ. Có trường giữ nguyên whitespace, trường trim, max length và exception/message khác. Gom chỉ khi contract giống nhau; không tạo validation DSL.
- **Một retry helper áp dụng cho mọi provider:** không phù hợp với UNKNOWN/durable checkpoint. Retry transport và retry business attempt có điều kiện khác nhau.
- **DTO/factory/assertion thuộc từng feature:** giữ local nếu chỉ dùng ở một test hoặc mang business defaults riêng. Test infrastructure dùng chung; test scenario và invariant vẫn gần feature.

**Thứ tự common:** reuse có sẵn → C1/C2 → C3 → C4; Tasks 3/4 feature-local vẫn ưu tiên. Không cần dependency mới cho các đề xuất common này. Lợi ích là giảm điểm phải sửa và giữ cùng contract; tốc độ runtime cần đo riêng.

## 8. Bổ sung: maintainability, database và legacy cut-over

**Database audit:** 2026-10-02, đọc source SQL/MyBatis/use cases và current decisions. Chưa truy vấn instance PostgreSQL thực tế: không có PostgreSQL MCP, `docker`/`psql` không có trong PATH của môi trường khảo sát. Không suy ra server/database cũ không tồn tại từ giới hạn tooling này. Working tree đang có thay đổi đồng thời; đọc lại file và applied migration history trước thực thi.

### 8.1. Refactor common có cần sửa database không?

| Thay đổi | Cần đổi schema? | Tác động |
|---|---|---|
| Getter/builder Lombok, hash/checksum helper, common exception code | Không nếu giữ mapping và semantics | Giảm duplication và điểm phải sửa; không chứng minh tăng throughput |
| ApiResponse/parser, canonical query keys, test support | Không nếu giữ wire contract | Contract/cache/test setup nhất quán; query consolidation có thể giảm request nhưng phải đo |
| MapStruct thay mapping viết tay | Không | Giữ table/column/CAS/null/default semantics và validating factories |
| Typed durable intent/snapshot, Take ↔ job/attempt association | Có thể | Kiểm tra snapshot/columns hiện có trước; thiếu dữ liệu authoritative mới đề xuất schema work riêng |
| Constraints/indexes/legacy schema cleanup | Có | Database task riêng với inventory dữ liệu, migration policy và PostgreSQL evidence |

Helpers giúp mở rộng khi chúng tập trung một contract ổn định. Provider/model mới dùng cùng workload có thể đi qua adapters/configuration hiện hữu; không cần schema chỉ vì thêm provider name. Thay đổi domain data, strategy constraints hoặc durable snapshot structure có thể cần schema riêng. Common không sở hữu routing/admission/business state.

### 8.2. Phần kiến trúc cũ còn trong schema/code

| Nhóm | Source evidence | Kết luận |
|---|---|---|
| Multi-user/account/billing | Quét migrations V1–V10 không thấy các business identity columns/tables và billing/quota artifacts đã bị ADR-0020 loại bỏ | Baseline trong repo đã theo single-user. Chưa xác nhận mọi database từng được tạo đã được dọn |
| Image-first production mode | [V9](../../app/backend-service/src/main/resources/db/migration/V9__video_first_retention_production.sql) cho phép `IMAGE_MOTION`, `VIDEO_FIRST`, `LEGACY_IMAGE`; enum/request/use case cũng còn các mode này | Legacy vẫn có thật trong schema và code, không chỉ là migration lịch sử |
| Beat-centric media plans/items | [V1](../../app/backend-service/src/main/resources/db/migration/V1__project_story_and_planning.sql) có `media_plans`, `media_scene_plans`, `media_beat_plans`; [V4](../../app/backend-service/src/main/resources/db/migration/V4__catalog_generation_and_render_snapshots.sql) có `media_generation_items` | Không phải tất cả dead: [CreateMediaJobUseCase](../../app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/usecase/CreateMediaJobUseCase.java) vẫn tạo plan/items cả VIDEO_FIRST. Cần cut-over caller trước khi drop |
| VisualBeat legacy/manual path | V1 có `motion_mode`, `relative_weight`, nullable `story_beat_id`; V2 thêm `preview_media_asset_id`; storyboard/timeline SQL còn đọc các field | Một phần để backward compatibility, preview/reference vẫn có ý nghĩa. Không đồng loạt xóa bảng VisualBeat hoặc mọi image field |
| Render compatibility | V4 snapshot default còn renderer `project-image-motion-v3-composition`, `fps: 30`; [ProductionTimelineMapper](../../app/backend-service/src/main/resources/mybatis/ProductionTimelineMapper.xml) còn beat selection/preview image read paths | Cut-over chưa hoàn tất. Default cho new production và reader cho old immutable snapshots phải tách rõ; phối hợp reliability Task 10 |
| Video-first | V9 có `shot_sequences`, `shots`, `takes`, `selected_takes`, `generation_references`; V10 có voice profiles | Schema mới đã tồn tại song song với cấu trúc cũ; không được gọi là fully migrated chỉ vì đã tạo tables mới |

Legacy readability/export được yêu cầu trong [ADR-0026](../decisions/ADR-0026-video-first-production.md). Vấn đề cần dọn là legacy creation/write path còn lẫn với active production, không phải xóa mọi dữ liệu cũ. Worker SQLite execution journal là storage đúng kiến trúc hiện tại theo ADR-0019/0021, không phải business database cũ.

**Docs cần đồng bộ:** CURRENT_STATUS vẫn ghi V1–V9; DATABASE liệt kê V1–V10 nhưng freeze/forward numbering còn V1–V8/V9. Legacy inventory còn nhắc `render_beat_overrides`, trong khi CREATE TABLE inventory hiện tại không có bảng đó; source hiện có `production_beat_media_selections`. Không dùng inventory cũ để kết luận table đang có hoặc đã hết caller.

### 8.3. Database changes có bằng chứng đáng xem xét

| Ưu tiên | Quan sát source | Đề xuất |
|---|---|---|
| P1 integrity | V9 `selected_takes.shot_id` và `take_id` có FK riêng, chưa bảo đảm `takes.shot_id` bằng selected shot | Composite FK `(shot_id,take_id)` → `takes(shot_id,id)` với unique key phù hợp; kiểm existing mismatches trước |
| P1 integrity | Trim chỉ CHECK `source_out_ms > source_in_ms`; `takes.attempt_number` và `shots.target_duration_ms` chưa có positive CHECK trong migrations hiện có | Thêm row-local checks cho in ≥ 0, attempt > 0, target duration > 0. Bound trim theo actual take duration/approval là cross-row policy, cần application transaction/validation phù hợp |
| P1 maintainability, thiết kế cùng reliability work | [TakeMapper](../../app/backend-service/src/main/resources/mybatis/TakeMapper.xml) lookup job/task bằng `metrics_json->>'generationJobId'` / `computeTaskId` | Đánh giá explicit job/task/attempt columns và constraints thay authoritative identity trong metrics. Phân biệt DB generation job ID với public job/task UUID; backfill legacy chỉ từ evidence có thật |
| P2 measured performance | JSON scalar lookup chưa thấy matching expression index; generation reference SQL filter/delete theo shot chưa thấy index tương ứng. Existing unique keys đã cover shots(sequence,order), takes(shot,attempt), selected_takes PK | Đo EXPLAIN và workload trước khi thêm targeted indexes. Không thêm duplicate indexes cho access path đã có PK/unique coverage |
| P1 cut-over | New media job source còn image-mode creation branch; timeline/render snapshot còn assumptions cũ | Chốt VIDEO_FIRST creation policy, giữ explicit legacy readers/export và reference/keyframe image generation. Chỉ remove cột/bảng khi writer/reader/data dependencies đã xử lý |

Composite FK cần referenced unique/PK key thích hợp; CHECK thông thường không kiểm tra rows của table khác. Xem [PostgreSQL constraints](https://www.postgresql.org/docs/18/ddl-constraints.html). Với equality lookup trên scalar expression, xem [expression indexes](https://www.postgresql.org/docs/18/indexes-expressional.html); verify bằng [EXPLAIN](https://www.postgresql.org/docs/18/using-explain.html). Đây là candidate design, chưa có query timing/index benchmark mới.

### 8.4. Tasks database

#### D0 — Audit instance hiện có bằng read-only queries

**Deliverable:** Applied Flyway versions/checksums, tables/columns/constraints/indexes thực tế, row counts theo production mode và legacy/canonical state. Không log story/prompt/secrets.

- [ ] Read `flyway_schema_history`, `information_schema`/`pg_catalog`; đối chiếu repo baseline và deployment status. Source V1–V10 không chứng minh instance đã apply V10 hoặc old tables đã biến mất.
- [ ] Đếm nullable StoryBeat links, legacy-mode plans/jobs, selected takes sai shot/negative trim, pending/UNKNOWN work và old render snapshot versions. Dùng aggregate counts, không đọc nội dung truyện.
- [ ] Phân loại mỗi legacy structure: active current use, required compatibility, hoặc removable sau cut-over. Xác định data cần giữ và FK/snapshot/reader dependents.
- [ ] Chốt migration policy theo applied state: baseline chưa frozen + database disposable đã xác nhận mới rewrite/reset; installed data dùng compatible forward migration. Không sửa checksum history thay cho schema migration.

#### D1 — Bảo vệ relational/trim invariants

**Files:** Owning SQL migration theo D0, selected take persistence/use case; existing migration/SelectedTake tests; thêm PostgreSQL regression cases cho cross-shot selection và negative trim.

- [ ] Test direct persistence không thể chọn take của shot khác; đúng pair pass. Existing mismatch được báo và xử lý có evidence trước validate constraint, không tự sửa bằng chọn take bất kỳ.
- [ ] Test in âm, out ≤ in, attempt ≤ 0 và target duration ≤ 0 bị reject; valid inputs/replays vẫn pass.
- [ ] Chọn unique key/FK và row-local CHECK nhỏ nhất; giữ validation trim/asset/QC thực tế tại backend transaction, không viết CHECK đọc foreign table.
- [ ] Chạy real PostgreSQL migration, persistence, selection và render admission tests; kiểm ảnh hưởng đến retained legacy snapshots/data.

#### D2 — Durable Take ↔ execution identity

**Files:** `TakeRow`, `TakeMapper`, take repository, dispatcher/finalizer/reconciler, owning migration. Thực hiện cùng reliability Tasks 3/5/7 để chỉ có một execution model.

- [ ] Chốt ID semantics/cardinality và nơi durable snapshot tồn tại; schema columns chỉ thêm nếu existing representation không đáp ứng ownership/idempotency/reconciliation.
- [ ] Backfill verified JSON pointers sang typed columns khi khả thi; legacy rows thiếu evidence không được gán synthetic association. Giữ metrics cho measurements/QC, không làm authoritative lookup lâu dài.
- [ ] Test one attempt → expected take, duplicates/stale event/restart/UNKNOWN không bind sai take hoặc tạo duplicate output. Preserve row version/CAS và accepted asset snapshots.
- [ ] Migrate read/write caller đồng bộ rồi retire JSON identity lookup; run persistence, finalizer, callback/reconcile và contract tests.

#### D3 — Measured query optimization và legacy cut-over

**Files:** Relevant MyBatis SQL, index migration, production read/admission/render callers và current migration inventory. Các source paths cụ thể đã nêu ở bảng 8.3.

- [ ] Đo cùng Project/Chapter với workload representative: query count, payload size, p50/p95, rows scanned; `EXPLAIN (ANALYZE, BUFFERS)` chỉ cho read queries được kiểm tra hoặc test environment phù hợp.
- [ ] Reuse batch reads đã có, xử lý voice/shot lookup fan-out trước; thêm expression/FK indexes chỉ khi plan/query timings chứng minh có ích. Nếu D2 bỏ JSON lookup thì không thêm index cho đường sắp xóa.
- [ ] Chốt new VIDEO_FIRST writes và explicit old-project read/export; image generation auxiliary vẫn giữ. Prove active pipeline không dùng legacy footage fallback trước xóa path.
- [ ] Remove dead schema/code chỉ sau data/dependency gates; không rewrite approved snapshots. Update CURRENT_STATUS, DATABASE và inventory theo source/apply evidence, giữ IMPLEMENTED/PARTIAL/TARGET rõ.
- [ ] Chạy full local gate, PostgreSQL suites và affected Desktop/native flow; benchmark trước/sau. Không tuyên bố optimized/fully migrated dựa trên static inventory.

**Ưu tiên database:** D0 → D1; D2 đi cùng reliability ownership; D3 tối ưu và dọn legacy theo evidence. Các common refactors C1–C4 có thể triển khai mà không chờ schema cleanup nếu public/storage contracts giữ nguyên.
