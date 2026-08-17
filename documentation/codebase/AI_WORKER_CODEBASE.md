# AI Worker Codebase and Execution Contract

## Current implementation

`app/ai-worker` is a Python 3.12 package built with Hatchling. Dependencies currently include Pydantic v2, Pydantic Settings and HTTPX; development tooling includes Pytest, Ruff and strict Mypy.

- `src/narrativex_worker/config.py`: environment-backed `WorkerSettings` (`worker_name`, `worker_env`, `log_level`, `backend_url`, health port).
- `src/narrativex_worker/worker.py`: lifecycle runner, logging and graceful signal/cancellation handling; `start(dry_run=True)` exits without processing.
- `src/narrativex_worker/schema.py`: typed resource classes, v1.7 chapter job types, image settings, moderation decisions, rights-policy metadata, story-analysis request and provider-operation states.
- `src/narrativex_worker/prompting.py`: deterministic prompt construction with an explicit untrusted-story boundary.
- `src/narrativex_worker/providers/ports.py`: provider port and operation contract; `disabled.py` is the safe non-production adapter.
- `src/narrativex_worker/service.py`: provider-backed service façade that requires rights attestation before story analysis.
- `src/narrativex_worker/__main__.py`: CLI entry point.
- `tests/test_worker.py`: settings, dry-run and stop behavior.

There is currently no durable queue consumer, real provider SDK, object-storage client or media pipeline. The current provider façade is intentionally adapter-owned and non-production. The README describes the intended boundary, not current feature completeness.

## Target package shape

```text
src/narrativex_worker/
├── contract/       # backend API DTOs, stage claims, heartbeat/results
├── execution/      # lease-safe dispatcher and job handlers
├── providers/
│   ├── llm/        # VertexGeminiProvider
│   ├── image/      # image capability adapters
│   ├── video/      # VertexVeoProvider, KlingProvider, future adapters
│   └── tts/        # narration adapter
├── safety/         # prompt boundary, schema/output checks, moderation mapping
├── identity/       # reference snapshots and Identity QA
├── media/          # Pillow/OpenCV, crop/reframe, audio/subtitle helpers
├── ffmpeg/         # scene/final render, ffprobe and atomic promotion
├── storage/        # MinIO/S3-compatible temporary and immutable object contract
├── metering/       # resource usage and provider cost evidence
└── config.py / worker.py / __main__.py
```

## Stage execution contract

1. Poll/recover a backend-issued delivery hint, then claim a `StageAttempt` by durable ID and lease token.
2. Heartbeat at the configured interval (baseline 30 seconds; lease around 120 seconds).
3. Load immutable snapshots: workflow version, model/provider, prompt, character/location/style references, output profile and operation budget.
4. Before external submission, ask the backend to persist/confirm the `ProviderOperation` reservation and pass rate/circuit/resource/budget guards.
5. Execute through a provider port or deterministic local handler. All story text is explicitly untrusted data; structured schemas and allowlists prevent model output from authorizing arbitrary tools/jobs/keys.
6. On ambiguous timeout, report `UNKNOWN` and evidence. Reconcile before retrying; never “retry until it works” against a possibly submitted operation.
7. Write temp output, validate MIME/codec/dimensions/duration/checksum, promote immutable storage, and report asset metadata.
8. Report usage (`gpu_seconds`, `cpu_seconds`, storage/egress, provider/internal/billable cost) and terminal stage state to the backend.

## Provider ports

The worker must keep vendor SDKs inside adapters. `VertexGeminiProvider` handles planning/intelligence via Vertex AI and ADC/workload identity. Image and video are independent ports; Veo/Kling produce selected-beat `MotionAsset` outputs and do not replace the image-first pipeline.

## Safety, privacy and secrets

Provider credentials are runtime-only. Real-person references require consent/use-right basis; identity templates/embeddings are private, tenant-isolated, excluded from logs/public manifests and deleted/expired by lifecycle policy. Input and output moderation decisions are mapped to application `SAFE`, `REVIEW` or `BLOCK`; hard blocks fail closed.

## Scaling and recovery

CPU provider orchestration and FFmpeg queues scale independently. Optional GPU workers use a lease/resource class with one heavy workflow per GPU by default. A worker restart cannot lose PostgreSQL state. Redis loss triggers PostgreSQL/outbox recovery. Stalled local stages may retry; stalled submitted external stages reconcile.
