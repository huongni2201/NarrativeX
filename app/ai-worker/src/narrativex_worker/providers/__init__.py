"""Provider ports with lazy exports for role-specific adapters.

Importing the provider namespace must not import image, narration or other
optional runtime dependencies. Concrete adapters are loaded only when a caller
requests their named export or imports the adapter module directly.
"""

from importlib import import_module
from typing import Any

_LAZY_EXPORTS: dict[str, tuple[str, str]] = {
    "DisabledProvider": ("narrativex_worker.providers.disabled", "DisabledProvider"),
    "ProviderNotConfiguredError": (
        "narrativex_worker.providers.disabled",
        "ProviderNotConfiguredError",
    ),
    "DisabledImageProvider": ("narrativex_worker.providers.factory", "DisabledImageProvider"),
    "create_image_provider": ("narrativex_worker.providers.factory", "create_image_provider"),
    "ImageGenerationRequest": ("narrativex_worker.providers.image", "ImageGenerationRequest"),
    "ImageGenerationResult": ("narrativex_worker.providers.image", "ImageGenerationResult"),
    "ImageProviderOperation": ("narrativex_worker.providers.image", "ImageProviderOperation"),
    "LlmProvider": ("narrativex_worker.providers.ports", "LlmProvider"),
    "ProviderCapabilities": ("narrativex_worker.providers.ports", "ProviderCapabilities"),
    "ProviderOperation": ("narrativex_worker.providers.ports", "ProviderOperation"),
    "ContinuityVertexGeminiProvider": (
        "narrativex_worker.providers.vertex_continuity",
        "ContinuityVertexGeminiProvider",
    ),
    "VertexProviderError": ("narrativex_worker.providers.vertex", "VertexProviderError"),
    "VertexImageProvider": ("narrativex_worker.providers.vertex_image", "VertexImageProvider"),
    "VertexImageProviderError": (
        "narrativex_worker.providers.vertex_image",
        "VertexImageProviderError",
    ),
    "VertexImageSubmissionUnknownError": (
        "narrativex_worker.providers.vertex_image",
        "VertexImageSubmissionUnknownError",
    ),
}

__all__ = sorted(_LAZY_EXPORTS)


def __getattr__(name: str) -> Any:
    target = _LAZY_EXPORTS.get(name)
    if target is None:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    module = import_module(target[0])
    value = getattr(module, target[1])
    globals()[name] = value
    return value
