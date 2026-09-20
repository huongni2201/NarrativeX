# NarrativeX LTX Production — Implementation Plan

> **For agentic workers:** Dùng `superpowers:executing-plans` để thực hiện từng task và cập nhật checkbox. Đây là kế hoạch, không phải bằng chứng tính năng đã triển khai. Không thuê GPU, gọi dịch vụ tính phí hoặc publish video chỉ vì đọc kế hoạch này.

**Goal:** Xây đủ luồng Gemini → production package → keyframe có reference → LTX-2.5 → tải và kiểm tra clip → hậu kỳ local để sau đó benchmark chất lượng, tốc độ và chi phí tập 60 phút dưới 100.000đ.

**Architecture:** Spring Boot tiếp tục sở hữu business state, admission, kế hoạch, retry và PostgreSQL. Generation service thực thi task domain-neutral bằng Compute Protocol; Electron main sở hữu bytes local, credentials, FFmpeg và ffprobe. Không tạo orchestrator thứ hai trong renderer hoặc GPU worker.

**Tech Stack:** Spring Boot/MyBatis/PostgreSQL; Python generation service/SQLite execution journal/ComfyUI; Electron/React/TypeScript/FFmpeg; Vertex Gemini. LTX-2.5 Distilled NVFP4 là ứng viên benchmark, chưa là profile production được chứng nhận.

**Spec:** Design brief và các hợp đồng TARGET trong mục 1–4 dưới đây; yêu cầu nguồn là phương án người dùng cung cấp ngày 2026-09-20. Kế hoạch được viết theo yêu cầu trực tiếp “plan chi tiết để implement, sau đó mới test”.

## 1. Phạm vi và kết quả cần đạt

- TARGET: một tập khoảng 60 phút/ngày, footage chuyển động mới, không dùng ảnh tĩnh/loop/freeze để bù thời lượng.
- TARGET: đầu ra 1280×720, 24 FPS; không mặc định AI upscale 1080p.
- TARGET: tổng chi phí mỗi tập không quá 100.000 VND; ưu tiên chất lượng trong giới hạn đó. Chưa cam kết throughput trước benchmark thật.
- TARGET: tối đa 2 retry tự động cho mỗi shot, tức tối đa 3 lượt sinh; sửa prompt/keyframe không được tự reset giới hạn này. Retry thủ công vẫn phải qua admission.
- TARGET: một video generation task hoạt động tại một thời điểm trên GPU; tải clip có thể đồng thời với compute.
- Không Qwen, đa video provider, broker mới, microservice business mới, billing người dùng, tự động mua/thuê máy hay tự upload công khai.
- V1 tích hợp ComfyUI LTX qua worker hiện có. Native ltx-pipelines là phương án thay adapter nếu thử nghiệm chứng minh ComfyUI không đáp ứng; không xây cả hai ngay.
- TARGET cập nhật: nội dung tiếng Anh, ưu tiên LTX sinh cả hình và audio; mỗi nhân vật giữ cùng vocal identity xuyên cảnh. VieNeu không còn là giọng production mặc định cho luồng này. Audio nhập sẵn/TTS riêng chỉ là chế độ explicit, không tự fallback khi LTX trượt quality gate.
- “Episode” là một production run chọn các Chapter có thứ tự trong một Project/StoryVersion, không phải business root mới. Một tập có nhiều batch GPU; một phiên thuê có thể phục vụ nhiều tập.
- Unit/contract/integration tests đi cùng từng thay đổi; benchmark model và E2E tính phí chỉ thực hiện khi luồng tối thiểu đã chạy được.

### Mốc bàn giao

| Mốc | Kết quả | Điều chưa được tuyên bố |
|---|---|---|
| M0 | Hợp đồng, ADR, test fixtures và schema rõ ràng | Chưa có video generation |
| M1 | Một shot đi xuyên backend → worker → local → render 24 FPS | Chưa chứng minh chất lượng/giá |
| M2 | Batch, resume, retry, budget guard và UI vận hành đầy đủ | Chưa đạt 60 phút/ngày |
| M3 | Benchmark 12–20 shot và tập 5 phút có số liệu thật | Chưa đủ để chốt giá tập 60 phút |
| M4 | Một tập 60 phút và ít nhất 3 tập tiếp theo đạt gate | Khi đó mới đánh dấu profile production |

## 2. Hiện trạng và khoảng trống đã khảo sát

Nguồn: [CURRENT_STATUS](../CURRENT_STATUS.md), [Compute Protocol](../COMPUTE_PROTOCOL.md), [database](../architecture/DATABASE.md), ADR-0018/0019/0020/0021/0023/0025 và source hiện tại.

| Thành phần | Bằng chứng hiện tại | Việc phải làm |
|---|---|---|
| Vertex chapter analysis | Có adapter Vertex trong backend | Production package, kiểm tra coverage và patch phần lỗi |
| OperationPlan | Aggregate hiện lưu project/job/type | Không giả định đã chứa snapshot kế hoạch shot hoặc budget |
| Audio | VieNeu và WhisperX qua worker | Thêm LTX-native audio; transcript QA và khóa audio đã duyệt trước final timeline; giữ chế độ audio-first hiện có |
| Image executor | `comfyui/executor.py` gọi `build_txt2img_workflow`, không nạp reference | Bổ sung conditioning thực, không chỉ tên nhân vật trong prompt |
| Video executor | Chưa có task video trong danh sách task hoạt động | Schema, adapter LTX, registry và backend dispatch |
| Render | `CreateProjectRenderRequest`, `ProjectRenderProfileFactory`, snapshot adapter giới hạn 30/60 FPS | Hỗ trợ 24 xuyên suốt; giữ đọc được snapshot cũ |
| Fit media | API hiện nhận TRIM/LOOP/FREEZE_END/SPEED_ADJUST | Production run mới chỉ cho TRIM; thiếu footage phải chặn |
| Compute lifecycle | Có intent, checkpoint, UNKNOWN, callback/outbox, reconciliation | Tái sử dụng; không xây queue/retry độc lập |
| GPU deployment | Docs hướng Windows RTX 3090; Compose còn drift | Profile RTX 5090 và manifest môi trường, không mặc định Compose sẵn sàng |
| Chi phí | Database cấm monetary ledger/cost estimation | ADR hẹp cho ngân sách sản xuất, không tái sinh entitlements/billing |

Các tên file mới bên dưới là thiết kế đề xuất. Đường dẫn hiện có được ghi rõ là sửa. Trước khi thực thi phải đọc lại source và git status; không coi danh sách này là giấy phép ghi đè thay đổi khác.

## 3. Quyết định thiết kế TARGET

### 3.1 Hai chế độ audio, một đồng hồ audio cuối cùng

**Cập nhật theo yêu cầu người dùng:** ưu tiên `LTX_NATIVE_AV` cho tiếng Anh. Flow dưới đây là flow mặc định mới:

```text
Approved English script + speaker mapping + pinned character/voice profiles
  → provisional shot timing + approved keyframes → AV_READY
  → LTX joint audio/video generation → dialogue/voice/lip-sync review
  → approved audio extraction + transcript verification + alignment
  → AUDIO_LOCKED + finalized timeline → EXPORT_READY → local render
```

Thời lượng trước generation chỉ là dự kiến. Không yêu cầu AUDIO_LOCKED trước khi tạo native AV; chỉ yêu cầu trước khi đóng timeline/export. Audio đã duyệt của từng clip là nguồn thời gian authoritative. Không kéo tốc độ lời nói để ép đúng duration dự kiến. Clip sai lời/giọng cần review hoặc regenerate; không align trực tiếp script kỳ vọng rồi coi đó là bằng chứng model nói đúng.

Flow sau chỉ áp dụng cho chế độ `AUDIO_FIRST` được chọn explicit:

```text
Gemini chapter analysis + participating CharacterVersion snapshots
  → DRAFT package → VALIDATED package
  → narration/import + forced alignment → AUDIO_LOCKED
  → batch keyframes → review keyframes → VIDEO_READY
  → video attempts → clip review + local verification
  → EXPORT_READY → local final render → COMPLETE
```

`VALIDATED` cho phép chuẩn bị keyframe; `AUDIO_FIRST` yêu cầu `VIDEO_READY` với audio khóa, `LTX_NATIVE_AV` yêu cầu `AV_READY` với script/speaker/voice profile khóa. Prompt, reference, audio hoặc character version đổi tạo package revision mới; run đang chạy vẫn dùng revision cũ. Legacy VisualBeat không có StoryBeat phải được gắn canonical rõ ràng trước package validation, không tự suy diễn bằng thứ tự hàng.

“Chuẩn bị trước khi thuê GPU” áp dụng chắc chắn cho Gemini và dữ liệu kế hoạch. Nếu TTS vẫn cần GPU thuê, chạy một pha AUDIO_PREP theo lô trước pha keyframe/video, tính đầy đủ chi phí vào tập. Audio nhập sẵn vẫn cần alignment và kiểm tra; không giả định import là miễn phí. Chạy TTS local trên RTX 2060 Super là ứng viên thử sau, không prerequisite của M1.

### 3.2 Hợp đồng dữ liệu

Tạo JSON Schema đóng, có `schemaVersion`, `additionalProperties: false` cho object nghiệp vụ. Dùng số nguyên cho frames, ms và VND; FPS là numerator/denominator khi cần biểu diễn chuẩn xác.

**ProductionPackage** (backend/local, không gửi nguyên sang GPU):

```typescript
type ProductionPackage = {
  schemaVersion: 1;
  packageId: string; revision: number; projectId: string; storyVersionId: string;
  orderedChapterIds: string[]; sourceDigest: string;
  audioMode: 'LTX_NATIVE_AV' | 'AUDIO_FIRST'; spokenLanguage: 'en';
  audioSnapshotId: string | null; alignmentDigest: string | null;
  target: { width: 1280; height: 720; fpsNumerator: 24; fpsDenominator: 1 };
  policy: { movingFootageOnly: true; allowLoop: false; allowFreeze: false; maxAutoRetries: 2 };
  shots: ProductionShot[];
};
type ProductionShot = {
  shotId: string; visualBeatId: string; storyBeatId: string; orderIndex: number;
  sourceStart: number; sourceEnd: number;
  characterVersionIds: string[]; referenceArtifactIds: string[];
  timingStatus: 'PROVISIONAL' | 'LOCKED';
  startFrame: number; endFrameExclusive: number;
  voiceProfileVersionIds: string[];
  prompt: string; negativePrompt: string; action: string; camera: string;
  keyframeArtifactId: string | null; profileId: string; seed: number;
  acceptanceCriteria: string[];
};
```

Phần shot/scene JSON là projection từ domain hiện có, không tạo song song một cây Scene mới. Source offset theo quy ước hiện tại của story anchoring. Validator kiểm tra membership, snapshot immutability, ordering, không overlap/hole và coverage narration. Frame boundary được tính từ mốc audio tuyệt đối, không cộng dồn duration từng shot đã làm tròn.

**video.generate v1** (wire): task/attempt IDs opaque; inputs gồm prompt, seed, width/height/numFrames/fps, workflowProfileId, conditioning artifact IDs. Không chứa projectId/chapterId/shotId, path local, giá thuê hoặc arbitrary ComfyUI graph. Profile trỏ tới workflow đã allow-list và có digest; model revision và decoder/quantization được pin. Compute task giữ fingerprint/idempotency hiện tại.

**Clip manifest** (backend/local): package revision, shotId, attemptId, artifactId, sha256, sizeBytes, seed, model/workflow digest, width/height/fps, actual frame count, duration, usable trim interval, review result. Worker chỉ trả metadata kỹ thuật và opaque IDs; backend gắn shot/order.

**LtxWorkflowProfile**: immutable ID/revision; hashes weights/encoder/decoder/upsampler; quantization; inference size và output normalization; valid frame/size constraints; steps; runtime versions; max runtime; cache format revision. Không khóa 480p→720p hoặc node names theo trí nhớ: nhập workflow chính thức, pin commit/digest và validate tại Task 5.

### 3.3 Budget và phiên thuê

Đề xuất ADR mới chỉ cho production expense cap. Không thay CAPACITY/LONGFORM_EXPORT thành tiền; không có balance, credit tài khoản, plan entitlement hoặc hóa đơn khách hàng.

- Backend lưu run cap, expense observations, commitments và rental session checkpoint. Electron hiển thị và báo local receipts; worker không biết budget.
- Rental cost tính theo toàn thời gian tính phí và billing quantum của nhà thuê, không cộng `gpuTimeMs` rồi coi là tiền thuê. Nhập giá 14.700đ/giờ là cấu hình người dùng, không hard-code.
- API lưu gross usage cost, credit applied và paid amount riêng. Dùng paid amount kiểm tra cap hiện tại, hiển thị thêm dự báo hết credit. Mọi khoản chưa biết cần upper bound, không coi bằng 0.
- Shared session: tổng phân bổ startup/load/idle/download cho các run phải bằng chi phí session; dùng chính sách cố định theo compute time, phân bổ lại khi session đóng và giữ contingency cho sai lệch.
- Admission atomic: spent + outstanding commitments + next maximum commitment + shutdown/transfer reserve ≤ cap. Receipt thay commitment tương ứng, không cộng trùng. Duplicate callback không ghi chi phí hai lần.
- Time-based hard stop phải được kiểm soát phía nhà thuê hoặc watchdog có thể thật sự release instance. Stop worker/cancel job không đồng nghĩa dừng tính tiền.
- Chưa chọn nhà thuê: cung cấp session tracking và release port, hiển thị `MANUAL_RELEASE_REQUIRED`; không tuyên bố hard cap được bảo đảm khi thiếu quyền/API auto-stop. M4 yêu cầu release integration được kiểm chứng hoặc cơ chế spending limit do nhà thuê thực thi.
- Dự phòng tải dữ liệu và giải phóng máy trước deadline; thiếu khả năng cứu dữ liệu thì chặn nhận shot mới. Dừng generation không tự đánh dấu tập hoàn tất.

### 3.4 Lựa chọn và giới hạn

Ưu tiên mở rộng hệ thống hiện có. Script benchmark đứng riêng nhanh để thử model nhưng không kiểm chứng orchestration và recovery; chỉ dùng làm driver gọi API thật. Xây orchestrator mới gây hai nguồn sự thật nên không chọn.

Model keyframe chưa được chọn về chất lượng. RealVisXL hiện có là baseline tích hợp; chỉ advertise reference conditioning khi workflow thực sự hỗ trợ, có weights phù hợp và test. Nếu không đạt identity, thay workflow keyframe sau benchmark qua cùng contract, không thay model Character.

## 4. File map và nguyên tắc triển khai

Trong task dùng các prefix sau để tránh lặp đường dẫn dài:

- `B` = `app/backend-service/src/main/java/com/narrativex/backend/feature/generation`
- `BT` = `app/backend-service/src/test/java/com/narrativex/backend/feature/generation`
- `G` = `app/generation-service/src/narrativex_gpu_worker`
- `GT` = `app/generation-service/tests`
- `D` = `app/desktop/src`
- `DT` = `app/desktop/test`

Đặt persistence row/mapper/XML theo convention MyBatis hiện có; DTO ở api/request và api/response, không expose domain aggregate. Mỗi task là một PR/commit logic có thể review riêng; không commit toàn worktree. Không mặc định dispatch subagents.

### Review focus bắt buộc

1. Timeout sau submit nhưng trước lưu handle: không tạo video thứ hai — Task 5/7.
2. Audio/character/keyframe bị sửa sau package freeze: không thay đầu vào run âm thầm — Task 2/3.
3. Restart gần budget cap hoặc hai admission đồng thời: không cấp tiền hai lần — Task 8.
4. Clip tải đủ byte nhưng decode lỗi/thiếu frames: không cho export — Task 6/9.
5. Local mất mạng khi máy thuê vẫn chạy: không báo “đã dừng tính phí” — Task 8/11.

## 5. Các task triển khai theo thứ tự

### Task 1 — ADR và contracts nền (M0)

**Tạo:** `documentation/decisions/ADR-0026-ltx-production-and-expense-cap.md` (kiểm tra số còn trống lúc thực hiện); `contracts/production-package.v1.schema.json`; `contracts/production-clip-manifest.v1.schema.json`; `contracts/compute/v1/schemas/task-video-generate.json`; `contracts/compute/v1/examples/video-generate-task.json`.

**Sửa:** `contracts/compute/v1/schemas/compute-task.json`, `contracts/compute/v1/openapi.yaml`, `scripts/check_compute_contracts.py`, `G/contracts/task.py`, `G/contracts/models.py`, `B/application/model/compute/ComputeTaskRequest.java`.

- [ ] Viết ADR ở trạng thái Proposed: thay phạm vi RTX 3090/no-video của ADR-0023; nêu ngoại lệ database cho expense cap và audio preparation. Không sửa ADR-0020 thành hệ thống tài khoản.
- [ ] Thêm schema và golden examples cho các record mục 3.2; output clip `video/mp4`, một clip/attempt.
- [ ] Viết contract tests cross-language: valid video task; reject domain IDs/absolute paths/unknown fields/unsupported profile/zero frames; refresh capability không đổi fingerprint.
- [ ] Implement parsing/validation và update checker task inventory. Giữ task cũ tương thích; thay đổi bắt buộc field cũ phải version major, không lén sửa v1.
- [ ] Chạy `python scripts/check_compute_contracts.py` và `python -m pytest scripts/tests/test_check_compute_contracts.py` ở root; backend/worker contract suites phải cùng chấp nhận golden example.

**Đầu ra:** wire schema mới và package schema đã validate; chưa enable production video capability.

### Task 2 — Production package, persistence và readiness

**Tạo:** `B/domain/aggregate/ProductionPackage.java`, `B/application/service/ProductionPackageValidator.java`, `B/application/usecase/CreateProductionPackageUseCase.java`, `B/api/controller/ProductionPackageController.java`, `BT/application/ProductionPackageUseCaseTest.java` và MyBatis repository/mapper tương ứng.

**Sửa:** migration V1/V4/V5/V6 theo [database policy](../architecture/DATABASE.md); không tự thêm V9 khi baseline chưa frozen. Không reset database chứa dữ liệu chưa được xác nhận disposable.

- [ ] Test package chỉ chứa Chapter/StoryBeat/CharacterVersion thuộc đúng Project/StoryVersion, legacy unassigned beat bị chặn kèm lỗi actionable.
- [ ] Implement snapshot revision, canonical digest, optimistic locking, status và blocker list. Approved snapshots immutable; patch tạo revision mới.
- [ ] API đề xuất dưới `/api/v1/projects/{projectId}/production/packages`: POST create, GET by ID, POST `/{id}/validate`, POST `/{id}/freeze`; mutation có idempotency key và expected revision.
- [ ] Validator tạo `ValidationResult(readyStage, blockers[])`; block code ổn định: AUDIO_NOT_LOCKED, CHARACTER_NOT_PARTICIPATING, KEYFRAME_NOT_APPROVED, TIMELINE_GAP, SOURCE_CHANGED.
- [ ] Integration test transaction rollback, repeated idempotency key cùng body trả cùng package, khác body trả conflict.
- [ ] Chạy backend focused test và migration tests theo mục 6.

**Đầu ra:** package có thể tạo/lưu/đọc và biết chính xác còn thiếu gì; không cần GPU.

### Task 3 — Gemini planning có provenance và audio lock theo mode

**Sửa:** `B/infrastructure/analysis/vertex/VertexGeminiChapterAnalysisAdapter.java`, `B/infrastructure/analysis/vertex/VertexGeminiClient.java`, `B/application/service/NarrationOperationPlanner.java`.

**Tạo:** `B/application/service/ProductionPackageAssembler.java`, `B/application/usecase/LockProductionAudioUseCase.java`, `BT/application/ProductionPackageAssemblerTest.java`.

- [ ] Reuse chapter analysis và continuity snapshots; tạo rolling chapter summary có source/version digest. Không gửi lại cả truyện cho mỗi shot.
- [ ] Structured output phải validate theo schema, giới hạn số shot và kích thước; patch chỉ vào shot/chapter lỗi và giữ nguyên provenance phần còn lại.
- [ ] Không cho prompt/model output tự đổi model allow-list, budget, path, tool instruction hoặc consent. Reject reference người thật thiếu consent theo policy hiện hành.
- [ ] AUDIO_FIRST: gắn narration asset + alignment digest trước video. LTX_NATIVE_AV: pin English script, speaker/voice profile và provisional windows; sau clip QA mới tạo approved audio snapshot/alignment và final frame boundaries. Package revision mới khi audio đổi; không ghi đè run cũ.
- [ ] Test missing alignment, mismatched audio digest, invalid Gemini JSON, source version race, narration 60 phút không tích lũy sai số frame.
- [ ] Native AV là mặc định mới; nhập audio/TTS trước video chỉ cho AUDIO_FIRST. Lưu usage cả generated/rejected audio và chi phí alignment để Task 8 hạch toán.

**Đầu ra:** package có prompts/context đã kiểm tra, timeline theo audio thật, chưa cần video.

### Task 4 — Keyframe conditioning và review

**Sửa:** `G/adapters/executors/comfyui/executor.py`, `G/adapters/executors/comfyui/workflow.py`, `G/adapters/executors/comfyui/client.py`, `GT/executors/test_comfyui.py`, schema image hiện có nếu cần optional extension tương thích.

**Tạo:** `B/application/usecase/ReviewProductionShotUseCase.java`, `BT/application/ReviewProductionShotUseCaseTest.java`.

- [ ] Test reference artifact được tải và verify checksum trước submit; workflow dùng đúng image inputs, không chỉ nhận rồi bỏ qua.
- [ ] Pin một workflow keyframe hỗ trợ conditioning; capabilities tách rõ text-only và reference-conditioned. Missing nodes/weights khiến not-ready.
- [ ] Keyframe review lưu reviewer decision, reason, artifact digest, package revision; chỉ keyframe approved mới vào video queue.
- [ ] Tạo một ảnh mỗi shot/lượt; sửa ảnh không tự nhân nhiều candidates. Immutable character version và outfit/context theo shot.
- [ ] Test reference expired/reissued, wrong digest, changed character version và rejection không chạy video.

**Đầu ra:** keyframe có lineage và approval; không tuyên bố identity quality đạt trước xem ảnh thật.

### Task 5 — LTX adapter: một shot chạy được

**Tạo:** `G/adapters/executors/ltx/__init__.py`, `executor.py`, `workflow.py`, `profiles.py` trong cùng thư mục; `GT/executors/test_ltx.py`; profile/workflow pinned trong `app/generation-service/workflows/ltx/`.

**Sửa:** `G/bootstrap.py`, `G/adapters/executors/registry.py`, `G/application/ports/residency.py` và residency implementation hiện có.

- [ ] Load official LTX-2.5 I2V workflow, pin ComfyUI/custom nodes/model hashes. Baseline NVFP4, một decoder rõ ràng; validate dimensions/frame constraints từ workflow được pin.
- [ ] Thêm runtime family video; exclusive với image/TTS/alignment, kiểm tra VRAM thật sau unload. Không advertise ready chỉ vì HTTP ComfyUI trả 200.
- [ ] Implement `LtxExecutor.execute(task, cancel, context)` theo ExecutorPort hiện có; reuse ComfyUI transport, submission checkpoint và artifact port.
- [ ] Không nhận workflow graph tùy ý từ client. Profile resolve chỉ trên allow-list; không silently fallback BF16/FP8 hoặc decoder khác.
- [ ] Persist SUBMITTING trước engine I/O; lưu handle; resume poll handle. Crash window chưa rõ giữ UNKNOWN, không enqueue mới.
- [ ] Validate output slot/type/checksum; thu stage timings, peak VRAM/RAM có cờ unavailable khi không đo được. Truyền metrics bằng schema được version hóa, không arbitrary metadata bag.
- [ ] Test lost submit ACK, worker restart có handle/không handle, cancel, OOM, missing model, invalid dimensions và output thiếu.

**Đầu ra:** video executor đủ để smoke một shot qua real API khi có máy; test adapter dùng fake transport riêng trong test.

### Task 6 — Nhận clip local, manifest và integrity

**Tạo:** `D/main/production/clip-ingest.ts`, `clip-store.ts`, `DT/production-clip-ingest.test.mjs`.

**Sửa:** `D/main/rendering/ffprobe.ts`, `D/preload/index.ts`, `D/preload/types.ts`, `packages/client-contracts/src/production.ts`; reuse local-media capability/registration flow hiện có.

- [ ] Tải output hoàn tất sang file `.partial` trong project root, verify checksum/size, probe và decode scan rồi atomic rename.
- [ ] Resume range chỉ khi nguồn hỗ trợ và fingerprint/ETag phù hợp; nếu không tải lại bytes, không render lại GPU.
- [ ] Manifest gắn shot/attempt với artifact, không đưa absolute path lên backend; renderer chỉ dùng typed IPC IDs.
- [ ] Local verification receipt idempotent; backend chỉ EXPORT_READY khi đủ receipt và quality approval. Worker SUCCEEDED không đồng nghĩa LOCAL_VERIFIED.
- [ ] Test checksum sai, truncated video, decode fail, hết disk, app crash giữa rename/receipt, expired URL, path traversal và repeated receipt.
- [ ] Tải clip N đồng thời render N+1 với bounded transfer concurrency và backpressure khi disk gần đầy.

**Đầu ra:** một clip từ GPU trở thành asset local đã xác minh, sẵn sàng ghép.

### Task 7 — Backend batch scheduling, resume và retry

**Tạo:** `B/application/usecase/StartProductionRunUseCase.java`, `B/application/service/ProductionBatchPlanner.java`, `B/application/service/ProductionRetryPolicy.java`, `BT/application/ProductionRunLifecycleTest.java` và persistence run/shot-attempt mapping.

**Sửa:** `B/domain/aggregate/OperationPlan.java` chỉ khi cần thêm liên kết snapshot; reuse GenerationJob transaction/finalizer/reconciliation, không sửa terminal state thành mutable.

- [ ] Tạo run snapshot và operation intent trước dispatch. AUDIO_FIRST: AUDIO_PREP → KEYFRAME_BATCH → KEYFRAME_REVIEW → VIDEO_BATCH → CLIP_REVIEW. LTX_NATIVE_AV: SCRIPT_VOICE_LOCK → KEYFRAME_BATCH → KEYFRAME_REVIEW → AV_BATCH → DIALOGUE_VOICE_REVIEW → AUDIO_LOCK_TIMELINE.
- [ ] Bounded batch: mọi keyframe của batch được review rồi mới đổi model; review timeout dừng cấp job và yêu cầu release, không idle vô hạn.
- [ ] `selectNextEligibleShot(runId)` chỉ trả shot current revision, approved keyframe cùng audio lock (AUDIO_FIRST) hoặc script/voice lock (LTX_NATIVE_AV), chưa có active/UNKNOWN attempt; một video task active mỗi target.
- [ ] Retry kỹ thuật tạo attempt mới chỉ sau proven terminal failure. Sai identity/layout chuyển KEYFRAME_REVIEW; action lỗi chuyển PLAN_REVIEW; thiếu chi tiết chọn profile mới qua revision; sai duration sửa coverage, không loop/freeze.
- [ ] Persist autoRetryCount theo shot lineage; chia shot phải có explicit plan revision, không dùng để né cap. Sau 2 retry chuyển NEEDS_REVIEW.
- [ ] Duplicate/out-of-order callbacks không tăng retry hoặc finalize asset lần hai. Resume chỉ enqueue shot còn thiếu; worker mới không thể tự nhận lại job UNKNOWN của worker mất journal.
- [ ] Test retry matrix, restart từng stage, callback replay, deleted rental host, lease loss và cancellation race.

**Đầu ra:** batch có thể tiếp tục sau gián đoạn, không phát sinh GPU trùng vì timeout.

### Task 8 — Expense cap và rental lifecycle

**Tạo:** `B/application/service/ProductionExpenseGuard.java`, `B/domain/aggregate/ProductionExpenseBudget.java`, `B/application/port/out/RentalSessionControlPort.java`, `BT/application/ProductionExpenseGuardTest.java`; DTO/persistence session và expense receipts theo ADR Task 1.

- [ ] Trước schema tiền tệ, ADR ngoại lệ phải được chấp thuận; không âm thầm vi phạm DATABASE hiện tại.
- [ ] Dùng integer VND và round-up billing quantum. Đồng hồ session từ billing start, heartbeat/reconcile qua restart, chi phí shared-session phân bổ đúng một lần.
- [ ] Atomic check-and-reserve bằng row version/lock ngắn; external submit/release ngoài transaction. Budget rejection trả BLOCKED_BUDGET, không tự hạ quality.
- [ ] Implement release port và manual state trước; provider adapter chỉ khi chọn nhà thuê và có API/credential rõ ràng. Phân biệt release requested/confirmed/unknown; chỉ confirmed mới ngừng ước tính tiền thuê.
- [ ] Dự phòng remaining transfer/shutdown và upper-bound API/audio/local. Thiếu tariff/estimate bắt buộc nhập hoặc chặn cap-enforced run.
- [ ] Test 100.000đ boundary, concurrent reservations, integer overflow, duplicate receipts, expired credits, restart, failed release và stale heartbeat.
- [ ] Expose report paid/gross/estimated/unsettled; mọi con số đều có nguồn/rate timestamp. Benchmark setup expense tách run sản xuất, không giấu phần recurring startup khỏi giá tập.

**Ví dụ invariant để chuyển thành unit test:**

```text
cap=100000, spent=60000, outstanding=15000, shutdownReserve=10000
nextMax=15000 => admit (total=100000)
nextMax=15001 => BLOCKED_BUDGET
receipt for outstanding=15000 arrives twice => settle once
```

**Đầu ra:** admission bảo vệ ngân sách với giả định hiển thị rõ; hard rental cap chỉ đạt khi release thực sự được kiểm chứng.

### Task 9 — Local render 720p/24 FPS, footage-only

**Sửa backend:** `B/api/request/CreateProjectRenderRequest.java`, `B/application/render/ProjectRenderProfileFactory.java`, `B/infrastructure/persistence/adapter/MyBatisProjectRenderInputSnapshotAdapter.java`, production readiness và snapshot schemas liên quan.

**Sửa Desktop:** `D/shared/render-frame-clock.ts`, `D/main/rendering/render-profile.ts`, `render-manifest.ts`, `segment-renderer.ts`, `video-concat.ts`, `video-encoder.ts`, `local-render-preflight.ts`, `project-renderer.ts` trong cùng rendering directory; `contracts/local-render-manifest.v1.schema.json` và client contracts nếu cần.

- [ ] Thêm 24 FPS xuyên validation/profile/schema/UI; snapshot cũ 30/60 vẫn đọc được. Đổi renderer/cache policy version để không dùng nhầm segment cache.
- [ ] Production run mới dùng movingFootageOnly: reject image, LOOP, FREEZE_END, duplicate source interval và footage thiếu; không gọi Ken Burns thay video. Giữ legacy editor behavior ngoài policy này.
- [ ] Cắt theo frame clock audio; thiếu duration trả blocker cụ thể, không kéo narration hoặc pad last frame âm thầm. Native generated frames đúng profile, không mặc định optical interpolation.
- [ ] Stream-copy chỉ khi codec/profile/timebase/extradata/audio layout và cut boundaries tương thích; nếu cần scale/subtitle/effect thì encode cuối một lượt. Không encode từng segment rồi encode toàn tập lần nữa mà không lý do.
- [ ] NVENC H.264 khi probe supported; fallback CPU phải explicit và phản ánh estimate/runtime. AUDIO_FIRST giữ narration master. LTX_NATIVE_AV giữ approved generated dialogue/audio làm master, không drop audio track hoặc chồng thêm TTS mặc định; không giả định LTX trả dialogue/music/SFX stems riêng.
- [ ] Test 24/30/60 compatibility, 60-minute timestamp arithmetic, missing interval, duplicate clip, trim bounds, mux subtitle sync và cache invalidation.
- [ ] Native FFmpeg test dùng clip fixture chuyển động có timestamp, ffprobe output 1280×720/24 FPS, duration sai lệch không quá 1 frame theo frame policy; decode toàn output.

**Đầu ra M1:** một shot chuẩn được tải về và xuất file thật tại local; không cần UI quản trị hoàn chỉnh để smoke.

### Task 10 — Cache embeddings và giảm model switching

**Tạo:** `G/adapters/executors/ltx/embedding_cache.py`, `GT/executors/test_ltx_embedding_cache.py`.

- [ ] Chỉ triển khai sau khi single-shot path hoạt động. Cache key gồm exact prompt + negative prompt + text encoder/tokenizer/projection revisions + conditioning/preprocessing + dtype + format version.
- [ ] Precompute embeddings trong pha batch, unload text encoder trước video; dùng interface thật của pinned workflow, không giả định ComfyUI tự cache qua restart.
- [ ] Cache bounded theo disk quota/LRU, checksum/atomic write; corruption là cache miss, không bỏ validation.
- [ ] Cache image/reference embeddings theo content digest nếu workflow hỗ trợ. Không tái sử dụng footage như shot mới; render segment cache cho cùng snapshot vẫn hợp lệ.
- [ ] Test prompt/model revision invalidate, partial write/restart, eviction và memory release. Đo load/encode separately để chứng minh có lợi.

**Đầu ra:** giảm chi phí chuẩn bị có số liệu; không làm thay đổi chất lượng hoặc lineage.

### Task 11 — Desktop production controls

**Sửa:** `D/renderer/features/chapters/components/stages/ChapterProductionStage.tsx`, `D/renderer/features/production/screens/RenderScreen.tsx`, `D/renderer/features/production/components/RenderDialog.tsx`, `D/renderer/features/production/api/production.api.ts`, `packages/client-contracts/src/production.ts`.

**Tạo:** `D/renderer/features/production/components/ProductionRunPanel.tsx`, `ShotReviewPanel.tsx` cùng thư mục; `DT/production-run-contracts.test.mjs`.

- [ ] Tái sử dụng workspace hiện có: package blockers, audio lock, keyframe review, clip review, start/pause/resume, attempts remaining, local download verification.
- [ ] Hiển thị quality reason, completed usable duration và missing duration; phân biệt BLOCKED_BUDGET, NEEDS_REVIEW, UNKNOWN, LOCAL_TRANSFER_PENDING, MANUAL_RELEASE_REQUIRED.
- [ ] Budget hiển thị paid/estimated/unsettled và rental vẫn tính phí. Không dùng status xanh khi chỉ stop worker.
- [ ] SSE invalidates query; reconnect đọc snapshot authority từ backend. Không đưa business retry hoặc direct GPU calls vào renderer.
- [ ] Unit tests event/state mapping; chạy Electron/Vite (`npm run dev`) và actual flow qua API thật, loading/error/empty/offline, keyboard và overflow; chụp screenshot sau implementation.
- [ ] Kiểm tra console/network, mock leakage và preload/native download/render. Không có automation thì ghi runtime-verification blocked.

**Đầu ra M2:** người dùng vận hành package và batch qua Desktop, không cần sửa database tay.

### Task 12 — Reproducible runtime, benchmark driver và runbook

**Tạo:** `scripts/benchmark-ltx-production.py`, `scripts/tests/test_benchmark_ltx_production.py`, `documentation/operations/LTX_PRODUCTION_BENCHMARK.md`, `deploy/remote-gpu/ltx-runtime-manifest.json`.

**Sửa:** `documentation/operations/REMOTE_GPU_RUNTIME.md`, worker environment template/setup scripts và registry; chỉ sửa Compose nếu thực sự chọn/test Linux target.

- [ ] Manifest pin OS/driver/CUDA/Python/PyTorch/ComfyUI/nodes/model hashes, GPU/host RAM/disk và workflow revisions; bootstrap idempotent, verify downloads; secret lấy từ protected runtime config.
- [ ] Target OS chưa chốt: ưu tiên giữ workflow Windows hiện có nếu kernel/node hỗ trợ; nếu phải Linux ghi ADR/runtime profile rõ và kiểm chứng, không quảng cáo hỗ trợ cả hai khi chỉ test một.
- [ ] Preflight kiểm tra real GPU, NVFP4 kernel, weights, free disk/RAM, transfer channel và callback reachability từ remote. Không giả định remote truy cập loopback local được; dùng capability transport qua đường mạng được xác minh, không public Postgres/ComfyUI.
- [ ] Driver gọi backend production APIs, không bypass admission; tạo report JSON/CSV theo run/shot/attempt và stage timings, usable footage, quality decisions, rental invoice và gross/paid API costs.
- [ ] Benchmark A/B resolution và decoder theo từng vòng; cùng prompts/references/seeds khi có thể, nhiều seed trên tập con. Profile BF16 đối chứng tùy chọn trên vài shot khi memory/offload khả thi.
- [ ] Synthetic reports chỉ để unit test phép tính, không xuất vào báo cáo production health. CLI phải require explicit real-run flag/target và cap để phát sinh compute.
- [ ] Runbook: tải/verify toàn bộ clip, backup manifest/journal evidence, xác nhận release, final encode/decode, handoff upload thủ công. Auto upload platform-specific nằm ngoài v1 vì chưa có nền tảng đích.
- [ ] Dọn cache theo quota, chỉ xóa temp thuộc run sau final + backup xác nhận; bảo vệ references/approved assets/active partials. Không mặc định SSD 100GB luôn đủ.

**Đầu ra:** môi trường dựng lại được và test có số liệu; không bắt người dùng thuê máy để tìm lỗi schema căn bản.

## 6. Kiểm thử và thứ tự thực thi

### Trước khi thuê GPU

Thứ tự: **1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12**. Task 9 có thể làm ngay sau Task 6 để chứng minh M1; Task 8 phải hoàn thành trước benchmark tính phí. M0/M1 không đòi chứng minh chất lượng model.

Mỗi task: viết regression test cho invariant → chạy và thấy failure đúng nguyên nhân → implement → focused test pass → cập nhật docs tối thiểu → review diff → commit riêng khi thực thi. Không cần chạy lại toàn bộ gate sau mỗi thay đổi nhỏ; full gate trước merge.

```powershell
# Repository root: contracts và docs
python scripts/check_compute_contracts.py
python scripts/check-docs-drift.py
git diff --check

# app/backend-service
./mvnw.cmd test
./mvnw.cmd test '-Dtest=FlywayBaselineStructureTest,PostgreSqlMigrationIntegrationTest'

# app/generation-service
python -m pytest
python -m ruff check .
python -m mypy src

# app/desktop
npm test
npm run type-check
npm run build

# Root: full provider-independent gate trước merge
pwsh -File scripts/verify-local.ps1
```

Test names mới trong task phải tồn tại trước khi dùng `-Dtest`/pytest filter tương ứng. Database integration cần PostgreSQL/Docker theo repository setup; thiếu dependency ghi BLOCKED, không coi skipped là passed.

### Sau khi implementation đủ M2

1. **Real smoke 1–2 shot:** verify runtime, conditioning, callback, download, review, render 24 FPS; thử reconnect. Không bắt đầu ngay tập 60 phút.
2. **Benchmark 12–20 shot:** đủ cận mặt, hai người, toàn cảnh, chuyển động, ánh sáng khó; ghi score identity/outfit/action/motion/flicker/continuity. Một lỗi critical identity hoặc motion làm shot rejected; không chỉ chấm độ nét.
3. **Tập 5 phút hoàn chỉnh:** audio, subtitles, 100% timeline coverage, không loop/freeze, decode pass, release confirmed, chi phí tất cả stage có nguồn. So sánh estimate và actual.
4. **Tập 60 phút:** chạy dưới cap 100k đã cấu hình, không bỏ shot lỗi để đủ duration. Thiếu ngân sách → PAUSED/BLOCKED và báo footage còn thiếu; không đánh dấu COMPLETE.
5. **Ổn định:** ít nhất 3 tập tiếp theo, ghi rental time, local post time, human review time, footage yield và chi phí; chỉ khi chu kỳ thực tế đáp ứng mới claim 1 tập/ngày.

Metric chính:

```text
usableMinutes = tổng độ dài interval clip được duyệt dùng trong timeline / 60
paidEpisodeCost = allocatedRental + paidAPI + audio + storage/network + localEnergy
costPerUsableMinute = paidEpisodeCost / usableMinutes
throughput = usableMinutes / billedRentalHours
```

Rejected outputs/retries không vào usableMinutes nhưng vẫn vào cost. Costs chưa settle giữ estimated/unsettled, không công bố “đã dưới 100k” như số đã xác nhận.

## 7. Tài liệu cần cập nhật khi thực thi và điều kiện kết thúc

- ADR Task 1, [decision index](../decisions/README.md), [DATABASE](../architecture/DATABASE.md) cho scope/schema budget và snapshot.
- [COMPUTE_PROTOCOL](../COMPUTE_PROTOCOL.md) cho video task/capabilities/metrics; giữ domain-neutral và checkpoint semantics.
- [STORY_TO_VIDEO](../workflows/STORY_TO_VIDEO.md), [NARRATION_AUDIO](../workflows/NARRATION_AUDIO.md), [IMAGE_GENERATION](../workflows/IMAGE_GENERATION.md) cho package/audio/keyframe review.
- [CURRENT_STATUS](../CURRENT_STATUS.md) chuyển từng mục TARGET → IMPLEMENTED/PARTIAL theo bằng chứng; không đổi toàn bộ status sau unit tests.
- [REMOTE_GPU_RUNTIME](../operations/REMOTE_GPU_RUNTIME.md) và môi trường mẫu phải khớp target thực tế.

**Implementation complete:** contracts + schema + worker + backend + Desktop/local render đã qua test và runtime UI gate. **Production validated:** thêm benchmark và real episodes đạt chất lượng/cap/throughput. Hai trạng thái này tách riêng.

## 8. Nguồn kỹ thuật và quyết định còn phải đo

### Yêu cầu bổ sung: giọng nhân vật tiếng Anh xuyên suốt

**Mức nhất quán đã được người dùng làm rõ:** chỉ cần giọng tương tự, không yêu cầu voice clone hoặc speaker identity giống 100%. Giữ nhóm tuổi cảm nhận, kiểu giọng/âm sắc chủ đạo và accent đã duyệt. Chấp nhận biến thiên nhẹ về pitch, nhịp, hơi thở và delivery theo cảm xúc; không dùng pitch đơn lẻ để suy ra tuổi. Reject thay đổi rõ như trẻ con thành người lớn/người già, giọng đổi hẳn hoặc nhầm speaker. Thay đổi tuổi có chủ ý theo truyện cần voice profile/version riêng được duyệt. Các từ “identity/voice consistency” trong kế hoạch được hiểu theo mức này.

Baseline implementation: pin mô tả giọng trong prompt của mọi shot, gắn đúng speaker và nghe QA đối chiếu mẫu đã duyệt. Có thể lấy audio shot đầu làm mẫu QA; không bắt buộc casting riêng hoặc audio conditioning. Reference conditioning chỉ bổ sung nếu workflow hỗ trợ và benchmark cho thấy cần thiết. Không xây voice cloning, speaker embeddings hoặc training LoRA làm prerequisite của M1/M2; không block chỉ vì thiếu voice-reference capability.

Đây là điều kiện nghiệm thu bắt buộc, chưa phải capability đã chứng minh. [LTX-2.5 overview](https://docs.ltx.io/open-source-model/getting-started/overview) mô tả voice consistency trong một lần sinh native multishot; không suy ra bảo đảm cùng giọng giữa mọi lần sinh độc lập. [Dub-It Beta](https://docs.ltx.io/open-source-model/feature-guides/audio/dub-it-beta) hiện ghi validated trên LTX-2.3, chưa validated trên 2.5, single speaker. Không tự đưa Dub-It 2.3 vào baseline 2.5 hoặc coi training reference-conditioning là inference feature đã sẵn sàng.

Các đầu việc bổ sung vào task tương ứng, phải hoàn thành trước M3:

- [ ] Task 1/2: tạo versioned CharacterVoiceProfile tham chiếu Character identity, không buộc outfit thay đổi làm đổi giọng. Lưu perceivedAgeGroup, language/accent, voice description, optional approved reference artifact IDs/checksums và engine/profile revision. Pin version trong run; emotion/delivery được thay đổi trong mức nhất quán đã chốt. Voice description và reference lưu trữ không tự bảo đảm model hỗ trợ voice conditioning.
- [ ] Task 1/3: schema dialogue chứa stable cue ID, speaker mapping, exact approved English text và delivery; worker chỉ nhận opaque speaker slots/voice descriptions và capabilities, không domain Character ID. Prompt/schema hỗ trợ narration off-screen riêng khi script yêu cầu.
- [ ] Task 1/5/6: native AV output giữ video+audio, audio codec/sample rate/channel count/duration và speaker-cue lineage. Với M1 dùng một shot/attempt; native multishot thử bằng contract version riêng có mapping clip/cut/shot rõ ràng, không phá invariant một clip/attempt hiện tại.
- [ ] Task 3/9: ADR mới phải mở rộng timing authority của ADR-0024 cho native AV. ASR transcript validation trước forced alignment; human review từ ngữ quan trọng, đúng speaker, voice identity và lip sync. Export fail-closed nếu provisional timing hoặc dialogue chưa duyệt.
- [ ] Task 5/12: capability flags phân biệt native audio, multishot và cross-generation voice-reference support. Chỉ enable voice-reference support sau thử workflow/model revision thật; giữ nguyên seed/prompt không phải voice lock.
- [ ] Task 7/11: thêm VOICE_IDENTITY_DRIFT, WRONG_SPEAKER, DIALOGUE_MISMATCH, LIP_SYNC và AUDIO_ARTIFACT; retry chung trong giới hạn hiện có, không thêm hai retry riêng cho audio. Không tự thay giọng/TTS khi hết lượt.
- [ ] Task 12: benchmark tối thiểu 2 nhân vật, gồm một trẻ con và một người lớn, mỗi người 6 câu khác nhau qua ít nhất 3 lần generation độc lập, nhiều cảm xúc; có đối thoại luân phiên và cảnh nhân vật quay lại. So sánh multishot với cross-generation. Người nghe đối chiếu mẫu đã duyệt: đổi nhóm tuổi/kiểu giọng/accent rõ rệt, nhầm speaker hoặc sai câu critical đều fail; biến thiên nhẹ tự nhiên pass và không tiêu retry. V1 không cần speaker similarity score tự động.
- [ ] Task 8/12: tính chi phí voice casting, native audio generation, ASR/alignment và render lại video vì lỗi giọng vào cost/usable minute; không giả định audio native là miễn phí.

Nếu cross-generation voice consistency chưa đạt trong trần 100k, trạng thái là BLOCKED_VOICE_CONSISTENCY. Báo kết quả và các lựa chọn cho người dùng; không tuyên bố LTX-only đã production-ready, không tự nới cap hoặc chuyển sang TTS khác.

- [LTX-2.5 official model card](https://huggingface.co/Lightricks/LTX-2.5): NVFP4 transformer, split components, decoder choices.
- [LTX repository](https://github.com/Lightricks/LTX-2): runtime và workflow; pin revision tại Task 5/12, không dùng main không khóa cho sản xuất.
- [LTX NVFP4 kernels](https://github.com/Lightricks/LTX-2/blob/main/packages/ltx-kernels/docs/NVFP4.md): kiểm tra hardware/runtime compatibility trước advertise ready.

Nhà thuê/API release, chất lượng keyframe, voice quality, RAM host thuê, quantization/decoder/resolution tốt nhất và throughput là các kết quả cần xác minh, không phải giả định đã đạt. Không cần các lựa chọn này để viết contracts, package, lifecycle, local ingestion và rendering tests.
