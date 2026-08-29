# NarrativeX AI Worker

## Purpose

The Python worker executes durable AI/media work authorized by the Spring backend. It is not a public HTTP/FastAPI service and it never owns Desktop native paths, authentication policy, project ownership or final project rendering.

For the architecture-level worker map, see `../../documentation/codebase/AI_WORKER_CODEBASE.md`.

## Current execution foundations

- Chapter analysis and continuity/storyboard materialization;
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
  -> authorized materialization for project use
```

A paid submission must never happen before the durable fence is committed. Ambiguous outcomes remain `UNKNOWN` and reconcile rather than being blindly retried.

GCS batch staging is temporary provider infrastructure, not NarrativeX project storage. Remote object transport may be used only where the configured provider/media flow explicitly requires durable bytes across worker/provider boundaries. Accepted project media is materialized into the local-first project flow before final rendering.

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

VieNeu supports system-managed voices and authorized reference-audio flows. Reference audio must be handled as sensitive input, kept out of arbitrary durable job payloads and used only with appropriate consent.

Catalog preview generation is a development/asset-maintenance task. Run `scripts/generate_vieneu_previews.py` to regenerate local preview files and a checksum manifest; its `artifacts/` output is intentionally not tracked in Git. Pass `--publish-r2` to publish through the immutable voice-reference adapter. Publishing requires the normal `R2_ACCOUNT_ID` or `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_BUCKET` settings, and writes the required lowercase SHA-256 as R2 object metadata.

## Media and storage scope

The worker never owns Desktop ProjectStorage. Current storage boundaries are:

```text
Desktop project/final bytes              -> Electron ProjectStorage
shared generated-media handoff           -> configured project-media local root where applicable
remote generated-media/provider transport -> R2 only when the authorized flow requires it
Vertex batch staging                      -> temporary GCS staging
worker-local files                        -> ephemeral scratch/cache
```

R2 is not authoritative for Desktop project bytes or final MP4 files. Voice-reference/custom-voice flows may use R2 through the explicitly routed backend/worker storage boundary.

## Final project rendering

Final project rendering belongs to Electron main under backend assignment/lease. The Python worker has no final-render role, no video-generation/I2V provider adapter, does not resolve Desktop project paths and does not persist final MP4 bytes. Current image motion and final composition are executed through the Desktop FFmpeg pipeline.

## Provider safety

- persist submission identity before external paid calls;
- reconcile `UNKNOWN`/non-terminal provider state before resubmission;
- cancel claimed processing on lease loss;
- fail closed on invalid or uncorrelated provider output;
- never invent work outside persisted backend authorization;
- do not resurrect a removed I2V provider path as an implicit fallback for the FFmpeg render flow.

## Quality gates

```bash
pytest
ruff check .
ruff format --check .
mypy src tests
```

Provider integrations should use deterministic fakes/mocks in ordinary automated tests. Real-provider verification is a separate controlled integration concern.
