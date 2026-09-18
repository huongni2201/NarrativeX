# NarrativeX Generation Service Codebase

## Runtime

- Location: `app/generation-service`.
- Runtime: Python 3.12+, FastAPI 0.141.1, Uvicorn, HTTPX, Pydantic 2.13.5.
- Persistence: SQLite3 local execution journal (`.runtime/execution_journal.sqlite3`).
- Role: Domain-agnostic compute execution plane consuming Compute Protocol v1 tasks from `backend-service`.
- Architecture: Hexagonal Architecture (Ports and Adapters) with Light DDD (ADR-0028, ADR-0029).

## Boundary Rules

- **Zero NarrativeX Business Database Access:** Does not connect to PostgreSQL, has no `DATABASE_URL`, and does not access business tables.
- **Zero Domain Model Knowledge:** Does not know about Projects, Chapters, Scenes, VisualBeats, or Storyboards. Tasks are closed self-contained specifications defined in `contracts/compute/v1/`.
- **Local Lifecycle Only:** Owns execution lifecycle local to the compute host; domain transitions remain strictly owned by `backend-service`.

## Structure

```text
app/generation-service/
  src/
    narrativex_gpu_worker/ (or narrativex_generation_service)
      application/
        ports/
          execution.py       # ExecutorPort, ExecutionContext, ExecutionOutput
          executors.py       # ExecutorCatalogPort
          journal.py         # ExecutionJournalPort
          artifacts.py       # ArtifactAccessPort
          residency.py       # RuntimeResidencyPort, RuntimeFamily, RuntimeRequirement
        services/
          execution.py       # ExecutionApplicationService (checkpoint & dispatch)
      domain/
        submission.py        # SubmissionState (NOT_SUBMITTED, SUBMITTING, SUBMITTED, UNKNOWN)
        task.py              # Task lifecycle state and error representations
      adapters/
        inbound/
          http/              # FastAPI application, routes (/v1/tasks/submit, /health)
        persistence/
          sqlite_execution_journal.py # SQLite journal implementation (ADR-0031)
        runtime/
          manager.py         # GpuResidencyManager (host-level VRAM mutual exclusion)
        executors/
          catalog.py         # Dynamic executor catalog
          vieneu/            # VieNeu TTS executor adapter
          whisperx/          # local WhisperX forced-alignment adapter
          comfyui/           # ComfyUI (RealVisXL / Wan2.1) image & video generation adapter
          media_validation/  # Domain-neutral media validation adapter
        artifacts/
          http.py            # HTTP capability artifact download and upload
  tests/                     # Unit, contract, and adapter integration tests
  pyproject.toml
  Dockerfile
  README.md
```

## Durable Checkpointing & Recovery (ADR-0031)

To prevent blind resubmission and double-execution on external AI engines:

1. `NOT_SUBMITTED`: Task accepted by generation-service, recorded in SQLite journal before external call.
2. `SUBMITTING`: Immediate intent to call external engine written to SQLite journal.
3. `SUBMITTED`: Engine returned an external handle; saved in SQLite journal.
4. `UNKNOWN`: Engine timeout, network drop, or crash during submission. Reconciled before retry.
5. On crash recovery during startup, all unfinished attempts in SQLite journal are reconciled or aborted safely.

## GPU Model Residency & Mutual Exclusion (ADR-0033)

In single-GPU host deployments (such as remote RTX 3090 with 24GB VRAM):
- `GpuResidencyManager` arbitrates exclusive access between heavy model runtimes (`COMFYUI_VIDEO`, `COMFYUI_IMAGE`, `VIENEU`, `WHISPERX`).
- Concurrent leases are allowed within non-exclusive families; family transitions require full active lease drainage.
- Transitions enforce strict timeouts with fail-closed poisoning: if an unloader hangs or VRAM is not reclaimed, the manager poisons itself to prevent cascading host OOM errors.

## Supported Task Types (Compute Protocol v1)

- `audio.synthesize`: VieNeu segment TTS synthesis (`task-audio-synthesize.json`).
- `audio.align`: WhisperX forced alignment (`task-audio-align.json`). The adapter aligns the known script against the exact WAV input, emits deterministic UTF-16 source offsets plus measured millisecond word ranges, caches the align model per language, and fails closed instead of inventing proportional timing when tokens/timestamps cannot be reconciled.
- `image.generate`: ComfyUI RealVisXL image generation (`task-image-generate.json`).
- `video.generate`: ComfyUI Wan2.1 reference-conditioned short video clip generation (silent stems, ADR-0033).
- `media.validate`: Domain-neutral media integrity validation (`task-media-validate.json`).
