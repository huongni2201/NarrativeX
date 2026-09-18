# Remote GPU Runtime Deployment (Windows RTX 3090)

This directory provides the production deployment package for running the NarrativeX GPU execution plane (`generation-service`) on a leased or dedicated **Windows RTX 3090** (24GB VRAM) machine (e.g. Vast.ai, RunPod, TensorDock, or bare-metal Windows server).

---

## 1. Architecture Scope & Constraints

Under **ADR-0018**, **ADR-0019**, and **ADR-0023**:
- **Workloads Hosted on GPU Node**:
  1. **VieNeu TTS** (`audio.synthesize`): Fast Vietnamese text-to-speech generating 48kHz mono signed 16-bit PCM WAV.
  2. **WhisperX** (`audio.align`): Forced audio alignment using `faster-whisper-large-v3` against exact synthesized WAV.
  3. **ComfyUI** (`image.generate`): RealVisXL v5.0 Lightning photorealistic image generation.
  4. **Media Validation** (`media.validate`): File format and audio header validation.
- **Strict Exclusions**:
  - **No Database**: This worker has no connection or access to PostgreSQL.
  - **No Chapter Analysis / Text Generation**: Spring Boot handles chapter analysis directly with Google Vertex AI Gemini 3.8 Flash.
  - **No Video Generation**: Video generation (`video.generate`, Wan, HunyuanVideo) is deferred/planned.
  - **Mutual Exclusion**: Only one heavy model runtime is resident in GPU VRAM at any time (enforced by `GpuResidencyManager` and `RuntimeProcessSupervisor`).

---

## 2. Quick Setup on Leased RTX 3090 Windows Node

### Step 1: Clone or Copy the Repository
```powershell
git clone https://github.com/huongni2201/NarrativeX.git C:\NarrativeX
cd C:\NarrativeX\deploy\remote-gpu-windows
```

### Step 2: Run Automated Bootstrap
```powershell
.\bootstrap.ps1
```
The bootstrap script will automatically:
1. Verify `nvidia-smi` and confirm RTX 3090 (>= 24GB VRAM).
2. Detect the drive with greatest free space and set up `C:\NarrativeXRuntime`.
3. Install standalone `uv` package manager.
4. Install Python 3.12 and PyTorch 2.5.1 with CUDA 12.4 wheels.
5. Install `app/generation-service`.
6. Generate a secure `GENERATION_SERVICE_MACHINE_TOKEN` and write `C:\NarrativeXRuntime\.env`.

### Step 3: Start the Worker
```powershell
.\start.ps1
```
The worker will start in the background on port `8010`. Logs are written to `C:\NarrativeXRuntime\logs\worker.log`.

### Step 4: Verify Health & Capabilities
```powershell
.\healthcheck.ps1
```

---

## 3. Remote Access / Tunneling

To connect your local NarrativeX Desktop / Spring Boot control plane to the remote GPU worker:

### Option A: Cloudflare Tunnel (Recommended)
```powershell
cloudflared tunnel --url http://127.0.0.1:8010
```

### Option B: Tailscale
Install Tailscale on the remote machine and connect directly via its MagicDNS hostname / IP:
```text
http://<tailscale-ip>:8010
```

---

## 4. Operational Scripts

| Script | Purpose |
|---|---|
| `bootstrap.ps1` | Fresh machine automated setup (Python 3.12, CUDA 12.4, runtimes, config) |
| `start.ps1` | Start worker in background (or `-Foreground` for interactive debug) |
| `stop.ps1` | Cleanly terminate worker |
| `drain.ps1` | Drain active tasks before host deallocation or maintenance |
| `healthcheck.ps1` | Inspect VRAM, GPU temperature, and worker `/v1/capabilities` |
| `runtime.lock.json` | Pinned software versions (PyTorch cu124, Python 3.12, etc.) |
| `models.lock.json` | Pinned model weights (RealVisXL, VieNeu, WhisperX) |
