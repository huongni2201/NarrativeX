"""Backward-compatible import surface for the pre-hexagonal package layout.

New code should import wire types from ``narrativex_gpu_worker.contracts``.
"""

from narrativex_gpu_worker.contracts.models import (
    ArtifactAccess,
    ArtifactRef,
    AudioAlignInputs,
    AudioFormat,
    AudioSynthesizeInputs,
    ComputeError,
    ComputeObservation,
    ComputeTask,
    ErrorCategory,
    ExecutionMetrics,
    ExecutionState,
    ExecutorCapability,
    ImageGenerateInputs,
    MediaValidateInputs,
    ModelRef,
    ProtocolModel,
    TaskConstraints,
    TaskDescriptor,
    VoiceSelection,
    WorkerCapabilities,
    WorkerLimits,
)

__all__ = [
    "ArtifactAccess",
    "ArtifactRef",
    "AudioAlignInputs",
    "AudioFormat",
    "AudioSynthesizeInputs",
    "ComputeError",
    "ComputeObservation",
    "ComputeTask",
    "ErrorCategory",
    "ExecutionMetrics",
    "ExecutionState",
    "ExecutorCapability",
    "ImageGenerateInputs",
    "MediaValidateInputs",
    "ModelRef",
    "ProtocolModel",
    "TaskConstraints",
    "TaskDescriptor",
    "VoiceSelection",
    "WorkerCapabilities",
    "WorkerLimits",
]
