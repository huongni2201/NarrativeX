# NarrativeX AI Worker

## Purpose
The AI Worker is responsible for asynchronous AI and media-processing workloads for NarrativeX. It executes resource-intensive tasks including story script analysis, image generation, video generation, text-to-speech synthesis, and media composition.

## Technology Stack
- **Language**: Python 3.12
- **Configuration & Validation**: Pydantic v2, Pydantic Settings
- **HTTP Client**: HTTPX
- **Code Quality**: Ruff (Linting & Formatting), Mypy (Strict Type Checking)
- **Testing**: Pytest, Pytest-asyncio
- **Packaging**: Standard `pyproject.toml` with Hatchling

## Local Prerequisites
- Python 3.12+
- Virtual environment tool (`venv` or `uv`)

## Development Commands

### Set Up Virtual Environment & Install Dependencies
```bash
# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# Unix:
source .venv/bin/activate

# Install in editable mode with development dependencies
pip install -e ".[dev]"
```

### Run Worker Locally
```bash
# Full execution
python -m narrativex_worker

# Verification / Dry run
python -m narrativex_worker --dry-run
```

### Run Tests
```bash
pytest
```

### Linting & Formatting
```bash
# Lint check
ruff check .

# Format check
ruff format --check .

# Auto-format
ruff format .
```

### Type Checking
```bash
mypy src
```

### Build & Run with Docker
```bash
# Build Docker image
docker build -t narrativex-ai-worker .

# Run container
docker run narrativex-ai-worker
```

## Application Boundaries
- **Must Own**: Asynchronous execution of AI inference, prompt processing, media synthesis, FFmpeg audio/video assembly, progress reporting back to `backend-service`.
- **Must NOT Own**: Direct user authentication/authorization, primary relational database management (managed exclusively by `backend-service`), direct browser client communication.
