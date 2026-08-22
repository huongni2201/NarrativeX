FROM python:3.12-slim AS runner

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
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
RUN pip install --no-cache-dir .

USER appuser

CMD ["python", "-m", "narrativex_worker"]
