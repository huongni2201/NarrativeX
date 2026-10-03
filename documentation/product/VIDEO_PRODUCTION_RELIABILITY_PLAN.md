# Video Production Reliability — Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` hoặc `superpowers:subagent-driven-development` để thực thi từng task, giữ chung progress ledger khi chuyển executor. Các checkbox dưới đây ghi trạng thái triển khai; real-runtime gates chưa có evidence vẫn pending. Không tự thuê GPU, gọi provider tính phí, reset database hoặc publish video khi đọc kế hoạch.

**Goal:** Sửa các blocker của implementation hiện tại và hoàn thiện một luồng truyện → approved shots/takes → audio/timeline → MP4 720p/24 FPS, có idempotency, recovery và bằng chứng E2E.

**Architecture:** Tái sử dụng Spring control plane, PostgreSQL, GenerationJob/StageAttempt/OperationPlan, transactional outbox và Compute Protocol. Worker chỉ thực thi workload domain-neutral; Electron main quản lý bytes local và FFmpeg cuối. Ưu tiên hoàn thiện đường hiện hữu, không thêm broker, business microservice hoặc orchestrator trong renderer.

**Tech Stack:** Spring Boot/MyBatis/Flyway/PostgreSQL; Python/FastAPI/SQLite/ComfyUI/LTX/WhisperX; Electron/React/TypeScript/FFmpeg.

**Spec:** Yêu cầu người dùng ngày 2026-10-02: sửa các lỗi đã review và tối ưu độ ổn định. Phạm vi sản phẩm theo [LTX implementation plan](../product/LTX_PRODUCTION_IMPLEMENTATION_PLAN.md), đặc biệt mục 8 về voice similarity; [ADR-0018](../decisions/ADR-0018-backend-control-plane-and-domain-agnostic-gpu-execution-plane.md), [ADR-0020](../decisions/ADR-0020-single-user-local-first-architecture.md), [ADR-0021](../decisions/ADR-0021-submission-checkpoint-and-worker-recovery-semantics.md), [ADR-0025](../decisions/ADR-0025-event-driven-compute-orchestration-and-reconciliation.md), [ADR-0030](../decisions/ADR-0030-take-selected-take-and-editing-director.md), [ADR-0032](../decisions/ADR-0032-video-first-ltx-audio-native-production-runtime.md).

## 1. Baseline và phạm vi

Review dựa trên HEAD `06e381d8e`. Khi thực thi phải kiểm tra lại HEAD/worktree và các caller; không ghi đè thay đổi khác. Không có runtime fix nào được thực hiện trong lần lập kế hoạch này.

Các blocker đã xác nhận: Spring constructor injection; workflow SaveVideo; Take output chưa persist; chỉ một selected shot/VisualBeat; trim duration bị trừ hai lần; submit trước commit; reconciliation chọn image finalizer; UNKNOWN bị terminalize; Windows entrypoint/venv; native audio/QC chưa nối; take UI chưa reachable; query invalidation thiếu; 24 FPS thành 30; Voices sai asset scope/cold cache; smoke script chỉ in payload.

Khảo sát để lập plan còn thấy hai điểm phải xử lý cùng các lỗi trên: outbox dispatcher có thể bắt exception rồi vẫn `markPublished`; bulk handler hiện chọn một target shot nhưng chưa chứng minh scheduling đủ mọi shot. Đây là checklist kiểm chứng khi thực thi, không phải kết quả E2E mới.

**Ba mốc nghiệm thu:**

| Mốc | Kết quả bắt buộc | Chưa được tuyên bố |
|---|---|---|
| R1 — single-shot integrity | Worker thật trả clip; take đọc lại từ DB có asset/duration; replay/lost callback không tạo compute thứ hai | Chưa hoàn tất một chapter |
| R2 — creator loop | Chapter nhiều shot, review/retake/trim trong Desktop, native audio/subtitles, MP4 đúng 24 FPS | Chưa chứng minh tập 60 phút hoặc chi phí |
| R3 — reliability | Restart/lease loss/cancel/disk failure được kiểm chứng; tập 5 phút rồi long-form soak | Chưa chứng nhận installer/production throughput nếu chưa đo |

## 2. Global Constraints

- Single-user, Project là boundary; không User/Account/billing/credits/per-user entitlements.
- LTX-native AV là luồng đích. Audio-first/TTS/import là lựa chọn explicit, không fallback âm thầm khi native AV/QC thất bại.
- Voice consistency nghĩa là **tương tự tuổi cảm nhận, âm sắc/kiểu giọng và accent**. Không yêu cầu clone 100%, speaker embeddings hoặc training LoRA. Pin voice description và nghe QA là baseline; conditioning reference là tùy chọn theo capability đã kiểm chứng.
- Một shot generation attempt tạo một immutable take. Transport replay dùng cùng attempt; regenerate thật tạo attempt mới. UNKNOWN không cấp phép retry.
- GPU target RTX 5090/32GB; một video compute hoạt động tại một thời điểm trên một GPU. Download/CPU kiểm tra có thể chồng lấp có giới hạn.
- Output baseline 1280×720, 24 FPS, MP4/H.264; không mặc định AI upscale. Không loop/freeze/speed-adjust lời thoại để che thiếu footage trong VIDEO_FIRST.
- Render dùng approved audio làm master clock; timing dự kiến chỉ để authoring/generation, không đủ điều kiện export.
- Persist intent và input fingerprint trước external I/O; không giữ PostgreSQL transaction mở trong HTTP/provider/FFmpeg I/O.
- Snapshot khóa script/source revision, CharacterVersion/voice profile, reference checksums, strategy/seed/model/workflow revision. Expiring capability URL và secrets không nằm trong semantic fingerprint.
- Kế hoạch không thay thế kế hoạch ngân sách sản xuất cũ bằng một monetary ledger mới. Đo runtime/footage yield/retry trước; chưa cam kết 60 phút/ngày hoặc trần chi phí bằng unit tests.
- DB hiện có V1–V10; CURRENT_STATUS ghi V1–V9 là drift. Theo [DATABASE](../architecture/DATABASE.md), thay baseline chỉ khi chưa freeze production; chỉ recreate DB được xác nhận disposable. Nếu baseline đã được áp dụng vào dữ liệu phải giữ, dừng phần rewrite và chốt rollout/forward migration theo ADR trước; các task không đổi schema vẫn làm được.
- Mọi UI change phải chạy Electron/Vite, thực hiện flow thật, kiểm console/API/loading/error/empty/overflow và lưu screenshot. Typecheck/source regex không thay runtime verification.

## 3. File map và quyết định giao diện

Đường dẫn task dùng các prefix cố định, mở rộng tương đối từ repository root:

| Prefix | Đường dẫn |
|---|---|
| B / BT | `app/backend-service/src/main/java/com/narrativex/backend/feature/generation` / tương ứng `src/test/java/.../feature/generation` |
| SB | `app/backend-service/src/main/java/com/narrativex/backend/feature/storyboard` |
| SQL | `app/backend-service/src/main/resources/mybatis` |
| DB | `app/backend-service/src/main/resources/db/migration` |
| G / GT | `app/generation-service/src/narrativex_gpu_worker` / `app/generation-service/tests` |
| D / DT | `app/desktop/src` / `app/desktop/test` |
| C | `packages/client-contracts/src` |

Các file mới bên dưới là đề xuất, không phải file đã tồn tại. Không tạo abstraction chỉ để có interface; tái sử dụng port/domain type hiện hữu.

**Hợp đồng cần giữ xuyên task:**

1. `GenerateShotTakeUseCase.execute(GenerateShotTakeCommand)` giữ entry point. Command bổ sung `idempotencyKey`; controller `POST /api/v1/projects/{projectId}/shots/{shotId}/takes` nhận `Idempotency-Key`. Trả TakeResponse PENDING cùng generationJobId, không trả null. Client giữ key qua transport retry; thao tác regenerate mới có key mới.
2. Take có liên kết typed `generationJobId`, `computeTaskId`, `computeAttemptId`, `operationPlanId`, cùng immutable `inputSnapshotJson/inputFingerprint`. `sourceDurationMs` luôn là độ dài file gốc đã probe; `sourceOutMs-sourceInMs` mới là độ dài edit. Không nhét identity quan trọng chỉ vào metrics JSON.
3. Bulk chapter tái sử dụng MediaPlan/media_generation_items làm danh sách công việc và parent GenerationJob BACKGROUND. Item video có `shotId` và `leafGenerationJobId`; mỗi leaf đi qua entry point admission ở mục 1. Một leaf/một take/một compute attempt, không gom nhiều clip vào một handle. Parent không submit GPU và không chiếm slot GPU; completion dựa trên toàn bộ items, không dựa vào một clip đầu.
4. Timeline thêm `selectedShotCuts` tách khỏi `beats` dùng cho story/legacy preview. Cut gồm chapter/scene/visualBeat/shot/take IDs, global order, asset ID/checksum/storage key, full source duration, source In/Out và timeline In/Out. Các cut dùng half-open interval.
5. Thêm audio spans: `mediaAssetId, sourceInMs, sourceOutMs, timelineInMs, timelineOutMs, checksum, alignmentArtifactId`. Native spans lấy từ approved AV takes; legacy spans lấy narration asset. Backend lưu metadata, Electron resolve bytes. Không cần ghi một audio master file giả lên backend để thỏa constructor cũ.
6. Render snapshot v2 lưu cut/audio span độc lập; profile schema 4 dùng cho đường mới. Giữ reader schema 3 và bảng beat/chapter cũ để render snapshot legacy. EDL mới nhận `AudioClockSource` và audio spans; native dùng GENERATED_TAKE_AUDIO, external dùng EXTERNAL_MASTER/TTS_FALLBACK. SCRIPT_LOCK không phải trạng thái render-ready.
7. Wire Compute Protocol vẫn ACCEPTED/RUNNING/SUCCEEDED/FAILED/CANCELED; UNKNOWN là submission checkpoint. Task schema mới advertise qua capabilities, không đổi nghĩa protocol v1 âm thầm.

## 4. Review Focus

1. Submit đã được engine nhận nhưng mất ACK/crash trước lưu handle: không submit lại, vẫn có đường reconciliation — Task 3/5/6.
2. Hai click hoặc hai request đồng thời cho cùng shot: một logical attempt/replay, không double GPU hoặc overwrite selected take — Task 3/4/7/11.
3. Sửa script/voice/reference sau enqueue: job dùng snapshot cũ; kết quả stale không tự gắn vào revision mới — Task 2/3/7.
4. Clip đủ byte nhưng decode lỗi, thiếu audio, sai câu/giọng hoặc trim hợp lệ có In > 0: không giả PASS; trim/clock đúng — Task 7/8/9/10.
5. Mất callback/SSE, restart Desktop/worker hoặc hết lease sau ghi MP4: có thể reload/reconcile; không double-finalize hoặc mất job — Task 5/10/12/13.

## 5. Task theo thứ tự phụ thuộc

Mỗi task: viết regression thể hiện invariant, xác nhận RED, sửa tối thiểu, xác nhận GREEN, cập nhật tài liệu sở hữu hành vi và tạo một commit chỉ chứa scope task khi được thực thi. Test mới phải tồn tại trước khi dùng filter tên test. Bất kỳ runtime gate chưa chạy được đều ghi BLOCKED, không đánh dấu DONE.

### Task 1 — Khởi động backend/worker và tách lỗi môi trường

**Files:** Modify `B/application/usecase/GetChapterProductionUseCase.java`; `deploy/remote-gpu-windows/{bootstrap,start,healthcheck}.ps1`, `runtime.lock.json`, `models.lock.json`, README. Tests: existing `app/backend-service/src/test/java/com/narrativex/backend/NarrativeXBackendApplicationTests.java`; new `scripts/tests/test_remote_gpu_windows_contract.py`; update `GT/test_supervisor.py`, `GT/test_runtime.py` nếu cần sửa harness.

**Interfaces:** Backend tạo được Spring context; worker được khởi động bằng package entrypoint `python -m narrativex_gpu_worker` trong đúng environment chứa package.

- [x] Regression Spring context phải fail với constructor hiện tại; giữ một constructor injection production rõ ràng, tránh constructor tiện test làm đổi wiring.
- [x] Bootstrap cài package/Torch vào cùng `$InstallDir/.venv`; pin môi trường và chạy import/entrypoint check trước start. Background start dùng `-WindowStyle Hidden`, healthcheck phải chờ endpoint thật và báo process exit.
- [x] Healthcheck tách service alive / executor ready. Kiểm ComfyUI/node/model manifest/callback reachability; thiếu models không được advertise ready.
- [x] Sửa test deadline bằng clock controllable thay timeout 30 ms. Với Temp/cache/build EPERM, dùng output riêng được phép hoặc môi trường phù hợp; không xóa out/cache/user data không rõ quyền. Xác minh supervisor inherited stdio trong đúng harness trước sửa production.
- [x] Run `./mvnw.cmd -Dtest=NarrativeXBackendApplicationTests test`; `python -m pytest tests/test_supervisor.py tests/test_runtime.py -q`; `python -m pytest scripts/tests/test_remote_gpu_windows_contract.py -q` từ đúng module/root. Expected: không có lỗi constructor; các lỗi environment được xử lý hoặc ghi blocked riêng.

**Gate:** Backend và worker có thể boot ở cấu hình test; runtime GPU chưa được chứng nhận ở bước này.

**Evidence 2026-10-02:** Constructor regression RED → GREEN; backend suite 560 tests, 0 failures/errors, 78 PostgreSQL/Testcontainers skips (Docker unavailable); worker suite 133 pass; deployment-script behavioral tests 5 pass using isolated runtimes. Ruff/mypy pass. Maven uses `narrativex.buildDirectory=target/verification/target` and a JVM temp directory in the workspace to avoid concurrent IDE bytecode/temp-permission problems. LTX weights, ComfyUI readiness and remote callback reachability remain unverified until Tasks 6/13.

### Task 2 — Analysis atomic và materialize AudioCue thật

**Files:** Modify `B/infrastructure/dispatch/ChapterAnalysisJobHandler.java`, `ChapterAnalysisArtifactMaterializer.java`; các analysis DTO/schema đang được materializer dùng; `SB/infrastructure/persistence/mybatis/StoryboardMapper.java`, `SQL/StoryboardMapper.xml` nếu mapping cue cần mở rộng. Create `BT/infrastructure/persistence/ChapterAnalysisAtomicMaterializationIntegrationTest.java`; update materializer/analysis tests hiện hữu.

**Interfaces:** Analysis output đã validate tạo cùng revision Scene → StoryBeat → AudioCue/VisualBeat → ShotSequence/Shot; lỗi validation không để retention/canon rows partial.

- [x] Test provider output có anchor sai sau retention/canon fields: transaction rollback toàn bộ; retry không bị UNIQUE(chapter_id). Test dialogue/speaker/source ranges được materialize và chỉ resolve participating characters.
- [x] Validate schema, source anchors và speaker mapping trước writes; mở transaction thực qua bean/proxy hoặc TransactionTemplate, thay self-invocation không được intercept. Provider I/O ở ngoài transaction.
- [x] Gọi persistence AudioCue cho NARRATOR/DIALOGUE/INNER_MONOLOGUE/SYSTEM theo enum hiện hữu; cue IDs/order/source offsets và speakerProjectCharacterId ổn định. Không fabricate dialogue từ vị trí row hoặc sourceText metadata. Non-speech/silence policy thuộc Task 8; không invent VOICEOVER/SILENCE DB enum ở đây.
- [x] Reject stale source/rowVersion trước writes, preserve locked character versions qua reconciliation. Voice-description/profile snapshot được pin ở take admission (Task 3), không yêu cầu audio reference tại materialization.
- [x] Run targeted analysis/materializer tests và PostgreSQL integration. Expected: cue đọc qua API đúng; failed materialization không để dữ liệu dở.

**Evidence 2026-10-02:** Four core regressions RED → GREEN; H2 verified real rollback and provider I/O outside transaction; PostgreSQL verified AudioCue readback, speaker FK, exact source ranges and DRAFT state. Full backend suite: 566 tests, zero failures/errors/skips. Run Maven outside the sandbox for Docker access. Legacy analysis payloads without cues remain readable; new requests use prompt/schema 1.1.

### Task 3 — Admission/idempotency/frozen input cho từng shot

**Files:** Modify `B/{api/controller/ChapterProductionController.java,api/request/GenerateShotTakeRequest.java,application/command/GenerateShotTakeCommand.java,application/usecase/GenerateShotTakeUseCase.java}`; `B/domain/aggregate/OperationPlan.java`, repository/row/SQL của OperationPlan; Take repository/row/SQL; `B/application/port/out/GenerationJobRepository.java` và adapter/SQL; `C/{story,generation}.ts`; `D/renderer/features/production/api/video-production.api.ts`. Create `B/application/model/TakeInputSnapshot.java` và `BT/infrastructure/persistence/ShotTakeAdmissionPostgreSqlIntegrationTest.java`. Schema theo DB policy: owning V2/V9 và indexes V6.

**Interfaces:** Hợp đồng mục 3.1–3.2. Enqueue transaction lưu job, plan, take PENDING, stage attempt và outbox; không gọi worker trong usecase.

- [x] Test cùng key/cùng fingerprint trả cùng take/job; cùng key/khác prompt/seed/revision trả 409; hai request concurrent không có hai attempt_number trùng hoặc hai reservation.
- [x] Lock idempotency và shot khi cấp attempt number; DB unique (shot_id,attempt_number) là tuyến bảo vệ cuối. ID/fingerprint/seed/deadline được lưu một lần, không dùng timestamp mỗi lần HTTP retry.
- [x] Pin script/cues, participating CharacterVersions, voice description/version, optional reference checksums, provider/model/workflow profile, seed/strategy và audio mode. OperationPlan có scope thật; không giả định aggregate hiện tại đã chứa snapshot.
- [x] Tái sử dụng capacity lock/reservation hiện hữu: phân biệt queue admission và slot thực thi GPU; một GPU chỉ một admitted execution. Ref/reference chỉ lấy READY approved thuộc đúng Project. Thiếu reference bắt buộc I2V/FLF thì reject trước I/O; text-only voice profile vẫn được dùng khi mode không hỗ trợ audio conditioning.
- [x] Take insert/snapshot persistence lỗi phải abort; không catch rồi submit với null take. Trả response PENDING có takeId/jobId để UI theo dõi ngay.
- [x] Run `./mvnw.cmd -Dtest=GenerateShotTakeUseCaseTest,ChapterProductionControllerTest,ShotTakeAdmissionPostgreSqlIntegrationTest test`. Expected: replay deterministic, DB intent tồn tại trước bất kỳ submit nào, capacity concurrency đúng.

**Evidence 2026-10-03:** Atomic admission/frozen input/idempotency PostgreSQL tests pass; full backend 583 tests, zero skips. Review caught callback-before-ACK status regression and lifecycle-only replay conflict; both fixed RED → GREEN with 46 targeted tests, zero skips. Scoped SPEC and CODE QUALITY reviews PASS. Native UI/GPU gates remain Tasks 6/11/13. Native UNIQUE constraints live in owning V9, because V6 precedes takes.

### Task 4 — Bulk chapter tạo đủ công việc cho mọi shot

**Files:** Modify `B/application/usecase/CreateMediaJobUseCase.java`; media_generation_items aggregate/repository/row/SQL; `B/infrastructure/dispatch/{ComputeExecutionDispatcher,VideoGenerationJobHandler}.java`; `B/application/usecase/GetChapterProductionUseCase.java`; owning V4/V6; `C/story.ts`. Create `BT/infrastructure/persistence/ChapterVideoBatchPostgreSqlIntegrationTest.java`.

**Interfaces:** Hợp đồng mục 3.3. Parent là progress container có danh sách items khóa; leaf dùng Task 3. Không thêm business root Episode/Batch hoặc queue trong renderer.

- [ ] Test chapter có một beat/ba shots: có đủ ba items và ba logical leaf identities; cùng key replay không sinh item mới; job không COMPLETED sau clip thứ nhất.
- [ ] Freeze danh sách shot/order/revision khi bulk được tạo; item_key dùng shot identity thay beat identity. Persist mapping item → leaf job/take; pending items sống qua restart.
- [ ] Dispatch leaf qua outbox và slot GPU; parent BACKGROUND chỉ schedule/projection, không submit ComfyUI. Không reserve một slot GPU cho parent hay hàng trăm queued children cùng lúc.
- [ ] Finalize/cancel parent dựa trên toàn bộ item outcomes; UNKNOWN/review/rejected hiển thị từng shot. Reload không mất items còn chưa chạy; current chapter job không âm thầm thay batch đang active.
- [ ] Run `./mvnw.cmd -Dtest=CreateMediaJobUseCaseTest,VideoGenerationJobHandlerTest,ChapterVideoBatchPostgreSqlIntegrationTest test`. Expected: all-shot scheduling, restart/resume, partial progress đúng.

### Task 5 — Outbox, callbacks và UNKNOWN có đường phục hồi

**Files:** Modify `B/infrastructure/dispatch/GenerationOutboxDispatcher.java`, `SQL/GenerationOutboxMapper.xml`; `B/infrastructure/reconciliation/ComputeReconciliationService.java`, finalizer registry/callback application tests; `G/application/services/execution.py`, `G/adapters/persistence/sqlite_execution_journal.py`, `G/domain/submission.py` khi cần. Tests: `BT/infrastructure/dispatch/GenerationOutboxDispatcherTest.java`, reconciliation tests, `GT/test_runtime.py`, `GT/test_journal.py`, cancellation tests.

**Interfaces:** Một common finalizer selection bằng job type + production mode; durable outbox chỉ acknowledge khi intent đã chuyển sang đường xử lý có thể recover. Wire states giữ nguyên.

- [ ] Test dispatcher throws: event vẫn pending/backoff, không `markPublished`. Dispatcher không wired cũng không được discard event. Durable submitted/UNKNOWN có reconciliation ownership thì mới có thể ACK.
- [ ] Truyền productionMode trong reconciliation giống callback; test successful video khi callback mất vẫn materialize take đúng. Duplicate event/out-of-order/success-after-cancel race không đảo terminal state hoặc overwrite approved selection.
- [ ] Test callback SUCCEEDED đến trước receipt được markSubmitted: receipt muộn không được chuyển COMPLETED về RUNNING; optimistic version conflict phải reload rồi monotonic no-op.
- [ ] Mất ACK/timeout sau dispatch: giữ checkpoint UNKNOWN và observation nonterminal để recover; có handle thì poll, không có handle thì adapter lookup với correlation ID đã persist. Không chứng minh NOT_SUBMITTED thì không resubmit.
- [ ] Làm rõ deadline/cancel cho ambiguous attempts trong ADR-0021/Compute Protocol: deadline là dừng dispatch/poll budget, không bằng chứng engine đã fail. Chỉ terminalize khi biết outcome/cancel được xác nhận; hết khả năng xác minh thì expose unresolved/manual action, giữ no-retry fence. Không invent wire UNKNOWN state.
- [ ] Dùng bounded backoff có jitter và nextReconcileAt persisted; không tight-loop hoặc giữ worker thread chờ model. Capacity settlement chỉ một lần theo known outcome/confirmed resource release.
- [ ] Run targeted backend outbox/reconciliation tests; `python -m pytest tests/test_runtime.py tests/test_journal.py tests/application/test_execution_cancellation.py -q`. Expected: crash trước/sau handle và lost callback không duplicate compute; unknown attempt vẫn discoverable.

### Task 6 — Workflow LTX thật, profile pin và capability đúng

**Files:** Modify `G/adapters/executors/ltx/{workflow,executor}.py`, `G/adapters/executors/comfyui/client.py`, `G/bootstrap.py`, model/settings registry; deployment locks/healthcheck; `B/infrastructure/dispatch/VideoGenerationJobHandler.java` và `B/infrastructure/compute/VideoGenerationProperties.java`. Create `G/adapters/executors/ltx/workflows/native-av.json` và profile manifest có digest; update `GT/executors/test_ltx.py`. Task schemas/capabilities/examples chỉ sửa khi cần field mới.

**Interfaces:** Một allowlisted immutable workflow profile cho model/revision cụ thể; input binding có whitelist. Backend chỉ gửi resolved opaque artifact refs và generation controls, không arbitrary ComfyUI graph/domain IDs.

Tham chiếu: [source SaveVideo/CreateVideo chính thức](https://github.com/Comfy-Org/ComfyUI/blob/master/comfy_extras/nodes_video.py); node schema runtime được pin mới là căn cứ triển khai, không latest docs đơn lẻ.

- [ ] Import workflow self-hosted chính thức phù hợp LTX 2.5/model quantization/runtime thật; pin workflow/node/model digests. Không suy ra self-hosted 2.5 từ tài liệu cloud API hoặc tự đổi sang 2.3/cloud provider.
- [ ] Validate graph bằng `/object_info` của runtime đã pin: đúng loader/latent/sampler/decode audio-video và SaveVideo input. Test graph traversal từ save node phải đi qua generated audio decoder; không mux voice reference làm thoại mới.
- [ ] T2V trước; sau khi pass mới enable I2V/FLF bằng reference thật. Không hard-code node/frame constraints theo trí nhớ. Quy đổi target duration sang frame count hợp lệ của model, ghi duration/frame count thực ở output, không dùng target làm actual.
- [ ] Compile exact approved dialogue/speaker voice descriptions vào prompt; optional audio conditioning chỉ enable khi profile chứng minh support. Capability nativeAudio/voiceConditioning/T2V/I2V/FLF phản ánh profile thực. Mất reference bắt buộc hoặc graph/model mismatch thì preflight fail.
- [ ] Persist deterministic prompt/correlation identifier trước `/prompt`, probe queue/history để reconcile; submit retry không tạo prompt ID mới. Test fake HTTP loss là failure-mode test, không real health evidence.
- [ ] Nếu cần schema mới: `video.generate` schemaVersion 1.1 thêm constrained workflowProfileId/native-audio controls, đóng nested objects; advertise 1.0/1.1 có compatibility window. Không gửi shot/character/project IDs, arbitrary providerOptions hoặc host paths.
- [ ] Run `python -m pytest tests/executors/test_ltx.py -q` và graph-schema check trên ComfyUI thật không submit model. Đánh dấu R1 real compute pending cho đến Task 13; mô hình/voice support không tồn tại thì capability BLOCKED, không fake ready.

### Task 7 — Kiểm clip, persist kết quả Take và review trước selection

**Files:** Modify `G/adapters/executors/media_validation/executor.py`, LTX executor output handling; `B/infrastructure/finalizer/VideoGenerationResultFinalizer.java`; TakeMapper/SelectedTakeMapper Java + SQL; `B/application/service/VideoQualityAssurance.java`, `B/application/usecase/SelectTakeUseCase.java`, `B/api/controller/ChapterProductionController.java`; update contracts của validation result. Create `B/api/request/ReviewTakeRequest.java`, `B/application/usecase/ReviewTakeUseCase.java`, `BT/application/usecase/ReviewTakeUseCaseTest.java`, `BT/infrastructure/persistence/VideoTakeFinalizationPostgreSqlIntegrationTest.java`; update `GT/executors/test_media_validation.py` (create nếu chưa có), finalizer/SelectTake tests.

**Interfaces:** `media.validate(decode=true)` có output report versioned với video/audio codec, dimensions, rational fps, decoded frame count, source duration, audio stream duration và decode errors. Backend orchestration yêu cầu verified report; callback transaction chỉ apply DB, không thực thi ffprobe/remote I/O. Take thêm `reviewStatus` theo NOT_READY/NEEDS_REVIEW/APPROVED/REJECTED, `reviewedAt` và `reviewReason` trong owning V9; technical validation và human approval là hai thuộc tính riêng, không thêm reviewer account identity.

`ReviewTakeUseCase.execute(UUID projectId, UUID shotId, UUID takeId, String decision, String reason, long rowVersion): TakeResponse` thực hiện optimistic update review state; controller chỉ validate/route vào usecase này.

- [ ] Test output có header MP4 nhưng truncated/decode fail/zero frames; dialogue clip thiếu audio; wrong checksum; không có validation report: không PASSED/selectable.
- [ ] Dùng ffprobe và full decode cho clip ngắn; LTX chỉ nhận output slot video thật, không lấy image/gif và đổi label thành video/mp4. Technical validation CPU không chiếm VRAM family.
- [ ] First finalization persist `output_asset_id`, source duration **thực**, metrics/validation cùng optimistic-lock update. Chỉ bind take khớp exact job/task/attempt; callback replay không áp output vào take khác hoặc increment version vô hạn.
- [ ] Lưu generated artifact → VALIDATING trước; technical PASS chưa đồng nghĩa human approval/đúng dialogue. Không tự chọn first PASSED take nếu thiếu review; giữ approved take cũ khi retake mới được tạo.
- [ ] Controller có `POST /api/v1/projects/{projectId}/shots/{shotId}/takes/{takeId}/review` nhận decision APPROVED/REJECTED, reason và rowVersion. SelectTake chỉ nhận APPROVED take; approval/conflict/reject được persist và phát event. Review không thể bỏ qua hard technical failure; test approve rồi reload DB trước select.
- [ ] Selection kiểm đúng shot/project, media READY/local identity và `0 <= In < Out <= fullSourceDuration`; cập nhật selected take có If-Match/rowVersion hoặc CAS để không lost update.
- [ ] Run finalizer + SelectTake tests và PostgreSQL integration: finalize → disconnect/reload TakeMapper → assert assetId/duration/checksum; replay cùng event đúng một selection. Repair take cũ chỉ khi existing artifact lineage chứng minh mapping, không bulk gán PASSED giả.

### Task 8 — Independent speech QC, voice review và finalized audio clock

**Files:** Modify `G/adapters/executors/whisperx/{client,executor}.py`, contracts models/task/registry/bootstrap; create `contracts/compute/v1/schemas/task-audio-transcribe.json`, example và `contracts/take-dialogue-qc.v1.schema.json`; add `audio.transcribe` tests. Backend use `B/application/service/VideoQualityAssurance.java`, `B/domain/enums/VideoQAFailureCategory.java`, Take review DTO/repository; `D/renderer/features/storyboard/components/TakeSelectorDrawer.tsx`; source voice/profile fields hiện có trong character feature.

**Interfaces:** `audio.transcribe` inputs `{audioArtifactRole, language}`; không nhận script kỳ vọng. Artifact role có thể trỏ audio/wav hoặc native video/mp4 đã validate; worker decode audio stream bằng FFmpeg sang 16 kHz mono cho WhisperX, không trả host path. Report `{schemaVersion, detectedText, language, segments, words}`; words có optional timestamp/score, thiếu timing không tự fabricate. Transcript/alignment report là artifact với SHA-256. Backend/human so với approved cue snapshot.

Tham chiếu: [WhisperX transcribe → align](https://github.com/m-bain/whisperx/blob/main/_autodocs/api-reference/align.md). API thực tế phải khớp version runtime đã pin.

- [ ] Test actual spoken text khác expected script nhưng forced alignment vẫn trả spans: phải DIALOGUE_MISMATCH/review, không PASS vì align succeeded. Empty speech, missing word timing, wrong speaker, unavailable QC phải expose blocked/review.
- [ ] WhisperX transcribe actual audio trước, align recognized segments sau. Không dùng forced alignment against expected script như bằng chứng model nói đúng; không tự sửa approved script để khớp output.
- [ ] Baseline nghe QA kiểm đúng câu quan trọng, speaker, voice similarity, lip sync; tuổi/accent/kiểu giọng rõ ràng đổi thì reject, biến thiên delivery nhẹ cho phép. Reference audio optional; không dựng voice clone/embedding score làm prerequisite.
- [ ] Thêm taxonomy audio/dialogue cần thiết: DIALOGUE_MISMATCH, WRONG_SPEAKER, VOICE_IDENTITY_DRIFT, LIP_SYNC, AUDIO_ARTIFACT; chỉ auto-detect loại có signal thật. Technical failures không human-override thành hợp lệ; ASR false positive có thể review với reason recorded.
- [ ] Retry audio/video dùng chung giới hạn: tối đa hai auto retries sau lần đầu cho một shot revision; prompt tweak không reset count. Unknown không retry. Reject/hết lượt → manual review, không tự chuyển VieNeu.
- [ ] Approved take + usable In/Out + verified word timing tạo audio spans locked. SILENCE/ambient được explicit authoring; thiếu thoại bắt buộc không coi là silence hợp lệ. Map subtitle words theo cut, trim và offset global.
- [ ] Run worker transcript tests, shared contract check và backend QA tests; fixture tạo spoken mismatch/low confidence là test-only. Voice similarity được xác nhận trong real human benchmark Task 13, không bằng schema tests.

### Task 9 — EDL nhiều shot và snapshot bất biến

**Files:** Modify `B/application/service/EditingDirector.java`, `B/application/query/ProductionTimelineView.java`, `B/application/usecase/{GetProductionTimelineUseCase,CreateProjectRenderUseCase,GetChapterProductionUseCase}.java`; timeline source port/adapter/rows/SQL; render snapshot adapter/mapper/SQL; `app/backend-service/src/main/java/com/narrativex/backend/feature/localexecution/application/port/out/LocalProjectRenderStore.java` và corresponding mapper/store/SQL; `C/production.ts`, `contracts/local-render-manifest.v1.schema.json` hoặc version mới. Schema: V4/V5 immutability/V6 theo DB policy. Create `BT/infrastructure/persistence/SelectedShotRenderSnapshotIntegrationTest.java`.

**Interfaces:** Hợp đồng cuts/spans/snapshot mục 3.4–3.6. Extend EditingDirector bằng overload nhận AudioClockSource + approved audio spans; giữ legacy overload đọc external master. Add snapshot tables `project_render_input_shots` và `project_render_input_audio_spans`, key theo renderJob + shot/order thay visualBeat-only.

- [ ] DB test một VisualBeat có ba selected shots 2s/3s/4s: cả ba tồn tại đúng thứ tự trong timeline, persisted snapshot và claim payload. In=2000/Out=5000 của source=5000 phải thành cut 3000ms, không bị trừ thêm.
- [ ] Bỏ LIMIT 1 cho selected-shot path; batch query full selected set và ordered hierarchy. Không nhân bản beat keys để che lỗi snapshot PK; legacy beat preview giữ reader riêng.
- [ ] EditingDirector kiểm nguồn audio locked/đã duyệt, cut bounds/coverage/ordering và missing shot; không dùng `Math.max(cutDuration,audioMasterDuration)` để che gap. Native timeline theo approved audio spans; audio-first phải đủ footage cho external master, không loop/freeze.
- [ ] Rounding frame từ global boundaries và rational FPS; không cộng duration đã round riêng từng shot. V1 cut-only để chốt sync; chỉ bật dissolve/fade khi transition/audio overlap policy có test rõ, không tự nối silence/black để lấp hole.
- [ ] CreateProjectRender chụp EDL/cuts/audio/word timing/model lineage atomically; claim/recovery không đọc live selected_take để thay render cũ. Nếu selection đổi giữa read và snapshot, optimistic conflict thay vì mixed revision.
- [ ] Production status và render admission cùng dùng readiness evaluator: SCRIPT_LOCK/provisional/ASR pending/missing bytes không renderReady. Có blocked reason cụ thể cho UI.
- [ ] Run EditingDirector/timeline/render tests và integration mới trên DB disposable. Expected: source edits hoặc new selection sau snapshot không đổi MP4 input cũ; missing middle shot bị chặn.

### Task 10 — Native audio render, 24 FPS, subtitles và recovery

**Files:** Modify `D/main/rendering/{render-profile,render-manifest,project-renderer,segment-renderer,audio-concat,audio-muxer,ffprobe,render-sync-validation,render-journal,segment-cache-key}.ts`; `D/shared/render-frame-clock.ts`; `B/application/render/ProjectRenderProfileFactory.java`; local completion store/schema validators. Tests: existing `DT/render-sync-validation.test.mjs`, `DT/render-manifest-subtitles.test.mjs`, `DT/render-lifecycle-regressions.test.mjs`; create `DT/render-native-av.integration.test.mjs`, `DT/render-profile-fps.test.mjs`.

**Interfaces:** Parser nhận legacy schema3 và profile4; fps 24|30|60 giữ đúng. Native render trim audio từ cùng approved source clip/cut; external narration mode dùng path cũ có chủ đích.

- [ ] Regression 24→24, 30→30, 60→60; invalid FPS reject. Completion verify probed FPS/dimensions against immutable profile, không so với parser fallback đã đổi giá trị.
- [ ] Native segments/audio spans không bị `-an` bỏ audio rồi mux TTS khác. Normalize timestamps/sample rate/channel layout và concat/mix bằng FFmpeg hiện có; không kéo pitch/speech speed để fit target.
- [ ] Clip fixture có tone khác nhau cho ba shots và trim In>0: decoded output phải giữ đủ ba phần audio/video đúng order, expected boundaries và subtitle offset; không chỉ assert file tồn tại.
- [ ] Keep checksum/manifest local resolution; preflight missing/corrupt asset, free disk, FFmpeg capability. Cache key gồm input checksum, cut In/Out, fps/profile/renderer version và audio/subtitle effects liên quan.
- [ ] Journals checkpoint verified outputs; restart chỉ reuse output đã probe+checksum. Lease loss/cancel giữa mux/finalize không báo success; delivery retry đăng ký metadata idempotent, không render lại nếu artifact đã valid.
- [ ] Run `node --experimental-strip-types --experimental-transform-types --test test/render-profile-fps.test.mjs test/render-native-av.integration.test.mjs test/render-lifecycle-regressions.test.mjs` với bundled FFmpeg. Expected: 720p/24 thật, audio/video sync và legacy snapshot vẫn chạy.

### Task 11 — Nối UI Take và sửa Voices/route readiness

**Files:** Modify `D/renderer/features/chapters/{screens/ChapterWorkspaceScreen.tsx,components/stages/ChapterProductionStage.tsx}`; `D/renderer/features/storyboard/components/{VideoShotboard,TakeSelectorDrawer,ShotActionToolbar}.tsx`; `D/renderer/features/workspace/queries/useProjectWorkspace.ts`; `D/renderer/features/canon/screens/ProjectCanonScreen.tsx`; Voices queries/screen; `D/renderer/features/production/{api,queries}/video-production.*`; production DTO/client contracts. Update `DT/video-production-components.test.mjs`; create a runtime flow driver `scripts/verify-desktop-production-flow.mjs` using the available automation environment, without introducing a new product frontend.

**Interfaces:** Workstation mount VideoShotboard với backend data; generate/retake/select/trim dùng các API hiện hữu, no fake synthesize shots. UI giữ idempotency key trong cùng pending command và rowVersion cho selection.

- [ ] Mount take controls vào stage thực; chỉ một state owner/query cho selected take. Cho preview âm thanh, review, regenerate, switch take, trim, unsupported-strategy disabled và reason; approved take giữ nguyên khi retake còn pending.
- [ ] Tải AUDIO assets cho Voices, không truyền visual-only list. Chapter query dùng storyVersion ID từ authoritative project/current-story source, không phụ thuộc timeline cache bị disable. Direct Canon/Jobs reload phải có chapters.
- [ ] Display progress/readiness từ backend: queued/running/validating/review/unknown/blocked, không cộng selectedCount + passedCount trùng rồi clamp %. Render button dựa readiness evaluator của Task 9.
- [ ] Runtime flow: analyze → complete → shots appear → generate → review/select → trim In>0 → Editor → Render; test direct Canon import voice, cold reload, error/retry/empty states. Kiểm console, failed requests và screenshots.
- [ ] Run `npm test`, `npm run type-check`, `npm run build` và Electron/browser automation thật. Test regex chỉ hỗ trợ regression structure; nếu native UI automation không có, task runtime-verification BLOCKED.

### Task 12 — Refresh đúng cache và giảm request thừa

**Files:** Modify `D/renderer/features/generation/realtime/project-events.ts`; story/production/storyboard query modules; generation mutations; `D/main` SSE transport chỉ khi cần. Update `DT/sse-subscription-contract.test.mjs`, generation/status tests; create `DT/production-query-refresh.test.mjs`.

**Interfaces:** Một canonical production query key family; SSE terminal snapshot invalidate story + production + status + timeline đúng Project/Chapter scope. Watchdog chỉ fallback khi active/disconnected; durable state vẫn backend.

- [ ] Test analysis completes sau enqueue lâu: story revision mới hiển thị không cần focus/remount. Test video completes khi cached status ban đầu idle: shots/takes/readiness refresh.
- [ ] Consolidate hai bộ chapter-production/video-production hooks đang gọi cùng endpoints; giữ một family/export compatibility, không tạo polling state machine thứ ba.
- [ ] Subscribe khi Project mở; validate event payload/project; invalidate/coalesce đúng scope. Reconnect làm một authoritative snapshot GET; không invalidation toàn workspace sau mỗi progress tick.
- [ ] Fallback GET bounded khi active hoặc SSE disconnected, stop khi terminal; không dùng interval chỉ bật khi stale cached response đã busy. Mutation success refresh key ngay và SSE vẫn xử lý completion.
- [ ] Run query tests và runtime flow Task 11 với lost SSE/reconnect. Expected: refresh đúng sau terminal; request count idle không tăng theo số shot.

### Task 13 — Smoke thật, docs và full acceptance gate

**Files:** Modify `scripts/smoke-ltx-rtx5090.py`, `scripts/smoke-remote-generation-service.py`, `scripts/verify-local.py` khi cần explicit gate coverage; relevant backend/worker/desktop tests. Update `documentation/{CURRENT_STATUS,COMPUTE_PROTOCOL}.md`, product spec/roadmap, editing pipeline, runtime operations, deployment README/env và ADR sections được task thay đổi.

**Interfaces:** `--dry-run` chỉ validate payload và nói chưa generate. Real smoke submit/poll/download/decode có deadline và exact ids; unavailable/failed/budget not authorized không exit0 như thành công.

- [ ] Script dùng real API, đủ protocol fields/fingerprint/Idempotency-Key/deadline, probe output streams/frame/audio, verify checksum. Không bọc một custom orchestration thay backend bằng script.
- [ ] Correct docs IMPLEMENTED/PARTIAL/TARGET: V1–V10, native audio/QC, take UI, 24 FPS, deferred strategies. Cập nhật current behavior theo evidence, không chỉ đổi chữ trong CURRENT_STATUS để gate pass.
- [ ] Full provider-independent gate: `python scripts/verify-local.py` (hoặc PS wrapper), `python scripts/check_compute_contracts.py`, `python scripts/check-docs-drift.py`, `git diff --check`. PostgreSQL suites phải thực sự chạy trên disposable DB; skip không là pass integration.
- [ ] Với runtime/GPU do người dùng cấp và authorization chi phí phù hợp, chạy R1 một shot; R2 project 1–3 phút có ít nhất hai Chapters và một VisualBeat nhiều shots, trim In>0, dialogue/native audio, subtitle, 720p/24, playback/export local.
- [ ] Fault injection: lost ACK/callback/SSE; worker/backend/Desktop restart; duplicate POST/event; input edit sau enqueue; cancel/lease loss; corrupt/missing asset và disk-full. Assertions: không duplicate submit/finalize, không mất approved take, chưa đủ evidence thì không renderReady.
- [ ] Voice real benchmark tối thiểu hai nhân vật (trẻ con/người lớn), mỗi người sáu câu qua ít nhất ba generations độc lập, nhiều cảm xúc và quay lại cảnh khác. Human QA theo similarity đã chốt, không đòi clone100%. Chưa đạt thì giữ BLOCKED_VOICE_CONSISTENCY, không tự đổi provider/mode.
- [ ] Chỉ sau R2 đạt mới chạy tập 5 phút; 60 phút/ít nhất ba lần tiếp theo là long-form evidence riêng. Lưu evidence artifact/checksum, environment/workflow/model versions và những gate chưa chạy được.

### Task 14 — Tối ưu sau khi đường nhỏ đã đúng

**Files:** Chỉ sửa các hotspot có số liệu: `B/infrastructure/dispatch/VideoGenerationJobHandler.java`, Take/SelectedTake/production SQL; `G/adapters/runtime/{manager,supervisor}.py`; artifact transport; `D/main/rendering/{project-renderer,segment-cache-key}.ts`. Tái sử dụng benchmark/smoke scripts và telemetry hiện hữu, không thêm observability platform.

**Interfaces:** Timing spans/counters dùng cùng job/task/attempt correlation, không log prompt/secret/path; so sánh trước/sau cùng workload và pinned runtime.

- [ ] Đo stage durations: queue wait, model load, generate, download/upload, technical QC, ASR, human review, local render; retry rate, UNKNOWN tuổi, usable footage/generated footage, peak VRAM/disk và query/request count. Dùng median/p95 đo thật, không ước lượng thành SLA.
- [ ] Batch SQL thay N+1 `findByShotId` trong chapter; dùng `findByShotIds` đã có. Với batch 100 shots, query count phải cố định theo nhóm query thay vì linear theo shot. Chỉ thêm index khi EXPLAIN ở workload thật chứng minh cần; hiện unique (shot_id,attempt_number) đã có.
- [ ] Giữ model residency trong cùng family, tránh unload/load giữa mỗi shot. Nhóm LTX footage và WhisperX QC theo bounded window, ưu tiên fairness/cancel; không chạy LTX+WhisperX đồng thời trên cùng GPU khi VRAM chưa chứng minh đủ.
- [ ] Chồng lấp transfer/CPU QC với GPU bằng concurrency cap; streaming file/checksum tránh giữ nhiều MP4 lớn trong RAM. Retry transfer capability mới giữ cùng semantic fingerprint, không regenerate chỉ vì download lỗi.
- [ ] Reuse approved keyframe/assets và valid segment cache; invalidation theo checksum/revision/cut/profile thật. Disk cleanup chỉ completed/failed work không còn leased; giữ unfinished journals và referenced assets.
- [ ] Render stream-copy chỉ khi codec/fps/resolution/timebase/cut-boundary/effects thực sự tương thích; subtitle burn/transition/non-keyframe trim dùng encode đúng. Benchmark NVENC đã có so với libx264; không mặc định parallel FFmpeg vô hạn.
- [ ] Benchmark trước/sau và chạy lại relevant tests + R2. Tối ưu không đạt cải thiện đo được hoặc làm recovery phức tạp thì bỏ; chưa cần Redis/broker/đa provider/AI quality scorer riêng.

## 6. Thứ tự triển khai và tối ưu đáng làm ngay

```text
Task 1 → Task 2 → Task 3 → Task 4 → Task 5
                                 ↓
                     Task 6 → Task 7 → Task 8
                                 ↓
                     Task 9 → Task 10 → Task 11 → Task 12
                                 ↓
                             Task 13 → Task 14
```

Không cần chờ real GPU để viết/regression-test admission, snapshots, SQL persistence, trim, 24 FPS, refresh UI hay renderer fixtures. Nhưng không đánh dấu LTX/voice/E2E production validated trước real evidence.

| Tối ưu | Mức ưu tiên | Lý do |
|---|---|---|
| Một đường admission + durable queue cho manual/bulk | Làm cùng fix | Giảm duplicate compute, giảm caller divergence |
| Callback/reconcile chung finalizer, UNKNOWN nonterminal | Làm cùng fix | Recovery đúng thay vì tăng số retry |
| Readiness evaluator chung, technical QA trước human approval | Làm cùng fix | UI và admission không tự mâu thuẫn |
| Batch reads và canonical query keys | Làm cùng fix nếu nhỏ | Giảm N+1 và stale/request storms bằng helper/query đã có |
| Model residency + bounded transfer/CPU overlap | Sau R2 và đo baseline | Có thể tăng usable throughput mà vẫn một video/GPU |
| Segment reuse, streaming transfer, adaptive FFmpeg concurrency | Sau correctness gates | Giảm RAM/disk/render cost; không trade off trim/sync |
| Broker/cache/business microservices/voice cloning | DEFERRED | Không giải quyết các blocker hiện tại, chưa có measured need |

## 7. Rủi ro cần kiểm chứng, không giả định đã đạt

- Workflow self-hosted LTX 2.5 NVFP4/hardware compatibility và native voice similarity giữa nhiều calls: chỉ runtime/benchmark thật xác nhận; docs cloud hoặc model card không đủ.
- Master clock/EDL contract hiện vẫn mang giả định một narration asset. Snapshot v2/audio spans là thay đổi boundary thật, phải document trước implement và giữ legacy reader.
- Baseline migrations và dữ liệu đang dùng: không reset database từ planning task. Chốt disposable/frozen status trước schema writes.
- Test harness quyền Temp/output/Docker hiện có giới hạn. Cần môi trường phù hợp; không xóa output tùy tiện hoặc đổi tests để che lỗi source.
- Phần ngân sách/tốc độ tập dài của LTX implementation plan vẫn TARGET. Rejected attempts và review time phải có trong measurement; không suy rộng từ clip 4s hoặc FFmpeg fixture.

## 8. Checklist tự review kế hoạch

- Tất cả nhóm lỗi review đã có task sở hữu: boot/venv 1; canonical/analysis 2; submit/admission 3; bulk 4; outbox/UNKNOWN/reconcile 5; workflow 6; output persistence/selection 7; audio/voice/QC 8; multi-shot/trim/readiness 9; fps/native render 10; UI/Voices 11; stale queries 12; smoke/docs/gates 13; performance 14.
- Không tăng yêu cầu voice từ similarity lên clone. Không bắt conditioning reference cho profile text-only đã được sản phẩm cho phép.
- Một logical attempt/replay không tái tính input/deadline/seed; một retake mới không overwrite accepted take hoặc snapshot cũ.
- Mỗi task có invariant test cụ thể và gate; DB/native/GPU/UI coverage tách riêng, unavailable không được đổi thành passed.
- Task 1 implementation đã qua provider-independent gates; Task 2–14 và real GPU/UI/long-form acceptance còn pending. Không thuê GPU, reset database hoặc publish trong quá trình setup.
