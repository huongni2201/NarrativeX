FROM python:3.12-slim AS runner

WORKDIR /app

# Prevent Python from writing .pyc and buffering stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Create non-root user
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

# Install package dependencies
COPY pyproject.toml README.md ./
RUN pip install --no-cache-dir .

# Copy application source code
COPY src/ ./src/

USER appuser

CMD ["python", "-m", "narrativex_worker"]
