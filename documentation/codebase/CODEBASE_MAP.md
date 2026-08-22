# NarrativeX Current Codebase Map — V1.11

**Canonical baseline:** `documentation/source-of-truth/NARRATIVEX_PROJECT_SPEC_V1_11.md`
**Docs-sync checkpoint:** `a614d05101a5992783cbc580668b4ed0927b41d9`

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
- All production backend persistence is MyBatis + explicit SQL.
- GenerationJob, StageAttempt, OperationPlan, MediaPlan, generation outbox enqueue/dispatch, Job History and the Chapter Analyze safety gate use MyBatis/explicit SQL.
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

The migration is complete: production source contains no JPA or `JdbcTemplate` persistence. MyBatis row models, mapper interfaces and explicit XML/SQL are guarded by architecture and PostgreSQL integration tests.

## Worker boundary

The worker owns execution mechanics, provider calls, alignment/media processing, lease/recovery and validation. It does not own public APIs, entitlement/authorization policy, MediaPlan authorization or Flyway.
