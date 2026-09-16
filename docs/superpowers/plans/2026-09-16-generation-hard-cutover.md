# Generation Service Hard Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện yêu cầu PR1–PR3 để backend, generation-service, desktop và repository gates chạy xanh; VoiceStudio hủy in-flight đúng ngữ nghĩa; generation-service trở thành compute runtime duy nhất sau khi parity/recovery được kiểm chứng.

**Architecture:** Spring modular monolith giữ admission, job/lease/checkpoint, business state và artifact metadata. Backend gọi generation-service qua compute contract v1. Generation-service là runtime domain-agnostic, không có PostgreSQL/R2/domain credentials, dùng executor catalog để chạy Qwen, ComfyUI, VoiceStudio, WhisperX và media validation. Mọi dispatch chỉ được ghi READY sau khi quan sát terminal SUCCEEDED và kiểm tra output; UNKNOWN/cancel/error đi theo recovery semantics của ADR-0031.

**Tech Stack:** Java 21, Spring Boot, Maven, MyBatis, PostgreSQL/Flyway, Python 3.12, FastAPI, Pydantic, asyncio, pytest, ruff, mypy, Docker Compose, GitHub Actions, PowerShell repository gates.

**Spec:** docs/superpowers/specs/2026-09-16-generation-hard-cutover-design.md

## Global Constraints

- Làm việc trực tiếp trên checkout hiện tại của nhánh main theo yêu cầu người dùng; không tạo branch/worktree và không reset/checkout làm mất thay đổi.
- Giữ nguyên ba thư mục/file tạm chưa thuộc task: .tmp-generation-review-20260915/, .tmp-generation-review-recovery-20260915/, app/generation-service/.pytest-tmp-qwen/.
- Không commit hoặc push thay người dùng; để các thay đổi ở working tree cho người dùng review.
- Tuân thủ ADR-0028, ADR-0029, ADR-0031, documentation/COMPUTE_PROTOCOL.md và AGENTS.md; database baseline chỉ dùng V1–V7, không tạo migration V8+.
- Không thêm fake provider success, blind resubmit sau outcome UNKNOWN, fallback timeline READY, hoặc durationMs override nếu chưa có bằng chứng từ code/test.
- Mỗi thay đổi hành vi phải có test regression; test phải được chạy bằng lệnh reproducible và output được ghi lại trong final verification.
- Không xóa app/ai-worker hoặc app/narration-worker cho đến khi parity, recovery, CI và residue audit chứng minh không còn runtime/reference cần thiết.

---

## Task 1: Đưa backend verify về trạng thái chẩn đoán được và sửa các lỗi gate hiện tại

**Files:**
- app/backend-service/src/main/java/com/narrativex/backend/feature/generation/infrastructure/compute/HttpGenerationExecutionAdapter.java
- app/backend-service/src/main/java/com/narrativex/backend/feature/common/api/ApiExceptionHandler.java
- app/backend-service/src/main/java/com/narrativex/backend/feature/common/exception/ và các import/use site của InvalidDeviceCredentialsException
- app/backend-service/src/main/resources/db/migration/V1__project_story_and_planning.sql đến V7__seed_catalog.sql khi thiếu schema là nguyên nhân thật
- các mapper/use case/test đang fail trong Surefire

**Steps:**

- [ ] Viết/chỉnh test architecture để cố định dependency direction: exception dùng tại API boundary phải nằm trong common boundary, không để common import domain của localexecution.
- [ ] Sửa constructor selection của HttpGenerationExecutionAdapter để Spring context chọn được constructor production và unit test injection vẫn giữ được; loại import Jackson không dùng nếu formatter/linter yêu cầu.
- [ ] Đối chiếu authoritative baseline V1–V7 với MyBatis references và integration assertions. Bổ sung/sửa trong migration đang sở hữu bảng/column, không thêm migration mới chỉ để che test.
- [ ] Sửa MediaAssetRow/mapper hoặc test fixture theo contract lưu asset: project ownership và checksum reuse phải đúng, origin phải hợp lệ với constraint database.
- [ ] Đồng bộ giới hạn idempotency trong use case, migration và message test về 512 ký tự; sửa replay fingerprint để cùng type/scope/request thật sự replay, request khác mới bị reject.
- [ ] Đồng bộ result map của GenerationOutboxMapper với cột dispatch thực sự cần đọc và cập nhật assertion nếu contract đã intentionally mở rộng; không giữ mapping dư chỉ để làm test xanh.
- [ ] Sửa Mockito verification của MediaUploadUseCaseTest để matcher/raw arguments không trộn sai sau khi signature hiện tại đã được xác nhận.
- [ ] Chạy targeted tests trước, sau đó ./mvnw.cmd --batch-mode --no-transfer-progress verify; không dùng skipTests hay bỏ qua integration tests.

**Verification:**

    Set-Location app/backend-service
    ./mvnw.cmd --batch-mode --no-transfer-progress -Dtest=ArchitectureRulesTest,MyBatisSchemaReferenceContractTest,MyBatisMediaAssetRepositoryTest,CreateMediaJobUseCaseTest,GenerationOutboxMapperResultMapTest,MediaUploadUseCaseTest,ContextLoadsTest test
    ./mvnw.cmd --batch-mode --no-transfer-progress verify

---

## Task 2: Khóa compute contract cho text.generate và workload inputs

**Files:**
- contracts/compute/v1/schemas/compute-task.json
- contracts/compute/v1/schemas/task-text-generate.json (new)
- contracts/compute/v1/openapi.yaml và examples nếu cần để schema/examples không drift
- app/generation-service/src/narrativex_gpu_worker/contracts/task.py và contract tests
- app/backend-service/src/main/java/com/narrativex/backend/feature/generation/infrastructure/dispatch/ComputeExecutionDispatcher.java
- documentation/COMPUTE_PROTOCOL.md và một ADR amendment/new decision nếu thay đổi boundary chapter analysis

**Steps:**

- [ ] Định nghĩa text.generate trong shared JSON schema với input strict, version, executor/model và artifact contract phù hợp; test schema reject extra/invalid fields.
- [ ] Đồng bộ Pydantic task models, OpenAPI, examples và scripts/check_compute_contracts.py; mọi workload type từ parity table phải có schema source of truth.
- [ ] Đưa prompt/source text vào field contract duy nhất đã chọn, không gửi sourceText/sourceLanguage dư nếu schema forbids extra; business interpretation và persistence vẫn ở backend.
- [ ] Bổ sung contract test chạy cùng backend payload serialization và generation-service parsing.
- [ ] Chạy compute contract checker và test riêng task model trước khi sửa dispatcher tiếp.

**Verification:**

    python scripts/check_compute_contracts.py
    Set-Location app/generation-service
    python -m pytest --basetemp=D:/workspace/NarrativeX/.tmp/pytest-contract tests/contracts tests/test_contracts.py

---

## Task 3: Reconcile backend dispatch tới terminal state và bỏ fallback READY giả

**Files:**
- app/backend-service/src/main/java/com/narrativex/backend/feature/generation/application/port/out/GenerationExecutionPort.java
- app/backend-service/src/main/java/com/narrativex/backend/feature/generation/infrastructure/compute/HttpGenerationExecutionAdapter.java
- app/backend-service/src/main/java/com/narrativex/backend/feature/generation/infrastructure/dispatch/ComputeExecutionDispatcher.java
- app/backend-service/src/main/java/com/narrativex/backend/feature/generation/infrastructure/compute/ComputeNarrationAlignmentAdapter.java
- dispatcher/alignment/HTTP adapter tests

**Steps:**

- [ ] Thêm một reconciliation abstraction có deadline/backoff hữu hạn, hoặc helper trong dispatcher, để ACCEPTED/RUNNING không bị coi là thành công; null/timeout đi UNKNOWN hoặc retryable state theo ADR-0031.
- [ ] Xử lý terminal SUCCEEDED, FAILED, CANCELED, UNKNOWN rõ ràng; chỉ SUCCEEDED kèm output/artifact hợp lệ mới chuyển job/media/narration sang READY/COMPLETED.
- [ ] Cấu hình interval/deadline qua properties với default an toàn và test deterministic bằng clock/sleeper abstraction hoặc fake port.
- [ ] Sửa ComputeNarrationAlignmentAdapter gửi đúng audio.align input contract; không tự tạo timeline READY khi compute lỗi, null hoặc đang chạy. Kết quả chỉ READY sau alignment output được parse/validate; provisional timeline nếu cần phải non-ready.
- [ ] Ghi lỗi an toàn, không đưa raw provider response/secret vào job error.
- [ ] Thêm tests cho accepted/running polling, succeeded, failed, canceled, unknown/timeout, missing observation, malformed result và no-fallback behavior.

**Verification:**

    Set-Location app/backend-service
    ./mvnw.cmd --batch-mode --no-transfer-progress -Dtest=ComputeExecutionDispatcherTest,ComputeNarrationAlignmentAdapterTest,HttpGenerationExecutionAdapterTest test

---

## Task 4: Implement VoiceStudio shared in-flight cancellation

**Files:**
- app/generation-service/src/narrativex_gpu_worker/adapters/executors/voicestudio/client.py
- app/generation-service/src/narrativex_gpu_worker/adapters/executors/voicestudio/executor.py
- app/generation-service/tests/executors/test_voicestudio.py
- app/generation-service/tests/application/test_execution_cancellation.py nếu cần cross-provider regression

**Steps:**

- [ ] Viết test đỏ cho client request đang chờ: _await_response phải race request task với cancel event, cancel request task khi event thắng, chờ cleanup, rồi raise ExecutionCanceledError.
- [ ] Cho cả normal và reference synthesis dùng cùng helper; không tạo một đường cancel riêng có semantics khác.
- [ ] Propagate context.cancel_event từ executor tới client; kiểm tra cancel trước download, sau synthesis và trước upload.
- [ ] Giữ raw asyncio.CancelledError khi outer task bị cancel; không biến nó thành provider failure và không swallow trong cleanup.
- [ ] Test cancel trước start, cancel in-flight, cancel during reference download, cancel-after-synthesis-before-upload, normal success, provider error redaction và resume rejection.
- [ ] Đảm bảo cancellation không gọi upload và không tạo artifact success.

**Verification:**

    Set-Location app/generation-service
    python -m pytest --basetemp=D:/workspace/NarrativeX/.tmp/pytest-voicestudio tests/executors/test_voicestudio.py tests/application/test_execution_cancellation.py
    python -m ruff check src tests
    python -m mypy src

---

## Task 5: Cross-provider cancellation, recovery và artifact safety

**Files:**
- Qwen/ComfyUI executors and clients under app/generation-service/src/narrativex_gpu_worker/adapters/executors/
- whisperx/executor.py, whisperx/client.py
- media_validation/executor.py
- corresponding executor/application tests

**Steps:**

- [ ] Audit every executor against the same lifecycle: pre-cancel, submit journal, provider wait, post-provider cancel check, artifact upload, output validation.
- [ ] Sửa WhisperX để không trả success rỗng khi canceled và không phát READY/successful alignment nếu result không được provider xác nhận/validate; raw outer cancellation phải propagate.
- [ ] Sửa media validation and all output-producing paths để cancel thắng race trước upload; no late upload after cancellation.
- [ ] Giữ resume semantics: existing non-empty provider handle không được resubmit mù; chỉ resume khi adapter có khả năng query/resume.
- [ ] Chạy full generation-service tests với basetemp repo-scoped, sau đó ruff/mypy.

**Verification:**

    Set-Location app/generation-service
    python -m pytest --basetemp=D:/workspace/NarrativeX/.tmp/pytest-generation-service
    python -m ruff check src tests
    python -m mypy src

---

## Task 6: Wire generation-service production catalog và config canonical

**Files:**
- app/generation-service/src/narrativex_gpu_worker/bootstrap.py
- app/generation-service/src/narrativex_gpu_worker/config.py
- provider client/executor constructors and adapters
- app/generation-service/tests/test_bootstrap.py, config/catalog tests
- .env.example/runtime documentation as applicable

**Steps:**

- [ ] Inspect concrete constructor signatures/capability requirements của Qwen, ComfyUI, VoiceStudio, WhisperX và media validation.
- [ ] Build the default ExecutorCatalog from configured concrete executors; startup must fail clearly when a required configured provider lacks credentials/dependency, while optional capability readiness remains explicit and truthful.
- [ ] Use one canonical GENERATION_SERVICE_* environment namespace for host/port/token/journal/concurrency/provider endpoints; accept no DB/R2/domain credentials in the runtime.
- [ ] Keep an explicit test catalog factory for unit tests without making the production default empty.
- [ ] Add tests that catalog exposes every parity workload and that readiness flags are truthful.

**Verification:**

    Set-Location app/generation-service
    python -m pytest --basetemp=D:/workspace/NarrativeX/.tmp/pytest-bootstrap tests/test_bootstrap.py tests/test_config.py tests/executors
    python -m ruff check src tests
    python -m mypy src

---

## Task 7: Package and compose the sole generation runtime

**Files:**
- app/generation-service/Dockerfile
- app/generation-service/pyproject.toml
- docker-compose.yml
- generation-service runtime/readiness tests and deployment docs

**Steps:**

- [ ] Include exact optional dependencies needed by enabled executors (narration, image, and media validation as applicable); do not rely on undeclared host packages.
- [ ] Add healthcheck/readiness, bounded resources, machine token, journal volume, and provider endpoint env for generation-service.
- [ ] Remove AI/TTS/image provider secrets and compute runtime env from backend/legacy services once backend adapter and generation-service wiring are complete.
- [ ] Ensure generation-service has no PostgreSQL URL, R2 credentials, business tables, or project-domain storage access.
- [ ] Add Compose config validation and a deterministic smoke check for /health plus contract submission/query/cancel stubs where external providers are absent.

**Verification:**

    docker compose config
    docker compose build generation-service
    python scripts/check_compute_contracts.py

---

## Task 8: Complete workload parity and durable backend compute integration

**Files:**
- backend generation dispatch/admission/checkpoint/artifact adapters
- generation-service executor catalog and task contracts
- parity matrix/tests under backend and generation-service
- documentation/COMPUTE_PROTOCOL.md

**Steps:**

- [ ] Enumerate all current production workload slices: text generation/chapter analysis, Qwen, ComfyUI image/video, VoiceStudio TTS, WhisperX alignment, media validation, and project render handoff.
- [ ] For each slice map task type, executor, input artifact roles, output artifact roles, idempotency key, cancel endpoint, query/recovery behavior, and terminal persistence.
- [ ] Replace direct legacy dispatch with backend adapter calls while preserving admission, leases, checkpoints, artifact ownership and narration timing authority.
- [ ] Ensure no backend path marks a provider operation completed from submit ACK alone and no generation-service path mutates backend domain state.
- [ ] Add cross-provider parity tests using deterministic fake external adapters, including fail/retry/unknown/recovery and cancellation at every I/O boundary.

**Verification:**

    python scripts/check_compute_contracts.py
    Set-Location app/backend-service
    ./mvnw.cmd --batch-mode --no-transfer-progress -Dtest=*Generation*,*Compute*,*Narration*,*Media* test
    Set-Location ../generation-service
    python -m pytest --basetemp=D:/workspace/NarrativeX/.tmp/pytest-parity tests

---

## Task 9: End-to-end cancel/recovery acceptance matrix

**Files:**
- deterministic integration harness/tests for backend ↔ generation-service
- scripts/ test helpers if needed
- documentation of matrix and evidence

**Steps:**

- [ ] Add a fake generation-service server/provider that deterministically returns ACCEPTED → RUNNING → terminal states and can pause at submit, provider wait, download, validation and upload boundaries.
- [ ] Verify cancel from each boundary results in backend CANCELED (or explicit UNKNOWN when outcome is ambiguous), no output upload after cancellation, and safe retry/resume without duplicate provider submission.
- [ ] Verify provider failure, HTTP timeout, service restart, existing handle recovery, malformed artifact, checksum/size mismatch and backend restart semantics.
- [ ] Verify the same test matrix across Qwen, ComfyUI, VoiceStudio, WhisperX and media validation capability adapters where the interface applies.
- [ ] Record unavailable live-provider checks as environment limitations, never as passing parity evidence.

**Verification:**

    python scripts/check_compute_contracts.py
    Set-Location app/backend-service
    ./mvnw.cmd --batch-mode --no-transfer-progress -Dtest=*Compute*IntegrationTest,*Generation*IntegrationTest test
    Set-Location ../generation-service
    python -m pytest --basetemp=D:/workspace/NarrativeX/.tmp/pytest-e2e tests/e2e tests/integration

---

## Task 10: Remove legacy runtime, CI jobs, scripts and environment residue

**Files:**
- docker-compose.yml
- .github/workflows/ci.yml
- scripts/verify-local.py, scripts/quality-gates.py, scripts/check_architecture_residue.py
- app/ai-worker/, app/narration-worker/ only after reference audit
- .env.example, deployment/config files and legacy docs

**Steps:**

- [ ] Run rg across repository for service names, image names, worker env vars, Docker targets, CI jobs, imports and docs references; classify active runtime vs historical decision record.
- [ ] Remove ai-worker CI job and make repository gates run generation-service as the single compute runtime.
- [ ] Remove legacy Compose services and their secrets/env wiring only after generation-service smoke/parity evidence is present.
- [ ] Remove legacy source directories only when rg confirms no active imports/build/context references; preserve ADR/history references as historical unless residue checker explicitly requires a safe wording change.
- [ ] Update residue checker to fail on active legacy runtime references and allow intentional historical references.
- [ ] Run architecture/residue/docs drift checks and inspect git diff --check.

**Verification:**

    python scripts/check_architecture_residue.py
    python scripts/check-docs-drift.py
    python scripts/check_diff_contract.py
    git diff --check

---

## Task 11: Update source-of-truth docs and operator runbook

**Files:**
- README.md, AI_CONTEXT.md
- documentation/CURRENT_STATUS.md
- documentation/codebase/* affected maps
- documentation/source-of-truth/README.md
- documentation/COMPUTE_PROTOCOL.md

**Steps:**

- [ ] State generation-service as current sole compute runtime only after Task 10 acceptance; remove future/initial scaffold claims that are no longer true.
- [ ] Document canonical env names, readiness/capability behavior, no-DB/no-R2 boundary, artifact flow, cancel/recovery semantics and local verification commands.
- [ ] Keep historical ADR decisions intact but annotate superseded migration status accurately.
- [ ] Run docs drift checker and inspect changed links/commands.

**Verification:**

    python scripts/check-docs-drift.py
    python scripts/check_compute_contracts.py

---

## Task 12: Final repository gate and review handoff

**Files:** all changed files; no additional scope unless a gate identifies a concrete defect.

**Steps:**

- [ ] Run generation-service full tests, ruff, mypy and compute contract checker with repo-scoped temp directories.
- [ ] Run backend full Maven verify with integration tests enabled and no skip flags.
- [ ] Run desktop tests/build if touched or if repository gate requires it.
- [ ] Run scripts/verify-local.ps1 / canonical full repository gate and resolve every failure rather than masking it.
- [ ] Inspect git status, git diff --stat, git diff --check, and rg residue; confirm pre-existing untracked temp paths remain untouched.
- [ ] Report exact passing commands, known environment-limited checks, files changed, and any remaining user decision. Do not claim complete until all acceptance criteria have fresh evidence.

**Verification:**

    pwsh -File scripts/verify-local.ps1
    git diff --check
    git status --short --branch

