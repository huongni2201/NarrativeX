# Remote GPU Runtime Architecture & Operations (RTX 3090)

## Overview

NarrativeX employs an asynchronous, domain-neutral GPU execution plane (`app/generation-service`) that can run locally on an authoring workstation (e.g. RTX 4060) or remotely on a dedicated machine equipped with a high-VRAM GPU (NVIDIA GeForce RTX 3090 24GB).

This document outlines the architecture, resource boundaries, residency rules, and deployment procedures for the remote GPU runtime.

---

## 1. Architectural Boundaries

Per **ADR-0028**, **ADR-0029**, and **ADR-0033**:
1. **Domain-Neutral Execution:**
   The remote worker exposes the Compute Protocol v1 HTTP interface (`/v1/tasks`, `/v1/capabilities`, `/health`). It never connects to PostgreSQL, has no knowledge of business entities (`projects`, `chapters`, `scenes`), and receives only self-contained task inputs and capability-scoped artifact URLs.
2. **Control Plane Independence:**
   Spring Boot (`app/backend-service`) acts as the exclusive control plane. It coordinates task admission, persistence, retry/recovery, and artifact storage. The remote GPU node is completely decoupled from the application database.
3. **Desktop Render Master:**
   Desktop (`app/desktop` Electron + FFmpeg) remains the sole compositor and final render master. The GPU server yields isolated video clips or audio stems; it never produces final mixed project MP4s.

---

## 2. Hardware Constraints & Residency Model (RTX 3090 24GB)

An NVIDIA RTX 3090 provides 24,576 MiB of VRAM. Concurrently loading multiple state-of-the-art generative models will exceed this capacity:

| Generative Workload | Engine / Model | Approx. VRAM Footprint |
| :--- | :--- | :--- |
| **Text Generation** | Out of scope (managed directly via Vertex AI Gemini 3.8 Flash) | N/A – 12GB |
| **Image Generation** | SDXL / FLUX.1-schnell (NF4 / FP8) | 12GB – 16GB |
| **Speech Generation** | VieNeu (`vieneu-v3-turbo`) | 4GB – 8GB |
| **Audio Alignment** | WhisperX (wav2vec2 + alignment) | 3GB – 5GB |
| **Video Generation** | Wan 2.1 14B (Quantized GGUF/NF4) | 16GB – 22GB |

### Sequential Residency Rule
To prevent out-of-memory (OOM) faults:
- The GPU service implements `RuntimeResidencyPort` and `GpuResidencyManager`.
- Only **one** runtime family (`VIENEU`, `COMFYUI_IMAGE`, `WHISPERX`, `COMFYUI_VIDEO`) may actively occupy GPU resources at any instant.
- Switching between runtime families is an atomic, fail-closed operation:
  1. The running runtime process is unloaded or gracefully terminated.
  2. The system polls host and PyTorch/CUDA memory metrics until VRAM is freed below the idle threshold (< 1.5GB).
  3. If VRAM is not reclaimed within the transition timeout (default: 30s), the transition **fails closed**, marking the GPU node unhealthy to prevent conflicting allocations.
  4. The incoming runtime family is initialized.

---

## 3. Deployment Topology

The remote GPU node runs only Docker with the NVIDIA Container Toolkit.

```
+----------------------------------------------------------------+
|                 Remote Worker Host (Ubuntu 22.04 / 24.04)     |
|                                                                |
|  +----------------------------------------------------------+  |
|  | Container: generation-service                            |  |
|  |                                                          |  |
|  | - FastAPI HTTP server (:8000)                            |  |
|  | - Compute Protocol v1 dispatcher                         |  |
|  | - GpuResidencyManager (RuntimeResidencyPort)             |  |
|  | - Task Executors:                                        |  |
|  |     * (Text Gen handled by Spring Boot Vertex Gemini)    |  |
|  |     * VieNeu TTS Executor                                |  |
|  |     * WhisperX Alignment Executor                        |  |
|  |     * ComfyUI Image / Video Executor                     |  |
|  +----------------------------------------------------------+  |
|          |                                                     |
|          v                                                     |
|  NVIDIA Container Runtime (nvidia-smi, CUDA 12.4+)             |
|  GeForce RTX 3090 (24GB VRAM)                                  |
+----------------------------------------------------------------+
```

---

## 4. Operational Runbook

### Prerequisites
- Host OS: Ubuntu 22.04 LTS or 24.04 LTS.
- NVIDIA Driver: `>= 550.54`.
- Docker Engine `>= 26.0` with `nvidia-container-toolkit` installed and configured as the default runtime.

### Configuration
Copy `deploy/remote-gpu/.env.example` to `deploy/remote-gpu/.env` and configure:
```bash
NARRATIVEX_WORKER_PORT=8000
NARRATIVEX_WORKER_BEARER_TOKEN=<secure-shared-secret>
MODELS_CACHE_DIR=/data/models
OUTPUTS_CACHE_DIR=/data/outputs
SHM_SIZE=16g
```

### Launch
```bash
cd deploy/remote-gpu
docker compose -f docker-compose.gpu.yml up -d
```

### Health Verification
Run the verification healthcheck script:
```bash
./healthcheck.sh
```

Or run the end-to-end remote smoke verification script from the management machine:
```bash
python scripts/smoke-remote-generation-service.py --host <remote-ip> --port 8000 --token <token>
```
