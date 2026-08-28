# NarrativeX AI Worker

## Purpose

The Python worker executes durable AI/media work authorized by the Spring backend. It is not a public HTTP/FastAPI service and it never owns Desktop native paths, authentication policy, project ownership or final project rendering.

For the architecture-level worker map, see `../../documentation/codebase/AI_WORKER_CODEBASE.md`.

## Current execution foundations

The current supervisor exposes these worker roles:

```text
analysis
narration
media-validation
image-generation
```

Current foundations include:

- Chapter analysis and continuity/storyboard materialization;
- richer source-grounded Character profile extraction/materialization;
- beat-specific Character participation and role references;
- durable ProviderOperation submission/reconciliation fences;
- Vertex image generation through the configured provider path;
- VieNeu narration generation and persisted alignment;
- user-provided narration alignment/timeline foundations;
- media validation and runtime-file handling;
- character/reference-aware image request foundations;
- bounded PostgreSQL claim/lease/heartbeat execution;
- shared deterministic retry/reconciliation behavior where implemented.

There is **no Python final-render worker role** in the current runtime supervisor. Final project FFmpeg/ffprobe rendering belongs to Electron main under backend assignment/lease.

## Roles and concurrency

The repository is one Python source tree but runtime configuration enables only the roles above. `WORKER_ROLES` selects the enabled roles, and the shared worker concurrency gate bounds active work.

Exact settings are authoritative in `src/narrativex_worker/config.py`; exact dependency versions and optional extras are authoritative in `pyproject.toml`.

The package requires Python `>=3.12`; Ruff/mypy target Python 3.12.

## Analysis and storyboard materialization

Current Chapter analysis returns reusable Character/Location data, ordered Scenes and Visual Beats.

Character analysis includes source-grounded continuity fields such as role, importance, groups, bible, visual prompt and Chapter appearance data. Materialization preserves explicitly pinned Character versions; AI-derived profile versions are created/pinned only when an explicit pinned version is absent.

Visual Beat analysis currently owns semantic information such as:

```text
title
visual_intent
camera_angle
characters[{character_key, role}]
```

Storyboard materialization persists beat-specific Character mappings through `visual_beat_characters`.

Current non-claim: analysis does not yet return deterministic source-span IDs/offsets, and storyboard materialization does not yet populate exact `visual_beats.text_start/text_end` or narration-derived `audio_start_ms/audio_end_ms` for every beat. AI must not be documented as calculating those numeric offsets.

## Image generation

The enabled API/provider image path uses durable provider-operation fencing and reconciliation behavior:

```text
backend-authorized image work
  -> PostgreSQL claim + lease
  -> persist provider submission fence
  -> provider staging/execution
  -> durable reconciliation
  -> validate/correlate output
  -> stable MediaAsset/lineage
  -> R2 transport when remote durability is required
  -> Desktop materialization for project use
```

A paid submission must never happen before the durable fence is committed. Ambiguous outcomes remain `UNKNOWN` and reconcile rather than being blindly retried.

Provider staging infrastructure is not the NarrativeX project-media authority. Accepted generated media may be transported through R2 and is then materialized into the Desktop local project workspace when required by the creator flow.

Gemini Web generation is **not** a Python-worker provider path. It runs in Electron main through visible Chrome/CDP automation and is documented in the Desktop/ADR workflow.

## Narration

```text
TTS
  -> VieNeu/provider execution
  -> speaking-rate adjustment where supported
  -> validate/normalize
  -> alignment
  -> durable narration asset/alignment metadata

USER_PROVIDED_AUDIO
  -> ordered registered parts
  -> one logical audio clock/alignment foundations
  -> no TTS stage for covered scope
```

Current generated narration completion persists source-hash-bound alignment spans containing text and audio boundaries. That does **not** yet mean Visual Beat audio timing has been reconciled: the current completion path does not populate every storyboard beat's `audio_start_ms/audio_end_ms` from those spans.

VieNeu supports system-managed voices and authorized reference-audio flows. Reference audio must be handled as sensitive input, kept out of arbitrary durable job payloads and used only with appropriate consent.

Catalog preview generation is a development/asset-maintenance task, not a browser-specific product architecture requirement.

## Durable media scope

The worker storage contract is scoped to generated-media/provider execution:

```text
AI-generated image/narration transport -> Cloudflare R2 when remote durability is required
worker-local files                     -> ephemeral scratch/cache
Desktop project media                  -> Electron local project workspace after materialization
final project MP4                      -> Electron local project artifacts
```

The worker does not own Desktop project bytes or final-video storage. Google Drive is not part of the current NarrativeX final-video contract.

## Final render boundary

Final project rendering is backend-authorized but Desktop-executed:

```text
backend render snapshot + device assignment/lease
  -> Electron main resolves local stable asset IDs/checksums
  -> FFmpeg/ffprobe local render
  -> local final MP4
  -> backend artifact metadata/progress/completion
```

Do not reintroduce a Python/cloud final-render role or server final-video storage contract without an explicit architecture decision and corresponding runtime code.

## Provider safety

- persist submission identity before external paid calls;
- reconcile `UNKNOWN`/non-terminal provider state before resubmission;
- cancel claimed processing on lease loss;
- fail closed on invalid or uncorrelated provider output;
- never invent work outside persisted backend authorization;
- never silently upgrade an image-motion plan to I2V;
- never treat a nullable schema column or implementation plan as proof that downstream timing/materialization is implemented.

## Quality gates

```bash
pytest
ruff check .
ruff format --check .
mypy src tests
```

Provider integrations should use deterministic fakes/mocks in ordinary automated tests. Real-provider verification is a separate controlled integration concern.
