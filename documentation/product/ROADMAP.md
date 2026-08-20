# NarrativeX — V1.10 Roadmap

**Canonical baseline:** `../source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_10.md`
**Planning rule:** milestones are dependency order, not fixed-date commitments.

## Current checkpoint

The current codebase has an implemented Chapter Analysis foundation:

```text
Create Project
  -> Save Chapter
  -> Analyze
  -> durable admission/enqueue
  -> worker claim/lease/heartbeat
  -> durable ProviderOperation lifecycle
  -> structured analysis
  -> Character + Location continuity
  -> Scene + VisualBeat + Scene relations
  -> COMPLETED
```

Project/Chapter/Analyze, worker concurrency, provider durability, analysis continuity and Storyboard/Character read foundations are no longer roadmap-only items.

## Next milestones

### M1 — Character review and locking

**Status:** PARTIAL

- CharacterVersion view/edit workflow.
- explicit review/approve/lock semantics.
- reference asset management.
- deterministic resolution of reviewed CharacterVersion/reference snapshots for future generation.
- UI consumes backend state only.

### M2 — Storyboard review completion

**Status:** PARTIAL

- broader Scene/VisualBeat editing and ordering.
- explicit approved-output reset/versioning workflow.
- deep-link/navigation improvements.
- preserve approved/history semantics during re-analysis.

### M3 — Image generation

**Status:** PENDING

```text
reviewed VisualBeat
  -> durable image stage
  -> ProviderOperation
  -> Cloudflare R2
  -> Asset metadata/checksum/dimensions
  -> review/regenerate
```

Start with one real provider path. Multi-provider routing is not required to prove the product loop. Durable image bytes use the environment R2 bucket; worker-local files are temporary scratch only.

### M4 — Narration / TTS / subtitle timing

**Status:** PENDING

- one TTS adapter;
- narration audio Asset persisted to R2;
- duration/timing metadata;
- subtitle segmentation/timing with durable R2 artifacts where applicable;
- durable provider/output validation.

### M5 — FFmpeg render/export

**Status:** PENDING

- reviewed image/visual assets;
- narration/subtitle timeline;
- basic pan/zoom/fade;
- immutable RenderVersion/FinalArtifact uploaded to R2;
- checksum/MIME/dimensions/manifest validation before READY.

### M6 — Billing and production hardening

**Status:** PARTIAL

- actual provider usage reconciliation;
- append-only billing/resource ledger completion;
- unused reservation release/refund;
- broader provider recovery/observability;
- moderation/consent/abuse coverage;
- deletion/retention;
- backup/restore drills;
- real-provider E2E/load/recovery evidence.

## Product loop target

```text
Login
  -> Create Project
  -> Create/Edit Chapter
  -> Analyze
  -> Review Character/Continuity
  -> Review Storyboard
  -> Generate Images
  -> Generate Narration
  -> Render MP4
  -> Preview/Download
```

## Not required before the core creator loop

- multiple LLM providers;
- complex provider-routing optimization;
- BYOK;
- LoRA/adapter training;
- collaboration/sharing;
- CapCut-style full timeline editor;
- cinematic lip-sync;
- multi-region/GPU orchestration;
- premature microservice extraction.

## Release blockers for public beta

- no real-provider E2E/recovery evidence;
- incomplete moderation/consent/abuse coverage;
- incomplete billing/usage reconciliation;
- deletion/retention not verified end-to-end;
- backup/restore/observability insufficient;
- media outputs not validated atomically before READY;
- unresolved P0/P1 security or data-integrity issues.

Historical V1.8 milestone text should be treated as historical planning only; it is not the current implementation status.
