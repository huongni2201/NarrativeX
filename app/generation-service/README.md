# NarrativeX Generation Service

`generation-service` is the domain-agnostic compute execution plane. It accepts versioned compute tasks, runs registered executor adapters, stages artifacts, and reports execution observations. Its SQLite execution journal and `compute_event_outbox` durably record state transitions before asynchronous signed callback delivery.

It deliberately has no NarrativeX database connection, business aggregate, project workspace, or job orchestration. Outbox delivery uses bounded retry/backoff and never changes a terminal execution state merely because callback delivery failed. See `../../documentation/COMPUTE_PROTOCOL.md` and `../../contracts/compute/v1/openapi.yaml`.

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

The production bootstrap registers ComfyUI (`image.generate`), LTX Video (`video.generate`),
VieNeu (`audio.synthesize`), WhisperX (`audio.align`), and media validation (`media.validate`). Capability
readiness is advertised per adapter. LTX remains `ready=false` until its pinned native AV
runtime/model/schema preflight passes; a configured ComfyUI URL is insufficient. Managed
ComfyUI starts before initial preflight. Capability reads retry failed preflight at most once
every five seconds, without submitting generation work. Other
endpoint-backed adapters require a configured endpoint, and WhisperX requires the optional local dependency.
The service starts with unavailable optional capabilities marked `ready=false`; the backend must
not dispatch a task until its advertised executor is ready.

Successful static model verification is retained for readiness recovery; capability probes
bound the remote schema read to five seconds and do not rehash model files. Static pin
failures require repair followed by explicit preflight or worker restart.

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
  persistence/  SQLite execution-journal and event-outbox adapter
  artifacts/    capability-based HTTP artifact adapter
  runtime/      host-level GPU model residency manager (GpuResidencyManager)
bootstrap.py    composition root; the only place that wires concrete adapters
```

## GPU Model Residency & Mutual Exclusion

In resource-constrained GPU host environments (NVIDIA GeForce RTX 5090 32GB target; RTX 3090 24GB baseline running LTX Video / ComfyUI / VieNeu / WhisperX), `GpuResidencyManager` provides:
- Strict logical mutual exclusion between generative runtime families (`LTX_VIDEO`, `COMFYUI_IMAGE`, `VIENEU`, `WHISPERX`).
- Automatic draining of in-flight leases before transitioning runtime families.
- Lifecycle management via `RuntimeProcessSupervisor`, loader/unloader lifecycle hooks, and `GpuVramProbe` wired into `bootstrap.py`; runtime process commands can be configured via environment settings. Production strictness hardening and full Windows worker validation remain in progress.
- Timeout-bounded fail-closed transitions: if a transition exceeds `GENERATION_SERVICE_RESIDENCY_TIMEOUT_SECONDS`, the residency manager enters a poisoned state to prevent cascading host crashes.
- Configurable via `GENERATION_SERVICE_RESIDENCY_ENABLED=true` (enabled by default).

WhisperX owns local inference until its actual thread finishes, including after timeout or
awaiter cancellation. Worker capacity and the GPU lease remain held during that interval;
a hung inference therefore keeps the worker unavailable. Same-family work reuses cached
alignment models. Family transitions await inference, clear those references, collect them,
and release the CUDA allocator cache through the client that owns the models.

Managed process stdout/stderr are drained continuously with a 64 KiB retained tail per stream.
Startup failures execute shutdown cleanup, including processes and shared HTTP resources.
These lifecycle tests do not establish production VRAM reclamation or GPU throughput.

LTX output requires `ffprobe` and `ffmpeg` on the worker PATH. Before artifact upload, the
worker inspects the actual video stream duration, dimensions and frame rate, requires native
audio, and fully decodes both streams. Produced artifact `technicalMetadata` contains the
observed values and decode outcome; requested generation duration is not source duration.
This technical validation does not establish dialogue accuracy or perceptual video quality.

Provider, runtime and model revisions are selected at the adapter boundary through `ExecutorCatalogPort`. The application service only sees the executor port, so replacing a provider or runtime does not change lifecycle, replay, recovery or HTTP code. All code strictly imports from `contracts`, `domain`, `application`, and `adapters`.
