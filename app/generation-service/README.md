# NarrativeX Generation Service

`generation-service` is the domain-agnostic compute execution plane. It accepts versioned compute tasks, runs registered executor adapters, stages artifacts, and reports execution observations.

It deliberately has no NarrativeX database connection, business aggregate, project workspace, or job orchestration. See `../../documentation/COMPUTE_PROTOCOL.md` and `../../contracts/compute/v1/openapi.yaml`.

## Development

```powershell
python -m pip install -e ".[dev]"
python -m pytest
python -m ruff check .
python -m mypy src
```

Set `GENERATION_SERVICE_MACHINE_TOKEN` to a non-empty machine credential and run:

```powershell
python -m narrativex_gpu_worker
```

The production bootstrap registers Qwen (`text.generate`), ComfyUI (`image.generate`), VoiceStudio
(`audio.synthesize`), WhisperX (`audio.align`), and media validation (`media.validate`). Capability
readiness is advertised per adapter: endpoint-backed adapters require a configured endpoint, the
VoiceStudio adapter also requires its API key, and WhisperX requires the optional local dependency.
The service starts with unavailable optional capabilities marked `ready=false`; the backend must
not dispatch a task until its advertised executor is ready.

Canonical runtime environment names use the `GENERATION_SERVICE_*` namespace. The service accepts
only protocol tasks and opaque artifact capabilities; it has no PostgreSQL, R2, project-media, or
business-state configuration. Its durable execution journal is the SQLite file configured by
`GENERATION_SERVICE_JOURNAL_FILE`.

## Structure

The service uses light DDD with Hexagonal boundaries:

```text
contracts/       Compute Protocol v1 wire schemas and canonical fingerprinting
domain/          execution-attempt lifecycle aggregate; no framework/provider imports
application/     execution use case plus driven ports
adapters/
  inbound/http/  FastAPI transport and authentication
  executors/    model/provider capability registry and executor adapters
  persistence/  SQLite execution-journal adapter
  artifacts/    capability-based HTTP artifact adapter
bootstrap.py    composition root; the only place that wires concrete adapters
```

Provider, runtime and model revisions are selected at the adapter boundary through `ExecutorCatalogPort`. The application service only sees the executor port, so replacing a provider or runtime does not change lifecycle, replay, recovery or HTTP code. All code strictly imports from `contracts`, `domain`, `application`, and `adapters`.
