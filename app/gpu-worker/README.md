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

