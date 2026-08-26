# NarrativeX AI Worker

## Purpose

The Python worker executes durable AI/media work authorized by the Spring backend. It is not a public HTTP/FastAPI service and it never owns Desktop native paths, authentication policy or project ownership.

For the architecture-level worker map, see `../../documentation/codebase/AI_WORKER_CODEBASE.md`.

## Current execution foundations

- Chapter analysis and continuity/storyboard materialization;
- durable ProviderOperation submission/reconciliation fences;
- Vertex Gemini image generation through the configured batch path;
- Google TTS / VieNeu narration and alignment;
- user-provided narration timeline/alignment foundations;
- retained server/cloud FFmpeg rendering with ffprobe validation;
- media validation and runtime-file handling;
- character-reference-aware image request foundations;
- bounded PostgreSQL claim/lease/heartbeat execution;
- shared deterministic retry/reconciliation behavior where implemented.

## Roles and concurrency

The repository is one Python source tree but runtime packaging is role-specific. Compose/config separates general/image, narration and render worker concurrency.

Important runtime controls include:

```text
WORKER_ROLES
GENERAL_WORKER_CONCURRENCY
NARRATION_WORKER_CONCURRENCY
RENDER_WORKER_CONCURRENCY
WORKER_LEASE_SECONDS
WORKER_POLL_INTERVAL_SECONDS
```

Exact dependency versions and optional extras are authoritative in `pyproject.toml`.

## Image generation

The enabled Vertex image path uses durable provider-operation fencing and batch/reconciliation behavior:

```text
backend-authorized image work
  -> PostgreSQL claim + lease
  -> persist provider submission fence
  -> Vertex batch staging/execution
  -> durable reconciliation
  -> validate/correlate output
  -> stable MediaAsset/lineage
  -> retained remote materialization where required
```

A paid submission must never happen before the durable fence is committed. Ambiguous outcomes remain `UNKNOWN` and reconcile rather than being blindly retried.

GCS batch staging is temporary provider infrastructure, not the NarrativeX product-media store. R2 may hold retained server/provider media; Desktop can subsequently materialize an accepted MediaAsset into its own local project workspace.

## Narration

```text
TTS
  -> Google TTS or VieNeu
  -> VieNeu speaking-rate adjustment when requested (0.25x–2.0x)
  -> validate/normalize
  -> alignment

USER_PROVIDED_AUDIO
  -> ordered registered parts
  -> one logical global audio clock
  -> alignment
  -> no TTS stage for covered scope
```

VieNeu supports system-managed voices and authorized reference-audio flows. Reference audio must be handled as sensitive input, kept out of arbitrary durable job payloads and used only with appropriate consent.

Catalog preview generation is a development/asset-maintenance task, not a browser-specific product architecture requirement.

## Durable media scope

The worker's storage contract is scoped to **server/provider execution**:

```text
retained server/provider pipeline media -> Cloudflare R2
retained cloud-render final MP4         -> Google Drive
worker-local files                      -> ephemeral scratch/cache
```

This does **not** make R2/Drive authoritative for Desktop project bytes. The primary Desktop flow materializes project media/final local renders under Electron ProjectStorage.

## Render role

The worker render role is the retained cloud/server executor. It consumes backend-pinned input, runs FFmpeg/ffprobe and uses the configured final-video storage adapter.

Desktop `LOCAL_DEVICE` rendering is separate and runs in Electron main under backend assignment/lease.

## Provider safety

- persist submission identity before external paid calls;
- reconcile `UNKNOWN`/non-terminal provider state before resubmission;
- cancel claimed processing on lease loss;
- fail closed on invalid or uncorrelated provider output;
- never invent work outside persisted backend authorization;
- never silently upgrade an image-motion plan to I2V.

## Quality gates

```bash
pytest
ruff check .
ruff format --check .
mypy src tests
```

Provider integrations should use deterministic fakes/mocks in ordinary automated tests. Real-provider verification is a separate controlled integration concern.
