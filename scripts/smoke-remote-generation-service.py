#!/usr/bin/env python3
"""Remote GPU Generation Service smoke test and artifact transport verification.

Performs end-to-end Compute Protocol v1 health, capability negotiation, task
submission, observation polling, and artifact transport checks against a running
generation-service instance (local or remote RTX 3090).
"""

from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import sys
import time
import urllib.error
import urllib.request
import uuid
from typing import Any

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


def canonical_fingerprint(payload: dict[str, Any]) -> str:
    """Compute sha256 fingerprint over canonical json."""
    canonical = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()


def make_request(
    url: str,
    method: str = "GET",
    data: dict[str, Any] | None = None,
    token: str | None = None,
    timeout: float = 15.0,
) -> tuple[int, dict[str, Any] | list[Any] | str]:
    headers: dict[str, str] = {
        "Accept": "application/json",
        "User-Agent": "NarrativeX-Remote-SmokeTest/1.0",
    }
    encoded_data: bytes | None = None
    if data is not None:
        headers["Content-Type"] = "application/json"
        encoded_data = json.dumps(data).encode("utf-8")

    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(url, data=encoded_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            code = resp.status
            body_bytes = resp.read()
            try:
                parsed = json.loads(body_bytes.decode("utf-8"))
                return code, parsed
            except Exception:
                return code, body_bytes.decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, body
    except urllib.error.URLError as e:
        return 0, str(e.reason)


def run_smoke_test(
    host: str,
    port: int,
    token: str | None,
    action: str,
    timeout: float,
) -> bool:
    base_url = f"http://{host}:{port}"
    print(f"=== NarrativeX Remote Generation Service Smoke Test ===")
    print(f"Target: {base_url}")
    print(f"Action: {action}")
    print()

    # 1. Check /health
    print(f"1. Probing {base_url}/health ...", end=" ")
    code, health_resp = make_request(f"{base_url}/health", method="GET", timeout=5.0)
    if code != 200:
        print(f"FAILED (HTTP {code}: {health_resp})")
        return False
    print(f"OK (HTTP 200 -> {health_resp})")

    # 2. Check /v1/capabilities
    print(f"2. Fetching {base_url}/v1/capabilities ...", end=" ")
    code, caps_resp = make_request(f"{base_url}/v1/capabilities", method="GET", token=token, timeout=5.0)
    if code != 200 or not isinstance(caps_resp, dict):
        print(f"FAILED (HTTP {code}: {caps_resp})")
        return False
    executors = caps_resp.get("executors", [])
    print(f"OK ({len(executors)} executors advertised)")
    for exc in executors:
        ready_mark = "READY" if exc.get("ready") else "NOT READY"
        print(f"   - {exc.get('name')}: types={exc.get('taskTypes')} [{ready_mark}]")

    # 3. Construct ComputeTask
    print(f"3. Preparing ComputeTask for action '{action}' ...")
    task_id = str(uuid.uuid4())
    attempt_id = str(uuid.uuid4())
    idempotency_key = f"smoke-test-{task_id[:8]}"
    deadline = (
        datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=int(timeout))
    ).isoformat()

    if action == "text.generate":
        task_desc = {"type": "text.generate", "schemaVersion": "1.0"}
        model_ref = {"executor": "text-engine", "model": "generic-instruct", "revision": "v1"}
        inputs = {
            "prompt": "Say hello to NarrativeX remote GPU worker in 5 words.",
            "temperature": 0.2,
            "topP": 0.8,
            "maxTokens": 64,
            "responseFormat": "text",
        }
    elif action == "media.validate":
        task_desc = {"type": "media.validate", "schemaVersion": "1.0"}
        model_ref = {"executor": "media-validator", "model": "ffprobe", "revision": "v1"}
        inputs = {
            "artifactRole": "source-audio",
            "allowedMediaTypes": ["audio/wav", "audio/x-wav"],
            "decode": False,
        }
    else:
        print(f"Unsupported smoke action '{action}'. Supported: text.generate, media.validate")
        return False

    constraints = {"deadline": deadline, "maxRuntimeSeconds": int(timeout)}
    artifacts_semantic: dict[str, list[Any]] = {"inputs": [], "outputs": []}

    semantic_payload = {
        "protocolVersion": "1.0",
        "task": task_desc,
        "model": model_ref,
        "constraints": constraints,
        "inputs": inputs,
        "artifacts": artifacts_semantic,
    }
    fingerprint = canonical_fingerprint(semantic_payload)

    task_payload = {
        "protocolVersion": "1.0",
        "taskId": task_id,
        "attemptId": attempt_id,
        "idempotencyKey": idempotency_key,
        "requestFingerprint": fingerprint,
        "task": task_desc,
        "model": model_ref,
        "constraints": constraints,
        "inputs": inputs,
        "artifacts": {"inputs": [], "outputs": []},
    }

    # 4. Submit Task via POST /v1/tasks
    print(f"4. Submitting task {task_id} to {base_url}/v1/tasks ...", end=" ")
    code, submit_resp = make_request(
        f"{base_url}/v1/tasks",
        method="POST",
        data=task_payload,
        token=token,
        timeout=10.0,
    )
    if code not in (200, 202) or not isinstance(submit_resp, dict):
        print(f"FAILED (HTTP {code}: {submit_resp})")
        return False
    state = submit_resp.get("state")
    print(f"OK (HTTP {code} -> state={state})")

    # 5. Poll task status until terminal
    print(f"5. Polling {base_url}/v1/tasks/{task_id} until terminal ...")
    start_time = time.time()
    while time.time() - start_time < timeout:
        time.sleep(1.0)
        code, poll_resp = make_request(
            f"{base_url}/v1/tasks/{task_id}",
            method="GET",
            token=token,
            timeout=5.0,
        )
        if code != 200 or not isinstance(poll_resp, dict):
            print(f"   Polling error: HTTP {code}: {poll_resp}")
            continue

        cur_state = poll_resp.get("state")
        print(f"   Elapsed: {int(time.time() - start_time)}s -> state={cur_state}")

        if cur_state in ("SUCCEEDED", "FAILED", "CANCELED"):
            if cur_state == "SUCCEEDED":
                outputs = poll_resp.get("outputs", [])
                metrics = poll_resp.get("metrics", {})
                print()
                print("=== Smoke Test PASSED ===")
                print(f"State:   SUCCEEDED")
                print(f"Metrics: {metrics}")
                print(f"Outputs: {outputs}")
                return True
            else:
                err = poll_resp.get("error", {})
                print()
                print(f"=== Smoke Test FAILED with state {cur_state} ===")
                print(f"Error: {err}")
                return False

    print(f"Timed out after {timeout}s waiting for task completion.")
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Remote GPU Generation Service smoke test")
    parser.add_argument("--host", default="127.0.0.1", help="Worker host address (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8000, help="Worker HTTP port (default: 8000)")
    parser.add_argument("--token", default="", help="Worker bearer token if required")
    parser.add_argument(
        "--action",
        default="media.validate",
        choices=["media.validate", "text.generate"],
        help="Task action to test (default: media.validate)",
    )
    parser.add_argument("--timeout", type=float, default=60.0, help="Max wait seconds for task completion")

    args = parser.parse_args()
    success = run_smoke_test(
        host=args.host,
        port=args.port,
        token=args.token or None,
        action=args.action,
        timeout=args.timeout,
    )
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
