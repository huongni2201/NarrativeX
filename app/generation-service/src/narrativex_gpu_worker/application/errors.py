"""Errors owned by the application boundary.

Adapters translate their technology-specific failures into these errors so the
HTTP adapter and future inbound adapters do not depend on provider/runtime code.
"""


class FingerprintConflictError(ValueError):
    """The same attempt or idempotency key was reused for different input."""


class CapacityError(RuntimeError):
    """The worker cannot admit another attempt right now."""


class ExecutorNotSupportedError(LookupError):
    """No ready adapter supports the requested task/model revision."""


class DeadlineExceededError(ValueError):
    """The task deadline has already expired."""


class AmbiguousOutcomeError(RuntimeError):
    """External outcome is ambiguous; blind resubmission is forbidden."""


class MissingDurableContextError(RuntimeError):
    """A remote side-effect executor was invoked without durable persistence callbacks."""


__all__ = [
    "AmbiguousOutcomeError",
    "CapacityError",
    "DeadlineExceededError",
    "ExecutorNotSupportedError",
    "FingerprintConflictError",
    "MissingDurableContextError",
]
