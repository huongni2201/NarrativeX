# NarrativeX Technology Stack

Product specification: [`../product/PRODUCT_SPEC.md`](../product/PRODUCT_SPEC.md).

Executable manifests are authoritative for exact dependency versions. This file summarizes the current stack after the single-user local-first (ADR-0020) and compute execution plane (ADR-0018/0029) refactors.


| Layer | Current stack | Current role |
|---|---|---|
| Desktop | Electron 44.4.2, Electron Vite 5.0.0, React/React DOM 19.2.8, React Router DOM 7.18.2, TypeScript 7.0.2 | only supported editor client and local native-execution boundary |
| Desktop state/data | TanStack React Query 5.102.3, Zustand 5.0.15 | backend query/cache and local editor state |
| Desktop UI | Tailwind CSS 4.3.3, `@tailwindcss/vite` 4.3.3, source-owned shadcn-style primitives, Radix UI, CVA, clsx, tailwind-merge, Lucide 1.34.0, Sonner 2.0.8 | accessible renderer component vocabulary and semantic styling |
| Backend | Java 25, Spring Boot 4.1.1, Spring MVC + Virtual Threads, Google GenAI Java SDK 1.72.0, Actuator | modular monolith, control plane, domain metadata, policy, Vertex Gemini Chapter Analyze and durable orchestration authority |
| Persistence | PostgreSQL 18.6 + Flyway + MyBatis Spring Boot 4.1.0 + explicit SQL | sole production application persistence path, including durable jobs, leases, and state CAS |
| Compute Execution Plane | Python 3.14.7, FastAPI 0.141.1, Pydantic 2.13.5, HTTPX 0.28.1, Uvicorn 0.53.0, SQLite3 | `app/generation-service`: domain-agnostic Compute Protocol v1 execution plane with Hexagonal adapters, RuntimeProcessSupervisor, and local SQLite execution journal |
| Compute media/AI extras | Pillow 12.3.0, WhisperX 3.8.6 forced-align, PyTorch 2.14.0 (cu130), TorchAudio 2.11.0, NumPy 2.5.3, CTranslate2 4.8.2 | forced alignment, image validation, and media execution runtimes |
| Compute contracts | JSON Schema, Pydantic models | `contracts/compute/v1/`: versioned wire contracts for task submission, callbacks, and artifact descriptors |
| Shared client contracts | `packages/client-contracts` | typed Desktop/backend contracts |
| Narration TTS | VieNeu 3.8.1 + WhisperX 3.8.6 forced-align | segmented TTS, 48 kHz mono WAV master and forced alignment; narration remains the master clock |
| Image generation | ComfyUI v0.36.0 (RealVisXL) with WebSocket completion | target local/remote image generation |
| Visual timing | source-anchor resolver + backend `NarrationTextClockMapper` | `source_anchor -> UTF-16 text range -> narration alignment -> production beat clock` |
| Desktop project storage | Electron `userData` + `project.manifest.json` | local-first project media, PROJECT voice references, backups, render work/cache and final artifacts |
| Desktop deterministic render | FFmpeg + ffprobe from Electron main | backend-assigned lease-controlled final rendering and local MP4 output |

Redis, browser-based editors, and legacy application authentication infrastructure are removed.

## Desktop trust boundary

```text
renderer
  -> React UI / routes / query state / timeline state
  -> no unrestricted Node.js

preload
  -> narrow typed capability bridge

main
  -> native files and ProjectStorage
  -> local device execution & lease claim
  -> FFmpeg/ffprobe
```

The renderer must not become a second source of truth for Projects, Chapters, storyboard state, assets, or durable render state.

## Storage and timing status

Current storage is intentionally split by responsibility:

```text
project image/audio/video             -> project-local storage
PROJECT voice reference               -> project-local storage / manifest
GLOBAL_LOCAL voice reference          -> local application voice library
final MP4                             -> Desktop project artifacts
metadata                              -> PostgreSQL
```

There is no generated-project-media R2 transport/fallback in the current runtime.

Current visual timing is source anchored. AI materialization resolves deterministic UTF-16 text ranges; backend production-timeline reads map those ranges through narration/subtitle alignment. Provisional fallback timing is review-only and does not satisfy render readiness.

## Single-user workspace boundary

NarrativeX is a single-user local-first application per ADR-0020. There is no application user account, session cookie (`NX_SESSION`), Google OAuth, or guest ownership transfer. Project is the top business boundary.

## Persistence status

Production persistence is MyBatis + explicit PostgreSQL SQL. The final pre-release baseline is clean and squashed into **V1–V7**. V1–V5 separate schema/database responsibilities, V6 contains indexes/invariants and V7 contains deterministic catalog seeds. Future migrations begin at append-only V8 only after the first production deployment.
