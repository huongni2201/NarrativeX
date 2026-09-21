# Remote GPU Runtime Architecture & Operations (RTX 5090 / RTX 3090 Baseline)

## Overview

NarrativeX employs an asynchronous, domain-neutral GPU execution plane (`app/generation-service`) that runs on a dedicated high-performance GPU machine. The active production GPU target is the **NVIDIA GeForce RTX 5090 32GB**, with the **NVIDIA GeForce RTX 3090 24GB** retained as a benchmark and regression baseline.

Per [ADR-0018](../decisions/ADR-0018-backend-control-plane-and-domain-agnostic-gpu-execution-plane.md), [ADR-0019](../decisions/ADR-0019-generation-service-light-ddd-hexagonal-structure.md), [ADR-0023](../decisions/ADR-0023-vieneu-remote-gpu-media-runtime.md), [ADR-0025](../decisions/ADR-0025-event-driven-compute-orchestration-and-reconciliation.md), and [ADR-0026](../decisions/ADR-0026-video-first-ltx-audio-native-production-runtime.md):
- **Domain-Neutral Execution**: The GPU worker exposes the Compute Protocol v1 HTTP interface (`/v1/tasks`, `/v1/capabilities`, `/health`). It never connects to PostgreSQL, has no knowledge of business entities (`projects`, `chapters`, `scenes`), and processes only self-contained task payloads.
- **Control Plane Independence**: Spring Boot (`app/backend-service`) acts as the exclusive control plane, coordinating admission, persistence, job recovery ([ADR-0021](../decisions/ADR-0021-submission-checkpoint-and-worker-recovery-semantics.md)), and artifact metadata.
- **Desktop Render Master**: Desktop (`app/desktop` Electron + FFmpeg) is the sole compositor and final render master. The GPU runtime produces video takes and audio stems; it never produces final mixed project MP4s.
- **Event delivery**: The worker SQLite journal/outbox records transitions atomically, delivers HMAC-signed callbacks with bounded retry/backoff, and the backend applies idempotent receipts/finalization. Scheduled reconciliation is the non-blocking fallback for missed callbacks or ambiguous outcomes; Desktop receives project-scoped SSE snapshots.

---

## 1. Generative Workload Allocation

| Workload | Runtime / Engine | Execution Location | Notes |
| :--- | :--- | :--- | :--- |
| **Story / Script Analysis** | Google Vertex AI Gemini 3.8 Flash | Backend Service (`app/backend-service`) | Managed directly in Spring Boot control plane ([ADR-0022](../decisions/ADR-0022-vertex-gemini-chapter-analysis.md)) with thinking level `HIGH`. Not executed on GPU node. |
| **Video Generation** | LTX Video (`ltx-2.5-nvfp4`) | Generation Service (`app/generation-service`) | Primary generative video runtime ([ADR-0026](../decisions/ADR-0026-video-first-ltx-audio-native-production-runtime.md)). Generates moving shots with native video-conditioned audio. ~18–24 GB VRAM footprint. |
| **Speech Alignment & QC** | WhisperX | Generation Service (`app/generation-service`) | Generates phoneme/word timing alignment, automated transcription QC, and sync validation. ~3–5 GB VRAM footprint. |
| **Speech Generation (TTS)** | VieNeu (`vieneu-v3-turbo`) | Generation Service (`app/generation-service`) | Voice reference generation and narration preparation ([ADR-0023](../decisions/ADR-0023-vieneu-remote-gpu-media-runtime.md)). ~4–8 GB VRAM footprint. |
| **Visual Beat Keyframes** | ComfyUI (RealVisXL / SDXL) | Generation Service (`app/generation-service`) | Secondary keyframe, poster, and visual reference generation. ~12–16 GB VRAM footprint. |

---

## 2. Hardware Constraints & Residency Model (RTX 5090 32GB Target)

The active production target is the **NVIDIA GeForce RTX 5090 (32GB VRAM)**, providing high-bandwidth memory for NVFP4 quantized LTX models and native CUDA 13.0 operations. The **NVIDIA GeForce RTX 3090 (24GB VRAM)** is maintained as a historical benchmark baseline.

### Sequential Residency Rule
To prevent out-of-memory (OOM) faults across heavy generative models:
- `GpuResidencyManager` implements mutual exclusion across workload domains: `video_generation`, `audio_alignment`, `tts`, and `image`.
- Only **one** runtime family may actively occupy GPU VRAM at any instant.
- Transitioning between domains requires:
  1. Gracefully finishing active tasks in the current domain.
  2. Unloading model weights and freeing caches via PyTorch and runtime hooks.
  3. Reclaiming VRAM below the idle threshold (< 2.0 GB).
  4. Initializing the target workload runtime.

---

## 3. Dynamic Worker Session & Ephemeral Disk Model

The remote GPU runtime operates on disposable or dedicated hardware:

1. **Dynamic Worker Endpoint**: The backend does not require a fixed IP address. The worker URL is configured dynamically via backend environment properties (`NARRATIVEX_COMPUTE_BASE_URL`) or dynamic session handshake.
2. **Ephemeral Disk**: Local storage on the remote GPU machine is completely ephemeral:
   - Model weights are pre-cached in designated cache directories (`MODELS_CACHE_DIR`).
   - Task inputs and outputs are staged in temporary working directories.
   - Generated artifacts are retrieved by the backend control plane and persisted to local Desktop project storage. The worker execution journal (SQLite) is discarded when the machine is reprovisioned.
3. **Capability-Based Authentication**: Requests to `/v1/*` endpoints require a Bearer token matching `NARRATIVEX_COMPUTE_MACHINE_TOKEN` (or `GENERATION_SERVICE_MACHINE_TOKEN`).

---

## 4. Operational Lifecycle & Health Checks

### Verification Endpoints
- `GET /health`: Returns service health and GPU status:
  ```json
  {
    "status": "healthy",
    "gpu_available": true,
    "active_domain": "video_generation"
  }
  ```
- `GET /v1/capabilities`: Returns registered task adapters (`video.generate`, `audio.align`, `audio.synthesize`, `image.generate`) and runtime descriptors.

### Smoke Verification
Run the verification check from the host or management machine:
```bash
python scripts/smoke-remote-generation-service.py --host <worker-host> --port 8010 --token <token>
```

---

## 5. Deployment Target

The operational deployment target is a Windows 11/Server machine with an NVIDIA GeForce RTX 5090 (or RTX 3090 baseline) running Python 3.14.x with native CUDA, PyTorch, LTX Video, WhisperX, VieNeu, and ComfyUI. Launch `app/generation-service` directly using `uv run narrativex-gpu-worker` or native PowerShell service wrappers via `deploy/remote-gpu-windows/bootstrap.ps1`.
