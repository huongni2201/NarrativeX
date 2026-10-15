# GPU Worker Runtime Operations

**Status:** Current execution boundary; workstation deployment and GPU health still require runtime verification.

## Boundary

Spring Boot owns admission, durable business state, target assignment, recovery, and artifact metadata. `app/generation-service` executes closed Compute Protocol tasks and records local execution checkpoints in SQLite. It does not access the business database or own project files. Electron main owns project-local media and final FFmpeg rendering.

The worker may run on the same machine or a separate Windows GPU workstation. The current deployment target is Windows 11/Server with an RTX 5090 (32 GB); an RTX 3090 (24 GB) is a benchmark baseline. These targets do not establish that a worker is installed, available, or healthy.

## Workloads

| Workload | Owner | Current boundary |
| --- | --- | --- |
| Chapter analysis | Spring Boot backend | Vertex Gemini adapter; the proposed Antigravity OAuth/API route is not implemented |
| Video generation | Generation Service | Pinned LTX-2.5 Native AV profile; T2V at 1280×720, 24 FPS, 16:9 |
| Speech synthesis and alignment | Generation Service | VieNeu synthesis and WhisperX alignment |
| Image generation | Generation Service | ComfyUI text-to-image; input reference conditioning is not implemented |
| Final project render | Electron main | Local FFmpeg/ffprobe; the worker does not produce the final project MP4 |

The active LTX profile does not admit I2V, First/Last Frame, reference artifacts, or AUDIO_FIRST. Runtime capability readiness is a configuration claim, not a measurement of GPU health or output quality.

## Connectivity and credentials

- The backend connects through its configured Compute Protocol base URL. Configure the worker endpoint through the backend runtime settings/environment used by the deployment; do not treat a dynamic session handshake as an implemented contract.
- `/v1/*` requests use the machine execution credential. It is separate from provider credentials and from any application identity.
- Worker SQLite journal/outbox data supports execution recovery while the worker state remains available. A disposable machine may lose that local state when it is reprovisioned; reconcile backend assignments before replacing a worker with unfinished attempts.
- Keep model caches and temporary task artifacts on the worker. Generated artifact transfer and local project persistence follow the Compute Protocol and Desktop storage contract.

## Health and readiness checks

- `GET /health` reports worker process health. A healthy process does not prove a model can load or generate successfully.
- `GET /v1/capabilities` reports registered task types, schema versions, model revisions, and readiness claims. The backend fails closed when the required pinned profile is absent.
- Run the repository smoke script against the configured worker before relying on a deployment. Record the actual host, model revision, task profile, and result; do not use fixture or capability output as GPU-generation evidence.
- GPU residency arbitration serializes conflicting runtime families on a single-GPU worker. Capacity and VRAM policy remain runtime safeguards; performance and health need measured workstation runs.

## Rendering and storage

Project media bytes and final MP4 files remain in Electron-owned local storage. PostgreSQL stores stable IDs, checksums, opaque project-relative keys, leases, and final artifact metadata, not absolute machine paths or video bytes. The worker may return generated media through the artifact capability flow, but it never becomes the final-render authority.
