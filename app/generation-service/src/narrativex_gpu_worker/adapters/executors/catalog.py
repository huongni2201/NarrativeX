from __future__ import annotations

from narrativex_gpu_worker.application.errors import ExecutorNotSupportedError
from narrativex_gpu_worker.application.ports.execution import ExecutorPort
from narrativex_gpu_worker.application.ports.residency import RuntimeFamily
from narrativex_gpu_worker.contracts import ComputeTask, ExecutorCapability


class ExecutorCatalog:
    """Catalog adapter that selects a ready provider/model executor."""

    def __init__(self, executors: tuple[ExecutorPort, ...] = ()) -> None:
        self._executors = {executor.name: executor for executor in executors}
        if len(self._executors) != len(executors):
            raise ValueError("executor names must be unique")

    def resolve(self, task: ComputeTask) -> ExecutorPort:
        executor = self._executors.get(task.model.executor)
        if executor is None or not executor.ready:
            raise ExecutorNotSupportedError("executor is unavailable")
        if task.task.type not in executor.task_types or task.model not in executor.models:
            raise ExecutorNotSupportedError("task type or model revision is unsupported")
        return executor

    def capabilities(self) -> list[ExecutorCapability]:
        return [
            ExecutorCapability(
                name=executor.name,
                task_types=sorted(executor.task_types),
                models=list(executor.models),
                ready=executor.ready,
                task_schema_versions=getattr(executor, "task_schema_versions", {}),
                workflow_profiles=getattr(executor, "workflow_profiles", []),
            )
            for executor in self._executors.values()
        ]

    async def preflight(self) -> None:
        for executor in self._executors.values():
            probe = getattr(executor, "preflight", None)
            if probe is not None:
                await probe()

    async def unload_runtime(self, family: RuntimeFamily) -> None:
        for executor in self._executors.values():
            requirement = getattr(executor, "runtime_requirement", None)
            unload = getattr(executor, "unload", None)
            if requirement is not None and requirement.family == family and unload is not None:
                await unload()

    async def refresh_preflight(self) -> None:
        for executor in self._executors.values():
            refresh = getattr(executor, "refresh_preflight", None)
            if refresh is not None:
                await refresh()

    async def recover_handle(self, task: ComputeTask) -> str | None:
        executor = self._executors.get(task.model.executor)
        if executor is None or task.model not in executor.models:
            return None
        lookup = getattr(executor, "recover_handle", None)
        if lookup is None:
            return None
        handle: str | None = await lookup(task)
        return handle


__all__ = ["ExecutorCatalog"]
