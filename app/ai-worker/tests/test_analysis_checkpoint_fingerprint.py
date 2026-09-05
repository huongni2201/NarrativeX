from narrativex_worker.repository.analysis_fingerprint import analysis_step_fingerprint


def test_analysis_step_fingerprint_is_canonical_across_object_key_order() -> None:
    left = analysis_step_fingerprint(
        tenant_scope="project:00000000-0000-4000-8000-000000000001",
        chapter_source_hash="a" * 64,
        step_kind="SHARD",
        owned_source_range={"start": 10, "end": 20},
        input_canon_versions=["char:2", "outfit:7"],
        continuity_inputs={"timeline": "present", "facts": [{"b": 2, "a": 1}]},
        model_config={"temperature": "0", "model": "gemini-2.5-flash"},
        prompt_version="continuity-v1",
        schema_version=1,
    )
    right = analysis_step_fingerprint(
        tenant_scope="project:00000000-0000-4000-8000-000000000001",
        chapter_source_hash="a" * 64,
        step_kind="SHARD",
        owned_source_range={"end": 20, "start": 10},
        input_canon_versions=["char:2", "outfit:7"],
        continuity_inputs={"facts": [{"a": 1, "b": 2}], "timeline": "present"},
        model_config={"model": "gemini-2.5-flash", "temperature": "0"},
        prompt_version="continuity-v1",
        schema_version=1,
    )

    assert left == right
    assert len(left) == 64


def test_analysis_step_fingerprint_does_not_normalize_owned_source_or_array_order() -> None:
    base = dict(
        tenant_scope="project:p1",
        chapter_source_hash="b" * 64,
        step_kind="STRUCTURE",
        continuity_inputs={},
        model_config={},
        prompt_version="continuity-v1",
        schema_version=1,
    )

    assert analysis_step_fingerprint(
        **base,
        owned_source_range={"source": "Xin chào 😊"},
        input_canon_versions=["a", "b"],
    ) != analysis_step_fingerprint(
        **base,
        owned_source_range={"source": "Xin chào  😊"},
        input_canon_versions=["a", "b"],
    )
    assert analysis_step_fingerprint(
        **base,
        owned_source_range={"source": "Xin chào 😊"},
        input_canon_versions=["a", "b"],
    ) != analysis_step_fingerprint(
        **base,
        owned_source_range={"source": "Xin chào 😊"},
        input_canon_versions=["b", "a"],
    )
