# NarrativeX Current Codebase Map — V1.11

**Canonical baseline:** `documentation/source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`
**Docs-sync checkpoint:** `29122c51a6d113ed7fd4026f7de3f5df75771153`

## Runtime layout

```text
app/backend-service/   Java 25 / Spring Boot modular monolith and durable policy/control plane
app/frontend-web/      Next.js 16 / React 19 studio UI
app/ai-worker/         Python 3.12 async AI/media execution worker
contracts/             versioned cross-runtime contracts
documentation/         V1.11 source, architecture, workflows, ADRs and evidence
Cloudflare R2          external managed durable media storage
```

## Current implementation highlights

- Project/Chapter/Analyze foundations are implemented.
- Project dashboard/favorite APIs and frontend dashboard wiring are implemented foundations.
- ProviderOperation, Chapter and Project persistence are MyBatis-backed.
- GenerationJob, StageAttempt, OperationPlan, MediaPlan, generation outbox enqueue and Job History have MyBatis/explicit-SQL production paths. Chapter Analyze has no application-owned pre-moderation gate. The outbox dispatcher retains a deliberate JDBC claim/lease query.
- Character + Location continuity and Scene relations are materialized by the worker.
- Project-scoped Character list/detail reads are backed by MyBatis and wired into `ProjectCharactersTab` and `CharacterDetailView`; covered fields no longer come from fabricated runtime data.
- Backend-authoritative MediaPlan foundation is implemented and generation jobs can be pinned to plan revision/policy.
- Full-chapter TTS narration/alignment with R2-backed immutable narration media is implemented as a foundation.
- User-provided narration foundation is merged: ordered audio parts, logical global clock, document/narration fingerprints, alignment status and TTS-bypass planning.
- Cloudflare R2 is the sole durable media store; local disk is scratch/cache only.

## Remaining media chain

```text
production audio upload/finalize + alignment hardening
  -> VisualScenePlanner
  -> production image generation
  -> immutable image MediaAsset
  -> IMAGE_MOTION render
  -> validated FinalArtifact in R2
```

Reuse/reframe/edit and HYBRID_LOCAL_I2V are fast-follow after the first durable MP4.

## Persistence direction

Remaining JPA/JDBC boundaries are migration work, not the final architecture. StoryVersion and quota/billing are the highest-priority remaining persistence boundaries, followed by storyboard/continuity and low-risk CRUD/query surfaces. Generation execution persistence is no longer a future migration item except for explicitly documented residual operational JDBC.

## Worker boundary

The worker owns execution mechanics, provider calls, alignment/media processing, lease/recovery and validation. It does not own public APIs, entitlement/authorization policy, MediaPlan authorization or Flyway.
