import logging

from narrativex_worker.observability import PipelineContext, PipelineMetrics


def test_pipeline_metric_contains_correlation_fields(caplog) -> None:
    metrics = PipelineMetrics(logging.getLogger("test.pipeline"))
    context = PipelineContext(
        job_id=42,
        project_id=7,
        chapter_id=9,
        media_plan_id="plan-3",
        render_fingerprint="fingerprint-4",
        artifact_id="artifact-5",
    )

    with caplog.at_level(logging.INFO, logger="test.pipeline"):
        metrics.observe("render_duration", 1.25, context, unit="seconds")

    assert "name=render_duration" in caplog.text
    assert "jobId=42" in caplog.text
    assert "projectId=7" in caplog.text
    assert "chapterId=9" in caplog.text
    assert "mediaPlanId=plan-3" in caplog.text
    assert "renderFingerprint=fingerprint-4" in caplog.text
    assert "artifactId=artifact-5" in caplog.text
