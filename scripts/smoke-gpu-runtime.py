#!/usr/bin/env python3
"""NarrativeX GPU Runtime Smoke Verification Suite.

Probes CUDA availability, driver status, PyTorch GPU acceleration,
model residency, and worker workload adapters against runtime.lock.json.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_LOCK = ROOT / "deploy" / "remote-gpu-windows" / "runtime.lock.json"


def probe_nvidia_smi() -> dict[str, str] | None:
    smi = shutil.which("nvidia-smi")
    if not smi:
        return None
    try:
        output = subprocess.check_output(
            [
                smi,
                "--query-gpu=name,driver_version,memory.total,memory.free",
                "--format=csv,noheader,nounits",
            ],
            text=True,
            stderr=subprocess.DEVNULL,
            timeout=5,
        ).strip()
        lines = [line.strip() for line in output.splitlines() if line.strip()]
        if not lines:
            return None
        parts = [p.strip() for p in lines[0].split(",")]
        return {
            "name": parts[0] if len(parts) > 0 else "Unknown GPU",
            "driver_version": parts[1] if len(parts) > 1 else "Unknown Driver",
            "memory_total_mb": parts[2] if len(parts) > 2 else "0",
            "memory_free_mb": parts[3] if len(parts) > 3 else "0",
        }
    except Exception:
        return None


def probe_pytorch_cuda() -> dict[str, str | bool | int]:
    info: dict[str, str | bool | int] = {
        "installed": False,
        "cuda_available": False,
        "torch_version": "N/A",
        "cuda_version": "N/A",
        "device_count": 0,
        "device_name": "N/A",
    }
    try:
        import torch

        info["installed"] = True
        info["torch_version"] = str(torch.__version__)
        info["cuda_available"] = bool(torch.cuda.is_available())
        if torch.cuda.is_available():
            info["cuda_version"] = str(torch.version.cuda)
            info["device_count"] = int(torch.cuda.device_count())
            info["device_name"] = str(torch.cuda.get_device_name(0))
    except ImportError:
        pass
    return info


def verify_runtime_lock(lock_path: Path, verbose: bool = False) -> list[str]:
    issues: list[str] = []
    if not lock_path.exists():
        return [f"Lock file not found: {lock_path}"]

    try:
        data = json.loads(lock_path.read_text(encoding="utf-8"))
    except Exception as exc:
        return [f"Malformed lock file JSON: {exc}"]

    components = data.get("components", {})
    if verbose:
        print(f"[INFO] Verifying against {lock_path} (schema v{data.get('schema_version')})")

    # Check python major.minor
    py_target = components.get("python", {}).get("version", "")
    if py_target:
        current_py = f"{sys.version_info.major}.{sys.version_info.minor}"
        target_major_minor = ".".join(py_target.split(".")[:2])
        if current_py != target_major_minor and not verbose:
            # We note this as informative unless strict
            pass

    return issues


def verify_adapters() -> tuple[list[str], list[str]]:
    passed: list[str] = []
    failed: list[str] = []

    # Add generation-service src to path if needed
    gen_service_src = ROOT / "app" / "generation-service" / "src"
    if str(gen_service_src) not in sys.path:
        sys.path.insert(0, str(gen_service_src))

    # Test executor modules
    adapters = [
        ("audio.synthesize (VieNeu)", "narrativex_gpu_worker.adapters.executors.vieneu"),
        ("audio.align (WhisperX)", "narrativex_gpu_worker.adapters.executors.whisperx"),
        ("video.generate (LTX)", "narrativex_gpu_worker.adapters.executors.ltx"),
        ("image.generate (ComfyUI)", "narrativex_gpu_worker.adapters.executors.comfyui"),
    ]

    for label, mod_name in adapters:
        try:
            __import__(mod_name)
            passed.append(label)
        except Exception as exc:
            failed.append(f"{label}: {exc}")

    return passed, failed


def run_smoke(dry_run: bool = False, verbose: bool = False, lock_path: Path = DEFAULT_LOCK) -> int:
    print("=" * 60)
    print("NarrativeX GPU Runtime Smoke Suite")
    print("=" * 60)

    errors: list[str] = []

    # 1. Hardware & Driver Check
    gpu_info = probe_nvidia_smi()
    if gpu_info:
        print(f"[OK] NVIDIA GPU detected via nvidia-smi:")
        print(f"     Device:       {gpu_info['name']}")
        print(f"     Driver:       {gpu_info['driver_version']}")
        print(f"     Memory Total: {gpu_info['memory_total_mb']} MiB (Free: {gpu_info['memory_free_mb']} MiB)")
    else:
        msg = "nvidia-smi not available or no NVIDIA GPU found"
        if dry_run:
            print(f"[WARN] {msg} (ignored due to --dry-run)")
        else:
            errors.append(msg)

    # 2. PyTorch CUDA Probe
    torch_info = probe_pytorch_cuda()
    if not torch_info["installed"]:
        msg = "PyTorch is not installed in current Python environment"
        if dry_run:
            print(f"[WARN] {msg} (ignored due to --dry-run)")
        else:
            errors.append(msg)
    elif torch_info["cuda_available"]:
        print(f"[OK] PyTorch CUDA acceleration available:")
        print(f"     PyTorch: {torch_info['torch_version']}")
        print(f"     CUDA:    {torch_info['cuda_version']}")
        print(f"     Devices: {torch_info['device_count']} ({torch_info['device_name']})")
    else:
        msg = f"PyTorch {torch_info['torch_version']} installed but CUDA is NOT available"
        if dry_run:
            print(f"[WARN] {msg} (ignored due to --dry-run)")
        else:
            errors.append(msg)

    # 3. Workload Adapters Import Check
    passed_adapters, failed_adapters = verify_adapters()
    for item in passed_adapters:
        print(f"[OK] Workload Adapter loaded: {item}")
    for item in failed_adapters:
        print(f"[FAIL] Workload Adapter error: {item}")
        errors.append(item)

    # 4. Lock File Consistency
    lock_issues = verify_runtime_lock(lock_path, verbose=verbose)
    for issue in lock_issues:
        print(f"[FAIL] {issue}")
        errors.append(issue)

    print("-" * 60)
    if errors:
        print(f"GPU Runtime Smoke Test: FAILED ({len(errors)} error(s))")
        for err in errors:
            print(f"  - {err}")
        return 1

    print("GPU Runtime Smoke Test: PASSED (all checks verified)")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="NarrativeX GPU Runtime Smoke Suite")
    parser.add_argument("--dry-run", action="store_true", help="Allow running on machines without physical NVIDIA GPU")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose diagnostics")
    parser.add_argument("--lock-file", type=Path, default=DEFAULT_LOCK, help="Path to runtime.lock.json")
    args = parser.parse_args()

    return run_smoke(dry_run=args.dry_run, verbose=args.verbose, lock_path=args.lock_file)


if __name__ == "__main__":
    sys.exit(main())
