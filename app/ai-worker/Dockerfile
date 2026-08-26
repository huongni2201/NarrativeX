# syntax=docker/dockerfile:1

FROM python:3.12-slim AS base

ARG BUILD_SHA=unknown

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV HOME=/home/appuser
ENV XDG_CACHE_HOME=/home/appuser/.cache
ENV HF_HOME=/home/appuser/.cache/huggingface
ENV PIP_CACHE_DIR=/home/appuser/.cache/pip
ENV BUILD_SHA=${BUILD_SHA}

LABEL org.opencontainers.image.revision=${BUILD_SHA}

RUN addgroup --system appgroup \
    && adduser --system --home /home/appuser --ingroup appgroup appuser \
    && mkdir -p /home/appuser/.cache/huggingface /home/appuser/.config \
    && chown -R appuser:appgroup /home/appuser

COPY pyproject.toml README.md ./
COPY src/narrativex_worker/__init__.py ./src/narrativex_worker/__init__.py

EXPOSE 8001
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=4 \
  CMD python -c "import os, urllib.request; port=os.getenv('HEALTH_CHECK_PORT', '8001'); urllib.request.urlopen(f'http://127.0.0.1:{port}/healthz', timeout=4).read()" || exit 1

CMD ["python", "-m", "narrativex_worker"]

FROM base AS worker-core

RUN --mount=type=cache,id=narrativex-pip,target=/home/appuser/.cache/pip,sharing=locked \
    pip install .
COPY src/ ./src/
RUN --mount=type=cache,id=narrativex-pip,target=/home/appuser/.cache/pip,sharing=locked \
    pip install --no-deps .
USER appuser

FROM base AS media-base

RUN sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

FROM media-base AS worker-image

RUN --mount=type=cache,id=narrativex-pip,target=/home/appuser/.cache/pip,sharing=locked \
    pip install ".[image]"
COPY src/ ./src/
RUN --mount=type=cache,id=narrativex-pip,target=/home/appuser/.cache/pip,sharing=locked \
    pip install --no-deps .
USER appuser

FROM media-base AS worker-narration

RUN --mount=type=cache,id=narrativex-pip,target=/home/appuser/.cache/pip,sharing=locked \
    pip install ".[narration]"
COPY src/ ./src/
RUN --mount=type=cache,id=narrativex-pip,target=/home/appuser/.cache/pip,sharing=locked \
    pip install --no-deps .
USER appuser

FROM worker-image AS default
