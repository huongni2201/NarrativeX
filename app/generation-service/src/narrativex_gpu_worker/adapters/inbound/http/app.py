from __future__ import annotations

import secrets
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse

from narrativex_gpu_worker import __version__
from narrativex_gpu_worker.application.errors import (
    CapacityError,
    ExecutorNotSupportedError,
    FingerprintConflictError,
)
from narrativex_gpu_worker.application.ports.outbound import ExecutorCatalogPort
from narrativex_gpu_worker.application.services import ExecutionApplicationService
from narrativex_gpu_worker.bootstrap import ApplicationComponents, build_application
from narrativex_gpu_worker.config import WorkerSettings
from narrativex_gpu_worker.contracts import (
    ComputeObservation,
    ComputeTask,
    WorkerCapabilities,
    WorkerLimits,
)

MEDIA_TYPE = "application/vnd.narrativex.compute-v1+json"


@dataclass(frozen=True, slots=True)
class AppState:
    settings: WorkerSettings
    executor_catalog: ExecutorCatalogPort
    execution: ExecutionApplicationService

    @property
    def registry(self) -> ExecutorCatalogPort:
        return self.executor_catalog

    @property
    def runtime(self) -> ExecutionApplicationService:
        return self.execution

    @classmethod
    def from_components(cls, components: ApplicationComponents) -> AppState:
        return cls(
            settings=components.settings,
            executor_catalog=components.executor_catalog,
            execution=components.execution,
        )


def create_app(
    settings: WorkerSettings, registry: ExecutorCatalogPort | None = None
) -> FastAPI:
    components = build_application(settings, registry)
    state = AppState.from_components(components)

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        await state.execution.start()
        try:
            yield
        finally:
            await state.execution.stop()

    app = FastAPI(
        title="NarrativeX GPU Worker",
        version=__version__,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
        lifespan=lifespan,
    )
    app.state.compute = state

    async def authenticate(
        authorization: str | None = Header(default=None),
    ) -> None:
        expected = f"Bearer {settings.machine_token.get_secret_value()}"
        if authorization is None or not secrets.compare_digest(authorization, expected):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

    protected = [Depends(authenticate)]

    @app.middleware("http")
    async def enforce_request_size(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        content_length = request.headers.get("content-length")
        if content_length is not None:
            try:
                too_large = int(content_length) > settings.max_request_bytes
            except ValueError:
                return JSONResponse(status_code=400, content={"detail": "Invalid Content-Length"})
            if too_large:
                return JSONResponse(
                    status_code=413, content={"detail": "Request body is too large"}
                )
        return await call_next(request)

    @app.get("/healthz", include_in_schema=False)
    async def health() -> dict[str, str]:
        return {"status": "UP"}

    @app.get("/v1/capabilities", response_model=WorkerCapabilities, dependencies=protected)
    async def capabilities() -> WorkerCapabilities:
        return WorkerCapabilities(
            protocol_versions=["1.0"],
            worker_version=__version__,
            executors=state.executor_catalog.capabilities(),
            limits=WorkerLimits(
                max_concurrent_tasks=settings.max_concurrent_tasks,
                max_request_bytes=settings.max_request_bytes,
                max_artifact_bytes=settings.max_artifact_bytes,
            ),
        )

    @app.post(
        "/v1/tasks",
        response_model=ComputeObservation,
        status_code=status.HTTP_202_ACCEPTED,
        dependencies=protected,
    )
    async def submit(
        task: ComputeTask, idempotency_key: str = Header(alias="Idempotency-Key")
    ) -> ComputeObservation:
        if idempotency_key != task.idempotency_key:
            raise HTTPException(status_code=409, detail="Idempotency key does not match body")
        try:
            return await state.execution.submit(task)
        except FingerprintConflictError as exc:
            raise HTTPException(status_code=409, detail="Fingerprint conflict") from exc
        except ExecutorNotSupportedError as exc:
            raise HTTPException(status_code=422, detail="Unsupported task or model") from exc
        except CapacityError as exc:
            raise HTTPException(
                status_code=429,
                detail="Worker capacity exhausted",
                headers={"Retry-After": "5"},
            ) from exc

    @app.get(
        "/v1/tasks/{task_id}/attempts/{attempt_id}",
        response_model=ComputeObservation,
        dependencies=protected,
    )
    async def get_attempt(task_id: UUID, attempt_id: UUID) -> ComputeObservation:
        observation = await state.execution.get(task_id, attempt_id)
        if observation is None:
            raise HTTPException(status_code=404, detail="Attempt not found")
        return observation

    @app.post(
        "/v1/tasks/{task_id}/attempts/{attempt_id}:cancel",
        response_model=ComputeObservation,
        status_code=status.HTTP_202_ACCEPTED,
        dependencies=protected,
    )
    async def cancel(task_id: UUID, attempt_id: UUID) -> ComputeObservation:
        observation = await state.execution.cancel(task_id, attempt_id)
        if observation is None:
            raise HTTPException(status_code=404, detail="Attempt not found")
        return observation

    return app
