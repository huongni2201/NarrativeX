"""Tests for the NarrativeX Chapter analysis worker."""

import asyncio
from dataclasses import replace

import pytest
from pydantic import ValidationError

from narrativex_worker.config import WorkerSettings, get_settings
from narrativex_worker.providers.disabled import DisabledProvider, ProviderNotConfiguredError
from narrativex_worker.providers.ports import (
    ProviderCapabilities,
    ProviderOperation,
)
from narrativex_worker.providers.vertex import VertexProviderError
from narrativex_worker.repository import (
    ALLOWED_PROVIDER_TRANSITIONS,
    ClaimedChapterAnalysisJob,
    DurableProviderOperation,
    ProviderOperationInvalidTransitionError,
    WorkerRepository,
    provider_request_fingerprint,
)
from narrativex_worker.schema import (
    ChapterAnalysisRequest,
    ChapterAnalysisResult,
    ImageAspectRatio,
    ImageGenerationSettings,
    ProviderOperationStatus,
)
from narrativex_worker.service import WorkerService
from narrativex_worker.worker import (
    NarrativeXWorker,
    ProviderOperationUnreconcilableError,
)

SOURCE_HASH = "a" * 64


def chapter_request(source_text: str = "A short story.") -> ChapterAnalysisRequest:
    return ChapterAnalysisRequest(
        project_id="00000000-0000-4000-8000-000000000001",
        story_version_id="00000000-0000-4000-8000-000000000002",
        chapter_id="00000000-0000-4000-8000-000000000003",
        chapter_row_version=4,
        source_hash=SOURCE_HASH,
        source_text=source_text,
    )


def worker_settings_without_env_file() -> WorkerSettings:
    return WorkerSettings()


def test_worker_settings_defaults() -> None:
    settings = get_settings()
    assert settings.worker_name == "narrativex-worker"
    assert settings.worker_env in ("development", "test")
    assert settings.log_level == "INFO"
    assert settings.backend_url == "http://localhost:8080"
    assert settings.provider_mode == "disabled"
    assert settings.worker_concurrency == 4


def test_worker_settings_accepts_canonical_provider_mode_env(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("AI_PROVIDER_MODE", "vertex")
    monkeypatch.delenv("PROVIDER_MODE", raising=False)

    settings = worker_settings_without_env_file()

    assert settings.provider_mode == "vertex"


def test_worker_settings_prefers_canonical_provider_mode_env(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("AI_PROVIDER_MODE", "disabled")
    monkeypatch.setenv("PROVIDER_MODE", "vertex")

    settings = worker_settings_without_env_file()

    assert settings.provider_mode == "disabled"


def test_worker_settings_defaults_provider_to_disabled_when_unset(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("AI_PROVIDER_MODE", raising=False)
    monkeypatch.delenv("PROVIDER_MODE", raising=False)

    settings = worker_settings_without_env_file()

    assert settings.provider_mode == "disabled"


def test_worker_settings_accepts_legacy_provider_mode_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("AI_PROVIDER_MODE", raising=False)
    monkeypatch.setenv("PROVIDER_MODE", "vertex")

    settings = worker_settings_without_env_file()

    assert settings.provider_mode == "vertex"


def test_worker_settings_rejects_invalid_provider_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AI_PROVIDER_MODE", "foo")

    with pytest.raises(ValidationError):
        worker_settings_without_env_file()


@pytest.mark.parametrize("concurrency", [1, 32])
def test_worker_settings_accepts_concurrency_boundaries(
    monkeypatch: pytest.MonkeyPatch,
    concurrency: int,
) -> None:
    monkeypatch.setenv("WORKER_CONCURRENCY", str(concurrency))

    settings = worker_settings_without_env_file()

    assert settings.worker_concurrency == concurrency


@pytest.mark.parametrize("concurrency", [0, 33])
def test_worker_settings_rejects_concurrency_outside_contract(
    monkeypatch: pytest.MonkeyPatch,
    concurrency: int,
) -> None:
    monkeypatch.setenv("WORKER_CONCURRENCY", str(concurrency))

    with pytest.raises(ValidationError):
        worker_settings_without_env_file()


def test_vertex_provider_fails_fast_without_project() -> None:
    settings = WorkerSettings(provider_mode="vertex", vertex_project_id=None)

    with pytest.raises(VertexProviderError, match="VERTEX_PROJECT_ID is required"):
        NarrativeXWorker(settings=settings)


def test_worker_custom_settings() -> None:
    custom = WorkerSettings(
        worker_name="custom-worker",
        worker_env="test",
        log_level="DEBUG",
        backend_url="http://backend:8080",
        worker_concurrency=7,
    )
    assert custom.worker_name == "custom-worker"
    assert custom.worker_env == "test"
    assert custom.log_level == "DEBUG"
    assert custom.backend_url == "http://backend:8080"
    assert custom.worker_concurrency == 7


def test_worker_sizes_database_pool_for_concurrency() -> None:
    worker = NarrativeXWorker(settings=WorkerSettings(worker_env="test", worker_concurrency=4))
    assert worker.repository.pool_size == 9


@pytest.mark.asyncio
async def test_worker_dry_run_startup() -> None:
    settings = WorkerSettings(worker_env="test", log_level="DEBUG")
    worker = NarrativeXWorker(settings=settings)
    await worker.start(dry_run=True)
    assert not worker._running


def test_worker_stop() -> None:
    worker = NarrativeXWorker()
    worker._running = True
    worker.stop()
    assert not worker._running


def test_chapter_request_is_snapshot_scoped_without_rights_attestation() -> None:
    request = chapter_request()
    dumped = request.model_dump()
    settings = ImageGenerationSettings()
    assert str(request.chapter_id) == "00000000-0000-4000-8000-000000000003"
    assert request.chapter_row_version == 4
    assert request.source_hash == SOURCE_HASH
    assert "rights_attested" not in dumped
    assert "rights_policy_version" not in dumped
    assert "rights_basis" not in dumped
    assert settings.aspect_ratio is ImageAspectRatio.RATIO_16_9


def test_provider_terminal_status_is_completed() -> None:
    assert ProviderOperationStatus.COMPLETED.value == "COMPLETED"
    assert "SUCCEEDED" not in {status.value for status in ProviderOperationStatus}


def test_provider_operation_state_graph_rejects_illegal_transitions() -> None:
    for current_status, allowed_next in ALLOWED_PROVIDER_TRANSITIONS.items():
        operation = DurableProviderOperation(
            id=1,
            stage_attempt_id=2,
            provider_key="vertex",
            provider_operation_id=None,
            status=current_status,
            row_version=5,
            request_fingerprint="fingerprint",
        )
        for next_status in ProviderOperationStatus:
            if next_status in allowed_next:
                continue
            with pytest.raises(ProviderOperationInvalidTransitionError):
                WorkerRepository._assert_transition_allowed(operation, next_status)


def test_provider_request_fingerprint_is_restart_stable() -> None:
    claimed = ClaimedChapterAnalysisJob(
        stage_attempt_id=10,
        generation_job_id=20,
        job_id="job-1",
        requested_by_user_id="user-1",
        request=chapter_request(),
    )
    assert provider_request_fingerprint(claimed, "vertex") == provider_request_fingerprint(
        claimed, "vertex"
    )
    assert provider_request_fingerprint(claimed, "vertex") != provider_request_fingerprint(
        claimed, "other"
    )


@pytest.mark.asyncio
async def test_disabled_provider_never_fakes_success() -> None:
    with pytest.raises(ProviderNotConfiguredError):
        await WorkerService(DisabledProvider()).submit_chapter_analysis(chapter_request())


def completed_result() -> ChapterAnalysisResult:
    return ChapterAnalysisResult.model_validate(
        {
            "scenes": [
                {
                    "title": "Opening",
                    "narration": "A door opens.",
                    "visual_beats": [
                        {
                            "title": "Door",
                            "visual_intent": "Warm light",
                            "source_anchor": "A short story.",
                            "visual_direction": {
                                "shot_size": "WIDE",
                                "camera_angle": "EYE_LEVEL",
                                "lens_mm": 50,
                                "focus_target": "door",
                                "action_phase": "AFTER",
                                "subject_placement": "center third",
                                "foreground": None,
                                "background": "room",
                                "motivated_light": "warm light",
                                "palette": "warm",
                                "camera_movement": "NONE",
                                "movement_direction": None,
                                "movement_intensity": "SUBTLE",
                                "crop_safe_area": "all sides",
                            },
                        }
                    ],
                }
            ]
        }
    )


class DurableRepositorySpy:
    def __init__(
        self,
        status: ProviderOperationStatus | None = None,
        normalized_result: ChapterAnalysisResult | None = None,
        *,
        fail_complete_once: bool = False,
    ) -> None:
        self.status = status
        self.normalized_result = normalized_result
        self.submit_id = "vertex-op-1"
        self.complete_calls = 0
        self.status_history: list[ProviderOperationStatus] = []
        self.fail_complete_once = fail_complete_once
        self.suspended_errors: list[str] = []
        self.reconcile_errors: list[str] = []
        self.reconcile_statuses: tuple[ProviderOperationStatus, ...] | None = None
        self.listed_operations: list[DurableProviderOperation] = []
        self.row_version = 0

    def operation(self, provider_operation_id: str | None = None) -> DurableProviderOperation:
        return DurableProviderOperation(
            id=100,
            stage_attempt_id=10,
            provider_key="vertex",
            provider_operation_id=provider_operation_id or self.submit_id,
            status=self.status or ProviderOperationStatus.RESERVED,
            row_version=self.row_version,
            request_fingerprint="f",
            normalized_result=self.normalized_result,
        )

    async def reserve_provider_operation(
        self, claimed: ClaimedChapterAnalysisJob, provider_key: str, fingerprint: str
    ) -> DurableProviderOperation:
        del claimed, provider_key
        created = self.status is None
        return replace(
            self.operation(self.submit_id if self.status else None),
            request_fingerprint=fingerprint,
            created=created,
        )

    async def mark_provider_operation_submitted(
        self, operation: DurableProviderOperation, provider_operation_id: str | None
    ) -> DurableProviderOperation:
        self.row_version = operation.row_version + 1
        self.status = ProviderOperationStatus.SUBMITTED
        self.status_history.append(self.status)
        return self.operation(provider_operation_id)

    async def mark_provider_operation_submission_unknown(
        self, operation: DurableProviderOperation, reconcile_after_seconds: float
    ) -> DurableProviderOperation:
        del reconcile_after_seconds
        self.row_version = operation.row_version + 1
        self.status = ProviderOperationStatus.UNKNOWN
        self.status_history.append(self.status)
        return self.operation(None)

    async def schedule_provider_operation_reconciliation(
        self,
        operation: DurableProviderOperation,
        status: ProviderOperationStatus,
        provider_operation_id: str,
        *,
        error: str | None = None,
    ) -> DurableProviderOperation:
        del error
        self.row_version = operation.row_version + 1
        self.status = status
        self.submit_id = provider_operation_id
        self.status_history.append(status)
        return self.operation(provider_operation_id)

    async def record_provider_reconcile_error(
        self, operation: DurableProviderOperation, error: str
    ) -> DurableProviderOperation:
        self.row_version = operation.row_version + 1
        self.reconcile_errors.append(error)
        return self.operation()

    async def suspend_provider_reconciliation(
        self, operation: DurableProviderOperation, error: str
    ) -> DurableProviderOperation:
        self.row_version = operation.row_version + 1
        self.suspended_errors.append(error)
        return self.operation()

    async def list_provider_operations(
        self, statuses: tuple[ProviderOperationStatus, ...], limit: int = 50
    ) -> list[DurableProviderOperation]:
        del limit
        self.reconcile_statuses = statuses
        return self.listed_operations

    async def persist_provider_result(
        self,
        operation: DurableProviderOperation,
        provider_operation_id: str | None,
        result: ChapterAnalysisResult,
    ) -> DurableProviderOperation:
        self.row_version = operation.row_version + 1
        self.status = ProviderOperationStatus.COMPLETED
        self.normalized_result = result
        self.status_history.append(self.status)
        return self.operation(provider_operation_id)

    async def mark_provider_operation_status(
        self,
        operation: DurableProviderOperation,
        status: ProviderOperationStatus,
        provider_operation_id: str | None = None,
    ) -> DurableProviderOperation:
        self.row_version = operation.row_version + 1
        self.status = status
        self.status_history.append(status)
        return self.operation(provider_operation_id)

    async def get_provider_operation(self, operation_id: int) -> DurableProviderOperation:
        del operation_id
        return self.operation()

    async def complete(self, *args: object) -> None:
        del args
        self.complete_calls += 1
        if self.fail_complete_once:
            self.fail_complete_once = False
            raise RuntimeError("simulated crash before materialization commit")


class ProviderSpy:
    def __init__(
        self,
        submit_error: Exception | None = None,
        *,
        supports_reconciliation: bool = True,
    ) -> None:
        self.submit_calls = 0
        self.reconcile_calls = 0
        self.submit_error = submit_error
        self.supports_reconciliation = supports_reconciliation

    def get_capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(
            "vertex",
            supports_story_analysis=True,
            supports_operation_reconciliation=self.supports_reconciliation,
        )

    async def submit(self, request: ChapterAnalysisRequest) -> ProviderOperation:
        del request
        self.submit_calls += 1
        if self.submit_error:
            raise self.submit_error
        return ProviderOperation(
            "vertex", "vertex-op-1", ProviderOperationStatus.COMPLETED, completed_result()
        )

    async def get_status(self, operation: ProviderOperation) -> ProviderOperation:
        return operation

    async def reconcile(self, operation: ProviderOperation) -> ProviderOperation:
        self.reconcile_calls += 1
        return ProviderOperation(
            "vertex",
            operation.operation_id or "vertex-op-1",
            ProviderOperationStatus.COMPLETED,
            completed_result(),
        )


@pytest.mark.asyncio
async def test_reserved_restart_resubmits_after_safe_submission_fence() -> None:
    worker = NarrativeXWorker(settings=WorkerSettings(worker_env="test"))
    repository = DurableRepositorySpy(ProviderOperationStatus.RESERVED)
    provider = ProviderSpy()
    worker.repository = repository  # type: ignore[assignment]
    worker.service = WorkerService(provider)
    claimed = ClaimedChapterAnalysisJob(10, 20, "job-1", "user-1", chapter_request())

    await worker._execute_claimed(claimed)

    assert provider.submit_calls == 1
    assert provider.reconcile_calls == 0
    assert repository.status_history == [
        ProviderOperationStatus.UNKNOWN,
        ProviderOperationStatus.COMPLETED,
    ]
    assert repository.complete_calls == 1


@pytest.mark.asyncio
async def test_submitted_restart_reconciles_without_resubmitting() -> None:
    worker = NarrativeXWorker(settings=WorkerSettings(worker_env="test"))
    repository = DurableRepositorySpy(ProviderOperationStatus.SUBMITTED)
    provider = ProviderSpy()
    worker.repository = repository  # type: ignore[assignment]
    worker.service = WorkerService(provider)
    claimed = ClaimedChapterAnalysisJob(10, 20, "job-1", "user-1", chapter_request())

    await worker._execute_claimed(claimed)

    assert provider.submit_calls == 0
    assert provider.reconcile_calls == 1
    assert repository.complete_calls == 1


@pytest.mark.asyncio
async def test_unknown_restart_without_provider_operation_id_fails_closed() -> None:
    worker = NarrativeXWorker(settings=WorkerSettings(worker_env="test"))
    repository = DurableRepositorySpy(ProviderOperationStatus.UNKNOWN)
    repository.submit_id = ""
    provider = ProviderSpy()
    worker.repository = repository  # type: ignore[assignment]
    worker.service = WorkerService(provider)
    claimed = ClaimedChapterAnalysisJob(10, 20, "job-1", "user-1", chapter_request())

    durable = DurableProviderOperation(
        id=100,
        stage_attempt_id=10,
        provider_key="vertex",
        provider_operation_id=None,
        status=ProviderOperationStatus.UNKNOWN,
        row_version=0,
        request_fingerprint="f",
    )
    with pytest.raises(ProviderOperationUnreconcilableError, match="refusing blind"):
        await worker._recover_provider_operation(claimed, durable)

    assert provider.submit_calls == 0
    assert provider.reconcile_calls == 0
    assert repository.suspended_errors


@pytest.mark.asyncio
async def test_unreconcilable_provider_with_durable_id_fails_closed() -> None:
    worker = NarrativeXWorker(settings=WorkerSettings(worker_env="test"))
    repository = DurableRepositorySpy(ProviderOperationStatus.SUBMITTED)
    provider = ProviderSpy(supports_reconciliation=False)
    worker.repository = repository  # type: ignore[assignment]
    worker.service = WorkerService(provider)
    claimed = ClaimedChapterAnalysisJob(10, 20, "job-1", "user-1", chapter_request())

    with pytest.raises(ProviderOperationUnreconcilableError, match="does not support"):
        await worker._execute_claimed(claimed)

    assert provider.submit_calls == 0
    assert provider.reconcile_calls == 0
    assert repository.suspended_errors


@pytest.mark.asyncio
async def test_crash_after_provider_result_persist_replays_without_provider_call() -> None:
    worker = NarrativeXWorker(settings=WorkerSettings(worker_env="test"))
    repository = DurableRepositorySpy(fail_complete_once=True)
    provider = ProviderSpy()
    worker.repository = repository  # type: ignore[assignment]
    worker.service = WorkerService(provider)
    claimed = ClaimedChapterAnalysisJob(10, 20, "job-1", "user-1", chapter_request())

    with pytest.raises(RuntimeError, match="simulated crash"):
        await worker._execute_claimed(claimed)

    assert repository.status is ProviderOperationStatus.COMPLETED
    assert repository.normalized_result == completed_result()
    assert provider.submit_calls == 1
    assert provider.reconcile_calls == 0
    assert repository.complete_calls == 1

    restarted = NarrativeXWorker(settings=WorkerSettings(worker_env="test"))
    restarted.repository = repository  # type: ignore[assignment]
    restarted.service = WorkerService(provider)

    await restarted._execute_claimed(claimed)

    assert provider.submit_calls == 1
    assert provider.reconcile_calls == 0
    assert repository.complete_calls == 2


@pytest.mark.asyncio
async def test_timeout_fails_closed_and_never_blind_retries() -> None:
    worker = NarrativeXWorker(settings=WorkerSettings(worker_env="test"))
    repository = DurableRepositorySpy()
    provider = ProviderSpy(TimeoutError("provider timed out"))
    worker.repository = repository  # type: ignore[assignment]
    worker.service = WorkerService(provider)
    claimed = ClaimedChapterAnalysisJob(10, 20, "job-1", "user-1", chapter_request())

    with pytest.raises(ProviderOperationUnreconcilableError):
        await worker._execute_claimed(claimed)

    assert provider.submit_calls == 1
    assert repository.status_history == [ProviderOperationStatus.UNKNOWN]
    assert repository.suspended_errors
    assert repository.complete_calls == 0


@pytest.mark.asyncio
async def test_background_reconciler_scans_all_reconcilable_non_terminal_states() -> None:
    worker = NarrativeXWorker(settings=WorkerSettings(worker_env="test"))
    repository = DurableRepositorySpy()
    provider = ProviderSpy()
    worker.repository = repository  # type: ignore[assignment]
    worker.service = WorkerService(provider)

    await worker._reconcile_provider_operations()

    assert repository.reconcile_statuses == (
        ProviderOperationStatus.UNKNOWN,
        ProviderOperationStatus.SUBMITTED,
        ProviderOperationStatus.RUNNING,
    )


@pytest.mark.asyncio
async def test_background_reconciler_suspends_provider_without_reconciliation() -> None:
    worker = NarrativeXWorker(settings=WorkerSettings(worker_env="test"))
    repository = DurableRepositorySpy()
    repository.listed_operations = [
        DurableProviderOperation(
            id=100,
            stage_attempt_id=10,
            provider_key="vertex",
            provider_operation_id="vertex-op-1",
            status=ProviderOperationStatus.SUBMITTED,
            row_version=0,
            request_fingerprint="f",
        )
    ]
    provider = ProviderSpy(supports_reconciliation=False)
    worker.repository = repository  # type: ignore[assignment]
    worker.service = WorkerService(provider)

    await worker._reconcile_provider_operations()

    assert provider.reconcile_calls == 0
    assert repository.suspended_errors


@pytest.mark.asyncio
async def test_process_cancels_provider_work_when_lease_is_lost(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    worker = NarrativeXWorker(settings=WorkerSettings(worker_env="test"))
    provider_cancelled = asyncio.Event()

    async def slow_provider_work(claimed: ClaimedChapterAnalysisJob) -> None:
        del claimed
        try:
            await asyncio.Event().wait()
        except asyncio.CancelledError:
            provider_cancelled.set()
            raise

    class RepositorySpy:
        def __init__(self) -> None:
            self.complete_called = False
            self.fail_called = False

        async def complete(self, *args: object) -> None:
            del args
            self.complete_called = True

        async def fail(self, *args: object) -> None:
            del args
            self.fail_called = True

    async def lost_lease(stage_attempt_id: int) -> None:
        del stage_attempt_id
        await asyncio.sleep(0)
        raise RuntimeError("Worker lost its StageAttempt lease")

    repository = RepositorySpy()
    worker.repository = repository  # type: ignore[assignment]
    monkeypatch.setattr(worker, "_execute_with_budget", slow_provider_work)
    monkeypatch.setattr(worker, "_heartbeat_loop", lost_lease)

    claimed = ClaimedChapterAnalysisJob(
        stage_attempt_id=10,
        generation_job_id=20,
        job_id="job-1",
        requested_by_user_id="user-1",
        request=chapter_request(),
    )

    await worker._process(claimed)

    assert provider_cancelled.is_set()
    assert not repository.complete_called
    assert repository.fail_called
