from __future__ import annotations

from narrativex_gpu_worker.application.errors import ExecutorNotSupportedError
from narrativex_gpu_worker.application.ports.execution import ExecutorPort
from narrativex_gpu_worker.contracts import ComputeTask, ExecutorCapability


class ExecutorRegistry:
    """Configuration adapter that selects a ready provider/model executor."""

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
            )
            for executor in self._executors.values()
        ]
