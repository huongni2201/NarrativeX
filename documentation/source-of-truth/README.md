# NarrativeX Source of Truth V1.11

## Canonical baseline

- Version: `V1.11`
- Repository: `huongni2201/NarrativeX`
- Docs-sync base: `e47dccee4aa35450f3902a55311d5d83632cb5a6`
- Canonical specification: `documentation/source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`
- Historical baseline: `NARRATIVEX_PROJECT_SPEC_V1_10.md` (superseded; do not use as current authority)

## Current implemented foundations

- Project overview and Project persistence, including MyBatis-backed Project command/query persistence.
- Chapter CRUD/import with MyBatis Chapter persistence.
- Explicit durable Chapter Analyze admission/enqueue and worker claim/lease/heartbeat execution.
- Durable ProviderOperation lifecycle, CAS-style transition foundation and immutable completed-result fingerprint behavior.
- Backend-authoritative, versioned MediaPlan foundation and job pinning.
- Character/Location continuity plus Scene/VisualBeat and Scene relation materialization foundations.
- Full-chapter TTS narration, alignment and immutable R2-backed narration media.
- User-provided narration foundation: `NarrationStrategy.USER_PROVIDED_AUDIO`, ordered variable-count audio parts, one logical global audio clock, fingerprints/alignment status and TTS-bypass operation planning.
- Cloudflare R2-only durable media topology.

## Primary V1.11 targets

- Finish MyBatis migration for StoryVersion, generation execution, outbox, quota/billing, storyboard/continuity and remaining boundaries.
- Harden the production user-audio upload/finalize/alignment path.
- Build alignment-driven `VisualScenePlanner`.
- Implement the first production image-generation slice; `GENERATE_NEW` is allowed for the first vertical slice.
- Persist minimal immutable image `MediaAsset` before render completion.
- Deliver `IMAGE_MOTION` → validated R2-backed MP4 as the first complete long-form media path.
- Add reuse/reframe/edit resolution and `HYBRID_LOCAL_I2V` as fast-follow optimizations after the first durable MP4.

Derived documents are implementation views and must not redefine these invariants independently.
