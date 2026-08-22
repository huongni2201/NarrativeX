# NarrativeX Source of Truth V1.11

## Canonical baseline

- Version: `V1.11`
- Repository: `huongni2201/NarrativeX`
- Docs-sync base: `a614d05101a5992783cbc580668b4ed0927b41d9`
- Canonical specification: `documentation/source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`

Current code, Flyway migrations and automated tests decide factual AS-IS implementation claims when a derived document drifts from this checkpoint.

## Current implemented foundations

- Project overview/dashboard/favorite flows and MyBatis-backed Project command/query persistence.
- Chapter CRUD/import with MyBatis Chapter persistence.
- Explicit durable Chapter Analyze admission/enqueue and worker claim/lease/heartbeat execution.
- Durable ProviderOperation lifecycle, CAS-style transition foundation and immutable completed-result fingerprint behavior.
- Production persistence, including generation enqueue/dispatch and claim/lease, uses MyBatis + explicit SQL; JPA and `JdbcTemplate` are absent from production code.
- Backend-authoritative, versioned MediaPlan foundation and job pinning.
- Character/Location continuity plus Scene/VisualBeat and Scene relation materialization foundations.
- Project-scoped Character list/detail read models are wired end to end and no longer use fabricated runtime Character data for fields covered by the API.
- Full-chapter TTS narration, alignment and immutable R2-backed narration media.
- User-provided narration foundation: `NarrationStrategy.USER_PROVIDED_AUDIO`, ordered variable-count audio parts, one logical global audio clock, fingerprints/alignment status and TTS-bypass operation planning.
- Cloudflare R2-only durable media topology.

## Primary V1.11 targets

- Preserve the completed MyBatis-only production boundary with architecture and PostgreSQL integration tests.
- Harden the production user-audio upload/finalize/alignment path.
- Build alignment-driven `VisualScenePlanner`.
- Implement the first production image-generation slice; `GENERATE_NEW` is allowed for the first vertical slice.
- Persist minimal immutable image `MediaAsset` before render completion.
- Deliver `IMAGE_MOTION` → validated R2-backed MP4 as the first complete long-form media path.
- Add reuse/reframe/edit resolution and `HYBRID_LOCAL_I2V` as fast-follow optimizations after the first durable MP4.

Derived documents are implementation views and must not redefine these invariants independently.
