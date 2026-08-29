# NarrativeX AI Worker Codebase

## Authority

The Python worker executes durable AI/media work authorized by the Spring backend. PostgreSQL remains the durable execution source of truth. The worker is not a public API and is not product/domain authority.

## Supported roles

```text
analysis
narration
media-validation
image-generation
```

There is no current Python video-generation/I2V role and no Wan provider. `VIDEO` remains a valid analysis/editor intent for Electron web/browser generation; that intent must not be removed just because the Python provider path is gone.

## Chapter analysis

```text
Backend admission
  -> GenerationJob + StageAttempt
  -> worker claim/lease
  -> saved Chapter source
  -> provider structured result
  -> stale-source guard
  -> Character/Location/Scene/VisualBeat materialization
```

## Provider-operation fence

External provider work persists request identity before submission. Ambiguous outcomes remain `UNKNOWN` and reconcile before resubmission. Lease loss prevents stale owners from creating new durable side effects or finalizing success.

## Image generation

```text
backend-authorized image items
  -> worker claim
  -> provider operation fence
  -> Vertex execution/reconciliation
  -> validate/correlate image
  -> project-local media result
  -> stable MediaAsset + lineage
```

Generated image bytes are written to the configured project-media local root. They are not uploaded to R2.

## Narration

```text
TTS
  -> VieNeu/provider execution
  -> validate/normalize
  -> project-local narration output
  -> alignment
```

Generated narration uses `PROJECT_MEDIA_LOCAL_DIR` as its canonical storage root. The removed `media_storage_mode` / `media_local_dir` compatibility aliases must not be restored.

Account-owned custom voice references are separate: an authorized reference may be read from R2 and copied into local/ephemeral execution storage for inference. Generated narration output still remains project-local.

## Storage boundary

```text
worker generated image/audio   -> project-media local root
worker scratch                 -> ephemeral workspace
voice reference/custom voice   -> R2 only when account remote storage is required
Desktop project bytes          -> Electron ProjectStorage
final MP4                      -> Electron project artifacts
```

The worker never owns the Desktop absolute path and never stores final video.

## Final rendering

Final project rendering belongs to Electron main under backend assignment/lease. Python does not execute project FFmpeg renders and there is no server-side Chapter-render pipeline.

## Verification

```bash
pytest
ruff check .
ruff format --check .
mypy src tests
```

Tests should protect role boundaries, lease loss, provider ambiguity, local project-media storage and the absence of removed Python video-provider/runtime compatibility code.
