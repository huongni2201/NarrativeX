# syntax=docker/dockerfile:1

FROM python:3.14.7-slim

ARG BUILD_SHA=unknown
ARG GENERATION_SERVICE_EXTRAS=image,narration

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV HOME=/home/appuser
ENV XDG_CACHE_HOME=/home/appuser/.cache
ENV HF_HOME=/home/appuser/.cache/huggingface
ENV BUILD_SHA=${BUILD_SHA}

LABEL org.opencontainers.image.revision=${BUILD_SHA}

RUN addgroup --system appgroup \
    && adduser --system --home /home/appuser --ingroup appgroup appuser \
    && mkdir -p /home/appuser/.cache/huggingface /home/appuser/.config /app/.runtime \
    && chown -R appuser:appgroup /home/appuser /app/.runtime

COPY pyproject.toml README.md uv.lock* ./
COPY src/ ./src/

RUN --mount=type=cache,id=narrativex-generation-service-pip,target=/root/.cache/pip,sharing=locked \
    pip install ".[${GENERATION_SERVICE_EXTRAS}]"

USER appuser
EXPOSE 8010
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=4 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8010/healthz', timeout=4).read()" || exit 1

CMD ["python", "-m", "narrativex_gpu_worker"]
