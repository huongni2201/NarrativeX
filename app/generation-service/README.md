# NarrativeX GPU worker

`gpu-worker` is the domain-agnostic compute execution plane. It accepts versioned compute tasks,
runs registered executor adapters, stages artifacts, and reports execution observations.

It deliberately has no NarrativeX database connection, business aggregate, project workspace, or
job orchestration. See `../../documentation/COMPUTE_PROTOCOL.md` and
`../../contracts/compute/v1/openapi.yaml`.

## Development

```powershell
python -m pip install -e ".[dev]"
python -m pytest
python -m ruff check .
python -m mypy src
```

Set `GPU_WORKER_MACHINE_TOKEN` to a non-empty machine credential and run:

```powershell
python -m narrativex_gpu_worker
```

No executor is production-ready in the initial scaffold. Executor adapters are registered during
their vertical-slice migrations.

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

Provider, runtime and model revisions are selected at the adapter boundary through
`ExecutorCatalogPort`. The application service only sees the executor port, so replacing a
provider or runtime does not change lifecycle, replay, recovery or HTTP code. The old
`domain.models` and `runtime` modules remain import-compatible shims while vertical slices migrate;
there is intentionally no top-level `executors` package. New code should import from `contracts`,
`application`, and `adapters`.
