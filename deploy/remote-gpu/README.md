# Remote GPU Runtime Deployment (RTX 3090)

This directory provides the standalone deployment configuration for running the NarrativeX GPU execution plane (`generation-service`) on a remote machine equipped with an NVIDIA RTX 3090 (24GB VRAM).

## Prerequisites

1. **Host OS:** Ubuntu 22.04 LTS or Ubuntu 24.04 LTS (x86_64).
2. **NVIDIA Driver:** Version `>= 550.54` (`nvidia-smi` must work on the host).
3. **Docker Engine & NVIDIA Container Toolkit:**
   ```bash
   # Install NVIDIA Container Toolkit
   curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
   curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
     sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
     sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
   sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
   sudo nvidia-ctk runtime configure --runtime=docker
   sudo systemctl restart docker
   ```

## Quick Start

1. **Configure Environment:**
   ```bash
   cp .env.example .env
   # Edit .env to set your NARRATIVEX_WORKER_BEARER_TOKEN and local mount paths
   ```

2. **Start the Service:**
   ```bash
   docker compose -f docker-compose.gpu.yml up -d
   ```

3. **Verify Health:**
   ```bash
   ./healthcheck.sh
   ```

4. **Verify Remote Connection via Smoke Test:**
   From your local development machine:
   ```bash
   python scripts/smoke-remote-generation-service.py --host <REMOTE_IP> --port 8000 --token <YOUR_TOKEN>
   ```

## Architecture Invariants

- **No Database:** This node does not host or connect to PostgreSQL.
- **No Business IDs:** All payloads are domain-neutral `ComputeTask` objects.
- **Desktop Compositing:** Electron + FFmpeg on Desktop retains exclusive responsibility for rendering final project MP4s.
