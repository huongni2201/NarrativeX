# NarrativeX AI Worker

## Purpose

The Python worker executes durable AI/media work authorized by the Spring backend. It is not a public HTTP/FastAPI service and it never owns Desktop native paths, authentication policy, project ownership or final project rendering.

For the architecture-level worker map, see `../../documentation/codebase/AI_WORKER_CODEBASE.md`.

## Current execution foundations

- Chapter analysis and continuity/storyboard materialization;
- deterministic VisualBeat source-anchor to UTF-16 text-range materialization;
- durable ProviderOperation submission/reconciliation fences;
- Vertex Gemini image generation through the configured batch path;
- VieNeu narration and alignment;
- user-provided narration timeline/alignment foundations;
- media validation and runtime-file handling;
- character-reference-aware image request foundations;
- bounded PostgreSQL claim/lease/heartbeat execution;
- shared deterministic retry/reconciliation behavior where implemented.

There is no current Python video-generation/I2V provider role. The former Wan adapter and its provider port are not part of the active worker runtime.

## Roles and concurrency

The repository is one Python source tree but runtime packaging is role-specific. The supported runtime roles are:

```text
analysis
narration
media-validation
image-generation
```

Compose/config separates general/image and narration concurrency. Important runtime controls include:

```text
WORKER_ROLES
GENERAL_WORKER_CONCURRENCY
NARRATION_WORKER_CONCURRENCY
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
  -> project-local generated media
  -> authorized Desktop materialization for project use
```

A paid submission must never happen before the durable fence is committed. Ambiguous outcomes remain `UNKNOWN` and reconcile rather than being blindly retried.

GCS batch staging is temporary provider infrastructure, not NarrativeX project storage. Accepted project images are persisted into the project-local media flow. Cloudflare R2 is not a generated-image transport or durability layer in the current runtime.

## Narration

```text
TTS
  -> VieNeu
  -> speaking-rate adjustment when requested (0.25x–2.0x)
  -> validate/normalize
  -> alignment

USER_PROVIDED_AUDIO
  -> ordered registered parts
  -> one logical global audio clock
  -> alignment
  -> no TTS stage for covered scope
```

Voice-reference execution is scope-specific:

```text
PROJECT
  -> resolve project.manifest.json
  -> validate project identity + asset identity + size + SHA-256
  -> use local project AUDIO path

ACCOUNT
  -> validate authorized account VoiceReferenceAsset
  -> download from R2 voices/... storage
  -> use temporary local enrollment input
```

PROJECT references must not depend on R2. ACCOUNT references require R2 storage metadata and ownership/readiness checks.

Catalog preview generation is a development/asset-maintenance task. `scripts/generate_vieneu_previews.py --publish-r2` publishes reusable voice-reference assets through the voice-only R2 boundary.

## Visual timing responsibility

The worker resolves semantic source provenance, not the production audio clock:

```text
VisualBeat source_anchor
  -> deterministic UTF-16 textStart/textEnd
```

The backend owns `text range -> narration audio range` mapping through `NarrationTextClockMapper` when constructing the production timeline. The removed Python duration-weighted `visual_timing` path and Python visual text-to-audio mapping are not production fallbacks.

## Media and storage scope

The worker never owns Desktop ProjectStorage. Current storage boundaries are:

```text
project generated media                -> configured project-local media root
Desktop project/final bytes            -> Electron ProjectStorage
PROJECT voice references               -> project-local media / manifest
ACCOUNT voice references/custom voice  -> Cloudflare R2
Vertex batch staging                   -> temporary GCS staging
worker-local files                     -> ephemeral scratch/cache
```

R2 is not authoritative for Desktop project bytes, generated project media or final MP4 files.

## Final project rendering

Final project rendering belongs to Electron main under backend assignment/lease. The Python worker has no final-render role, no video-generation/I2V provider adapter, does not resolve Desktop project render paths and does not persist final MP4 bytes. Current image motion and final composition are executed through the Desktop FFmpeg pipeline.

## Provider safety

- persist submission identity before external paid calls;
- reconcile `UNKNOWN`/non-terminal provider state before resubmission;
- cancel claimed processing on lease loss;
- fail closed on invalid or uncorrelated provider output;
- never invent work outside persisted backend authorization;
- do not resurrect a removed I2V or legacy visual-timing path as an implicit fallback.

## Quality gates

```bash
pytest
ruff check .
ruff format --check .
mypy src tests
```

Provider integrations should use deterministic fakes/mocks in ordinary automated tests. Real-provider verification is a separate controlled integration concern.
