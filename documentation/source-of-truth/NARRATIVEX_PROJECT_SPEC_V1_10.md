# NarrativeX — Project Source of Truth V1.10

**Status:** Canonical code-aligned engineering baseline  
**Effective date:** 19/08/2026  
**Last code verification:** 21/08/2026

## Authority

This document is the maintained source of truth for NarrativeX product and architecture decisions.

Authority order:

1. This specification and accepted ADRs define intended contracts.
2. Current code, migrations and tests define factual implementation state.
3. Derived documentation must be synchronized when drift appears.

## Product definition

NarrativeX is an AI-assisted long-form story video studio. It transforms persisted Chapter sources into structured analysis, continuity-aware storyboard planning and eventually image-first video production.

The product is chapter-first, review-first and durable by design.

Create Project only creates metadata. Saving Chapter only persists source. AI analysis and media generation are explicit actions.

## Implemented V1.10 baseline

| Capability | State |
|---|---|
| Project Overview | IMPLEMENTED |
| Chapter CRUD/import | IMPLEMENTED |
| Chapter Analyze durable pipeline | IMPLEMENTED |
| Worker bounded concurrency | IMPLEMENTED |
| Storyboard/VisualBeat foundation | IMPLEMENTED |
| Character library read API | IMPLEMENTED |
| AI Character/Location continuity materialization foundation | IMPLEMENTED |
| Scene -> ProjectCharacter / Location continuity persistence foundation | IMPLEMENTED |
| Job history/quota/notification reads | IMPLEMENTED |
| ProviderOperation lifecycle + reconciliation foundation | IMPLEMENTED |
| Admission safety/quota/cost reservation foundation | IMPLEMENTED |
| Full-chapter narration/TTS + alignment foundation | IMPLEMENTED |
| R2-backed immutable narration media | IMPLEMENTED |

## Current generation model

```text
OperationPlan
    -> GenerationJob
        -> StageAttempt
            -> ProviderOperation
```

PostgreSQL is authoritative. Redis is delivery/progress infrastructure and never replaces durable execution state.

Chapter Analyze currently persists stable AI continuity keys for Character and Location identities, materializes project-scoped Character/Location records, and persists Scene character/location relations. These are implementation foundations; downstream image generation still needs reviewed/locked continuity snapshots before production media generation.

Full-chapter narration snapshots the Chapter source identity, performs durable provider execution, persists immutable narration segments/final chapter audio, and materializes alignment spans for downstream timing.

## Durable media storage contract

Cloudflare R2 is the sole durable object store for NarrativeX media across development, staging and production.

- Use environment-isolated R2 buckets (for example `narrativex-dev` and `narrativex-prod`) rather than a local object-storage implementation.
- Worker-local files are ephemeral scratch/cache/FFmpeg workspace only and are never authoritative asset references.
- Durable media includes generated/reference images, narration audio, subtitles/manifests, scene/motion video, final exports and thumbnails.
- Media bytes are validated and uploaded to R2 before the producing stage may be marked complete.
- PostgreSQL stores durable media metadata/contracts such as the R2 object key, content hash, MIME type, size, duration/dimensions and lineage/provider references; binary media does not belong in PostgreSQL.
- After durable R2 persistence and metadata commit succeed, local temporary files may be deleted.
- Retry/reclaim paths must reuse an existing valid R2 asset when one already exists instead of regenerating merely because a worker-local workspace disappeared.
- R2 objects are private by default; client access must flow through backend-authorized access/presigned delivery rather than persistent public object URLs.

The storage contract is now executable for the full-chapter narration path. Image generation, motion-video persistence and final render/export still need their own media-stage implementations behind the same R2 boundary.

## Remaining gaps

- Full character editing/version locking/reference workflow.
- Approved storyboard reset/versioning workflow.
- Production hardening for provider recovery/reconciliation and complete actual-usage accounting.
- Image generation, Cloudflare R2 persistence and immutable generated-asset lifecycle.
- Subtitle/timing refinement beyond current narration alignment.
- Render/export/final artifact pipeline with R2-backed durable outputs.
- Complete billing ledger reconciliation and unused-reservation release.
- Broader moderation/consent/abuse coverage, observability, backup/restore and deletion lifecycle evidence.

## AI coding rules

- Do not use mock data as production state.
- Do not submit provider requests without durable lifecycle state.
- `UNKNOWN` external outcomes must reconcile before blind resubmission.
- Do not overwrite approved/locked history.
- Prefer affected-scope regeneration.
- Do not treat worker-local media paths as durable assets.
- R2 is the only durable media object-store target; keep environment isolation at the bucket/configuration boundary.
- Update docs and ADRs when invariants change.
