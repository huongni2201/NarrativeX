# ADR-0015: Desktop render lifecycle and capability-scoped IPC

## Status

Accepted

## Context

Desktop render attempts cross FFmpeg, local storage, backend leases and Electron IPC. A single journal stage must not turn a process interruption into a known render failure, and the renderer must not choose arbitrary filesystem paths or signed download URLs.

## Decision

- Render journals checkpoint `REGISTER` before local artifact registration and only write `COMPLETED` after registration succeeds.
- `FAILED` is reserved for known render failures and stores a stable error code, failed stage, sanitized detail and retryability. `CANCELLED` is a separate user terminal state. A process interruption or lease interruption leaves the last active checkpoint resumable; it is not rewritten as `FAILED`.
- Registration is idempotent by render job/attempt ID through the immutable local artifact manifest. Recovery at `VERIFY`/`REGISTER` reconciles the deterministic `work/final.mp4` before rerunning the full render.
- Preflight receives typed executor/user/device context and passes only for `ONLINE` with valid user binding, valid pairing, FFmpeg/ffprobe and local resources. Renderer messages are mapped from stable blocker codes.
- Backup, restore and archive operations open dialogs and retain selected paths in Electron main. The preload bridge exposes only operation-level methods and business results, never caller-supplied paths.
- Remote materialization accepts project/asset IDs only. Main resolves metadata and a signed URL through the authenticated backend session, validates protocol/origin/size/type/checksum, and materializes into the controlled project workspace.
- Existing two-step local asset import uses short-lived, single-use tokens bound to the sender window and operation.

## Consequences

- Restart recovery can safely retry partial work without treating a crash as a business failure or duplicating final artifacts.
- The renderer has less authority and cannot redirect backup, restore, archive or remote download operations to arbitrary paths/URLs.
- Native dialog cancellation is represented as `null`; the renderer does not need to know the selected path.
- Full automatic process-restart orchestration remains backend-claim driven: discovery is safe, and an explicit backend retry/claim is still required for terminal `FAILED` or `CANCELLED` attempts.
