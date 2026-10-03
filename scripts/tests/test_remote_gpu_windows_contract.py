"""Exercise the deployment scripts with isolated runtimes, without GPU/network installs."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import threading
import venv
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "deploy" / "remote-gpu-windows"
PWSH = shutil.which("pwsh")
pytestmark = pytest.mark.skipif(os.name != "nt" or not PWSH, reason="Windows PowerShell required")


def ps_literal(value: Path | str) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def run_ps(command: str, **env: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [PWSH, "-NoProfile", "-NonInteractive", "-Command", command],
        stdin=subprocess.DEVNULL,
        capture_output=True,
        text=True,
        check=False,
        timeout=30,
        env={**os.environ, **env},
    )


@pytest.fixture
def installation(tmp_path: Path) -> Path:
    install = tmp_path / "runtime with spaces"
    venv.create(install / ".venv", with_pip=False)
    (install / "logs").mkdir()
    (install / ".runtime").mkdir()
    (install / ".env").write_text(
        "GENERATION_SERVICE_HOST=127.0.0.1\n"
        "GENERATION_SERVICE_PORT=1\n"
        "GENERATION_SERVICE_MACHINE_TOKEN=test-machine-token\n",
        encoding="utf-8",
    )
    return install


def write_worker(package: Path) -> None:
    package.mkdir(parents=True)
    (package / "__init__.py").write_text("", encoding="utf-8")
    (package / "__main__.py").write_text(
        "import os, sys\n"
        "from pathlib import Path\n"
        "if __name__ == '__main__':\n"
        "    Path(os.environ['WORKER_MARKER']).write_text('started', encoding='utf-8')\n"
        "    sys.exit(int(os.environ.get('WORKER_EXIT_CODE', '0')))\n",
        encoding="utf-8",
    )


def test_foreground_start_uses_the_installed_package_entrypoint(installation: Path) -> None:
    write_worker(installation / ".venv/Lib/site-packages/narrativex_gpu_worker")
    marker = installation / "started"
    result = run_ps(
        f"& {ps_literal(SCRIPTS / 'start.ps1')} -InstallDir {ps_literal(installation)} -Foreground",
        WORKER_MARKER=str(marker),
    )
    assert result.returncode == 0, result.stderr
    assert marker.exists(), result.stdout + result.stderr


def test_background_start_rejects_a_process_that_exits_before_health(installation: Path) -> None:
    write_worker(installation / ".venv/Lib/site-packages/narrativex_gpu_worker")
    result = run_ps(
        f"& {ps_literal(SCRIPTS / 'start.ps1')} -InstallDir {ps_literal(installation)}",
        WORKER_MARKER=str(installation / "started"),
        WORKER_EXIT_CODE="23",
    )
    assert result.returncode != 0, result.stdout
    assert not (installation / ".runtime/worker.pid").exists()


def test_bootstrap_installs_into_the_environment_used_by_start(
    installation: Path, tmp_path: Path
) -> None:
    package = tmp_path / "package/narrativex_gpu_worker"
    write_worker(package)
    destination = installation / ".venv/Lib/site-packages"
    # The UV double mirrors project-env selection; the real Python verifies installation.
    command = f"""
function global:nvidia-smi {{ 'Test GPU, 32768' }}
function global:uv {{
    if ($args[0] -eq 'sync' -and $env:UV_PROJECT_ENVIRONMENT -eq {ps_literal(installation / '.venv')}) {{
        Copy-Item -LiteralPath {ps_literal(package)} -Destination {ps_literal(destination)} -Recurse
    }}
    $global:LASTEXITCODE = 0
}}
& {ps_literal(SCRIPTS / 'bootstrap.ps1')} -InstallDir {ps_literal(installation)} -MachineToken 'test-machine-token' -SkipModelDownload
"""
    result = run_ps(command, WORKER_MARKER=str(installation / "started"))
    assert result.returncode == 0, result.stdout + result.stderr
    imported = subprocess.run(
        [str(installation / ".venv/Scripts/python.exe"), "-c", "import narrativex_gpu_worker.__main__"],
        stdin=subprocess.DEVNULL,
        capture_output=True,
        text=True,
        check=False,
        env={**os.environ, "WORKER_MARKER": str(installation / "started")},
    )
    assert imported.returncode == 0, imported.stderr


@pytest.mark.parametrize("ready", [True, False])
def test_healthcheck_rejects_unprovisioned_video_even_when_worker_advertises_ready(
    installation: Path, ready: bool
) -> None:
    accepted_requests: list[str] = []

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            if self.headers.get("Accept") != "application/vnd.narrativex.compute-v1+json":
                self.send_error(415)
                return
            if self.headers.get("Authorization") != "Bearer test-machine-token":
                self.send_error(401)
                return
            accepted_requests.append(self.path)
            payload = json.dumps(
                {
                    "protocolVersions": ["1.0"],
                    "workerVersion": "test",
                    "executors": [
                        {"name": "ltx", "taskTypes": ["video.generate"], "models": [], "ready": ready}
                    ],
                    "limits": {"maxConcurrentTasks": 1, "maxRequestBytes": 1000, "maxArtifactBytes": 1000},
                }
            ).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/vnd.narrativex.compute-v1+json")
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, *_args: object) -> None:
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        result = run_ps(
            f"function global:nvidia-smi {{ 'Test GPU' }}; "
            f"& {ps_literal(SCRIPTS / 'healthcheck.ps1')} -InstallDir {ps_literal(installation)} "
            f"-HostUrl 'http://127.0.0.1:{server.server_port}'"
        )
        assert accepted_requests == ["/v1/capabilities"], result.stdout + result.stderr
        assert result.returncode != 0, result.stdout + result.stderr
        assert "ALIVE" in result.stdout
    finally:
        server.shutdown()
        server.server_close()
        thread.join()
