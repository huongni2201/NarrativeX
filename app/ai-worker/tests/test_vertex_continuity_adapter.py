import inspect

from narrativex_worker.providers.vertex_continuity import _VertexStructuredAdapter


def test_vertex_structured_adapter_accepts_keyword_only_identity() -> None:
    parameters = inspect.signature(_VertexStructuredAdapter.generate).parameters

    assert "identity" in parameters
    assert parameters["identity"].kind is inspect.Parameter.KEYWORD_ONLY
    assert parameters["identity"].default is None
