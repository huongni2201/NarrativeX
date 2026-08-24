# syntax=docker/dockerfile:1

FROM python:3.12-slim AS runner

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# The Debian system-user default home is /nonexistent. VieNeu and Hugging Face
# resolve model/profile caches from the process home, so give the non-root worker
# an explicit writable runtime home instead.
ENV HOME=/home/appuser
ENV XDG_CACHE_HOME=/home/appuser/.cache
ENV HF_HOME=/home/appuser/.cache/huggingface

RUN addgroup --system appgroup \
    && adduser --system --home /home/appuser --ingroup appgroup appuser \
    && mkdir -p /home/appuser/.cache/huggingface /home/appuser/.config \
    && chown -R appuser:appgroup /home/appuser

COPY pyproject.toml README.md ./
COPY src/ ./src/
RUN --mount=type=cache,target=/root/.cache/pip pip install .

USER appuser

EXPOSE 8001
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=4 \
  CMD python -c "import os, urllib.request; port=os.getenv('HEALTH_CHECK_PORT', '8001'); urllib.request.urlopen(f'http://127.0.0.1:{port}/healthz', timeout=4).read()" || exit 1

CMD ["python", "-m", "narrativex_worker"]
