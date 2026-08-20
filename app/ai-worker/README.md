# NarrativeX AI Worker

## Purpose

The Python worker executes durable AI/media work authorized by the backend. It is not a public HTTP/FastAPI service.

## Current execution foundations

- Chapter analysis and continuity/storyboard materialization;
- durable ProviderOperation reconciliation;
- full-chapter TTS narration, alignment and R2 persistence;
- user-provided narration part/timeline processing foundation;
- Wan-compatible I2V adapter/planning foundation;
- bounded PostgreSQL claim/lease/heartbeat runtime.

## Narration

```text
TTS
  -> synthesize/assemble -> R2 -> alignment

USER_PROVIDED_AUDIO
  -> ordered parts -> logical global audio clock -> alignment
  -> no TTS_GENERATE stage
```

One audio part may cover multiple Chapters. The worker can translate per-part timestamps into one global audio timeline; physical concatenation is not required just to define timeline continuity.

Production upload/finalize and real alignment runtime still need end-to-end hardening.

## Durable media

Cloudflare R2 is the only durable media store. Worker-local files are scratch/cache/FFmpeg workspace only. A retry should reuse valid R2 media rather than regenerate due solely to lost scratch.

## Worker authority boundary

The worker may validate/reconcile/retry/fallback only within persisted backend authorization. It must not decide product entitlement, create arbitrary paid work or silently upgrade an IMAGE_MOTION plan to I2V.

## Quality gates

```bash
pytest
ruff check .
ruff format --check .
mypy src tests
```
