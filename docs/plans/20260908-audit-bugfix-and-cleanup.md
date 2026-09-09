# Kế hoạch sửa bug, hoàn tất migration và clean code

Ngày: 2026-09-08. Baseline review: `fb028d9d7`.
Trạng thái: IMPLEMENTATION GẦN HOÀN TẤT — T01–T11 và T13 đã triển khai; full Backend/Worker/Desktop gate xanh. T12 còn refactor orchestration; PostgreSQL integration và Electron runtime verification đang BLOCKED bởi môi trường. Chưa commit/deploy.
Nguồn: `documentation/codebase/AUDIT_RECHECK_2026_09_08.md`; báo cáo audit cũ không thay thế source hiện tại.

## Mục tiêu và nguyên tắc

- Sửa 8 findings correctness/tooling; xử lý các quality checks đang đỏ; tách UI/logic và dọn phần migration có bằng chứng.
- Giữ PostgreSQL authoritative, modular monolith, MyBatis persistence, Desktop-only editor, local-first media. Không thêm Redis/broker, cloud editor hoặc runtime mock.
- Bảo toàn worktree. Trước mỗi task kiểm tra HEAD/diff và dùng CodeGraph xác minh caller hiện tại; file mới bên dưới là tên đề xuất, có thể điều chỉnh khi triển khai.
- Bug hành vi: viết regression test tái hiện trước, sửa nhỏ nhất, chạy test liên quan. Không viết test soi source để thay thế concurrency, filesystem hoặc UI interaction test.
- Không làm xanh suite bằng cách nới architecture rule, bỏ test, thêm ignore toàn cục hoặc giả lập production health.
- Mỗi task chỉ đóng khi checks liên quan pass. Failure baseline thuộc task khác phải có mapping rõ ràng; toàn bộ baseline phải xanh trước đóng cả kế hoạch.
- Chính sách quota mới bên dưới là đề xuất thiết kế, không giả định đó đã là quy định sản phẩm. Đối chiếu ADR/tài liệu hiện tại khi triển khai; chỗ chưa có policy phải ghi quyết định trước khi phát hành.
- Chỉ migration trên DB disposable được xác định rõ. Không reset/repair DB người dùng; không xóa schema dựa riêng vào grep.

## Thứ tự thực hiện và phụ thuộc

| Đợt | Task | Lý do |
|---|---|---|
| A | T01 contracts, T02 Windows gate, T03 môi trường/test baseline | Khôi phục khả năng kiểm tra đáng tin cậy |
| B | T04 idempotency; T05 quota export; T06 watermark | Replay đúng trước khi gắn reservation; quota và watermark hoàn thành cùng đợt |
| C | T07 atomic storage; T08 MIME/recovery metadata | Cùng storage protocol, không phát hành một nửa |
| D | T09 lock/reference race; T10 favorite | Sửa concurrency và metadata UI |
| E | T11 architecture; T12 UI/logic; T13 cleanup/schema/docs | Refactor sau khi correctness có regression coverage |
| F | T14 full gate và runtime verification | Bằng chứng hoàn tất |

Task IDs khác số finding audit: finding 1→T01, 2→T05+T06, 3→T07, 4→T10, 5→T09, 6→T08, 7→T04, 8→T02.
T11 xử lý architecture failures ghi nhận ở T03. Không bắt T03 sửa toàn bộ lỗi thuộc task sau mới được tiếp tục.

## T01 — P1: export đầy đủ shared Storyboard contracts

**Files sửa:** `packages/client-contracts/src/index.ts`; kiểm tra đối chiếu `packages/client-contracts/src/generation.ts`. Consumer tại `app/desktop/src/renderer/features/storyboard/{api,queries,model,components,screens}` chỉ sửa nếu compiler chứng minh còn lỗi độc lập.

**Nguyên nhân:** bốn type đã tồn tại nhưng package root không public export, tạo TS2305 và implicit-any dây chuyền.

- [ ] Bổ sung type-only exports: `StoryboardGenerationBatch`, `PrepareStoryboardGenerationBatchInput`, `StoryboardGenerationBeatSnapshot`, `StoryboardGenerationReference`.
- [ ] Chạy type-check ngay; xử lý lỗi type còn lại bằng schema thực, không thêm `any`, ép kiểu rộng hay deep import lách barrel.
- [ ] Kiểm tra package local và dependency lock; không sửa tay node_modules. Chỉ refresh dependency nếu chứng minh workspace link/cache sai.
- [ ] Regression: compiler phải kiểm tra các consumer qua package root; bảo đảm CI/gate chạy type-check riêng vì Vite build không kiểm tra type.
- [ ] Chạy Desktop `npm run check`.

**Done:** public imports hợp lệ, hết TS2305/TS7006 liên quan, tests/type-check/build pass. Lỗi JSX cũ đã hết, không đưa lại vào scope.

## T02 — P2: resolve Maven wrapper và trạng thái gate chính xác trên Windows

**Files sửa:** `scripts/verify-local.py`; wrapper `.ps1/.sh` chỉ khi cần. **File test mới đề xuất:** `scripts/tests/test_verify_local.py`.

- [ ] Dùng một hàm resolve executable trả đường dẫn thực; kiểm tra và chạy chính đường dẫn đó.
- [ ] Resolve `mvnw.cmd` từ `Step.cwd`; lệnh tool thông thường như npm/python/docker vẫn qua PATH. Hỗ trợ absolute path, `./mvnw`, đường dẫn có dấu cách; không bật shell tùy tiện.
- [ ] Giữ fail-fast cho step bắt buộc, propagate exit code thực.
- [ ] Optional tool không có phải in SKIP/UNAVAILABLE, không in PASS như đã thực thi Compose config.
- [ ] Test resolver trên Windows/POSIX bằng temporary directory và subprocess mock: có wrapper, thiếu wrapper, PATH fallback, executable path có space, command exit khác 0.
- [ ] Chạy gate từ repo root; xác nhận nó thực sự đến Maven thay vì dừng ở discovery.

**Done:** root gate tìm đúng wrapper và báo trung thực PASS/FAIL/SKIP.

## T03 — Khôi phục môi trường kiểm tra và phân loại baseline đỏ

**Files:** `app/desktop/package.json`, lockfile chỉ nếu dependency thật sự sai; backend tests trong `feature/assets`, `feature/generation` và `architecture`; `app/ai-worker/tests`; `app/ai-worker/src/narrativex_worker/providers/tts/vieneu.py`.

- [ ] Kiểm tra Electron binary/path.txt/install scripts và cấu hình npm trước khi reinstall đúng locked dependencies. Xác nhận `npm run dev` mở Electron với preload thật. Không tạo runtime mock để chạy UI.
- [ ] Chuẩn bị PostgreSQL disposable/test container theo cấu hình test hiện có. Nếu Docker không khả dụng, dùng môi trường test được hỗ trợ khác hoặc giữ integration blocked; không trỏ test phá dữ liệu vào DB thật.
- [ ] Đọc nested causes của 13 backend errors: cleanup JUnit extension context có thể do handle chưa đóng, process/stream còn mở hoặc filesystem access. Sửa resource lifecycle nếu leak thật; chỉ chỉnh test environment khi chứng minh nguyên nhân môi trường.
- [ ] Bỏ unnecessary Mockito stubbing trong test cụ thể, giữ strictness.
- [ ] FlywayBaselineStructureTest: kiểm tra assertion đang cấm field của đúng bảng hay match toàn SQL. Nếu bắt nhầm field hợp lệ, scope assertion vào bảng cần bảo vệ và thêm positive/negative fixture.
- [ ] Prompt tests: xác định canonical composer và điểm sanitize theo boundary. Nếu hai đường gửi prompt cần cùng bytes, cho cả hai dùng cùng canonicalization; nếu requirement chỉ semantic equality thì test đúng contract. Giữ identity/appearance separation và safety cases; không đơn thuần thay expected theo output sai.
- [ ] Sửa 14 Ruff errors; unused `type: ignore[import-not-found]` chỉ bỏ/chỉnh tại đúng import sau khi xác minh locked dependency typing.
- [ ] Chạy lại từng test class/module lỗi và mypy src. Architecture failures chuyển T11 với danh sách dependency edges đầy đủ.

**Done:** lỗi môi trường có nguyên nhân rõ; tests sửa ở task này pass; danh sách baseline còn lại gắn T11 hoặc task correctness cụ thể. Electron/PostgreSQL thiếu thì ghi blocker, không đánh dấu runtime done.

## T04 — P2: idempotent replay trước admission mới

**Files sửa:** backend `feature/generation/application/usecase/CreateRegenerationJobUseCase.java`, `CreateProjectRenderUseCase.java`; repository/mapper fingerprint nếu cần. **Tests:** `CreateProjectRenderUseCaseTest` và regression regeneration trong cùng feature.

- [ ] Phân biệt fingerprint request do client gửi với fingerprint source/timeline đã snapshot. Không dùng timeline hiện tại để quyết định request cũ có giống nhau hay không.
- [ ] Luồng đề xuất: resolve identity + kiểm tra quyền truy cập → validate/canonicalize request và key → acquire idempotency lock theo user/key → lookup accepted job → kiểm tra type/scope/payload cũ → trả job cũ; chỉ nhánh không có job mới kiểm tra expiry/device/timeline/quota.
- [ ] Persist request identity đủ để phát hiện cùng key nhưng khác resolution/fps/subtitles/device/beat overrides/plan/cost cap, theo contract hiện hữu. Không làm mất uniqueness hoặc tenant scope hiện tại.
- [ ] Giữ immutable input snapshot/source fingerprint cho execution và stale validation của job mới; không overwrite khi replay.
- [ ] Xử lý job cũ thiếu request fingerprint bằng dữ liệu persisted đủ chứng minh request; nếu không đủ, trả lỗi compatibility rõ ràng, không blind-resubmit. Ghi policy key omitted và new explicit retry theo contract hiện tại.
- [ ] Tests: response mất rồi retry sau plan TTL; source đổi; device offline; quota vừa hết; cùng key khác payload; khác user; hai POST đồng thời. Chỉ một job/OperationPlan/outbox/reservation được tạo.

**Done:** replay hợp lệ luôn trả job đã nhận dù admission hiện tại thay đổi; key khác payload bị conflict; ownership vẫn bắt buộc. PostgreSQL concurrency test phải chạy thật.

## T05 — P1: quota export tháng có reservation và settlement

**Files sửa:** backend `CreateProjectRenderUseCase`, `QuotaReservation`, `feature/account/infrastructure/persistence/adapter/MyBatisQuotaReservation.java`, `resources/mybatis/QuotaMapper.xml`, quota queries; migration owning quota/usage và terminal settlement. **Tests:** `QuotaReservationLifecycleIntegrationTest`, render admission tests. **Docs:** ADR về export quota/settlement mới hoặc cập nhật ADR phù hợp.

**Đề xuất policy cần ghi rõ:** reserve khi nhận job; consume đúng một lần khi server chấp nhận COMPLETED; release khi FAILED/CANCELED đã xác nhận; UNKNOWN/reconciliation giữ reservation. Delivery/copy/download lại cùng artifact không tính thêm. Gán period theo thời điểm reservation bằng quy tắc UTC hiện hữu. Không tự phân loại short/longform bằng ngưỡng duration mới.

- [ ] Xác định render hiện tại thuộc loại export nào từ contract/domain. Nếu chưa có short export runtime, không nối bộ đếm short giả hoặc suy diễn theo tên file/duration.
- [ ] Mở rộng durable reservation có export kind/units, period và job binding; ưu tiên mở rộng cơ chế hiện hữu, không tạo hai nguồn đếm song song.
- [ ] Atomic admission PostgreSQL: serialized usage-window update/row lock theo user+period; `consumed + active reserved + requested <= limit`; null/unlimited theo contract hiện hữu. Tránh check-then-insert không lock.
- [ ] Trong cùng transaction: admission, reservation, job, OperationPlan, snapshot và outbox. Bất kỳ bước fail phải rollback toàn bộ. T04 bảo đảm replay không reserve lại.
- [ ] Tích hợp đúng một settlement authority vào lifecycle hiện có. Trigger V6 đang chỉ finalize credits nên phải cập nhật đồng bộ với consume/release methods, không cộng quota hai lần.
- [ ] Khi transition terminal: conditional update RESERVED→CONSUMED/RELEASED, dựa vào affected rows để tăng bộ đếm một lần. COMPLETED lặp lại và terminal retry không cộng thêm; không giải phóng UNKNOWN theo timeout mù.
- [ ] Migration/backfill: inventory reservations/jobs đang chạy; tính lịch sử chỉ từ terminal jobs đáng tin cậy nếu policy yêu cầu. Không sửa immutable snapshots. Baseline preproduction theo policy hiện tại; DB cần giữ dữ liệu phải có rollout tương thích và backup, không reset mặc định.
- [ ] Integration tests: dưới/ngang/vượt limit; unlimited; hai request tranh slot cuối; rollback sau reserve; completed hai lần; failed/canceled; UNKNOWN; job qua ranh giới tháng; credit/concurrency accounting không đổi ngoài scope.

**Done:** DB là nguồn quyền export; request đồng thời không vượt quota; replay không double charge; usage API thể hiện đúng và policy được ghi thành tài liệu.

## T06 — P1: watermark từ server snapshot đến video cuối

**Files sửa:** backend `ProjectRenderProfileFactory`, `ProjectRenderInputSnapshotRepository`, `MyBatisProjectRenderInputSnapshotAdapter`, snapshot mapper/DTO nếu cần; Desktop `src/main/rendering/render-profile.ts`, `render-manifest.ts`, `project-renderer.ts`, bước FFmpeg/segment cache liên quan. **Tests:** `ProjectRenderProfileV2ContractTest`, `ProjectRenderProfilePersistenceContractTest`, Desktop render profile/golden/integration tests.

- [ ] Server derive policy từ quota, lưu vào immutable render snapshot trước dispatch; renderer không gửi cờ được phép tắt watermark.
- [ ] Version render-profile schema; include policy trong render fingerprint và cache identity tại mọi stage chịu ảnh hưởng. Plan upgrade/downgrade sau admission không đổi snapshot đã chốt.
- [ ] Main validate schema/policy, đưa overlay vào bước render đã xác định; dùng asset/text cố định của ứng dụng, không nhận FFmpeg expression tùy ý từ renderer. Kiểm tra subtitles, aspect ratio, FPS và encoder.
- [ ] Chốt compatibility: client không hỗ trợ schema mới không được claim/render nó; old snapshot thiếu policy phải được phân loại legacy rõ ràng. Không default `false` cho missing policy của snapshot mới, không sửa ngược snapshot cũ.
- [ ] Server completion kiểm tra snapshot/fingerprint/capability theo contract. Ghi giới hạn: Desktop máy người dùng có thể bị sửa; metadata/completion callback không tự chứng minh watermark có trong bytes. Nếu yêu cầu chống client đã chỉnh sửa, đó là quyết định kiến trúc riêng, không hứa enforcement tuyệt đối bằng cờ JSON.
- [ ] Tests: plan watermark on/off; missing/malformed policy; cache invalidation; resume journal; actual FFmpeg output có overlay đúng vị trí và không che nội dung bắt buộc. Dùng frame/golden verification, không chỉ assert command string.

**Done:** Desktop được hỗ trợ render watermark theo immutable server policy; không có UI bypass; compatibility và trust boundary được tài liệu hóa.

## T07 — P1: atomic publication và recovery của LocalMediaStorage

**Files sửa:** worker `narration/storage.py`, `narration/local_runner.py` và reader khác cần completion proof. **Tests sửa:** `tests/test_local_narration_runner.py`, `tests/test_image_generation_crash_recovery.py`; **mới đề xuất:** `tests/test_local_media_storage.py`.

- [ ] Inventory mọi reader, bao gồm đường đọc file trực tiếp/backend local gateway; xác định completion protocol mà tất cả reader tuân thủ. Không chỉ sửa `put_immutable` trong khi `find/get_bytes/download` vẫn đọc file dở.
- [ ] Stage bytes vào file unique cùng filesystem, compute/verify checksum và size trước publication, flush/fsync theo khả năng platform; publication không overwrite object committed khác nội dung.
- [ ] Chọn commit protocol cụ thể trong implementation note: publish metadata atomically cuối cùng làm completion marker; readers chỉ nhận object khi marker hợp lệ và bytes khớp. Serialize writers cùng key bằng cơ chế cross-process đã chứng minh; asyncio.Lock một process không đủ. Nếu dùng lock file phải có recovery chủ sở hữu chết, không xóa lock còn hoạt động chỉ vì tuổi.
- [ ] Metadata chứa schemaVersion, checksum gốc, size, MIME và metadata cần recovery. Bytes+JSON là hai file nên chỉ rename file bytes chưa đủ chứng minh commit; viết marker sau bytes và kiểm tra crash tại mọi ranh giới.
- [ ] Legacy file thiếu marker không tự coi là complete bằng checksum tính lại. Chỉ adopt khi có expected checksum/size từ nguồn durable đáng tin; thiếu proof thì báo recoverable/incomplete, giữ bytes để điều tra và tái tạo có kiểm soát.
- [ ] Narration recovery yêu cầu completion/integrity proof trước suy duration; PCM dương/chẵn không chứng minh toàn câu đã được ghi đủ.
- [ ] Tests filesystem thật: crash giữa ghi; sau bytes trước marker; lỗi write/rename; retry cùng bytes; cùng key khác bytes; reader trong lúc ghi; hai process cùng key; file legacy; lease loss; không ghi đè committed content.

**Done:** reader không trả file dở là hoàn chỉnh, retry hội tụ hoặc trả recovery error rõ ràng. Không mất dữ liệu committed, không xóa temp của writer còn sống. Windows và môi trường worker deployment đều được kiểm tra.

## T08 — P2: giữ MIME/metadata qua replay và restart

**Phụ thuộc:** completion protocol T07. **Files sửa:** `narration/storage.py`, `image_generation_runner.py`, `image_generation_repository/materialization.py` nếu cần; tests storage/image crash recovery.

- [ ] `find()` lấy MIME và metadata từ committed record thay vì đuôi key; same-content replay trả cùng metadata contract qua restart.
- [ ] Giữ checksum-addressed key hiện có, không đổi tên key chỉ để vá MIME. Phân biệt MIME tự khai báo với detected MIME; validate provider content tại boundary hiện hữu.
- [ ] Cùng key/bytes nhưng caller đưa MIME xung đột: xử lý theo canonical detected MIME đã lưu hoặc conflict rõ ràng, không silent mutate immutable metadata.
- [ ] Legacy image metadata chỉ repair khi bytes đủ proof và có thể xác minh type; không suy mọi key image là PNG. Nếu DB `media_assets.content_type` đã sai, lập repair scope theo verified bytes và transaction riêng, không broad UPDATE.
- [ ] Tests: PNG/JPEG/WebP thật dưới key không extension, process restart, metadata round-trip, khác MIME, corrupted sidecar, materialization sau crash. Reproduce cũ phải chuyển từ PNG→octet-stream thành PNG→PNG.

**Done:** initial write/replay/restart/materialization giữ MIME đúng; T07 và T08 được phát hành cùng protocol.

## T09 — P2: serialize LOCKED và replace references

**Files sửa:** backend `SetCharacterVersionReferencesUseCase`, `LockCharacterVersionUseCase`, `CharacterVersionRepository`, `MyBatisCharacterVersionPersistenceAdapter`, `CharacterMapper.java/xml`; kiểm tra reference adapter và mọi writer khác. **Tests:** `CharacterVersionReferencesUseCaseTest`, `LockCharacterVersionUseCaseTest`; concurrency integration test mới trong feature character.

- [ ] Thêm owned lookup khóa version row với `SELECT ... FOR UPDATE OF cv`; explicit target tránh lock cả joined character ngoài ý muốn.
- [ ] Cả replace và lock lấy cùng parent lock trong transaction trước đọc status/reference; giữ ownership và characterId validation.
- [ ] Replace: recheck status sau lock, validate assets và replace. Lock: đọc IDENTITY references sau lock rồi transition. Serialize lock order nhất quán với các writer khác để tránh deadlock.
- [ ] Rà mọi đường thay references/version để không có writer bypass. Giữ optimistic row version hiện hữu; nếu invariant cần bảo vệ SQL ngoài ứng dụng, thiết kế DB guard dùng cùng lock order, không thêm trigger rời rạc gây deadlock.
- [ ] PostgreSQL tests với hai connection + latch/barrier, không dựa sleep: replace trước lock thì lock nhìn bộ references cuối; lock trước replace thì replace conflict; lock không được thành công sau replace bỏ identity; rollback/owner mismatch không thay references.

**Done:** không interleaving nào đổi reference sau successful LOCKED. Mock repository test không đủ đóng finding.

## T10 — P2: favorite đồng bộ backend, local catalog và UI

**Files sửa:** Desktop `features/projects/queries/projects.queries.ts`, `api/projects.api.ts` nếu response cần reconcile, `screens/ProjectsScreen.tsx`; `src/main/local-storage/project-catalog.ts`, `project-catalog-ipc.ts`, preload bridge/types nếu cần narrow metadata patch. **Tests:** `test/project-catalog.test.mjs`, test mutation/controller mới và actual UI flow.

- [ ] Ghi mutation theo desired state rõ ràng; khóa/dedupe per project khi pending để double-click không đảo sai do stale props.
- [ ] Sau backend success, nhận metadata authoritative hoặc GET đúng project đã registered, persist favorite vào catalog bằng merge chỉ field cần đổi; không overwrite snapshot mới bằng object cũ.
- [ ] Cập nhật list/detail query cache từ metadata đã reconcile, rồi invalidate có chủ đích. Không khôi phục cloud project discovery hay upsert project chưa có trên device.
- [ ] Backend fail: giữ/rollback trạng thái cũ và báo lỗi. Backend success nhưng local persist fail: báo partial-sync, refetch/retry persist metadata; không gửi toggle đảo lại backend. Tránh toast thành công hoàn toàn khi chưa durable.
- [ ] Test favorite/unfavorite; restart vẫn đúng; double-click; hai mutation cạnh tranh; network error; local write fail; list/detail nhất quán; không tự thêm project từ cloud.
- [ ] Runtime Electron: Projects list → bật sao → filter favorite → tắt sao → mở detail/quay lại → restart. Kiểm tra empty/loading/error, console/API, screenshot.

**Done:** UI phản ánh trạng thái backend và giữ sau restart; lỗi partial-sync có cách phục hồi. Runtime blocked thì task chưa DONE.

## T11 — Clean backend boundaries và architecture tests

**Files sửa:** `feature/generation/api/response/ChapterContinuityResponse.java`; use case/query/inbound port liên quan; các API khác nằm trong danh sách ArchUnit violations. **Tests:** `ArchUnitDependencyRulesTest`, `ArchitectureRulesTest`, controller serialization tests.

- [ ] Nhóm 37 dependency edges theo nguyên nhân gốc, không coi là 37 bug độc lập.
- [ ] Tạo application query/view để inbound API trả dữ liệu; repository adapter map persistence records vào application types qua đúng ownership layer.
- [ ] API map từ application view, không import outbound repository records/infrastructure. Không đưa DTO API xuống domain để lách rule.
- [ ] Cross-feature use case coupling nếu có: expose inbound capability nhỏ ở feature sở hữu, giữ transaction/authorization semantics hiện tại.
- [ ] Tests giữ response JSON/status/order/nullability như trước; architecture suite pass mà không thêm exemption.

**Done:** dependency rules pass, API contract không bị đổi ngoài ý muốn; cập nhật implementation-facing boundary docs.

## T12 — Tách UI và orchestration, giữ hành vi

**Files sửa:** `features/storyboard/screens/StoryboardScreen.tsx`, model/controller/persistence queue hiện có; `features/settings/screens/SettingsScreen.tsx`, `components/GeminiBrowserSettings.tsx`. **Mới đề xuất:** `features/storyboard/queries/useGeminiQueue.ts`, settings status hook. **Tests:** `test/storyboard-gemini-queue.test.mjs` và test controller/lifecycle.

- [ ] Trước refactor, khóa hành vi queue bằng tests cho transitions, retries, unresolved attempts và persistence; T01 phải xanh.
- [ ] Đưa dispatch/reconcile/concurrency/cancellation ra controller/hook, inject API/IPC/persistence để test; screen nhận state/actions và render panels.
- [ ] Model chứa transitions thuần; queries chứa request orchestration; store chứa persistence; components chứa UI. Không tạo generic framework hoặc gộp character/storyboard queue nếu semantics khác.
- [ ] Settings tách subscription/polling/IPC lifecycle vào hook; cleanup khi unmount, đổi project/account, tránh late async result cập nhật sai screen.
- [ ] Tests pause/resume, unmount, chapter change, response đến trễ, storage error, UNKNOWN reconcile trước submit; không gọi provider trả phí trong automated tests.
- [ ] Actual Electron flow storyboard/settings với backend thật: navigation, disabled states, queue pause/resume và failure recovery được môi trường cho phép. Provider-dependent flow chưa chạy phải ghi gap riêng; không bật fake runtime để đóng task.

**Done:** screen chỉ phối hợp UI và gọi actions; logic quan trọng có behavioral tests; screenshot và runtime verification cho các flow đã thay đổi.

## T13 — Dọn field/file/schema và đồng bộ tài liệu migration

**Files ứng viên:** worker `config.py`; Desktop preload `types.ts`, catalog IPC, `styles.css`; `V4__narration_notifications_and_artifacts.sql`, `V7__indexes.sql`, `MediaPlanMapper.xml`; `README.md`, `documentation/architecture/flyway-baseline-policy.md`, `documentation/codebase/DATABASE_BASELINE.md`, `scripts/check-docs-drift.py`.

- [ ] Lập inventory từng field/table/file: producer, consumer, persisted format, tests, env/config bên ngoài và trạng thái IMPLEMENTED/PARTIAL/DEFERRED/OBSOLETE.
- [ ] `backend_url`: chỉ xóa khi không có env/deployment/public config consumer; cập nhật examples/docs/tests liên quan.
- [ ] `workspacePath`: tách internal catalog entry khỏi public DTO; map explicit fields ở IPC, bỏ absolute path không được renderer sử dụng. Main giữ path phục vụ filesystem; test bridge không rò field này và catalog vẫn hoạt động.
- [ ] `--voice-card`: xác minh CSS dynamic consumer/theme mapping, bỏ duplicate/dead token và review UI. Không xóa semantic token đang dùng chỉ vì tên legacy.
- [ ] Narration legacy tables/FKs: trace cả SQL, worker, migrations, data thật read-only khi có môi trường. Nếu còn roadmap/consumer thì ghi DEFERRED/PARTIAL, chưa drop. Nếu obsolete có bằng chứng, lập migration theo dependency order, compatibility và preservation plan; không reset DB để làm test xanh.
- [ ] Đồng bộ inventory migration từ source thực tế; docs drift test so tập filename/version và phát hiện thiếu entry. Không chỉ hardcode đổi V8 thành V14 nếu repo đã có migration mới.
- [ ] Giữ fake adapters dùng tests; tests production config từ chối fake theo enabled worker role. Không giới thiệu runtime mock renderer.
- [ ] Tests config/IPC/schema phù hợp; migration fresh DB và upgrade path được hỗ trợ phải pass, cùng docs drift. Raw count grep không phải bằng chứng schema unused.

**Done:** các mục xóa có bằng chứng không còn consumer, mục giữ có status/rationale; docs khớp migration directory. Chưa có DB inspection thì ghi rõ không xác nhận deployed migration state.

## T14 — Verification cuối và release gate

**Files cập nhật:** kế hoạch này, audit recheck và implementation docs liên quan; không ghi đè báo cáo lịch sử để giả như lỗi chưa từng có.

- [ ] Backend từ `app/backend-service`: `.\mvnw.cmd verify`.
- [ ] Worker từ `app/ai-worker`: `python -m pytest`, `python -m ruff check .`, `python -m mypy src`.
- [ ] Desktop từ `app/desktop`: `npm run check`.
- [ ] Root: `powershell -File scripts/verify-local.ps1`; secret/docs checks pass. Ghi exit code thật và skipped stages.
- [ ] PostgreSQL: concurrency quota/idempotency/reference lock và migration tests chạy thật. Skipped integration là gap, không tính pass.
- [ ] Electron: OAuth/session thật hoặc existing authorized session; Projects favorite, Storyboard, Settings, Production render; kiểm tra console/failed API requests/loading/error/empty states/overflow và screenshots.
- [ ] FFmpeg local deterministic fixtures: watermark on/off, narration integrity, cached render/resume, completed artifact metadata. Fixture chỉ trong test harness.
- [ ] Rà diff cuối: không mock runtime, không absolute project path lên backend, không blind retry UNKNOWN, không nới entitlement/architecture rules.
- [ ] Cập nhật từng task với command/result/evidence và blocker còn lại. Chỉ đánh dấu hoàn tất toàn kế hoạch khi tất cả required gates pass.

## Nhật ký triển khai 2026-09-08

- T01: public Storyboard generation contracts đã export; Desktop tests/type-check/build pass.
- T02: Windows executable resolution và PASS/FAIL/SKIP đã sửa; 5 resolver tests pass.
- T03: prompt/Flyway/Mockito/worker checks đã sửa; worker 326 pass/32 skip, Ruff và mypy pass.
- T04: replay được resolve trước mutable admission; render regression tests 7/7 pass. PostgreSQL concurrency evidence còn thiếu.
- T05: thêm `V15__export_quota_reservations.sql`, long-form reservation/settlement và ADR-0025. Flyway contract + render tests pass; 8 Testcontainers tests skip vì không có Docker daemon.
- T07/T08: completion marker, atomic publish, integrity/MIME recovery và conflict handling đã triển khai; storage tests pass.
- T09: character-version parent lock dùng chung cho lock/replace; mock tests pass. PostgreSQL concurrency evidence còn thiếu.
- T10: favorite reconcile backend/local/cache và persistence test đã triển khai; Electron user flow/restart screenshot còn thiếu.
- T11: application views và storyboard inbound capability đã loại dependency sai tầng; architecture/use-case gate 15/15 pass.
- T06: render-profile v3 snapshot watermark policy từ entitlement server, strict Desktop parser, fingerprint/cache isolation và fixed FFmpeg overlay đã triển khai; ADR-0026 ghi trust boundary. Contract tests pass; FFmpeg fixture thật 2/2 pass (BT.709/60fps motion và decoded-pixel watermark on/off).
- T13: bỏ worker `backend_url` không có consumer, không còn public `workspacePath` qua preload IPC, bỏ duplicate `--voice-card`; migration docs đồng bộ đến V16 và docs drift pass. Narration legacy schema giữ DEFERRED vì chưa có deployed-DB inventory đáng tin cậy.
- T14 automated gates (2026-09-09): backend `mvnw.cmd verify` 455 pass/70 Testcontainers skip; worker 326 pass/32 PostgreSQL skip + Ruff/mypy pass; Desktop `npm run check` 377 pass/5 optional FFmpeg skip + type-check/build pass; root secret/docs pass. Bundled-FFmpeg integration chạy riêng 2/2 pass.
- Electron dev đã cài lại binary và build main/preload/renderer thành công, nhưng Chromium GPU process thoát `0xc0000135` kể cả `--disable-gpu`; vì vậy chưa có screenshot/user-flow evidence. Docker executable/daemon không khả dụng nên PostgreSQL concurrency/migration tests vẫn skip.
- Toàn plan chưa DONE cho tới khi hoàn tất T12, chạy PostgreSQL integration thật và Electron runtime flow theo completion gate.

## Rollout và phục hồi

- Contracts/gate/cleanup là thay đổi nhỏ có thể tách commit; không auto-commit/deploy trong bước lập kế hoạch.
- Snapshot policy cần version/capability compatibility; rollout consumer hỗ trợ schema trước khi server dispatch profile mới. Không cho old client bỏ qua watermark.
- Storage protocol cần mọi reader hiểu marker trước khi bật writer mới; legacy adoption có proof và kiểm tra restart. Không rollback sang reader cũ có thể nhận file uncommitted.
- Quota migration theo expand/compatible rollout nếu có DB cần bảo toàn; không rollback phá reservation đã tạo hoặc counter đã settle. Dùng fix forward khi đã có durable state mới.
- Cần môi trường Electron/PostgreSQL/FFmpeg hoạt động và authorized account để kiểm tra flow thực. Nếu chưa có, implementation có thể tiếp tục ở task độc lập nhưng runtime gate phải giữ BLOCKED.

## Tiêu chí chấp nhận chung

Compiler, tests, lint và architecture checks xanh; idempotency không tạo job/reservation trùng; quota không vượt khi concurrency; watermark đúng snapshot; file dở không được công nhận; MIME replay không đổi; locked references bất biến; favorite bền vững qua restart; migrations/docs nhất quán; mọi flow UI bị thay đổi có runtime evidence hoặc trạng thái blocked rõ ràng.
