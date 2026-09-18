#!/usr/bin/env bash
set -euo pipefail

echo "=== Checking NVIDIA Driver and Hardware ==="
if ! command -v nvidia-smi &> /dev/null; then
    echo "ERROR: nvidia-smi not found. NVIDIA driver must be installed on host."
    exit 1
fi

GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader | head -n 1)
TOTAL_VRAM=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader | head -n 1)
FREE_VRAM=$(nvidia-smi --query-gpu=memory.free --format=csv,noheader | head -n 1)

echo "Detected GPU: $GPU_NAME"
echo "Total VRAM:   $TOTAL_VRAM"
echo "Free VRAM:    $FREE_VRAM"

echo ""
echo "=== Checking Docker Container Status ==="
CONTAINER_NAME="narrativex-gpu-generation-service"
if ! docker ps --filter "name=$CONTAINER_NAME" --format '{{.Names}}' | grep -q "$CONTAINER_NAME"; then
    echo "WARNING: Container $CONTAINER_NAME is not currently running."
else
    CONTAINER_STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo "running")
    echo "Container status: $CONTAINER_STATUS"
fi

echo ""
echo "=== Checking HTTP Health Endpoint ==="
PORT="${NARRATIVEX_WORKER_PORT:-8000}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT}/health" || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    echo "Health endpoint: OK (HTTP 200)"
    echo "=== System Ready for Compute Protocol v1 Workloads ==="
    exit 0
else
    echo "ERROR: Health endpoint returned HTTP $HTTP_CODE"
    exit 1
fi
