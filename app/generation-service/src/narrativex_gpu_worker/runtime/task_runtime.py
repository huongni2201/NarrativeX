"""Compatibility imports for the application execution service."""

from narrativex_gpu_worker.application.errors import CapacityError, FingerprintConflictError
from narrativex_gpu_worker.application.services.execution import ExecutionApplicationService

TaskRuntime = ExecutionApplicationService

__all__ = ["CapacityError", "FingerprintConflictError", "TaskRuntime"]
