"""Small dependency-free pipeline metrics and correlation helpers.

The worker emits one structured metric line per observation so the same fields
can be indexed by the log collector until a metrics exporter is introduced.
"""

import logging
import time
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class PipelineContext:
    job_id: str | int | UUID | None = None
    project_id: str | int | UUID | None = None
    chapter_id: str | int | UUID | None = None
    media_plan_id: str | None = None
    render_fingerprint: str | None = None
    artifact_id: str | int | UUID | None = None

    def fields(self) -> dict[str, str | int | UUID]:
        return {
            key: value
            for key, value in {
                "jobId": self.job_id,
                "projectId": self.project_id,
                "chapterId": self.chapter_id,
                "mediaPlanId": self.media_plan_id,
                "renderFingerprint": self.render_fingerprint,
                "artifactId": self.artifact_id,
            }.items()
            if value is not None
        }


class PipelineMetrics:
    def __init__(self, logger: logging.Logger) -> None:
        self.logger = logger

    def duration(self, name: str, started_at: float, context: PipelineContext) -> None:
        self.observe(name, time.monotonic() - started_at, context, unit="seconds")

    def observe(
        self,
        name: str,
        value: float | int,
        context: PipelineContext,
        *,
        unit: str,
    ) -> None:
        fields = " ".join(f"{key}={value}" for key, value in context.fields().items())
        self.logger.info(
            "pipeline_metric name=%s value=%s unit=%s%s",
            name,
            value,
            unit,
            f" {fields}" if fields else "",
        )

    @contextmanager
    def measure(self, name: str, context: PipelineContext) -> Iterator[None]:
        started_at = time.monotonic()
        try:
            yield
        finally:
            self.duration(name, started_at, context)
