# Remote GPU Runtime Architecture & Operations (RTX 3090)

## Overview

NarrativeX employs an asynchronous, domain-neutral GPU execution plane (`app/generation-service`) that can run locally on an authoring workstation or remotely on a dedicated high-VRAM machine (NVIDIA GeForce RTX 3090 24GB).

Per [ADR-0028](../decisions/ADR-0028-backend-control-plane-and-domain-agnostic-gpu-execution-plane.md), [ADR-0029](../decisions/ADR-0029-generation-service-light-ddd-hexagonal-structure.md), and [ADR-0035](../decisions/ADR-0035-vieneu-remote-gpu-media-runtime.md):
- **Domain-Neutral Execution**: The GPU worker exposes the Compute Protocol v1 HTTP interface (`/v1/tasks`, `/v1/capabilities`, `/health`). It never connects to PostgreSQL, has no knowledge of business entities (`projects`, `chapters`, `scenes`), and processes only self-contained task payloads.
- **Control Plane Independence**: Spring Boot (`app/backend-service`) acts as the exclusive control plane, coordinating admission, persistence, job recovery ([ADR-0031](../decisions/ADR-0031-submission-checkpoint-and-worker-recovery-semantics.md)), and artifact metadata.
- **Desktop Render Master**: Desktop (`app/desktop` Electron + FFmpeg) is the sole compositor and final render master. The GPU runtime produces individual audio stems and preview images; it never produces final mixed project MP4s.

---

## 1. Generative Workload Allocation

| Workload | Runtime / Engine | Execution Location | Notes |
| :--- | :--- | :--- | :--- |
| **Story / Script Analysis** | Google Vertex AI Gemini 2.5 Flash | Backend Service (`app/backend-service`) | Managed directly in Spring Boot control plane ([ADR-0034](../decisions/ADR-0034-vertex-gemini-chapter-analysis.md)). Not executed on GPU node. |
| **Speech Generation (TTS)** | VieNeu (`vieneu-v3-turbo`) | Generation Service (`app/generation-service`) | Synthesizes 48 kHz mono WAV narration ([ADR-0035](../decisions/ADR-0035-vieneu-remote-gpu-media-runtime.md)). ~4–8 GB VRAM footprint. |
| **Speech Alignment** | WhisperX | Generation Service (`app/generation-service`) | Generates phoneme/word timing alignment. ~3–5 GB VRAM footprint. |
| **Visual Beat Images** | ComfyUI (RealVisXL / SDXL) | Generation Service (`app/generation-service`) | Generates visual beat keyframe preview images. ~12–16 GB VRAM footprint. |
| **Video Generation** | Wan 2.1 / ComfyUI Video | Deferred / Not Implemented | Video generation pipeline is **DEFERRED** ([ADR-0033](../decisions/ADR-0033-reference-conditioned-gpu-video-generation.md)). Video assembly occurs locally in Electron via FFmpeg. |

---

## 2. Hardware Constraints & Residency Model (RTX 3090 24GB)

An NVIDIA RTX 3090 provides 24,576 MiB of VRAM. Concurrently loading multiple generative models exceeds capacity and causes out-of-memory (OOM) failures.

### Sequential Residency Rule
To prevent OOM faults:
- `GpuResidencyManager` implements mutual exclusion across workload domains: `audio_alignment`, `tts`, `image`, and `video`.
- Only **one** runtime family may actively occupy GPU VRAM at any instant.
- Transitioning between domains requires:
  1. Gracefully finishing active tasks in the current domain.
  2. Unloading or releasing model weights from GPU memory.
  3. Reclaiming VRAM below the idle threshold (< 1.5 GB).
  4. Initializing the target workload runtime.

> [!NOTE]
> **Implementation State**: `GpuResidencyManager` currently implements logical state mutual exclusion and transition guards. Process-level model unload probes and physical VRAM polling hooks are partially implemented and remain to be fully wired into runtime bootstrap.

---

## 3. Dynamic Worker Session & Ephemeral Disk Model

The remote GPU runtime is designed to operate on disposable or leased hardware:

1. **Dynamic Worker Endpoint**: The backend does not require a fixed IP address. The worker URL is configured dynamically via backend environment properties (`app.worker.base-url`) or dynamic session handshake.
2. **Ephemeral Disk**: Local storage on the remote GPU machine is completely ephemeral:
   - Model weights are pre-cached in designated cache directories (`MODELS_CACHE_DIR`).
   - Task inputs and outputs are staged in temporary working directories.
   - Generated artifacts are retrieved by the backend control plane and persisted to local Desktop project storage. The worker execution journal (SQLite) is discarded when the machine is reprovisioned.
3. **Capability-Based Authentication**: Requests to `/v1/*` endpoints require a Bearer token matching `NARRATIVEX_WORKER_BEARER_TOKEN`.

---

## 4. Operational Lifecycle & Health Checks

### Verification Endpoints
- `GET /health`: Returns service health and GPU status:
  ```json
  {
    "status": "healthy",
    "gpu_available": true,
    "active_domain": "tts"
  }
  ```
- `GET /v1/capabilities`: Returns registered task adapters and runtime descriptors.

### Smoke Verification
Run the verification check from the host or management machine:
```bash
python scripts/smoke-remote-generation-service.py --host <worker-host> --port 8000 --token <token>
```

---

## 5. Known Deployment Drift

> [!WARNING]
> The configuration files in `deploy/remote-gpu/docker-compose.yml` reflect an earlier Linux Docker prototype.
> The current operational target is a disposable Windows 11/Server RTX 3090 workstation running Python 3.11 with native CUDA and ComfyUI. When deploying to disposable Windows workstations, launch `app/generation-service` directly using `uvicorn app.main:app` and native ComfyUI rather than the stale Linux container compose file.
