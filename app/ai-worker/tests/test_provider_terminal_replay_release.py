"""Regression coverage for immediate replay after terminal provider reconciliation."""

import logging
from types import SimpleNamespace
from uuid import UUID

import pytest

from narrativex_worker.providers.ports import ProviderCapabilities, ProviderOperation
from narrativex_worker.repository import DurableProviderOperation, WorkerRepository
from narrativex_worker.schema import (
    ChapterAnalysisResult,
    ProviderOperationStatus,
    SceneAnalysis,
    VisualBeatAnalysis,
)
from narrativex_worker.worker import NarrativeXWorker


OPERATION_ID = UUID("00000000-0000-7000-8000-000000000201")
STAGE_ATTEMPT_ID = UUID("00000000-0000-7000-8000-000000000202")
GENERATION_JOB_ID = UUID("00000000-0000-7000-8000-000000000203")


def _durable() -> DurableProviderOperation:
    return DurableProviderOperation(
        id=OPERATION_ID,
        stage_attempt_id=STAGE_ATTEMPT_ID,
        provider_key="fake-analysis",
        provider_operation_id="provider-op-1",
        status=ProviderOperationStatus.RUNNING,
        row_version=3,
        request_fingerprint="a" * 64,
    )


def _result() -> ChapterAnalysisResult:
    return ChapterAnalysisResult(
        scenes=[
            SceneAnalysis(
                title="Opening",
                visual_beats=[
                    VisualBeatAnalysis(title="Beat", visual_intent="A quiet opening frame")
                ],
            )
        ]
    )


class _Provider:
    def get_capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(
            provider_key="fake-analysis",
            supports_story_analysis=True,
            supports_operation_reconciliation=True,
        )


class _Service:
    def __init__(self, reconciled: ProviderOperation) -> None:
        self.provider = _Provider()
        self.reconciled = reconciled

    async def reconcile_chapter_analysis(self, operation: ProviderOperation) -> ProviderOperation:
        assert operation.operation_id == "provider-op-1"
        return self.reconciled


class _Repository:
    def __init__(self) -> None:
        self.persisted = False
        self.failed = False
        self.released = False

    async def list_provider_operations(self, statuses: object, limit: int) -> list[DurableProviderOperation]:
        del statuses, limit
        return [_durable()]

    async def persist_provider_result(self, *args: object) -> DurableProviderOperation:
        self.persisted = True
        return _durable()

    async def mark_provider_operation_status(self, *args: object) -> DurableProviderOperation:
        self.failed = True
        return _durable()

    async def release_stage_for_provider_replay(self, operation: DurableProviderOperation) -> bool:
        assert operation.stage_attempt_id == STAGE_ATTEMPT_ID
        self.released = True
        return True


@pytest.mark.asyncio
@pytest.mark.parametrize("terminal_status", [ProviderOperationStatus.COMPLETED, ProviderOperationStatus.FAILED])
async def test_background_terminal_reconciliation_releases_stage_for_immediate_replay(
    terminal_status: ProviderOperationStatus,
) -> None:
    result = _result() if terminal_status is ProviderOperationStatus.COMPLETED else None
    repository = _Repository()
    worker = object.__new__(NarrativeXWorker)
    worker.settings = SimpleNamespace(worker_concurrency=1)
    worker.repository = repository
    worker.service = _Service(
        ProviderOperation(
            provider_key="fake-analysis",
            operation_id="provider-op-1",
            status=terminal_status,
            result=result,
        )
    )
    worker.billing_repository = SimpleNamespace()
    worker.logger = logging.getLogger("test.provider-replay")

    await worker._reconcile_provider_operations()

    assert repository.released is True
    if terminal_status is ProviderOperationStatus.COMPLETED:
        assert repository.persisted is True
        assert repository.failed is False
    else:
        assert repository.persisted is False
        assert repository.failed is True


class _Transaction:
    async def __aenter__(self) -> "_Transaction":
        return self

    async def __aexit__(self, *args: object) -> None:
        return None


class _Connection:
    def __init__(self) -> None:
        self.fetchval_queries: list[str] = []
        self.execute_queries: list[str] = []

    def transaction(self) -> _Transaction:
        return _Transaction()

    async def fetchval(self, query: str, *args: object) -> UUID:
        assert args == (STAGE_ATTEMPT_ID,)
        self.fetchval_queries.append(query)
        return GENERATION_JOB_ID

    async def execute(self, query: str, *args: object) -> str:
        assert args == (GENERATION_JOB_ID,)
        self.execute_queries.append(query)
        return "UPDATE 1"


class _Acquire:
    def __init__(self, connection: _Connection) -> None:
        self.connection = connection

    async def __aenter__(self) -> _Connection:
        return self.connection

    async def __aexit__(self, *args: object) -> None:
        return None


class _Pool:
    def __init__(self, connection: _Connection) -> None:
        self.connection = connection

    def acquire(self) -> _Acquire:
        return _Acquire(self.connection)


@pytest.mark.asyncio
async def test_release_stage_for_provider_replay_clears_lease_and_stalls_job() -> None:
    connection = _Connection()
    repository = WorkerRepository("postgresql://unused", lease_seconds=30)
    repository._pool = _Pool(connection)  # type: ignore[assignment]

    released = await repository.release_stage_for_provider_replay(_durable())

    assert released is True
    stage_sql = connection.fetchval_queries[0]
    assert "status = 'STALLED'" in stage_sql
    assert "worker_id = NULL" in stage_sql
    assert "heartbeat_at = NULL" in stage_sql
    job_sql = connection.execute_queries[0]
    assert "UPDATE generation_jobs" in job_sql
    assert "status = 'STALLED'" in job_sql
